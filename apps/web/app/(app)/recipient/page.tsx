"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  apiFetch,
  getRole,
  getDisplayName,
  formatUSD,
  formatDate,
  type ActivityItem,
} from "@/components/api";
import { useToast } from "@/components/Toast";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-elevated rounded animate-skeleton ${className}`} />;
}

export default function RecipientPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [receipts, setReceipts] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("Recipient");

  // Role guard
  useEffect(() => {
    const role = getRole();
    if (role && role !== "recipient") router.replace("/");
    setDisplayName(getDisplayName() ?? "Recipient");
  }, [router]);

  const fetchReceipts = useCallback(async () => {
    try {
      const res = await apiFetch<{ items: ActivityItem[] }>("/api/activity");
      setReceipts(res.items.filter((i) => i.type === "receipt"));
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Fetch error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchReceipts();
    const id = setInterval(fetchReceipts, 5000);
    return () => clearInterval(id);
  }, [fetchReceipts]);

  const total = receipts.reduce(
    (sum, r) => sum + (parseFloat(r.amount ?? "0") || 0),
    0
  );

  return (
    <div className="animate-fade-in max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-mono text-emerald-400 uppercase tracking-wider mb-0.5">
          Recipient View
        </p>
        <h1 className="text-white font-bold text-xl mb-1">
          Received Payments
        </h1>
        <p className="text-slate-500 text-sm">{displayName}</p>
      </div>

      {/* Privacy notice */}
      <div className="p-4 rounded-lg border border-emerald-900/40 bg-emerald-950/10 mb-6">
        <p className="text-xs font-mono text-emerald-400 uppercase tracking-wider mb-2">
          Canton ledger view — privacy enforced by contract
        </p>
        <p className="text-slate-400 text-sm leading-relaxed mb-3">
          This account sees only{" "}
          <strong className="text-emerald-300">receipts addressed to it</strong>.
          The Canton <code className="text-emerald-300">ExecutionReceipt</code>{" "}
          template names each recipient party as an observer exactly once.
        </p>
        <div className="space-y-1.5">
          {[
            "Treasury balance",
            "Mandate terms or limits",
            "Other recipients' payments",
            "Policy violations",
            "Pending approvals",
            "Agent conversation or intent",
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
          Data shown = this party&apos;s Canton ACS. Not a client-side filter.
        </p>
      </div>

      {/* Total received */}
      {!loading && receipts.length > 0 && (
        <div className="p-4 rounded-lg border border-rim bg-surface mb-4">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1">
            Total Received
          </p>
          <p className="text-2xl font-mono font-bold text-white">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(total)}
          </p>
          <p className="text-xs text-slate-600 mt-0.5">
            {receipts.length} payment{receipts.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Receipts list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : receipts.length === 0 ? (
        <div className="p-8 rounded-lg border border-rim bg-surface text-center">
          <div className="text-2xl mb-2">◈</div>
          <p className="text-slate-500 text-sm mb-1">No receipts yet</p>
          <p className="text-slate-600 text-xs">
            Payments sent to this account will appear here once confirmed on
            the Canton ledger.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {receipts.map((item, i) => (
            <div
              key={`${item.requestId}-${i}`}
              className="p-4 rounded-lg border border-rim bg-surface"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-emerald-400 font-mono">↙</span>
                    <span className="font-mono text-lg font-bold text-white">
                      {formatUSD(item.amount)}
                    </span>
                    {item.currency && (
                      <span className="text-slate-600 text-xs font-mono">
                        {item.currency}
                      </span>
                    )}
                  </div>
                  {item.category && (
                    <span className="inline-block px-2 py-0.5 rounded bg-elevated border border-rim text-slate-400 text-[10px] font-mono mb-1.5">
                      {item.category}
                    </span>
                  )}
                  <p className="text-sm text-slate-400">{item.detail}</p>
                  <p className="text-[11px] font-mono text-slate-600 mt-1">
                    {formatDate(item.at)} · {item.requestId.slice(0, 14)}…
                  </p>
                </div>
                <div className="shrink-0">
                  <span className="px-2 py-1 rounded-full bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-[10px] font-medium">
                    Confirmed
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-[11px] font-mono text-slate-700 text-center">
        {receipts.length} receipt{receipts.length !== 1 ? "s" : ""} ·
        auto-refresh 5s · Canton DevNet
      </p>
    </div>
  );
}
