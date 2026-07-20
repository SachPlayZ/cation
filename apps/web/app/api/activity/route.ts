import { NextRequest } from "next/server";
import { requireAuth, type Role } from "@/lib/auth";
import { ok, handleError } from "@/lib/apiResponse";
import { queryAcs, tid } from "@/lib/ledger";
import { partyToLabel } from "@/lib/partyMap";

interface ActivityItem {
  type: "receipt" | "violation" | "pending" | "mandate-event";
  requestId: string;
  amount?: string;
  currency?: string;
  counterpartyLabel?: string;
  code?: string;
  category?: string;
  at: string;
  detail: string;
}

/**
 * GET /api/activity — party-scoped ACS query, NO client-side cross-party filtering.
 * Each role sees only what their Canton party can see on the ledger.
 */
export async function GET(req: NextRequest) {
  try {
    const jwt = await requireAuth(req);
    const party = jwt.party;
    const role = jwt.role as Role;

    const items: ActivityItem[] = [];

    // Role-gated template queries. The LEDGER enforces visibility;
    // we only query templates the caller's party is a stakeholder of.
    if (role === "cfo" || role === "agent" || role === "recipient") {
      const receipts = await queryAcs(
        party,
        tid("Cation.Mandate", "ExecutionReceipt")
      );
      for (const r of receipts) {
        const p = r.payload;
        items.push({
          type: "receipt",
          requestId: String(p["requestId"] ?? ""),
          amount: String(p["amount"] ?? ""),
          currency: String(p["currency"] ?? ""),
          counterpartyLabel: partyToLabel(String(p["recipient"] ?? "")),
          at: String(p["executedAt"] ?? ""),
          detail: `Payment executed to ${partyToLabel(String(p["recipient"] ?? ""))}`,
        });
      }
    }

    if (role === "cfo" || role === "agent" || role === "compliance") {
      const violations = await queryAcs(
        party,
        tid("Cation.Mandate", "PolicyViolation")
      );
      for (const v of violations) {
        const p = v.payload;
        items.push({
          type: "violation",
          requestId: String(p["requestId"] ?? ""),
          amount: String(p["amount"] ?? ""),
          counterpartyLabel: partyToLabel(String(p["counterparty"] ?? "")),
          code: String(p["code"] ?? ""),
          category: extractTag(p["category"]),
          at: String(p["occurredAt"] ?? ""),
          detail: String(p["code"] ?? "DENIED"),
        });
      }
    }

    if (role === "cfo" || role === "agent") {
      const pendings = await queryAcs(
        party,
        tid("Cation.Mandate", "PendingApproval")
      );
      for (const pending of pendings) {
        const p = pending.payload;
        items.push({
          type: "pending",
          requestId: String(p["requestId"] ?? ""),
          amount: String(p["amount"] ?? ""),
          currency: String(p["currency"] ?? ""),
          counterpartyLabel: partyToLabel(String(p["counterparty"] ?? "")),
          category: extractTag(p["category"]),
          at: String(p["createdAt"] ?? ""),
          detail: "Awaiting approval",
        });
      }
    }

    // Sort newest first (ISO timestamp strings sort lexicographically).
    items.sort((a, b) => (b.at > a.at ? 1 : -1));

    return ok({ items });
  } catch (err) {
    return handleError(err);
  }
}

function extractTag(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "tag" in v) return (v as { tag: string }).tag;
  return String(v ?? "");
}
