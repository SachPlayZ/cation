import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, apiError, handleError } from "@/lib/apiResponse";
import { getMandateView, getTreasuryDeposit } from "@/lib/mandateUtils";
import { queryAcs, exerciseChoice, tid, isContentionError } from "@/lib/ledger";
import { explorerPartyUrl } from "@/lib/explorer";

type ApproveOutcome = {
  outcome: "executed" | "denied";
  denialCode: string | null;
  explorerUrl: string;
};

const doApprove = async (
  cfoParty: string,
  agentParty: string,
  pendingId: string
): Promise<ApproveOutcome> => {
  const state = await getMandateView(cfoParty);
  if (!state) throw new Error("Mandate state not found");

  const deposit = await getTreasuryDeposit(cfoParty);
  if (!deposit) {
    return {
      outcome: "denied",
      denialCode: "INSUFFICIENT_FUNDS",
      explorerUrl: explorerPartyUrl(cfoParty),
    };
  }

  // ApproveRequest on PendingApproval → internally exercises ExecuteApprovedAction on state
  await exerciseChoice(
    tid("Cation.Mandate", "PendingApproval"),
    pendingId,
    "ApproveRequest",
    {
      stateCid: state._stateCid,
      depositCid: deposit.contractId,
    },
    {
      actAs: [cfoParty],
      readAs: [agentParty],
      commandId: `approve-${pendingId}-${Date.now()}`,
    }
  );

  // Detect outcome: after ExecuteApprovedAction the mandate re-evaluates.
  // Either ExecutionReceipt (success) or PolicyViolation (re-evaluated denial).
  const [receipts, violations] = await Promise.all([
    queryAcs(cfoParty, tid("Cation.Mandate", "ExecutionReceipt")),
    queryAcs(cfoParty, tid("Cation.Mandate", "PolicyViolation")),
  ]);

  if (receipts.length > 0) {
    const latest = receipts.reduce((a, b) =>
      String(b.payload["executedAt"] ?? "") > String(a.payload["executedAt"] ?? "")
        ? b
        : a
    );
    if (latest) {
      return {
        outcome: "executed",
        denialCode: null,
        explorerUrl: explorerPartyUrl(cfoParty),
      };
    }
  }

  if (violations.length > 0) {
    const latest = violations.reduce((a, b) =>
      String(b.payload["occurredAt"] ?? "") > String(a.payload["occurredAt"] ?? "")
        ? b
        : a
    );
    if (latest) {
      return {
        outcome: "denied",
        denialCode: String(latest.payload["code"] ?? "UNKNOWN"),
        explorerUrl: explorerPartyUrl(cfoParty),
      };
    }
  }

  return {
    outcome: "executed",
    denialCode: null,
    explorerUrl: explorerPartyUrl(cfoParty),
  };
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pendingId: string }> }
) {
  try {
    const jwt = await requireAuth(req, ["cfo"]);
    const { pendingId } = await params;
    if (!pendingId) return apiError(400, "BAD_REQUEST", "pendingId required");

    const cfoParty = process.env.PARTY_CFO!;
    const agentParty = process.env.PARTY_AGENT!;

    let result: ApproveOutcome;
    try {
      result = await doApprove(cfoParty, agentParty, pendingId);
    } catch (err) {
      if (isContentionError(err)) {
        result = await doApprove(cfoParty, agentParty, pendingId);
      } else {
        throw err;
      }
    }

    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
