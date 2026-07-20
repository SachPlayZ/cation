/** Machine-readable denial codes (must match Cation.Types constants). */
export const DENIAL_CODES = [
  "COUNTERPARTY_NOT_ALLOWED",
  "ACTION_CATEGORY_NOT_ALLOWED",
  "MANDATE_EXPIRED",
  "DAILY_LIMIT_EXCEEDED",
  "MONTHLY_LIMIT_EXCEEDED",
  "MANDATE_REVOKED",
  "MANDATE_PAUSED",
  "AMOUNT_ABOVE_HARD_LIMIT",
  "DUPLICATE_REQUEST",
  "INVALID_AMOUNT",
  "INVALID_CURRENCY",
  "REJECTED_BY_APPROVER",
] as const;

export type DenialCode = (typeof DENIAL_CODES)[number];

/** Human-readable explanations for UI display. Codes pass through verbatim alongside. */
export const DENIAL_EXPLANATIONS: Record<DenialCode, string> = {
  COUNTERPARTY_NOT_ALLOWED:
    "The counterparty is not on the approved list in this mandate.",
  ACTION_CATEGORY_NOT_ALLOWED:
    "This action category is not permitted under the mandate.",
  MANDATE_EXPIRED: "The mandate has passed its expiry date.",
  DAILY_LIMIT_EXCEEDED:
    "This action would exceed the daily spending limit for this mandate.",
  MONTHLY_LIMIT_EXCEEDED:
    "This action would exceed the monthly spending limit for this mandate.",
  MANDATE_REVOKED:
    "The mandate has been revoked. No actions can be submitted.",
  MANDATE_PAUSED:
    "The mandate is paused. Resume it before submitting new actions.",
  AMOUNT_ABOVE_HARD_LIMIT:
    "The requested amount exceeds the per-action hard limit.",
  DUPLICATE_REQUEST:
    "A request with this ID has already been processed recently.",
  INVALID_AMOUNT: "The amount must be a positive number.",
  INVALID_CURRENCY: "The currency does not match the mandate's currency.",
  REJECTED_BY_APPROVER: "The approver explicitly rejected this request.",
};

export function explainDenial(code: string): string {
  return (
    DENIAL_EXPLANATIONS[code as DenialCode] ??
    `Denied with code: ${code}`
  );
}
