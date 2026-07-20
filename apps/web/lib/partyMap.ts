/**
 * Maps environment-defined counterparty labels to Canton party IDs.
 * The LLM uses labels; the backend resolves to party IDs.
 * Never let labels or party IDs reach the browser in a way that
 * allows the LLM to select them directly.
 */

export interface CounterpartyEntry {
  label: string;
  party: string;
}

/** All known counterparties (from env). The agent system prompt lists only labels. */
export function getAllCounterparties(): CounterpartyEntry[] {
  return [
    { label: "cloud-operations", party: process.env.PARTY_OPS! },
    { label: "reserve-account", party: process.env.PARTY_RESERVE! },
  ].filter((c) => !!c.party);
}

/** Resolve a counterparty label to its Canton party ID. Returns null if not found. */
export function resolveCounterparty(label: string): string | null {
  const cp = getAllCounterparties().find((c) => c.label === label);
  return cp?.party ?? null;
}

/** Map Canton party ID back to label for display purposes. */
export function partyToLabel(party: string): string {
  const cp = getAllCounterparties().find((c) => c.party === party);
  return cp?.label ?? party;
}

/** Role → Canton party ID mapping. */
export function partyForRole(role: string): string {
  switch (role) {
    case "cfo":
      return process.env.PARTY_CFO!;
    case "agent":
      return process.env.PARTY_AGENT!;
    case "compliance":
      return process.env.PARTY_COMPLIANCE!;
    case "recipient":
      // Recipient demo user sees the ops account's receipts.
      return process.env.PARTY_RECIPIENT ?? process.env.PARTY_OPS!;
    default:
      throw new Error(`Unknown role: ${role}`);
  }
}
