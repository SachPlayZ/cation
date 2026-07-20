"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  border: string;
  accent: string;
  bg: string;
}[] = [
  {
    role: "cfo",
    title: "CFO",
    subtitle: "Principal authority",
    description:
      "Issues mandates, approves over-threshold actions. Full org ledger view — treasury balance, all activity.",
    border: "border-l-amber-500",
    accent: "text-amber-400",
    bg: "hover:bg-amber-950/20",
  },
  {
    role: "agent",
    title: "AI Agent Console",
    subtitle: "Delegated executor",
    description:
      "Proposes transactions via natural language. Mandate enforces authority on-ledger — the LLM cannot bypass it.",
    border: "border-l-cyan-500",
    accent: "text-cyan-400",
    bg: "hover:bg-cyan-950/20",
  },
  {
    role: "compliance",
    title: "Compliance",
    subtitle: "Violation monitor",
    description:
      "Sees policy violations only. Cannot see balances, prompts, approved receipts, or counterparty limits.",
    border: "border-l-violet-500",
    accent: "text-violet-400",
    bg: "hover:bg-violet-950/20",
  },
  {
    role: "recipient",
    title: "Recipient",
    subtitle: "Counterparty view",
    description:
      "Sees only receipts for payments received. Zero visibility into limits, other recipients, or mandate terms.",
    border: "border-l-emerald-500",
    accent: "text-emerald-400",
    bg: "hover:bg-emerald-950/20",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

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

  if (checking) {
    return <div className="min-h-screen bg-canvas" />;
  }

  return (
    <main className="min-h-screen bg-canvas dot-grid flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-amber-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-xl animate-fade-in">
        {/* Network badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-rim bg-surface text-xs text-slate-500 font-mono tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            CANTON NETWORK · DEVNET
          </div>
        </div>

        {/* Wordmark */}
        <div className="text-center mb-10">
          <h1 className="text-7xl font-extrabold tracking-[-0.03em] text-white leading-none mb-3">
            CATION
          </h1>
          <p className="text-lg font-semibold text-amber-400 tracking-wide mb-3">
            The AI proposes. The mandate decides.
          </p>
          <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed">
            Private, programmable financial authority for AI agents — enforced on-ledger as Daml contracts.
          </p>
        </div>

        {/* Role cards */}
        <div className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-3 text-center">
          Select role to enter
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {ROLES.map(({ role, title, subtitle, description, border, accent, bg }) => (
            <button
              key={role}
              onClick={() => handleLogin(role)}
              disabled={loading !== null}
              className={`
                text-left p-4 rounded-lg border border-rim border-l-2 bg-surface
                ${border} ${bg}
                transition-all duration-150 cursor-pointer
                hover:-translate-y-px hover:border-slate-700
                disabled:opacity-50 disabled:cursor-not-allowed
                focus:outline-none focus:ring-1 focus:ring-amber-500/40
              `}
            >
              <div className="flex items-start justify-between mb-1.5">
                <div>
                  <p className={`text-[10px] font-mono uppercase tracking-wider ${accent} mb-0.5`}>
                    {subtitle}
                  </p>
                  <h3 className="text-white font-semibold text-sm">{title}</h3>
                </div>
                {loading === role && (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-600 border-t-amber-400 animate-spin" />
                )}
              </div>
              <p className="text-slate-500 text-xs leading-relaxed">{description}</p>
              <div className={`mt-2.5 text-[11px] font-medium ${accent} flex items-center gap-1`}>
                Enter as {title}
                <span>→</span>
              </div>
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs text-center font-mono">
            {error}
          </div>
        )}

        <p className="text-center text-slate-700 text-[11px] font-mono mt-8">
          demo · password: cation-demo · Canton Network Hackathon 2026
        </p>
      </div>
    </main>
  );
}
