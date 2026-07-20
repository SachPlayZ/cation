import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, handleError } from "@/lib/apiResponse";
import { queryAcs, tid } from "@/lib/ledger";
import { partyToLabel } from "@/lib/partyMap";

export async function GET(req: NextRequest) {
  try {
    const jwt = await requireAuth(req, ["cfo"]);

    const pendings = await queryAcs(
      jwt.party,
      tid("Cation.Mandate", "PendingApproval")
    );

    const items = pendings.map((entry) => {
      const p = entry.payload;
      return {
        pendingId: entry.contractId,
        requestId: String(p["requestId"] ?? ""),
        amount: String(p["amount"] ?? ""),
        currency: String(p["currency"] ?? ""),
        counterpartyLabel: partyToLabel(String(p["counterparty"] ?? "")),
        category: extractTag(p["category"]),
        purpose: String(p["purpose"] ?? ""),
        createdAt: String(p["createdAt"] ?? ""),
      };
    });

    // Sort oldest-first so approvers see the queue in order.
    items.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));

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
