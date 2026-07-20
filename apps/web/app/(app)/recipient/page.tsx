"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowClockwise,
  CheckCircle,
  Receipt,
  ShieldCheck,
  Wallet,
} from "@phosphor-icons/react";
import {
  apiFetch,
  getRole,
  getDisplayName,
  formatUSD,
  formatDate,
  type ActivityItem,
} from "@/components/api";
import {
  EmptyState,
  InlineError,
  PageHeader,
  PrivacyBoundary,
  Skeleton,
} from "@/components/ui";

export default function RecipientPage() {
  const router = useRouter();
  const [receipts, setReceipts] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("Recipient");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    const role = getRole();
    if (role && role !== "recipient") router.replace("/");
    setDisplayName(getDisplayName() ?? "Recipient");
  }, [router]);

  const fetchReceipts = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const response = await apiFetch<{ items: ActivityItem[] }>("/api/activity");
      setReceipts(response.items.filter((item) => item.type === "receipt"));
      setError(null);
      setLastUpdated(new Date());
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Could not load receipts");
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchReceipts();
    const id = setInterval(fetchReceipts, 5000);
    return () => clearInterval(id);
  }, [fetchReceipts]);

  const total = receipts.reduce((sum, receipt) => sum + (parseFloat(receipt.amount ?? "0") || 0), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      <PageHeader
        title="Received payments"
        description={`${displayName} sees only receipts where its Canton party is the named recipient.`}
        action={
          <div className="flex items-center gap-2 text-xs text-faint">
            <ArrowClockwise className="size-4" />
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Awaiting refresh"}
          </div>
        }
      />

      <PrivacyBoundary
        summary="Recipient-scoped ledger visibility"
        detail="ExecutionReceipt names each recipient as an observer. Limits, requests, violations, and other payments remain private."
        hiddenItems={[
          "treasury balance",
          "mandate terms and limits",
          "other recipients' payments",
          "policy violations",
          "pending approvals",
          "agent conversation history",
        ]}
      />

      {error && (
        <InlineError
          title={receipts.length > 0 ? "Refresh failed" : "Receipts unavailable"}
          message={receipts.length > 0 ? `${error}. Showing last confirmed data.` : error}
          onRetry={fetchReceipts}
        />
      )}

      {!loading && receipts.length > 0 && (
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-panel border border-rim bg-surface p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-muted">Total received</p>
              <Wallet className="size-5 text-faint" />
            </div>
            <p className="mt-4 font-mono text-3xl font-semibold tracking-[-0.045em] text-ink">
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(total)}
            </p>
          </div>
          <div className="rounded-panel border border-rim bg-surface p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-muted">Confirmed receipts</p>
              <Receipt className="size-5 text-faint" />
            </div>
            <p className="mt-4 font-mono text-3xl font-semibold tracking-[-0.045em] text-ink">{receipts.length}</p>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-panel border border-rim bg-surface">
        <div className="border-b border-rim px-4 py-4 sm:px-5">
          <h2 className="text-sm font-semibold text-ink">Ledger receipts</h2>
          <p className="mt-1 text-xs text-faint">Confirmed ExecutionReceipt contracts</p>
        </div>

        {loading ? (
          <div aria-busy="true" aria-label="Loading receipts" className="space-y-3 p-4 sm:p-5">
            {[1, 2].map((item) => <Skeleton key={item} className="h-28" />)}
          </div>
        ) : !error && receipts.length === 0 ? (
          <EmptyState
            icon={<Receipt className="size-5" />}
            title="No receipts yet"
            description="Payments addressed to this Canton party will appear after ledger confirmation."
          />
        ) : receipts.length > 0 ? (
          <div>
            {receipts.map((item, index) => (
              <article
                key={`${item.requestId}-${index}`}
                className={`p-4 sm:p-5 ${index < receipts.length - 1 ? "border-b border-rim" : ""}`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-emerald-950/35 text-emerald-400">
                      <Receipt className="size-5" weight="fill" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-lg font-semibold text-ink">{formatUSD(item.amount)}</span>
                        {item.currency && <span className="font-mono text-xs text-faint">{item.currency}</span>}
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-900/70 bg-emerald-950/25 px-2 py-1 text-[10px] font-medium text-emerald-300">
                          <CheckCircle className="size-3" weight="fill" />
                          Confirmed
                        </span>
                      </div>
                      {item.category && <p className="mt-2 font-mono text-[11px] text-faint">{item.category}</p>}
                      <p className="mt-1 text-sm leading-6 text-muted">{item.detail}</p>
                    </div>
                  </div>
                  <time className="pl-12 font-mono text-[11px] text-faint sm:pl-0">{formatDate(item.at)}</time>
                </div>
                <div className="mt-3 flex items-center gap-2 pl-12 font-mono text-[10px] text-faint">
                  <ShieldCheck className="size-3.5" />
                  Request {item.requestId.slice(0, 16)}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
