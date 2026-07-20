"use client";

/**
 * Client-only helper for requesting a real Loop Wallet signature over a
 * specific message. Used to bind mandate creation to an actual CFO
 * signature, not just the login-time connection gate.
 *
 * loop.connect() calls autoConnect() internally and only opens the QR/popup
 * pairing UI if there is no valid persisted session (Loop's own
 * localStorage-backed session, restored automatically) — so if the CFO
 * already connected at login, this resolves silently with no visible UI.
 *
 * KNOWN LIMITATION: provider.signMessage()'s return value is treated as an
 * opaque blob here. We do not have a documented byte-exact signing scheme
 * or verification routine from Loop SDK, so the backend checks that a
 * signature was actually produced and that it covers the exact mandate
 * terms submitted (see lib/mandateSigning.ts), but does NOT perform
 * cryptographic Ed25519 verification against the wallet's public key. That
 * is a real, disclosed gap — not silently pretended away.
 */

// Provider isn't re-exported from the package's public entrypoint, so we
// declare the minimal structural shape we actually use rather than reaching
// into the package's internal dist path.
interface LoopProvider {
  party_id: string;
  public_key: string;
  signMessage(message: string): Promise<unknown>;
}

let initPromise: Promise<typeof import("@fivenorth/loop-sdk")> | null = null;
let pendingResolve: ((provider: LoopProvider) => void) | null = null;
let pendingReject: ((err: Error) => void) | null = null;

async function ensureInit(): Promise<typeof import("@fivenorth/loop-sdk")> {
  if (!initPromise) {
    initPromise = import("@fivenorth/loop-sdk").then((mod) => {
      mod.loop.init({
        appName: "Cation",
        network: "devnet",
        onAccept: (provider) => pendingResolve?.(provider),
        onReject: () => pendingReject?.(new Error("Connection rejected in Loop Wallet.")),
      });
      return mod;
    });
  }
  return initPromise;
}

async function connectLoopWallet(): Promise<LoopProvider> {
  const mod = await ensureInit();
  const providerPromise = new Promise<LoopProvider>((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
  });
  await mod.loop.connect();
  return providerPromise;
}

export interface LoopSignature {
  partyId: string;
  publicKey: string;
  message: string;
  signature: unknown;
}

export async function signWithLoopWallet(message: string): Promise<LoopSignature> {
  const provider = await connectLoopWallet();
  const signature = await provider.signMessage(message);
  return {
    partyId: provider.party_id,
    publicKey: provider.public_key,
    message,
    signature,
  };
}
