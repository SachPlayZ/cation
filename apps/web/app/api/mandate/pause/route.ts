import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, apiError, handleError } from "@/lib/apiResponse";
import { getMandateView } from "@/lib/mandateUtils";
import { exerciseChoice, tid } from "@/lib/ledger";

export async function POST(req: NextRequest) {
  try {
    const jwt = await requireAuth(req, ["cfo"]);
    const cfoParty = process.env.PARTY_CFO!;

    const view = await getMandateView(jwt.party);
    if (!view) return apiError(404, "NOT_FOUND", "No active mandate");
    if (view.status !== "Active") {
      return apiError(409, "INVALID_STATE", `Cannot pause a ${view.status} mandate`);
    }

    await exerciseChoice(
      tid("Cation.Mandate", "AgentMandateState"),
      view._stateCid,
      "PauseMandate",
      {},
      { actAs: [cfoParty], commandId: `pause-${view.mandateId}-${Date.now()}` }
    );

    const updated = await getMandateView(jwt.party);
    if (!updated) return apiError(502, "LEDGER_ERROR", "State not found after pause");
    const { _stateCid: _, _termsCid: __, _depositCid: ___, ...out } = updated;
    return ok(out);
  } catch (err) {
    return handleError(err);
  }
}
