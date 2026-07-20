import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, apiError, handleError } from "@/lib/apiResponse";
import { getMandateView } from "@/lib/mandateUtils";
import { createContract, exerciseChoice, tid } from "@/lib/ledger";
import { getAllCounterparties } from "@/lib/partyMap";
import { randomUUID } from "crypto";
import { z } from "zod";

// GET /api/mandate — cfo or agent
export async function GET(req: NextRequest) {
  try {
    const jwt = await requireAuth(req, ["cfo", "agent"]);
    const view = await getMandateView(jwt.party);
    if (!view) return apiError(404, "NOT_FOUND", "No active mandate");

    // Strip internal fields before returning.
    const { _stateCid: _, _termsCid: __, _depositCid: ___, ...out } = view;
    return ok(out);
  } catch (err) {
    return handleError(err);
  }
}

const CreateMandateBody = z.object({
  autoApproveLimit: z.string(),
  perActionMaximum: z.string(),
  dailyMaximum: z.string(),
  monthlyMaximum: z.string(),
  expiresAt: z.string(),
  counterpartyIds: z.array(z.string()),
  categories: z.array(z.string()),
});

// POST /api/mandate — cfo only; creates offer then auto-accepts as agent (demo flow)
export async function POST(req: NextRequest) {
  try {
    const jwt = await requireAuth(req, ["cfo"]);
    const body = CreateMandateBody.parse(await req.json());

    const cfoParty = process.env.PARTY_CFO!;
    const agentParty = process.env.PARTY_AGENT!;
    const complianceParty = process.env.PARTY_COMPLIANCE!;

    // Resolve counterpartyIds (labels) → party IDs
    const cpMap = Object.fromEntries(
      getAllCounterparties().map((c) => [c.label, c.party])
    );
    const counterpartyParties = body.counterpartyIds
      .map((id) => cpMap[id] ?? id)
      .filter(Boolean);

    // Daml nullary variants (enums like ActionCategory) are JSON-encoded as
    // plain strings by Canton's Ledger API, not {tag, value} objects.
    const permittedCategories = body.categories;

    const mandateId = `mandate-${randomUUID().slice(0, 8)}`;

    // Period reset boundaries — start of next UTC day/month from now
    const now = new Date();
    const dailyResetAt = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    ).toISOString();
    const monthlyResetAt = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
    ).toISOString();

    // 1. Create MandateOffer as cfo
    const offerResult = await createContract(
      tid("Cation.Mandate", "MandateOffer"),
      {
        mandateId,
        principal: cfoParty,
        agent: agentParty,
        approver: cfoParty,
        compliance: complianceParty,
        permittedCategories,
        permittedCounterparties: counterpartyParties,
        autoApproveLimit: body.autoApproveLimit,
        perActionMaximum: body.perActionMaximum,
        dailyMaximum: body.dailyMaximum,
        monthlyMaximum: body.monthlyMaximum,
        currency: "USD",
        expiresAt: body.expiresAt,
        dailyResetAt,
        monthlyResetAt,
      },
      { actAs: [cfoParty], commandId: `create-offer-${mandateId}` }
    );

    // 2. Find the created MandateOffer by mandateId from ACS
    const { queryAcs } = await import("@/lib/ledger");
    const offerEntries = await queryAcs(
      agentParty,
      tid("Cation.Mandate", "MandateOffer")
    );
    const offerEntry = offerEntries.find(
      (e) => e.payload["mandateId"] === mandateId
    );
    if (!offerEntry) {
      return apiError(502, "LEDGER_ERROR", "MandateOffer not found after create");
    }

    // 3. Exercise AcceptMandate as agent (demo auto-accept)
    await exerciseChoice(
      tid("Cation.Mandate", "MandateOffer"),
      offerEntry.contractId,
      "AcceptMandate",
      {},
      { actAs: [agentParty], commandId: `accept-mandate-${mandateId}` }
    );

    // 4. Return mandate view. Prefer a real transaction-deep-link over the
    // generic party-activity link when the create call gave us one.
    const view = await getMandateView(jwt.party);
    if (!view) {
      return apiError(502, "LEDGER_ERROR", "Mandate not visible after accept");
    }
    if (offerResult.updateId) {
      const { explorerTransactionUrl } = await import("@/lib/explorer");
      view.explorerUrl = explorerTransactionUrl(offerResult.updateId);
    }
    const { _stateCid: _, _termsCid: __, _depositCid: ___, ...out } = view;
    return ok(out);
  } catch (err) {
    return handleError(err);
  }
}
