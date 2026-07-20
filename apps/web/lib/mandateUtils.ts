/**
 * Helpers for fetching and shaping mandate data from the ledger ACS.
 * Both MandateTerms and AgentMandateState must be queried to produce
 * the full mandate view returned by GET /api/mandate.
 */

import { queryAcs, tid, type AcsEntry } from "./ledger";
import { partyToLabel } from "./partyMap";
import { explorerPartyUrl } from "./explorer";

export interface MandateView {
  mandateId: string;
  status: "Active" | "Paused" | "Revoked";
  autoApproveLimit: string;
  perActionMaximum: string;
  dailyMaximum: string;
  monthlyMaximum: string;
  dailySpent: string;
  monthlySpent: string;
  currency: string;
  expiresAt: string;
  permittedCategories: string[];
  counterparties: { party: string; label: string }[];
  version: number;
  explorerUrl: string;
  // Internal — needed for ledger operations, not returned to client.
  _stateCid: string;
  _termsCid: string;
  _depositCid?: string;
}

/** Extract the tag string from a Daml variant/enum JSON value. */
function variantTag(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "tag" in v)
    return (v as { tag: string }).tag;
  return String(v);
}

function decimalStr(v: unknown): string {
  return String(v ?? "0");
}

/**
 * Query ledger for the current active MandateTerms + AgentMandateState.
 * Returns null if no active mandate exists.
 * `party` must be either the cfo (principal) or agent — both are stakeholders.
 */
export async function getMandateView(
  party: string
): Promise<MandateView | null> {
  const [stateEntries, termsEntries] = await Promise.all([
    queryAcs(party, tid("Cation.Mandate", "AgentMandateState")),
    queryAcs(party, tid("Cation.Mandate", "MandateTerms")),
  ]);

  if (stateEntries.length === 0) return null;

  // Multiple independent mandate chains can coexist for the same party (no
  // contract keys in Daml 3.x to enforce "one mandate" — each create starts
  // a fresh chain). Prefer an Active mandate over a Paused/Revoked one from
  // an older chain; only pick version highest-wins WITHIN the preferred
  // status group, never across different mandateIds by raw version number.
  const byStatus = (status: string) =>
    stateEntries.filter((e) => variantTag(e.payload["status"]) === status);
  const candidates =
    byStatus("Active").length > 0
      ? byStatus("Active")
      : byStatus("Paused").length > 0
        ? byStatus("Paused")
        : stateEntries;

  const stateEntry = candidates.reduce((best, cur) => {
    const bestV = Number((best.payload["version"] as number | undefined) ?? 0);
    const curV = Number((cur.payload["version"] as number | undefined) ?? 0);
    return curV > bestV ? cur : best;
  });

  const s = stateEntry.payload;
  const termsCid = s["termsCid"] as string;
  const termsEntry =
    termsEntries.find((t) => t.contractId === termsCid) ?? termsEntries[0];

  if (!termsEntry) return null;
  const t = termsEntry.payload;

  const counterpartyParties = (t["permittedCounterparties"] as string[]) ?? [];
  const categories = ((t["permittedCategories"] as unknown[]) ?? []).map(
    variantTag
  );

  return {
    mandateId: String(s["mandateId"] ?? ""),
    status: variantTag(s["status"]) as "Active" | "Paused" | "Revoked",
    autoApproveLimit: decimalStr(t["autoApproveLimit"]),
    perActionMaximum: decimalStr(t["perActionMaximum"]),
    dailyMaximum: decimalStr(t["dailyMaximum"]),
    monthlyMaximum: decimalStr(t["monthlyMaximum"]),
    dailySpent: decimalStr(s["dailySpent"]),
    monthlySpent: decimalStr(s["monthlySpent"]),
    currency: String(t["currency"] ?? "USD"),
    expiresAt: String(t["expiresAt"] ?? ""),
    permittedCategories: categories,
    counterparties: counterpartyParties.map((p) => ({
      party: p,
      label: partyToLabel(p),
    })),
    version: Number(s["version"] ?? 1),
    explorerUrl: explorerPartyUrl(party),
    _stateCid: stateEntry.contractId,
    _termsCid: termsEntry.contractId,
  };
}

/**
 * Get the current ACS entry for the treasury DemoDeposit owned by cfoParty.
 * Returns the largest single deposit (simplest model for demo — one treasury deposit).
 */
export async function getTreasuryDeposit(
  cfoParty: string
): Promise<AcsEntry | null> {
  const deposits = await queryAcs(
    cfoParty,
    tid("Cation.Asset", "DemoDeposit")
  );
  // Filter to deposits owned by cfo (the treasury, not paid-out change fragments).
  const ours = deposits.filter((d) => d.payload["owner"] === cfoParty);
  if (ours.length === 0) return null;
  // Pick deposit with the largest amount as the primary treasury deposit.
  return ours.reduce((best, cur) =>
    Number(cur.payload["amount"]) > Number(best.payload["amount"]) ? cur : best
  );
}
