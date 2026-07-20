import type { ReactNode } from "react";
import {
  ArrowClockwise,
  Check,
  LockKey,
  WarningCircle,
} from "@phosphor-icons/react";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton-sheen rounded-control ${className}`}
    />
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-[-0.035em] text-ink sm:text-[2rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            {description}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-panel border border-rim bg-surface p-4 sm:p-5 ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {description && (
            <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-5 py-10 text-center">
      <div className="mb-4 flex size-11 items-center justify-center rounded-control border border-rim bg-elevated text-muted">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function InlineError({
  title = "Data unavailable",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-control border border-red-900/70 bg-red-950/25 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex gap-3">
        <WarningCircle className="mt-0.5 size-5 shrink-0 text-red-400" weight="fill" />
        <div>
          <p className="text-sm font-medium text-red-200">{title}</p>
          <p className="mt-0.5 text-xs leading-5 text-red-200/70">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-control border border-red-800 px-3 text-xs font-medium text-red-100 transition hover:bg-red-900/40 active:scale-[0.98]"
        >
          <ArrowClockwise className="size-4" />
          Retry
        </button>
      )}
    </div>
  );
}

export function PrivacyBoundary({
  summary,
  detail,
  hiddenItems,
}: {
  summary: string;
  detail: string;
  hiddenItems: string[];
}) {
  return (
    <section className="overflow-hidden rounded-panel border border-rim bg-surface">
      <div className="flex gap-3 border-b border-rim p-4 sm:p-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-strong">
          <LockKey className="size-5" weight="fill" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink">{summary}</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted">{detail}</p>
        </div>
      </div>
      <div className="grid gap-x-8 gap-y-2 p-4 sm:grid-cols-2 sm:p-5">
        {hiddenItems.map((item) => (
          <div key={item} className="flex items-center gap-2 text-xs text-muted">
            <Check className="size-4 shrink-0 text-faint" weight="bold" />
            Hidden: {item}
          </div>
        ))}
      </div>
    </section>
  );
}

export const buttonPrimary =
  "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-control bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45";

export const buttonSecondary =
  "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-control border border-rim bg-elevated px-4 text-sm font-medium text-ink transition hover:border-rim-strong hover:bg-rim/70 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45";

export const buttonGhost =
  "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-control px-3 text-sm font-medium text-muted transition hover:bg-elevated hover:text-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45";

export const fieldClass =
  "min-h-11 w-full rounded-control border border-rim bg-elevated px-3 text-sm text-ink placeholder:text-faint transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50";
