"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  apiFetch,
  getRole,
  formatUSD,
  formatDate,
  DENIAL_EXPLANATIONS,
  type ActivityItem,
} from "@/components/api";
import { useToast } from "@/components/Toast";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-elevated rounded animate-skeleton ${className}`} />;
}

export default function CompliancePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [violations, setViolations] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Role guard
  useEffect(() => {
    const role = getRole();
    if (role && role !== "compliance") router.replace("/");
  }, [router]);

  const fetchViolations = useCallback(async () => {
    try {
      const res = await apiFetch<{ items: ActivityItem[] }>("/api/activity");
      setViolations(res.items.filter((i) => i.type === "violation"));
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Fetch error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchViolations();
    const id = setInterval(fetchViolations, 5000);
    return () => clearInterval(id);
  }, [fetchViolations]);

  return (
    <div className="animate-fade-in max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-mono text-violet-400 uppercase tracking-wider mb-0.5">
          Compliance View
        </p>
        <h1 className="text-white font-bold text-xl mb-3">
          Policy Violations
        </h1>

        {/* Privacy notice */}
        <div className="p-4 rounded-lg border border-violet-900/40 bg-violet-950/10">
          <p className="text-xs font-mono text-violet-400 uppercase tracking-wider mb-2">
            Canton ledger view — privacy enforced by contract
          </p>
          <p className="text-slate-400 text-sm leading-relaxed mb-3">
            This view shows <strong className="text-violet-300">violations only</strong>.
            The Canton{" "}
            <code className="text-violet-300">PolicyViolation</code> template
            names Compliance as an observer. No other templates do.
          </p>
          <div className="space-y-1.5">
            {[
              "Treasury balance",
              "Mandate terms and limits",
              "Approved receipts",
              "Pending approval requests",
              "Agent conversation history",
              "Counterparty identities beyond violation records",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 text-xs text-slate-600"
              >
                <span className="text-red-600 font-mono">✕</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <p className="text-slate-600 text-xs mt-3 font-mono">
            Data shown = Compliance party&apos;s Canton ACS. Not a
            client-side filter.
          </p>
        </div>
      </div>

      {/* Violations list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : violations.length === 0 ? (
        <div className="p-8 rounded-lg border border-rim bg-surface text-center">
          <div className="text-2xl mb-2">◈</div>
          <p className="text-slate-500 text-sm mb-1">No violations recorded</p>
          <p className="text-slate-600 text-xs">
            All agent actions have been within mandate bounds.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {violations.map((item, i) => (
            <div
              key={`${item.requestId}-${i}`}
              className="p-4 rounded-lg border border-red-900/40 bg-red-950/10"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-red-400 font-mono text-sm">✕</span>
                  {item.code && (
                    <span className="px-2 py-0.5 rounded bg-red-950/60 border border-red-800 text-red-300 text-[10px] font-mono">
                      {item.code}
                    </span>
                  )}
                  {item.amount && (
                    <span className="font-mono text-sm text-white">
                      {formatUSD(item.amount)}
                    </span>
                  )}
                  {item.counterpartyLabel && (
                    <span className="text-slate-400 text-sm">
                      → {item.counterpartyLabel}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-mono text-slate-600 shrink-0">
                  {new Date(item.at).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {item.code && DENIAL_EXPLANATIONS[item.code] && (
                <p className="text-xs text-red-300/70 mb-1">
                  {DENIAL_EXPLANATIONS[item.code]}
                </p>
              )}

              <p className="text-xs text-slate-500">{item.detail}</p>

              <div className="mt-2 flex items-center gap-3 text-[11px] font-mono text-slate-600">
                <span>req: {item.requestId.slice(0, 14)}…</span>
                <span>{formatDate(item.at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-[11px] font-mono text-slate-700 text-center">
        {violations.length} violation{violations.length !== 1 ? "s" : ""} ·
        auto-refresh 5s · Canton DevNet
      </p>
    </div>
  );
}
