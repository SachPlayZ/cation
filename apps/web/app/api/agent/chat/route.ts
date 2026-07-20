import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, apiError, handleError } from "@/lib/apiResponse";
import { getMandateView, getTreasuryDeposit } from "@/lib/mandateUtils";
import { queryAcs, exerciseChoice, tid, isContentionError } from "@/lib/ledger";
import { resolveCounterparty, getAllCounterparties } from "@/lib/partyMap";
import { explorerPartyUrl } from "@/lib/explorer";
import { runAgentTurn, type ProposedAction } from "@cation/agent";
import { z } from "zod";
import { randomUUID } from "crypto";

const ChatBody = z.object({ message: z.string().min(1).max(4000) });

export async function POST(req: NextRequest) {
  try {
    const jwt = await requireAuth(req, ["agent"]);
    const { message } = ChatBody.parse(await req.json());

    const agentParty = process.env.PARTY_AGENT!;
    const cfoParty = process.env.PARTY_CFO!;

    const mandateView = await getMandateView(agentParty);
    if (!mandateView) {
      return apiError(404, "NOT_FOUND", "No active mandate for agent");
    }

    const allowedCounterparties = getAllCounterparties().map((c) => c.label);

    const { reply, proposedAction } = await runAgentTurn(message, {
      allowedCounterparties,
      currency: mandateView.currency,
      mandateStatus: mandateView.status,
    });

    if (!proposedAction) {
      return ok({ reply, action: null });
    }

    // Narrow type: proposedAction is non-null in this branch.
    // requestId is generated server-side, never trusted from the LLM — models
    // reliably copy the example ID from the prompt verbatim instead of
    // randomizing, which would collide with the on-ledger duplicate-request
    // guard and be misread as a stale prior outcome.
    const action: ProposedAction = {
      ...proposedAction,
      requestId: `req_${randomUUID().replace(/-/g, "").slice(0, 10)}`,
    };

    const counterpartyParty = resolveCounterparty(action.counterpartyId);
    if (!counterpartyParty) {
      return ok({
        reply: `${reply}\n\nNote: Counterparty "${action.counterpartyId}" is not in the approved list. Action blocked.`,
        action: null,
      });
    }

    // Daml nullary variants (enums like ActionCategory) are JSON-encoded as
    // plain strings by Canton's Ledger API, not {tag, value} objects.
    const categoryVariant = action.actionType;

    const submitAction = async (): Promise<{
      outcome: "executed" | "pending" | "denied";
      denialCode: string | null;
      receiptId: string | null;
    }> => {
      const state = await getMandateView(agentParty);
      if (!state) throw new Error("Mandate state disappeared");

      const deposit = await getTreasuryDeposit(cfoParty);
      if (!deposit) {
        return { outcome: "denied", denialCode: "INSUFFICIENT_FUNDS", receiptId: null };
      }

      await exerciseChoice(
        tid("Cation.Mandate", "AgentMandateState"),
        state._stateCid,
        "RequestAction",
        {
          requestId: action.requestId,
          category: categoryVariant,
          amount: action.amount,
          reqCurrency: action.currency,
          counterparty: counterpartyParty,
          purpose: action.purpose,
          depositCid: deposit.contractId,
        },
        {
          actAs: [agentParty],
          readAs: [cfoParty],
          commandId: `req-action-${action.requestId}`,
        }
      );

      return detectOutcome(agentParty, action.requestId);
    };

    let result: Awaited<ReturnType<typeof submitAction>>;
    try {
      result = await submitAction();
    } catch (err) {
      if (isContentionError(err)) {
        result = await submitAction();
      } else {
        throw err;
      }
    }

    return ok({
      reply,
      action: {
        requestId: action.requestId,
        category: action.actionType,
        amount: action.amount,
        counterpartyId: action.counterpartyId,
        purpose: action.purpose,
        outcome: result.outcome,
        denialCode: result.denialCode,
        receiptId: result.receiptId,
        explorerUrl: explorerPartyUrl(agentParty),
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * After RequestAction, query ACS to determine which branch executed.
 * The consuming choice always succeeds; the branch is visible in newly
 * created contracts: ExecutionReceipt, PendingApproval, or PolicyViolation.
 */
async function detectOutcome(
  agentParty: string,
  requestId: string
): Promise<{
  outcome: "executed" | "pending" | "denied";
  denialCode: string | null;
  receiptId: string | null;
}> {
  const [receipts, pendings, violations] = await Promise.all([
    queryAcs(agentParty, tid("Cation.Mandate", "ExecutionReceipt")),
    queryAcs(agentParty, tid("Cation.Mandate", "PendingApproval")),
    queryAcs(agentParty, tid("Cation.Mandate", "PolicyViolation")),
  ]);

  const receipt = receipts.find((r) => r.payload["requestId"] === requestId);
  if (receipt) {
    return { outcome: "executed", denialCode: null, receiptId: receipt.contractId };
  }

  const pending = pendings.find((p) => p.payload["requestId"] === requestId);
  if (pending) {
    return { outcome: "pending", denialCode: null, receiptId: null };
  }

  const violation = violations.find((v) => v.payload["requestId"] === requestId);
  if (violation) {
    return {
      outcome: "denied",
      denialCode: String(violation.payload["code"] ?? "UNKNOWN"),
      receiptId: null,
    };
  }

  // Should not reach here if the ledger is consistent.
  throw new Error("Outcome not determinable — possible ledger lag or contention");
}
