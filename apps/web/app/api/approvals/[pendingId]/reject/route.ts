import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, apiError, handleError } from "@/lib/apiResponse";
import { exerciseChoice, tid } from "@/lib/ledger";
import { explorerPartyUrl } from "@/lib/explorer";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pendingId: string }> }
) {
  try {
    const jwt = await requireAuth(req, ["cfo"]);
    const { pendingId } = await params;
    if (!pendingId) return apiError(400, "BAD_REQUEST", "pendingId required");

    const cfoParty = process.env.PARTY_CFO!;
    const complianceParty = process.env.PARTY_COMPLIANCE!;

    await exerciseChoice(
      tid("Cation.Mandate", "PendingApproval"),
      pendingId,
      "RejectRequest",
      { complianceParty },
      {
        actAs: [cfoParty],
        commandId: `reject-${pendingId}-${Date.now()}`,
      }
    );

    return ok({ ok: true, explorerUrl: explorerPartyUrl(cfoParty) });
  } catch (err) {
    return handleError(err);
  }
}
