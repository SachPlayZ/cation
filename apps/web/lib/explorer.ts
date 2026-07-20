/**
 * 5N Lighthouse — public Canton DevNet block explorer for the same "5N
 * Sandbox" validator our contracts run on. Used to give the UI a real,
 * independently-verifiable link to on-chain state after every transaction.
 *
 * Create-derived writes return a real `updateId` we can deep-link to a
 * specific transaction. Exercise-derived writes (RequestAction, approvals,
 * pause/resume/revoke) do not return one over the Seaport proxy — we link to
 * the acting party's live ledger activity instead, which is still genuine,
 * independently-verifiable on-chain proof, just not deep-linked to one exact
 * transaction hash.
 */

const EXPLORER_BASE = "https://lighthouse.devnet.cantonloop.com";

export function explorerTransactionUrl(updateId: string): string {
  return `${EXPLORER_BASE}/transactions/${updateId}`;
}

export function explorerPartyUrl(party: string): string {
  return `${EXPLORER_BASE}/party/${encodeURIComponent(party)}`;
}
