"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowClockwise,
  ArrowRight,
  Bank,
  Check,
  CheckCircle,
  CircleNotch,
  Clock,
  Pause,
  Play,
  Receipt,
  ShieldWarning,
  Warning,
  X,
  XCircle,
} from "@phosphor-icons/react";
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
import {
  EmptyState,
  InlineError,
  PageHeader,
  Section,
  Skeleton,
  buttonGhost,
  buttonPrimary,
  buttonSecondary,
  fieldClass,
} from "@/components/ui";
import { signWithLoopWallet } from "@/lib/loopWallet";
import { canonicalMandateMessage } from "@/lib/mandateSigning";

const KNOWN_CATEGORIES = [
  { id: "OperationalPayment", label: "Operational payment" },
  { id: "TreasuryTransfer", label: "Treasury transfer" },
  { id: "CollateralTopUp", label: "Collateral top-up" },
  { id: "PayrollDisbursement", label: "Payroll disbursement" },
  { id: "Reimbursement", label: "Reimbursement" },
];

const KNOWN_COUNTERPARTIES = [
  { id: "cloud-operations", label: "Cloud Operations" },
  { id: "reserve-account", label: "Treasury Reserve" },
];

function StatusBadge({ status }: { status: MandateView["status"] }) {
  const styles = {
    Active: "border-emerald-900/70 bg-emerald-950/35 text-emerald-300",
    Paused: "border-amber-900/70 bg-amber-950/35 text-amber-300",
    Revoked: "border-red-900/70 bg-red-950/35 text-red-300",
  };
  const Icon = status === "Active" ? CheckCircle : status === "Paused" ? Pause : XCircle;
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-control border px-2.5 text-xs font-medium ${styles[status]}`}
    >
      <Icon className="size-3.5" weight="fill" />
      {status}
    </span>
  );
}

function ActivityIcon({ type }: { type: ActivityItem["type"] }) {
  const cls = "size-4";
  if (type === "receipt") return <Receipt className={`${cls} text-emerald-400`} />;
  if (type === "violation") return <ShieldWarning className={`${cls} text-red-400`} />;
  if (type === "pending") return <Clock className={`${cls} text-amber-400`} />;
  return <ArrowClockwise className={`${cls} text-muted`} />;
}

function UsageMetric({
  label,
  spent,
  maximum,
}: {
  label: string;
  spent: string;
  maximum: string;
}) {
  const spentN = parseFloat(spent) || 0;
  const maxN = parseFloat(maximum) || 1;
  const pct = Math.min(Math.round((spentN / maxN) * 100), 100);
  const tone = pct > 90 ? "text-red-400" : pct > 70 ? "text-amber-400" : "text-ink";
  return (
    <div className="rounded-control border border-rim bg-elevated p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted">{label}</p>
          <p className={`mt-2 font-mono text-xl font-semibold tracking-[-0.03em] ${tone}`}>
            {formatUSD(subtract(maximum, spent))}
          </p>
          <p className="mt-1 text-xs text-faint">remaining of {formatUSD(maximum)}</p>
        </div>
        <span className={`font-mono text-sm font-medium ${tone}`}>{pct}% used</span>
      </div>
      <div className="mt-4 h-px bg-rim">
        <div className="h-px bg-brand transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MandateForm({ onCreated }: { onCreated: (mandate: MandateView) => void }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [signingStage, setSigningStage] = useState<"idle" | "signing" | "submitting">("idle");
  const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const [form, setForm] = useState({
    autoApproveLimit: "500",
    perActionMaximum: "2000",
    dailyMaximum: "5000",
    monthlyMaximum: "20000",
    expiresAt: thirtyDays,
    counterpartyIds: ["cloud-operations", "reserve-account"],
    categories: ["OperationalPayment", "TreasuryTransfer"],
  });

  const toggleArr = (key: "counterpartyIds" | "categories", value: string) => {
    setForm((previous) => ({
      ...previous,
      [key]: previous[key].includes(value)
        ? previous[key].filter((item) => item !== value)
        : [...previous[key], value],
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.categories.length === 0 || form.counterpartyIds.length === 0) {
      toast("warning", "Choose at least one category and counterparty");
      return;
    }
    setSubmitting(true);
    const expiresAt = new Date(`${form.expiresAt}T23:59:59Z`).toISOString();
    const terms = {
      autoApproveLimit: form.autoApproveLimit,
      perActionMaximum: form.perActionMaximum,
      dailyMaximum: form.dailyMaximum,
      monthlyMaximum: form.monthlyMaximum,
      expiresAt,
      counterpartyIds: form.counterpartyIds,
      categories: form.categories,
    };

    // Require a real Loop Wallet signature over these exact terms before
    // submitting — this is a real authorization gate, not a login-time
    // cosmetic check. If the wallet is unreachable or the request is
    // rejected, mandate creation does not proceed.
    setSigningStage("signing");
    let walletSignature: Awaited<ReturnType<typeof signWithLoopWallet>>;
    try {
      const message = canonicalMandateMessage(terms);
      walletSignature = await signWithLoopWallet(message);
    } catch (error) {
      toast(
        "error",
        error instanceof Error
          ? `Loop Wallet signature required: ${error.message}`
          : "Loop Wallet signature required to create a mandate."
      );
      setSubmitting(false);
      setSigningStage("idle");
      return;
    }

    setSigningStage("submitting");
    try {
      const body: CreateMandateBody = {
        ...terms,
        walletPartyId: walletSignature.partyId,
        walletSignature: JSON.stringify(walletSignature.signature),
        signedMessage: walletSignature.message,
      };
      const mandate = await apiFetch<MandateView>("/api/mandate", {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast("success", "Mandate signed via Loop Wallet and created on ledger", {
        label: "View on Canton Explorer",
        href: mandate.explorerUrl,
      });
      onCreated(mandate);
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "Failed to create mandate");
    } finally {
      setSubmitting(false);
      setSigningStage("idle");
    }
  };

  const amountFields = [
    ["autoApproveLimit", "Auto-approve below", "Actions below this amount execute without review."],
    ["perActionMaximum", "Per-action maximum", "Hard cap for any single request."],
    ["dailyMaximum", "Daily cap", "Maximum cumulative spend per day."],
    ["monthlyMaximum", "Monthly cap", "Maximum cumulative spend per month."],
  ] as const;

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-ink">Create agent mandate</h2>
        <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
          Define deterministic financial authority. Every limit is enforced on the Canton ledger.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {amountFields.map(([key, label, help]) => (
          <div key={key}>
            <label htmlFor={key} className="mb-2 block text-sm font-medium text-ink">
              {label}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-3 text-sm text-faint">$</span>
              <input
                id={key}
                type="text"
                inputMode="decimal"
                required
                pattern="^\\d+(\\.\\d{1,2})?$"
                aria-describedby={`${key}-help`}
                className={`${fieldClass} pl-7 font-mono`}
                value={form[key]}
                onChange={(event) => setForm((previous) => ({ ...previous, [key]: event.target.value }))}
              />
            </div>
            <p id={`${key}-help`} className="mt-1.5 text-xs leading-5 text-faint">{help}</p>
          </div>
        ))}
      </div>

      <div className="max-w-xs">
        <label htmlFor="expiresAt" className="mb-2 block text-sm font-medium text-ink">
          Mandate expiry
        </label>
        <input
          id="expiresAt"
          type="date"
          required
          min={new Date().toISOString().split("T")[0]}
          className={fieldClass}
          value={form.expiresAt}
          onChange={(event) => setForm((previous) => ({ ...previous, expiresAt: event.target.value }))}
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-ink">Permitted categories</legend>
        <p className="mt-1 text-xs text-faint">Only selected transaction types can pass policy evaluation.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {KNOWN_CATEGORIES.map(({ id, label }) => {
            const checked = form.categories.includes(id);
            return (
              <label
                key={id}
                className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-control border px-3 text-xs font-medium transition active:scale-[0.98] ${
                  checked
                    ? "border-brand/60 bg-brand-soft text-brand-strong"
                    : "border-rim bg-elevated text-muted hover:border-rim-strong hover:text-ink"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => toggleArr("categories", id)}
                />
                {checked && <Check className="size-3.5" weight="bold" />}
                {label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-ink">Approved counterparties</legend>
        <p className="mt-1 text-xs text-faint">Requests to any other party are denied and recorded.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {KNOWN_COUNTERPARTIES.map(({ id, label }) => {
            const checked = form.counterpartyIds.includes(id);
            return (
              <label
                key={id}
                className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-control border px-3 text-xs font-medium transition active:scale-[0.98] ${
                  checked
                    ? "border-brand/60 bg-brand-soft text-brand-strong"
                    : "border-rim bg-elevated text-muted hover:border-rim-strong hover:text-ink"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => toggleArr("counterpartyIds", id)}
                />
                {checked && <Check className="size-3.5" weight="bold" />}
                {label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <button type="submit" disabled={submitting} className={buttonPrimary}>
        {submitting ? <CircleNotch className="size-4 animate-spin" /> : <ShieldWarning className="size-4" />}
        {signingStage === "signing"
          ? "Awaiting Loop Wallet signature…"
          : signingStage === "submitting"
            ? "Creating on ledger"
            : "Create mandate"}
      </button>
      {signingStage === "signing" && (
        <p className="text-xs leading-5 text-faint">
          Approve the signature request in Loop Wallet to authorize these exact terms.
        </p>
      )}
    </form>
  );
}

type ApprovalOutcome = {
  outcome: "executed" | "denied";
  denialCode: string | null;
  explorerUrl: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [treasury, setTreasury] = useState<{ balance: string; currency: string } | null>(null);
  const [mandate, setMandate] = useState<MandateView | null | undefined>(undefined);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [failedResources, setFailedResources] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [approvalOutcomes, setApprovalOutcomes] = useState(new Map<string, ApprovalOutcome>());
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const fetchingRef = useRef(false);
  const revokeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const role = getRole();
    if (role && role !== "cfo") router.replace("/login");
  }, [router]);

  const fetchAll = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    const failures: string[] = [];
    try {
      const [treasuryResult, activityResult, approvalsResult, mandateResult] = await Promise.allSettled([
        apiFetch<{ balance: string; currency: string }>("/api/treasury"),
        apiFetch<{ items: ActivityItem[] }>("/api/activity"),
        apiFetch<{ items: ApprovalItem[] }>("/api/approvals"),
        apiFetch<MandateView>("/api/mandate"),
      ]);

      if (treasuryResult.status === "fulfilled") setTreasury(treasuryResult.value);
      else failures.push("treasury");
      if (activityResult.status === "fulfilled") setActivity(activityResult.value.items);
      else failures.push("activity");
      if (approvalsResult.status === "fulfilled") setApprovals(approvalsResult.value.items);
      else failures.push("approvals");
      if (mandateResult.status === "fulfilled") {
        setMandate(mandateResult.value);
      } else {
        const message = mandateResult.reason instanceof Error ? mandateResult.reason.message : "";
        if (message.includes("404") || message.toLowerCase().includes("not found")) setMandate(null);
        else failures.push("mandate");
      }
      if (failures.length < 4) setLastUpdated(new Date());
      setFailedResources(failures);
    } finally {
      fetchingRef.current = false;
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 5000);
    return () => clearInterval(id);
  }, [fetchAll]);

  useEffect(() => {
    if (!showRevokeConfirm) return;
    revokeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowRevokeConfirm(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showRevokeConfirm]);

  const mandateAction = async (action: "pause" | "resume" | "revoke", pastTense: string) => {
    setActionLoading(action);
    try {
      const nextMandate = await apiFetch<MandateView>(`/api/mandate/${action}`, { method: "POST" });
      setMandate(nextMandate);
      toast("success", `Mandate ${pastTense}`, {
        label: "View on Canton Explorer",
        href: nextMandate.explorerUrl,
      });
    } catch (error) {
      toast("error", error instanceof Error ? error.message : `Failed to ${action} mandate`);
    } finally {
      setActionLoading(null);
      setShowRevokeConfirm(false);
    }
  };

  const handleApprove = async (pendingId: string) => {
    setActionLoading(`approve-${pendingId}`);
    try {
      const result = await apiFetch<ApprovalOutcome>(`/api/approvals/${pendingId}/approve`, { method: "POST" });
      setApprovalOutcomes((previous) => new Map(previous).set(pendingId, result));
      const explorerLink = { label: "View on Canton Explorer", href: result.explorerUrl };
      if (result.outcome === "executed") {
        toast("success", "Action approved and executed on ledger", explorerLink);
      } else {
        toast("warning", `Approval denied on recheck: ${result.denialCode ?? "unknown"}`, explorerLink);
      }
      setTimeout(() => {
        setApprovals((previous) => previous.filter((item) => item.pendingId !== pendingId));
        setApprovalOutcomes((previous) => {
          const next = new Map(previous);
          next.delete(pendingId);
          return next;
        });
      }, 3500);
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "Failed to approve action");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (pendingId: string) => {
    setActionLoading(`reject-${pendingId}`);
    try {
      const rejectResult = await apiFetch<{ ok: true; explorerUrl: string }>(
        `/api/approvals/${pendingId}/reject`,
        { method: "POST" }
      );
      toast("info", "Approval request rejected", {
        label: "View on Canton Explorer",
        href: rejectResult.explorerUrl,
      });
      setApprovals((previous) => previous.filter((item) => item.pendingId !== pendingId));
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "Failed to reject action");
    } finally {
      setActionLoading(null);
    }
  };

  if (dataLoading) {
    return (
      <div aria-busy="true" aria-label="Loading treasury controls" className="space-y-6">
        <Skeleton className="h-16 max-w-md" />
        <div className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-56" />
      </div>
    );
  }

  if (mandate === null) {
    return (
      <div className="space-y-7 animate-fade-in">
        <PageHeader
          title="Treasury control"
          description="No active mandate. Define the agent's exact authority before it can transact."
        />
        {failedResources.length > 0 && (
          <InlineError message={`Could not refresh: ${failedResources.join(", ")}.`} onRetry={fetchAll} />
        )}
        <div className="rounded-panel border border-rim bg-surface p-5 sm:p-7">
          <MandateForm onCreated={setMandate} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Treasury control"
        description="Manage delegated authority, review human checkpoints, and inspect ledger outcomes."
        action={
          <div className="flex items-center gap-2 text-xs text-faint">
            <ArrowClockwise className="size-4" />
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Awaiting refresh"}
          </div>
        }
      />

      {failedResources.length > 0 && (
        <InlineError
          title="Some ledger data is unavailable"
          message={`Could not refresh: ${failedResources.join(", ")}. Existing values may be stale.`}
          onRetry={fetchAll}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[0.78fr_1.22fr]">
        <section className="rounded-panel border border-rim bg-surface p-5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-muted">Treasury balance</p>
            <Bank className="size-5 text-faint" />
          </div>
          <p className="mt-5 font-mono text-3xl font-semibold tracking-[-0.045em] text-ink">
            {failedResources.includes("treasury") ? "-" : formatUSD(treasury?.balance)}
          </p>
          <p className="mt-2 text-xs text-faint">Demo USD on Canton ledger</p>
        </section>

        {mandate ? (
          <section className="rounded-panel border border-rim bg-surface p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-ink">Agent mandate</h2>
                  <StatusBadge status={mandate.status} />
                </div>
                <p className="mt-2 font-mono text-xs text-faint">Version {mandate.version}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {mandate.status === "Active" && (
                  <button
                    type="button"
                    onClick={() => mandateAction("pause", "paused")}
                    disabled={actionLoading !== null}
                    className={buttonSecondary}
                  >
                    {actionLoading === "pause" ? <CircleNotch className="size-4 animate-spin" /> : <Pause className="size-4" />}
                    Pause
                  </button>
                )}
                {mandate.status === "Paused" && (
                  <button
                    type="button"
                    onClick={() => mandateAction("resume", "resumed")}
                    disabled={actionLoading !== null}
                    className={buttonSecondary}
                  >
                    {actionLoading === "resume" ? <CircleNotch className="size-4 animate-spin" /> : <Play className="size-4" />}
                    Resume
                  </button>
                )}
                {mandate.status !== "Revoked" && (
                  <button
                    type="button"
                    onClick={() => setShowRevokeConfirm(true)}
                    disabled={actionLoading !== null}
                    className="inline-flex min-h-10 items-center gap-2 rounded-control px-3 text-sm font-medium text-red-300 transition hover:bg-red-950/40 active:scale-[0.98] disabled:opacity-45"
                  >
                    <XCircle className="size-4" />
                    Revoke
                  </button>
                )}
              </div>
            </div>

            <dl className="mt-5 grid gap-4 border-t border-rim pt-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-faint">Auto-approve below</dt>
                <dd className="mt-1 font-mono text-sm text-ink">{formatUSD(mandate.autoApproveLimit)}</dd>
              </div>
              <div>
                <dt className="text-xs text-faint">Per-action max</dt>
                <dd className="mt-1 font-mono text-sm text-ink">{formatUSD(mandate.perActionMaximum)}</dd>
              </div>
              <div>
                <dt className="text-xs text-faint">Expires</dt>
                <dd className="mt-1 font-mono text-sm text-ink">
                  {new Date(mandate.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </dd>
              </div>
            </dl>
          </section>
        ) : (
          <InlineError message="Mandate data could not be loaded." onRetry={fetchAll} />
        )}
      </div>

      {mandate && (
        <Section title="Available authority" description="Current counters from the active mandate state.">
          <div className="grid gap-3 sm:grid-cols-2">
            <UsageMetric label="Daily authority" spent={mandate.dailySpent} maximum={mandate.dailyMaximum} />
            <UsageMetric label="Monthly authority" spent={mandate.monthlySpent} maximum={mandate.monthlyMaximum} />
          </div>
          <div className="mt-4 grid gap-4 border-t border-rim pt-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted">Permitted categories</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {mandate.permittedCategories.map((category) => (
                  <span key={category} className="rounded-control border border-rim bg-elevated px-2.5 py-1 text-xs text-muted">{category}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted">Approved counterparties</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {mandate.counterparties.map((counterparty) => (
                  <span key={counterparty.party} className="rounded-control border border-rim bg-elevated px-2.5 py-1 text-xs text-muted">{counterparty.label}</span>
                ))}
              </div>
            </div>
          </div>
        </Section>
      )}

      {!failedResources.includes("approvals") && approvals.length > 0 && (
        <Section
          title="Needs human approval"
          description={`${approvals.length} request${approvals.length === 1 ? "" : "s"} exceeded automatic authority.`}
          className="border-amber-900/60"
        >
          <div className="space-y-3">
            {approvals.map((item) => {
              const outcome = approvalOutcomes.get(item.pendingId);
              const isLoading = actionLoading === `approve-${item.pendingId}` || actionLoading === `reject-${item.pendingId}`;
              return (
                <article key={item.pendingId} className="rounded-control border border-rim bg-elevated p-4">
                  {outcome ? (
                    <div className="flex gap-3">
                      {outcome.outcome === "executed" ? (
                        <CheckCircle className="size-5 shrink-0 text-emerald-400" weight="fill" />
                      ) : (
                        <ShieldWarning className="size-5 shrink-0 text-red-400" weight="fill" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {outcome.outcome === "executed" ? "Executed on ledger" : `Denied on recheck: ${outcome.denialCode}`}
                        </p>
                        {outcome.denialCode && (
                          <p className="mt-1 text-xs text-muted">{DENIAL_EXPLANATIONS[outcome.denialCode] ?? outcome.denialCode}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-mono text-base font-semibold text-ink">{formatUSD(item.amount)}</span>
                          <ArrowRight className="size-4 text-faint" />
                          <span className="text-sm text-muted">{item.counterpartyLabel}</span>
                          <span className="rounded-md border border-rim px-2 py-0.5 text-[11px] text-faint">{item.category}</span>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted">{item.purpose}</p>
                        <p className="mt-1 font-mono text-[11px] text-faint">{formatDate(item.createdAt)} | {item.requestId.slice(0, 12)}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button type="button" onClick={() => handleReject(item.pendingId)} disabled={isLoading || actionLoading !== null} className={buttonGhost}>
                          Reject
                        </button>
                        <button type="button" onClick={() => handleApprove(item.pendingId)} disabled={isLoading || actionLoading !== null} className={buttonPrimary}>
                          {isLoading && <CircleNotch className="size-4 animate-spin" />}
                          Approve
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </Section>
      )}

      {mandate?.status === "Revoked" && (
        <div className="rounded-panel border border-rim bg-surface p-5 sm:p-7">
          <MandateForm onCreated={setMandate} />
        </div>
      )}

      <Section title="Ledger activity" description="Receipts, policy outcomes, and mandate state changes.">
        {failedResources.includes("activity") ? (
          <InlineError message="Activity could not be refreshed." onRetry={fetchAll} />
        ) : activity.length === 0 ? (
          <EmptyState
            icon={<Receipt className="size-5" />}
            title="No activity yet"
            description="Agent requests and mandate changes will appear here after ledger confirmation."
          />
        ) : (
          <div>
            {activity.map((item, index) => (
              <article
                key={`${item.requestId}-${index}`}
                className={`grid gap-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center ${index < activity.length - 1 ? "border-b border-rim" : ""}`}
              >
                <div className="flex min-w-0 gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-control bg-elevated">
                    <ActivityIcon type={item.type} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.amount && <span className="font-mono text-sm font-medium text-ink">{formatUSD(item.amount)}</span>}
                      {item.counterpartyLabel && <span className="text-sm text-muted">{item.counterpartyLabel}</span>}
                      {(item.code || item.category) && (
                        <span className="rounded-md border border-rim px-2 py-0.5 font-mono text-[10px] text-faint">{item.code ?? item.category}</span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted">{item.detail}</p>
                  </div>
                </div>
                <time className="pl-11 font-mono text-[11px] text-faint sm:pl-0">
                  {new Date(item.at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </time>
              </article>
            ))}
          </div>
        )}
      </Section>

      {showRevokeConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/85 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowRevokeConfirm(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="revoke-title"
            aria-describedby="revoke-description"
            className="w-full max-w-md rounded-panel border border-red-900/70 bg-surface p-6 panel-shadow animate-slide-in"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="revoke-title" className="text-lg font-semibold text-ink">Revoke mandate?</h2>
                <p id="revoke-description" className="mt-2 text-sm leading-6 text-muted">
                  Agent authority ends immediately. Pending approvals cannot execute. This mandate cannot be restored.
                </p>
              </div>
              <button type="button" aria-label="Close dialog" onClick={() => setShowRevokeConfirm(false)} className="flex size-9 shrink-0 items-center justify-center rounded-control text-muted hover:bg-elevated hover:text-ink">
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setShowRevokeConfirm(false)} className={buttonGhost}>Cancel</button>
              <button
                ref={revokeButtonRef}
                type="button"
                onClick={() => mandateAction("revoke", "revoked")}
                disabled={actionLoading !== null}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-control bg-red-700 px-4 text-sm font-semibold text-white transition hover:bg-red-600 active:scale-[0.98] disabled:opacity-50"
              >
                {actionLoading === "revoke" ? <CircleNotch className="size-4 animate-spin" /> : <Warning className="size-4" weight="fill" />}
                Revoke mandate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
