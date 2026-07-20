/**
 * Canonical message the CFO's Loop Wallet signs before a mandate is created.
 * Shared by the client (signs this exact string) and the server (recomputes
 * it from the submitted terms and rejects if it doesn't match the signed
 * message) — a single source of truth so the two can never drift apart.
 *
 * Only covers the mandate TERMS, not the generated mandateId — the id is
 * assigned server-side after the terms are known, so it cannot be part of
 * what the principal signs.
 */

export interface MandateTermsForSigning {
  autoApproveLimit: string;
  perActionMaximum: string;
  dailyMaximum: string;
  monthlyMaximum: string;
  expiresAt: string;
  counterpartyIds: string[];
  categories: string[];
}

export function canonicalMandateMessage(terms: MandateTermsForSigning): string {
  const sortedCounterparties = [...terms.counterpartyIds].sort();
  const sortedCategories = [...terms.categories].sort();
  return [
    "Cation mandate authorization",
    `autoApproveLimit=${terms.autoApproveLimit}`,
    `perActionMaximum=${terms.perActionMaximum}`,
    `dailyMaximum=${terms.dailyMaximum}`,
    `monthlyMaximum=${terms.monthlyMaximum}`,
    `expiresAt=${terms.expiresAt}`,
    `counterparties=${sortedCounterparties.join(",")}`,
    `categories=${sortedCategories.join(",")}`,
  ].join("\n");
}
