import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, apiError, handleError } from "@/lib/apiResponse";
import { getMandateView } from "@/lib/mandateUtils";
import { createContract, exerciseChoice, tid } from "@/lib/ledger";
import { getAllCounterparties } from "@/lib/partyMap";
import { canonicalMandateMessage } from "@/lib/mandateSigning";
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
  // Real Loop Wallet signature over these exact terms — required, not
  // optional. See lib/mandateSigning.ts for the canonical message the
  // client signs and this route recomputes to verify content-binding.
  //
  // KNOWN LIMITATION: this checks that a non-empty signature was produced
  // and that it covers the exact submitted terms (preventing a signature
  // for one mandate being replayed against different terms) — it does NOT
  // cryptographically verify the signature against the wallet's public key.
  // Loop SDK does not document a byte-exact signing/verification scheme, so
  // implementing Ed25519 verification blind risked silently accepting or
  // rejecting incorrectly, which is worse than disclosing the gap.
  walletPartyId: z.string().min(1, "Loop Wallet signature is required"),
  walletSignature: z.string().min(1, "Loop Wallet signature is required"),
  signedMessage: z.string().min(1, "Loop Wallet signature is required"),
});

// POST /api/mandate — cfo only; creates offer then auto-accepts as agent (demo flow)
export async function POST(req: NextRequest) {
  try {
    const jwt = await requireAuth(req, ["cfo"]);
    const body = CreateMandateBody.parse(await req.json());

    // Content-binding check: the signed message must exactly match the
    // terms actually being submitted, so a signature can't be replayed
    // against different limits/counterparties than the wallet approved.
    const expectedMessage = canonicalMandateMessage({
      autoApproveLimit: body.autoApproveLimit,
      perActionMaximum: body.perActionMaximum,
      dailyMaximum: body.dailyMaximum,
      monthlyMaximum: body.monthlyMaximum,
      expiresAt: body.expiresAt,
      counterpartyIds: body.counterpartyIds,
      categories: body.categories,
    });
    if (body.signedMessage !== expectedMessage) {
      return apiError(
        400,
        "SIGNATURE_MISMATCH",
        "Signed message does not match the submitted mandate terms"
      );
    }

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
    return ok({
      ...out,
      walletProof: {
        partyId: body.walletPartyId,
        verified: false as const,
        note: "Signature content-bound to submitted terms; not cryptographically verified server-side.",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
