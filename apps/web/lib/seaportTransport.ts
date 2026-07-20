/**
 * Seaport backend proxy transport — fallback when the validator's own OIDC
 * client-credentials path (validator-devnet-m2m) can't submit commands
 * directly. Seaport's own UI writes go through its backend using the org's
 * Seaport session cookie, not the validator's Ledger API auth, and that path
 * is proven to work for contract creation.
 *
 * Endpoints (reverse-engineered from Seaport's own UI network calls — no
 * public API docs exist for this):
 *   POST /api/orgs/{org}/contracts/create
 *     { arguments, moduleName, packageId, party, templateName, validatorId }
 *   POST /api/orgs/{org}/contracts/exercise-choice
 *     { args, choiceName, contractId, party, templateId, validatorId }
 *   POST /api/orgs/{org}/contracts/active-contracts
 *     { moduleName, packageId, templateName, parties, validatorId }
 *
 * Auth: Cookie header with the org admin's `seaport_session` JWT (~30 day
 * expiry). This is a personal session, not an app credential — never log it,
 * never send it to the browser, backend-only.
 */

import type { AcsEntry } from "./ledger";

const API_BASE = process.env.SEAPORT_API_BASE!;
const ORG_SLUG = process.env.SEAPORT_ORG_SLUG!;
const VALIDATOR_ID = process.env.SEAPORT_VALIDATOR_ID!;
const SESSION_COOKIE = process.env.SEAPORT_SESSION_COOKIE!;

export class SeaportTransportError extends Error {
  constructor(
    public status: number,
    public body: string
  ) {
    super(`Seaport proxy ${status}: ${body}`);
    this.name = "SeaportTransportError";
  }
}

async function seaportPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${API_BASE}/orgs/${ORG_SLUG}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: SESSION_COOKIE,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON body; fall through with raw text in the error
  }

  // Seaport returns 200 with a top-level "error" field on some failures
  // (observed on exercise-choice), not just non-2xx status codes.
  const obj = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
  const errMsg = obj && "error" in obj
    ? [obj.error, obj.message, obj.details].filter(Boolean).map(String).join(" | ")
    : null;

  if (!res.ok || errMsg) {
    throw new SeaportTransportError(res.status, errMsg ?? text);
  }

  return json;
}

/** Split a "pkg:Module.Sub:Template" style templateId into Seaport's separate fields. */
function splitTemplateId(templateId: string): {
  packageId: string;
  moduleName: string;
  templateName: string;
} {
  const [pkg, mod, tmpl] = templateId.split(":");
  if (!pkg || !mod || !tmpl) {
    throw new Error(`Malformed templateId for Seaport transport: ${templateId}`);
  }
  return { packageId: pkg, moduleName: mod, templateName: tmpl };
}

/**
 * Create a contract via Seaport. Mirrors ledger.ts#createContract's contract:
 * callers re-query ACS afterward for the resulting contractId, so success is
 * all that's strictly required — but the response also carries a real
 * `resultData.transaction.updateId`, which we surface for explorer links
 * (see lib/explorer.ts). Confirmed present via direct empirical probe
 * (2026-07-20); defensively optional in case the shape varies.
 */
export async function seaportCreateContract(
  templateId: string,
  createArguments: Record<string, unknown>,
  party: string
): Promise<{ updateId: string | null }> {
  const { packageId, moduleName, templateName } = splitTemplateId(templateId);
  const json = (await seaportPost("/contracts/create", {
    arguments: createArguments,
    moduleName,
    packageId,
    party,
    templateName,
    validatorId: VALIDATOR_ID,
  })) as { resultData?: { transaction?: { updateId?: string } } } | null;

  return { updateId: json?.resultData?.transaction?.updateId ?? null };
}

/**
 * Exercise a choice via Seaport. Same contract as ledger.ts#exerciseChoice —
 * callers re-query ACS for outcome contracts (receipt/violation/pending).
 *
 * IMPORTANT: `party` must be the actual choice controller (e.g. the mandate's
 * `agent` party for RequestAction, `principal` for Pause/Revoke) — Seaport's
 * Contract Factory UI can auto-fill an unrelated default operator party,
 * which fails with a generic "Authentication failed" error that is really an
 * authorization/wrong-actAs-party problem, not a credentials problem.
 */
export async function seaportExerciseChoice(
  templateId: string,
  contractId: string,
  choiceName: string,
  choiceArgument: Record<string, unknown>,
  party: string
): Promise<void> {
  await seaportPost("/contracts/exercise-choice", {
    args: choiceArgument,
    choiceName,
    contractId,
    party,
    templateId,
    validatorId: VALIDATOR_ID,
  });
}

interface SeaportContractRow {
  contractId: string;
  templateId: string;
  arguments: Record<string, unknown>;
  isArchived: boolean;
  status: string;
}

interface SeaportActiveContractsResponse {
  page: number;
  pageSize: number;
  result: SeaportContractRow[];
}

/**
 * Query active contracts via Seaport, scoped to a template and party.
 * Confirmed response shape (2026-07-19):
 *   { page, pageSize, result: [{ contractId, templateId, arguments,
 *     isArchived, status, moduleName, packageId, templateName, ... }] }
 * Paginated (pageSize observed as 20) — loops until a short page is returned.
 * Filters isArchived/status defensively even though the endpoint appears to
 * already scope to active contracts, in case that changes.
 */
export async function seaportQueryAcs(
  templateId: string,
  party: string
): Promise<AcsEntry[]> {
  const { packageId, moduleName, templateName } = splitTemplateId(templateId);
  const results: AcsEntry[] = [];
  let page = 1;

  for (;;) {
    const json = (await seaportPost("/contracts/active-contracts", {
      moduleName,
      packageId,
      templateName,
      parties: [party],
      validatorId: VALIDATOR_ID,
      page,
    })) as SeaportActiveContractsResponse | null;

    const rows = json?.result ?? [];
    for (const row of rows) {
      if (row.isArchived || row.status === "archived") continue;
      results.push({
        contractId: row.contractId,
        templateId: row.templateId ?? templateId,
        payload: row.arguments ?? {},
      });
    }

    const pageSize = json?.pageSize ?? rows.length;
    if (rows.length < pageSize || rows.length === 0) break;
    page += 1;
  }

  return results;
}

export function isSeaportEnabled(): boolean {
  return process.env.LEDGER_AUTH_MODE === "seaport-proxy";
}
