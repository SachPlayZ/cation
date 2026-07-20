"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  apiFetch,
  getRole,
  formatUSD,
  formatDate,
  subtract,
  DENIAL_EXPLANATIONS,
  type MandateView,
  type ActivityItem,
  type ApprovalItem,
  type CreateMandateBody,
} from "@/components/api";
import { useToast } from "@/components/Toast";

// ── Sub-components ─────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-elevated rounded animate-skeleton ${className}`} />
  );
}

function StatusBadge({ status }: { status: MandateView["status"] }) {
  const styles = {
    Active: "bg-emerald-950 text-emerald-300 border-emerald-800",
    Paused: "bg-amber-950 text-amber-300 border-amber-800",
    Revoked: "bg-red-950 text-red-300 border-red-800",
  };
  const dots = {
    Active: "bg-emerald-400 animate-pulse",
    Paused: "bg-amber-400",
    Revoked: "bg-red-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${styles[status]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status]}`} />
      {status}
    </span>
  );
}

function ProgressBar({
  spent,
  max,
  label,
}: {
  spent: string;
  max: string;
  label: string;
}) {
  const spentN = parseFloat(spent) || 0;
  const maxN = parseFloat(max) || 1;
  const pct = Math.min((spentN / maxN) * 100, 100);
  const barColor =
    pct > 90
      ? "bg-red-500"
      : pct > 70
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-xs font-mono text-slate-300">
          {formatUSD(spent)}{" "}
          <span className="text-slate-600">/ {formatUSD(max)}</span>
        </span>
      </div>
      <div className="h-1 bg-rim rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-0.5 text-right text-[10px] font-mono text-slate-600">
        {formatUSD(subtract(max, spent))} remaining
      </div>
    </div>
  );
}

function ActivityTypeIcon({ type }: { type: ActivityItem["type"] }) {
  const styles: Record<ActivityItem["type"], { icon: string; cls: string }> = {
    receipt: { icon: "↗", cls: "text-emerald-400" },
    violation: { icon: "✕", cls: "text-red-400" },
    pending: { icon: "◎", cls: "text-amber-400" },
    "mandate-event": { icon: "◇", cls: "text-blue-400" },
  };
  const s = styles[type];
  return (
    <span className={`font-mono text-sm ${s.cls} shrink-0`}>{s.icon}</span>
  );
}

// ── Mandate Create Form ────────────────────────────────────────────────────────

// Must match Cation.Types.ActionCategory in the Daml model exactly.
const KNOWN_CATEGORIES = [
  { id: "OperationalPayment", label: "Operational Payment" },
  { id: "TreasuryTransfer", label: "Treasury Transfer" },
  { id: "CollateralTopUp", label: "Collateral Top-Up" },
  { id: "PayrollDisbursement", label: "Payroll Disbursement" },
  { id: "Reimbursement", label: "Reimbursement" },
];

// Must match the labels registered in lib/partyMap.ts's getAllCounterparties().
const KNOWN_COUNTERPARTIES = [
  { id: "cloud-operations", label: "Cloud Operations" },
  { id: "reserve-account", label: "Treasury Reserve" },
];

function MandateForm({ onCreated }: { onCreated: (m: MandateView) => void }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [form, setForm] = useState<{
    autoApproveLimit: string;
    perActionMaximum: string;
    dailyMaximum: string;
    monthlyMaximum: string;
    expiresAt: string;
    counterpartyIds: string[];
    categories: string[];
  }>({
    autoApproveLimit: "500",
    perActionMaximum: "2000",
    dailyMaximum: "5000",
    monthlyMaximum: "20000",
    expiresAt: thirtyDays,
    counterpartyIds: ["cloud-operations", "treasury-reserve"],
    categories: ["OperationalPayment", "TreasuryTransfer"],
  });

  const toggleArr = (
    key: "counterpartyIds" | "categories",
    val: string
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].includes(val)
        ? prev[key].filter((x) => x !== val)
        : [...prev[key], val],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body: CreateMandateBody = {
        ...form,
        expiresAt: new Date(form.expiresAt + "T23:59:59Z").toISOString(),
      };
      const mandate = await apiFetch<MandateView>("/api/mandate", {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast("success", "Mandate created and accepted by agent");
      onCreated(mandate);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to create mandate");
    } finally {
      setSubmitting(false);
    }
  };

  const field =
    "w-full px-3 py-2 bg-elevated border border-rim rounded-md text-sm text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-600/60 focus:ring-1 focus:ring-amber-600/20 transition-colors";

  const label = "block text-xs text-slate-500 mb-1.5";

  return (
    <div className="max-w-xl animate-fade-in">
      <div className="mb-6">
        <h2 className="text-white font-semibold text-lg mb-1">
          Create agent mandate
        </h2>
        <p className="text-slate-500 text-sm">
          Define the exact financial authority delegated to the AI agent. All
          limits are enforced on-ledger — the agent cannot exceed them.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>
              Auto-approve below (no human needed)
            </label>
            <input
              type="text"
              className={field}
              value={form.autoApproveLimit}
              onChange={(e) =>
                setForm((p) => ({ ...p, autoApproveLimit: e.target.value }))
              }
              placeholder="500.00"
            />
          </div>
          <div>
            <label className={label}>Per-action maximum (hard cap)</label>
            <input
              type="text"
              className={field}
              value={form.perActionMaximum}
              onChange={(e) =>
                setForm((p) => ({ ...p, perActionMaximum: e.target.value }))
              }
              placeholder="2000.00"
            />
          </div>
          <div>
            <label className={label}>Daily cap</label>
            <input
              type="text"
              className={field}
              value={form.dailyMaximum}
              onChange={(e) =>
                setForm((p) => ({ ...p, dailyMaximum: e.target.value }))
              }
              placeholder="5000.00"
            />
          </div>
          <div>
            <label className={label}>Monthly cap</label>
            <input
              type="text"
              className={field}
              value={form.monthlyMaximum}
              onChange={(e) =>
                setForm((p) => ({ ...p, monthlyMaximum: e.target.value }))
              }
              placeholder="20000.00"
            />
          </div>
        </div>

        <div>
          <label className={label}>Mandate expires</label>
          <input
            type="date"
            className={field}
            value={form.expiresAt}
            onChange={(e) =>
              setForm((p) => ({ ...p, expiresAt: e.target.value }))
            }
          />
        </div>

        <div>
          <label className={label}>Permitted transaction categories</label>
          <div className="flex flex-wrap gap-2">
            {KNOWN_CATEGORIES.map(({ id, label: lbl }) => (
              <label
                key={id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                  form.categories.includes(id)
                    ? "border-amber-600 bg-amber-950/30 text-amber-300"
                    : "border-rim bg-elevated text-slate-500 hover:border-slate-600"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={form.categories.includes(id)}
                  onChange={() => toggleArr("categories", id)}
                />
                {lbl}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className={label}>Approved counterparties</label>
          <div className="flex flex-wrap gap-2">
            {KNOWN_COUNTERPARTIES.map(({ id, label: lbl }) => (
              <label
                key={id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                  form.counterpartyIds.includes(id)
                    ? "border-emerald-700 bg-emerald-950/30 text-emerald-300"
                    : "border-rim bg-elevated text-slate-500 hover:border-slate-600"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={form.counterpartyIds.includes(id)}
                  onChange={() => toggleArr("counterpartyIds", id)}
                />
                {lbl}
              </label>
            ))}
          </div>
          <p className="text-[11px] text-slate-600 mt-2 font-mono">
            Counterparties not listed above are blocked — e.g. &quot;unknown-external&quot;
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-black font-semibold text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Creating on ledger…" : "Create mandate"}
        </button>
      </form>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

type ApprovalOutcome = {
  outcome: "executed" | "denied";
  denialCode: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [treasury, setTreasury] = useState<{
    balance: string;
    currency: string;
  } | null>(null);
  const [mandate, setMandate] = useState<MandateView | null | undefined>(
    undefined
  ); // undefined=loading, null=no mandate
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [approvalOutcomes, setApprovalOutcomes] = useState<
    Map<string, ApprovalOutcome>
  >(new Map());
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  // Role guard
  useEffect(() => {
    const role = getRole();
    if (role && role !== "cfo") router.replace("/");
  }, [router]);

  const fetchAll = useCallback(async () => {
    const [tRes, aRes, appRes] = await Promise.allSettled([
      apiFetch<{ balance: string; currency: string }>("/api/treasury"),
      apiFetch<{ items: ActivityItem[] }>("/api/activity"),
      apiFetch<{ items: ApprovalItem[] }>("/api/approvals"),
    ]);

    if (tRes.status === "fulfilled") setTreasury(tRes.value);
    if (aRes.status === "fulfilled") setActivity(aRes.value.items);
    if (appRes.status === "fulfilled") setApprovals(appRes.value.items);

    try {
      const m = await apiFetch<MandateView>("/api/mandate");
      setMandate(m);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
        setMandate(null);
      }
    }

    setDataLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 5000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // Mandate actions
  const mandateAction = async (
    action: "pause" | "resume" | "revoke",
    label: string
  ) => {
    setActionLoading(action);
    try {
      const m = await apiFetch<MandateView>(`/api/mandate/${action}`, {
        method: "POST",
      });
      setMandate(m);
      toast("success", `Mandate ${label}d`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : `Failed to ${label}`);
    } finally {
      setActionLoading(null);
      setShowRevokeConfirm(false);
    }
  };

  // Approval actions
  const handleApprove = async (pendingId: string) => {
    setActionLoading(`approve-${pendingId}`);
    try {
      const res = await apiFetch<ApprovalOutcome>(
        `/api/approvals/${pendingId}/approve`,
        { method: "POST" }
      );
      setApprovalOutcomes((prev) => new Map(prev).set(pendingId, res));
      if (res.outcome === "executed") {
        toast("success", "Action approved and executed on ledger");
      } else {
        toast(
          "warning",
          `Approval denied on recheck: ${res.denialCode ?? "unknown"}`
        );
      }
      setTimeout(() => {
        setApprovals((prev) => prev.filter((a) => a.pendingId !== pendingId));
        setApprovalOutcomes((prev) => {
          const next = new Map(prev);
          next.delete(pendingId);
          return next;
        });
      }, 3500);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (pendingId: string) => {
    setActionLoading(`reject-${pendingId}`);
    try {
      await apiFetch(`/api/approvals/${pendingId}/reject`, { method: "POST" });
      toast("info", "Approval request rejected");
      setApprovals((prev) => prev.filter((a) => a.pendingId !== pendingId));
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (dataLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  // No mandate — show create form
  if (mandate === null) {
    return (
      <div className="animate-fade-in">
        <div className="mb-6 flex items-center gap-3">
          <div>
            <p className="text-xs font-mono text-amber-500 uppercase tracking-wider mb-0.5">
              CFO Dashboard
            </p>
            <h1 className="text-white font-bold text-xl">No active mandate</h1>
          </div>
        </div>
        <div className="p-6 rounded-lg border border-amber-900/40 bg-amber-950/10">
          <MandateForm onCreated={(m) => setMandate(m)} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-mono text-amber-500 uppercase tracking-wider mb-0.5">
            CFO Dashboard
          </p>
          <h1 className="text-white font-bold text-xl">Treasury Control</h1>
        </div>
        <div className="text-xs font-mono text-slate-600">
          Auto-refresh · 5s
        </div>
      </div>

      {/* Row 1: Treasury + Mandate status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Treasury balance */}
        <div className="sm:col-span-1 p-5 rounded-lg border border-rim bg-surface">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">
            Treasury Balance
          </p>
          {treasury ? (
            <p className="text-3xl font-mono font-bold text-white tracking-tight">
              {formatUSD(treasury.balance)}
            </p>
          ) : (
            <Skeleton className="h-8 w-36" />
          )}
          <p className="text-xs text-slate-600 mt-1 font-mono">Demo USD · Canton ledger</p>
        </div>

        {/* Mandate card */}
        {mandate && (
          <div className="sm:col-span-2 p-5 rounded-lg border border-rim bg-surface">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1">
                  Agent Mandate
                </p>
                <div className="flex items-center gap-2">
                  <StatusBadge status={mandate.status} />
                  <span className="text-[11px] font-mono text-slate-600">
                    v{mandate.version}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {mandate.status === "Active" && (
                  <button
                    onClick={() => mandateAction("pause", "pause")}
                    disabled={actionLoading !== null}
                    className="px-3 py-1 text-xs bg-elevated hover:bg-rim border border-rim rounded-md text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === "pause" ? "…" : "Pause"}
                  </button>
                )}
                {mandate.status === "Paused" && (
                  <button
                    onClick={() => mandateAction("resume", "resume")}
                    disabled={actionLoading !== null}
                    className="px-3 py-1 text-xs bg-elevated hover:bg-rim border border-rim rounded-md text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === "resume" ? "…" : "Resume"}
                  </button>
                )}
                {mandate.status !== "Revoked" && (
                  <button
                    onClick={() => setShowRevokeConfirm(true)}
                    disabled={actionLoading !== null}
                    className="px-3 py-1 text-xs bg-red-950/40 hover:bg-red-950/70 border border-red-900/50 hover:border-red-700 rounded-md text-red-400 transition-colors disabled:opacity-50"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Auto-approve below</span>
                  <span className="font-mono text-slate-300">
                    {formatUSD(mandate.autoApproveLimit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Per-action max</span>
                  <span className="font-mono text-slate-300">
                    {formatUSD(mandate.perActionMaximum)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Expires</span>
                  <span className="font-mono text-slate-400">
                    {new Date(mandate.expiresAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
              <div className="text-xs space-y-1">
                <div>
                  <span className="text-slate-500">Categories</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {mandate.permittedCategories.map((c) => (
                      <span
                        key={c}
                        className="px-1.5 py-0.5 rounded bg-elevated border border-rim text-slate-400 text-[10px] font-mono"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-1">
                  <span className="text-slate-500">Counterparties</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {mandate.counterparties.map((cp) => (
                      <span
                        key={cp.party}
                        className="px-1.5 py-0.5 rounded bg-elevated border border-rim text-slate-400 text-[10px] font-mono"
                      >
                        {cp.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Row 2: Spending limits */}
      {mandate && (
        <div className="p-5 rounded-lg border border-rim bg-surface">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-4">
            Spending Limits
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <ProgressBar
              spent={mandate.dailySpent}
              max={mandate.dailyMaximum}
              label="Daily"
            />
            <ProgressBar
              spent={mandate.monthlySpent}
              max={mandate.monthlyMaximum}
              label="Monthly"
            />
          </div>
        </div>
      )}

      {/* Row 3: Pending approvals */}
      {approvals.length > 0 && (
        <div className="p-5 rounded-lg border border-amber-900/40 bg-amber-950/10">
          <div className="flex items-center gap-2 mb-4">
            <p className="text-xs font-mono text-amber-400 uppercase tracking-wider">
              Pending Approvals
            </p>
            <span className="px-1.5 py-0.5 rounded-full bg-amber-900/60 text-amber-300 text-[10px] font-mono">
              {approvals.length}
            </span>
          </div>
          <div className="space-y-3">
            {approvals.map((item) => {
              const outcome = approvalOutcomes.get(item.pendingId);
              const isLoading =
                actionLoading === `approve-${item.pendingId}` ||
                actionLoading === `reject-${item.pendingId}`;

              return (
                <div
                  key={item.pendingId}
                  className="p-4 rounded-lg border border-rim bg-surface"
                >
                  {outcome ? (
                    <div
                      className={`text-sm font-medium ${
                        outcome.outcome === "executed"
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {outcome.outcome === "executed"
                        ? "✓ Executed on ledger"
                        : `✕ Denied on recheck: ${outcome.denialCode}`}
                      {outcome.denialCode && (
                        <p className="text-xs text-slate-500 mt-0.5 font-normal">
                          {DENIAL_EXPLANATIONS[outcome.denialCode] ??
                            outcome.denialCode}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-semibold text-sm">
                            {formatUSD(item.amount)}{" "}
                          </span>
                          <span className="text-slate-400 text-sm">
                            → {item.counterpartyLabel}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-elevated border border-rim text-slate-500 text-[10px] font-mono">
                            {item.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          {item.purpose}
                        </p>
                        <p className="text-[11px] font-mono text-slate-600 mt-0.5">
                          {formatDate(item.createdAt)} ·{" "}
                          {item.requestId.slice(0, 12)}…
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleReject(item.pendingId)}
                          disabled={isLoading || actionLoading !== null}
                          className="px-3 py-1.5 text-xs border border-rim rounded-md text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors disabled:opacity-40"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApprove(item.pendingId)}
                          disabled={isLoading || actionLoading !== null}
                          className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-black font-semibold rounded-md transition-colors disabled:opacity-40"
                        >
                          {isLoading ? "…" : "Approve"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Row 3b: Revoked — offer a fresh mandate. Revocation is terminal (no
          un-revoke choice by design), so this is the only way forward. */}
      {mandate?.status === "Revoked" && (
        <div className="p-6 rounded-lg border border-amber-900/40 bg-amber-950/10">
          <MandateForm onCreated={(m) => setMandate(m)} />
        </div>
      )}

      {/* Row 4: Activity feed */}
      <div className="p-5 rounded-lg border border-rim bg-surface">
        <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-4">
          Activity Feed
        </p>
        {activity.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-8">
            No activity yet — send the AI agent a message to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {activity.map((item, i) => (
              <div
                key={`${item.requestId}-${i}`}
                className="flex items-start gap-3 py-2.5 border-b border-rim last:border-0"
              >
                <ActivityTypeIcon type={item.type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.amount && (
                      <span className="font-mono text-sm text-white font-medium">
                        {formatUSD(item.amount)}
                      </span>
                    )}
                    {item.counterpartyLabel && (
                      <span className="text-slate-400 text-sm">
                        {item.counterpartyLabel}
                      </span>
                    )}
                    {item.category && (
                      <span className="px-1.5 py-0.5 rounded bg-elevated border border-rim text-slate-500 text-[10px] font-mono">
                        {item.category}
                      </span>
                    )}
                    {item.code && (
                      <span className="px-1.5 py-0.5 rounded bg-red-950/40 border border-red-900/50 text-red-400 text-[10px] font-mono">
                        {item.code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {item.detail}
                  </p>
                </div>
                <span className="text-[11px] font-mono text-slate-600 shrink-0">
                  {new Date(item.at).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revoke confirm modal */}
      {showRevokeConfirm && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowRevokeConfirm(false)}
        >
          <div
            className="bg-surface border border-red-900/60 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-semibold mb-2">Revoke mandate?</h3>
            <p className="text-slate-400 text-sm mb-5 leading-relaxed">
              The agent immediately loses all financial authority. Pending
              approvals will be blocked. The mandate cannot be reactivated —
              a new one must be created.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRevokeConfirm(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => mandateAction("revoke", "revoke")}
                disabled={actionLoading !== null}
                className="px-4 py-2 text-sm bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
              >
                {actionLoading === "revoke" ? "Revoking…" : "Revoke mandate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
