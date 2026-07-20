/**
 * Canton JSON Ledger API v2 client.
 *
 * Verified endpoints (from docs.canton.network/llms.txt + tutorial M4):
 *   POST /v2/commands/submit-and-wait        — submit command, wait for commit
 *   POST /v2/state/active-contracts          — query ACS at a given offset
 *   GET  /v2/state/ledger-end               — current ledger offset
 *
 * Template ID format: "#packageName:Module.Name:TemplateName"
 *   e.g. "#cation:Cation.Mandate:AgentMandateState"
 *   Falls back to "${PACKAGE_ID}:Module.Name:TemplateName" if PACKAGE_ID is set.
 *
 * Request shape for submit-and-wait (verified from Canton network quickstart tutorial):
 *   { commands: [CreateCommand | ExerciseCommand], actAs, readAs,
 *     commandId, applicationId, workflowId, submissionId,
 *     disclosedContracts, domainId, packageIdSelectionPreference }
 *
 * ACS response: JSON array of items each containing { createdEvent: { contractId, templateId, createArgument } }
 * (Defensive parsing handles alternate nesting variants.)
 */

import { getLedgerToken } from "./ledgerAuth";
import {
  isSeaportEnabled,
  seaportCreateContract,
  seaportExerciseChoice,
  seaportQueryAcs,
  SeaportTransportError,
} from "./seaportTransport";

const LEDGER_URL = process.env.LEDGER_API_URL!;
const APP_ID = "cation-app";

export interface AcsEntry {
  contractId: string;
  templateId: string;
  /** Deserialized Daml-LF JSON payload (createArgument). */
  payload: Record<string, unknown>;
}

/** Build a template ID string from module + template name. */
export function tid(module: string, template: string): string {
  const pkg = process.env.PACKAGE_ID;
  if (pkg) return `${pkg}:${module}:${template}`;
  return `#cation:${module}:${template}`;
}

/** Get current ledger end offset (used as activeAtOffset in ACS queries). */
async function getLedgerEnd(party: string): Promise<number> {
  const token = await getLedgerToken(party);
  const res = await fetch(`${LEDGER_URL}/v2/state/ledger-end`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new LedgerError(res.status, await res.text());
  const json = (await res.json()) as { offset?: number; ledgerEnd?: number };
  // Field name varies across Canton versions — try both.
  return json.offset ?? json.ledgerEnd ?? 0;
}

class LedgerError extends Error {
  constructor(
    public status: number,
    public body: string
  ) {
    super(`Ledger API ${status}: ${body}`);
    this.name = "LedgerError";
  }
}

interface SubmitOpts {
  actAs: string[];
  readAs?: string[];
  commandId?: string;
  workflowId?: string;
}

interface CreateCommand {
  CreateCommand: {
    templateId: string;
    createArguments: Record<string, unknown>;
  };
}

interface ExerciseCommand {
  ExerciseCommand: {
    templateId: string;
    contractId: string;
    choice: string;
    choiceArgument: Record<string, unknown>;
  };
}

type Command = CreateCommand | ExerciseCommand;

interface SubmitResult {
  updateId: string;
  completionOffset: number;
}

async function submitAndWait(
  commands: Command[],
  opts: SubmitOpts
): Promise<SubmitResult> {
  // Use first actAs party for auth token; that party must have ledger access.
  const party = opts.actAs[0];
  const token = await getLedgerToken(party);

  const body = {
    commands,
    actAs: opts.actAs,
    readAs: opts.readAs ?? [],
    applicationId: APP_ID,
    commandId:
      opts.commandId ??
      `${APP_ID}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workflowId: opts.workflowId ?? APP_ID,
    submissionId: opts.commandId ?? `sub-${Date.now()}`,
    disclosedContracts: [],
    domainId: "",
    packageIdSelectionPreference: [],
  };

  const res = await fetch(`${LEDGER_URL}/v2/commands/submit-and-wait`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new LedgerError(res.status, text);
  }

  const json = (await res.json()) as {
    updateId?: string;
    completionOffset?: number;
    update_id?: string;
    completion_offset?: number;
  };

  return {
    updateId: json.updateId ?? json.update_id ?? "",
    // Offset may be returned as number or string depending on Canton version.
    completionOffset: Number(
      json.completionOffset ?? json.completion_offset ?? 0
    ),
  };
}

/**
 * Create a contract and return the completion offset.
 * To retrieve the created contractId, call queryAcs after this returns.
 */
export async function createContract(
  templateId: string,
  createArguments: Record<string, unknown>,
  opts: SubmitOpts
): Promise<SubmitResult> {
  if (isSeaportEnabled()) {
    const { updateId } = await seaportCreateContract(
      templateId,
      createArguments,
      opts.actAs[0]
    );
    return { updateId: updateId ?? "", completionOffset: 0 };
  }
  return submitAndWait(
    [{ CreateCommand: { templateId, createArguments } }],
    opts
  );
}

/**
 * Exercise a choice on a contract.
 * Returns updateId + completionOffset.
 * Callers that need outcome data should query ACS after this returns.
 */
export async function exerciseChoice(
  templateId: string,
  contractId: string,
  choice: string,
  choiceArgument: Record<string, unknown>,
  opts: SubmitOpts
): Promise<SubmitResult> {
  if (isSeaportEnabled()) {
    await seaportExerciseChoice(templateId, contractId, choice, choiceArgument, opts.actAs[0]);
    return { updateId: "", completionOffset: 0 };
  }
  return submitAndWait(
    [{ ExerciseCommand: { templateId, contractId, choice, choiceArgument } }],
    opts
  );
}

/**
 * Check if an error indicates a consumed/archived contract (contention).
 * The ledger returns 409 or a body containing CONTRACT_NOT_FOUND / ABORTED.
 */
export function isContentionError(err: unknown): boolean {
  if (err instanceof LedgerError) {
    return (
      err.status === 409 ||
      err.body.includes("CONTRACT_NOT_FOUND") ||
      err.body.includes("ABORTED") ||
      err.body.includes("NOT_FOUND")
    );
  }
  if (err instanceof SeaportTransportError) {
    return (
      err.status === 409 ||
      err.body.includes("CONTRACT_NOT_FOUND") ||
      err.body.includes("ABORTED") ||
      err.body.includes("NOT_FOUND")
    );
  }
  return false;
}

/**
 * Query active contracts visible to `party`, optionally filtered by templateId.
 * Uses the current ledger end as the snapshot point.
 *
 * ACS query body (verified from Canton network M4 tutorial):
 *   POST /v2/state/active-contracts
 *   { eventFormat: { filtersByParty: { <party>: { cumulative: [ { identifierFilter: ... } ] } }, verbose: true }, activeAtOffset: <n> }
 *
 * Response: JSON array, each element may be:
 *   { createdEvent: { contractId, templateId, createArgument } }
 *   or nested under contractEntry/activeContract.
 */
export async function queryAcs(
  party: string,
  templateId?: string
): Promise<AcsEntry[]> {
  if (isSeaportEnabled()) {
    if (!templateId) {
      throw new Error(
        "queryAcs via Seaport transport requires a templateId (wildcard queries are not supported by the proxy)"
      );
    }
    return seaportQueryAcs(templateId, party);
  }

  const token = await getLedgerToken(party);
  const offset = await getLedgerEnd(party);

  const identifierFilter = templateId
    ? {
        TemplateFilter: {
          value: { templateId, includeCreatedEventBlob: false },
        },
      }
    : {
        WildcardFilter: { value: { includeCreatedEventBlob: false } },
      };

  const body = {
    eventFormat: {
      filtersByParty: {
        [party]: {
          cumulative: [{ identifierFilter }],
        },
      },
      verbose: true,
    },
    activeAtOffset: offset,
  };

  const res = await fetch(`${LEDGER_URL}/v2/state/active-contracts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new LedgerError(res.status, text);
  }

  const raw = await res.text();
  return parseAcsResponse(raw);
}

/**
 * Parse ACS response body.
 * Handles JSON array (primary), NDJSON (fallback), and variant nesting patterns.
 */
function parseAcsResponse(raw: string): AcsEntry[] {
  let items: unknown[];

  // Try JSON array first, then NDJSON.
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    items = JSON.parse(trimmed) as unknown[];
  } else {
    items = trimmed
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as unknown);
  }

  const results: AcsEntry[] = [];
  for (const item of items) {
    const event = extractCreatedEvent(item);
    if (event) results.push(event);
  }
  return results;
}

function extractCreatedEvent(item: unknown): AcsEntry | null {
  if (!item || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;

  // Try multiple nesting patterns from different Canton versions.
  const ce =
    obj["createdEvent"] ??
    (obj["contractEntry"] as Record<string, unknown> | undefined)?.[
      "createdEvent"
    ] ??
    (obj["activeContract"] as Record<string, unknown> | undefined)?.[
      "createdEvent"
    ] ??
    (obj["contractEntry"] as Record<string, unknown> | undefined)?.[
      "activeContract"
    ];

  if (!ce || typeof ce !== "object") return null;
  const event = ce as Record<string, unknown>;

  const contractId = event["contractId"] as string | undefined;
  const templateId = event["templateId"] as string | undefined;
  // Canton uses "createArgument" (singular) per tutorial evidence.
  const payload =
    (event["createArgument"] as Record<string, unknown> | undefined) ??
    (event["createArguments"] as Record<string, unknown> | undefined) ??
    {};

  if (!contractId || !templateId) return null;
  return { contractId, templateId, payload };
}

// Re-export the error class so callers can catch it.
export { LedgerError };
