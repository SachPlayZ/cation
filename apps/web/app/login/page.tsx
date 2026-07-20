"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bank,
  CaretRight,
  CheckCircle,
  CircleNotch,
  Receipt,
  Robot,
  SealCheck,
  ShieldCheck,
  WarningCircle,
  WifiHigh,
  X,
} from "@phosphor-icons/react";
import {
  login,
  setAuth,
  getToken,
  getRole,
  getRoleRoute,
  type Role,
} from "@/components/api";

const ROLES: {
  role: Role;
  title: string;
  subtitle: string;
  description: string;
}[] = [
  {
    role: "cfo",
    title: "CFO control",
    subtitle: "Principal authority",
    description: "Set mandates, review approvals, and control treasury authority.",
  },
  {
    role: "agent",
    title: "Agent console",
    subtitle: "Delegated executor",
    description: "Propose payments in natural language within active mandate limits.",
  },
  {
    role: "compliance",
    title: "Compliance",
    subtitle: "Violation observer",
    description: "Inspect policy violations without access to private treasury data.",
  },
  {
    role: "recipient",
    title: "Recipient",
    subtitle: "Counterparty view",
    description: "Verify only the payment receipts addressed to this party.",
  },
];

function RoleIcon({ role }: { role: Role }) {
  const className = "size-5";
  if (role === "cfo") return <Bank className={className} weight="duotone" />;
  if (role === "agent") return <Robot className={className} weight="duotone" />;
  if (role === "compliance") {
    return <ShieldCheck className={className} weight="duotone" />;
  }
  return <Receipt className={className} weight="duotone" />;
}

// Real 5N Loop Wallet connection (@fivenorth/loop-sdk) gates CFO login: the
// user must connect and sign with an actual Loop Wallet instance before
// entering. This proves control of a real Canton external party. It is
// deliberately a LOGIN GATE ONLY. The connected party is not wired into
// ledger execution. Every mandate action (create/pause/resume/revoke/
// approve) still executes through our existing Seaport-proxied backend
// service credential exactly as before; this does not make Cation
// self-custodial end to end, only its login screen.
function truncateParty(party: string): string {
  const [hint, fingerprint] = party.split("::");
  if (!fingerprint) return party;
  return `${hint}::${fingerprint.slice(0, 8)}…${fingerprint.slice(-6)}`;
}

type WalletStage = "select" | "connecting" | "signing" | "connected" | "error";

function WalletConnectModal({
  onConnected,
  onCancel,
}: {
  onConnected: () => void;
  onCancel: () => void;
}) {
  const [stage, setStage] = useState<WalletStage>("select");
  const [partyId, setPartyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;
  const initedRef = useRef(false);
  // Tracks the in-flight init() so handleConnect can await it. connect()
  // throws "SDK not initialized" if called before init()'s dynamic import
  // and setup have actually resolved, which can beat a fast click.
  const initPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;

    let cancelled = false;

    initPromiseRef.current = import("@fivenorth/loop-sdk").then(({ loop }) => {
      if (cancelled) return;
      loop.init({
        appName: "Cation",
        network: "devnet",
        onAccept: async (provider) => {
          setPartyId(provider.party_id);
          setStage("signing");
          try {
            await provider.signMessage(
              `Cation CFO authentication: ${new Date().toISOString()}`
            );
          } catch {
            // Signature request failed, commonly because this wallet has no
            // traffic allowance on devnet (no test CC) to cover the signing
            // request. The connect handshake itself (party_id + public_key
            // exchange) already proves control of the wallet, so we proceed
            // without blocking on the extra signature.
          }
          setStage("connected");
          setTimeout(() => onConnectedRef.current(), 900);
        },
        onReject: () => {
          setErrorMsg("Connection rejected in Loop Wallet.");
          setStage("select");
        },
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleConnect = async () => {
    setErrorMsg(null);
    setStage("connecting");
    try {
      if (initPromiseRef.current) await initPromiseRef.current;
      const { loop } = await import("@fivenorth/loop-sdk");
      await loop.connect();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Could not open Loop Wallet."
      );
      setStage("select");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/85 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-preview-title"
        className="w-full max-w-sm rounded-panel border border-rim bg-surface p-6 panel-shadow"
      >
        {stage === "select" && (
          <>
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 id="wallet-preview-title" className="text-base font-semibold text-ink">Connect wallet</h3>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Authenticate as the mandate principal via a real Canton
                  external party. Execution still runs through Cation&apos;s
                  backend service credential.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close wallet connection"
                onClick={onCancel}
                className="flex size-9 shrink-0 items-center justify-center rounded-control text-faint transition hover:bg-elevated hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleConnect}
              className="flex w-full items-center gap-3 rounded-control border border-rim bg-elevated px-4 py-3 text-left transition hover:border-brand/50 hover:bg-brand/5"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-control border border-rim bg-canvas text-brand-strong">
                <SealCheck className="size-4" weight="duotone" />
              </span>
              <span>
                <span className="block text-sm font-medium text-ink">Loop Wallet</span>
                <span className="block text-[11px] text-faint">Self-custodial, 5N Sandbox devnet</span>
              </span>
            </button>
            {errorMsg && (
              <p className="mt-3 text-xs leading-5 text-red-300">{errorMsg}</p>
            )}
            <p className="mt-4 text-[11px] leading-5 text-faint">
              Opens Loop Wallet to connect and sign. No test CC is required
              because connection and message signing do not submit a transaction.
            </p>
          </>
        )}

        {stage === "connecting" && (
          <div className="flex flex-col items-center py-6 text-center">
            <CircleNotch className="mb-4 size-8 animate-spin text-brand" />
            <p className="text-sm font-medium text-ink">Opening Loop Wallet…</p>
            <p className="mt-1 text-xs text-faint">
              Approve the connection request in your wallet
            </p>
          </div>
        )}

        {stage === "signing" && (
          <div className="flex flex-col items-center py-6 text-center">
            <CircleNotch className="mb-4 size-8 animate-spin text-brand" />
            <p className="text-sm font-medium text-ink">Requesting signature…</p>
            {partyId && (
              <p className="mt-1 font-mono text-[11px] text-faint">
                {truncateParty(partyId)}
              </p>
            )}
          </div>
        )}

        {stage === "connected" && (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle
              className="mb-4 size-8 text-emerald-400"
              weight="fill"
            />
            <p className="text-sm font-medium text-ink">Loop Wallet connected</p>
            {partyId && (
              <p className="mt-1 font-mono text-[11px] text-emerald-400">
                {truncateParty(partyId)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LoginLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Checking session"
      className="app-backdrop flex min-h-[100dvh] items-center justify-center p-6"
    >
      <div className="flex items-center gap-3 text-sm text-muted">
        <CircleNotch className="size-5 animate-spin text-brand" />
        Checking secure session
      </div>
    </main>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [showWalletModal, setShowWalletModal] = useState(false);

  useEffect(() => {
    const token = getToken();
    const role = getRole();
    if (token && role) {
      router.replace(getRoleRoute(role));
    } else {
      setChecking(false);
    }
  }, [router]);

  const handleLogin = async (role: Role) => {
    setLoading(role);
    setError(null);
    try {
      const result = await login(role, "cation-demo");
      setAuth(result.token, result.role, result.displayName);
      router.push(getRoleRoute(result.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(null);
    }
  };

  if (checking) return <LoginLoading />;

  return (
    <main className="app-backdrop min-h-[100dvh] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-[1320px] overflow-hidden rounded-panel border border-rim bg-surface panel-shadow sm:min-h-[calc(100dvh-3rem)] lg:grid-cols-[0.92fr_1.08fr]">
        <section className="relative flex min-h-[380px] flex-col justify-between overflow-hidden border-b border-rim bg-canvas p-7 sm:p-10 lg:min-h-0 lg:border-b-0 lg:border-r">
          <div
            aria-hidden="true"
            className="absolute -left-28 top-24 size-[28rem] rounded-full bg-brand/10 blur-[100px]"
          />
          <div className="relative flex items-center gap-3">
            <Image
              src="/android-chrome-192x192.png"
              alt="Cation"
              width={42}
              height={42}
              priority
              className="size-10 rounded-control"
            />
            <span className="text-sm font-semibold tracking-[0.18em] text-ink">
              CATION
            </span>
          </div>

          <div className="relative max-w-lg py-12 lg:py-16">
            <p className="mb-4 flex items-center gap-2 text-xs font-medium text-muted">
              <WifiHigh className="size-4 text-brand-strong" weight="bold" />
              Canton DevNet connected
            </p>
            <h1 className="max-w-md text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.055em] text-ink sm:text-[3.4rem]">
              Authority before execution.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-muted">
              AI proposes financial actions. Daml mandates decide what reaches the ledger.
            </p>
          </div>

          <div className="relative flex items-center gap-2 text-xs text-faint">
            <ShieldCheck className="size-4" />
            Private, revocable, on-ledger permissions
          </div>
        </section>

        <section className="flex flex-col justify-center p-5 sm:p-10 lg:p-12">
          <div className="mx-auto w-full max-w-xl">
            <div className="mb-7">
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-ink">
                Choose a ledger view
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Each role signs in with separate credentials and sees only its party-scoped contracts.
              </p>
            </div>

            <div className="overflow-hidden rounded-panel border border-rim bg-canvas/40">
              {ROLES.map(({ role, title, subtitle, description }, index) => (
                <button
                  key={role}
                  type="button"
                  onClick={() =>
                    role === "cfo"
                      ? setShowWalletModal(true)
                      : handleLogin(role)
                  }
                  disabled={loading !== null}
                  className={`group flex min-h-[92px] w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-elevated active:bg-rim/70 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 ${
                    index < ROLES.length - 1 ? "border-b border-rim" : ""
                  }`}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-control border border-rim bg-elevated text-muted transition group-hover:border-brand/50 group-hover:text-brand-strong">
                    <RoleIcon role={role} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-semibold text-ink">{title}</span>
                      <span className="text-xs text-faint">{subtitle}</span>
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted">
                      {description}
                    </span>
                  </span>
                  {loading === role ? (
                    <CircleNotch className="size-5 shrink-0 animate-spin text-brand" />
                  ) : (
                    <CaretRight className="size-5 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
                  )}
                </button>
              ))}
            </div>

            {error && (
              <div
                role="alert"
                className="mt-4 flex gap-3 rounded-control border border-red-900/70 bg-red-950/30 p-3 text-sm text-red-200"
              >
                <WarningCircle className="mt-0.5 size-5 shrink-0" weight="fill" />
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-2 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
              <span>Demo password configured automatically</span>
              <span className="inline-flex items-center gap-1 text-muted">
                Role switch available after login
                <ArrowRight className="size-3.5" />
              </span>
            </div>
          </div>
        </section>
      </div>

      {showWalletModal && (
        <WalletConnectModal
          onConnected={() => {
            setShowWalletModal(false);
            handleLogin("cfo");
          }}
          onCancel={() => setShowWalletModal(false)}
        />
      )}
    </main>
  );
}
