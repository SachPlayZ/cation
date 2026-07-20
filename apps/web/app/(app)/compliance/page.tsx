"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowClockwise,
  CheckCircle,
  ShieldCheck,
  ShieldWarning,
} from "@phosphor-icons/react";
import {
  apiFetch,
  getRole,
  formatUSD,
  formatDate,
  DENIAL_EXPLANATIONS,
  type ActivityItem,
} from "@/components/api";
import {
  EmptyState,
  InlineError,
  PageHeader,
  PrivacyBoundary,
  Skeleton,
} from "@/components/ui";

export default function CompliancePage() {
  const router = useRouter();
  const [violations, setViolations] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    const role = getRole();
    if (role && role !== "compliance") router.replace("/login");
  }, [router]);

  const fetchViolations = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const response = await apiFetch<{ items: ActivityItem[] }>("/api/activity");
      setViolations(response.items.filter((item) => item.type === "violation"));
      setError(null);
      setLastUpdated(new Date());
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Could not load violations");
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchViolations();
    const id = setInterval(fetchViolations, 5000);
    return () => clearInterval(id);
  }, [fetchViolations]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      <PageHeader
        title="Policy violations"
        description="Compliance sees denial records only. Contract observers enforce this boundary before data reaches the app."
        action={
          <div className="flex items-center gap-2 text-xs text-faint">
            <ArrowClockwise className="size-4" />
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Awaiting refresh"}
          </div>
        }
      />

      <PrivacyBoundary
        summary="Privacy enforced by contract"
        detail="The PolicyViolation template names Compliance as an observer. Other contract templates remain invisible to this party."
        hiddenItems={[
          "treasury balance",
          "mandate terms and limits",
          "approved receipts",
          "pending approvals",
          "agent conversation history",
          "unrelated counterparty identities",
        ]}
      />

      {error && (
        <InlineError
          title={violations.length > 0 ? "Refresh failed" : "Violations unavailable"}
          message={violations.length > 0 ? `${error}. Showing last confirmed data.` : error}
          onRetry={fetchViolations}
        />
      )}

      <section className="overflow-hidden rounded-panel border border-rim bg-surface">
        <div className="flex items-center justify-between border-b border-rim px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-ink">Violation records</h2>
            <p className="mt-1 text-xs text-faint">Compliance party Canton ACS</p>
          </div>
          {!loading && !error && (
            <span className="font-mono text-xs text-muted">{violations.length} total</span>
          )}
        </div>

        {loading ? (
          <div aria-busy="true" aria-label="Loading violations" className="space-y-3 p-4 sm:p-5">
            {[1, 2, 3].map((item) => <Skeleton key={item} className="h-24" />)}
          </div>
        ) : !error && violations.length === 0 ? (
          <EmptyState
            icon={<CheckCircle className="size-5" />}
            title="No violations recorded"
            description="Every observed agent action is currently within mandate policy."
          />
        ) : violations.length > 0 ? (
          <div>
            {violations.map((item, index) => (
              <article
                key={`${item.requestId}-${index}`}
                className={`p-4 sm:p-5 ${index < violations.length - 1 ? "border-b border-rim" : ""}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-red-950/40 text-red-400">
                      <ShieldWarning className="size-5" weight="fill" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.code && (
                          <span className="rounded-md border border-red-900/70 bg-red-950/25 px-2 py-1 font-mono text-[10px] text-red-300">
                            {item.code}
                          </span>
                        )}
                        {item.amount && <span className="font-mono text-sm font-semibold text-ink">{formatUSD(item.amount)}</span>}
                        {item.counterpartyLabel && <span className="text-sm text-muted">to {item.counterpartyLabel}</span>}
                      </div>
                      {item.code && DENIAL_EXPLANATIONS[item.code] && (
                        <p className="mt-2 text-sm leading-6 text-red-200/75">{DENIAL_EXPLANATIONS[item.code]}</p>
                      )}
                      <p className="mt-1 text-xs leading-5 text-muted">{item.detail}</p>
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
