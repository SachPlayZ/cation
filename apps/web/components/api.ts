// ── Types ──────────────────────────────────────────────────────────────────────

export type Role = "cfo" | "agent" | "compliance" | "recipient";

export interface MandateView {
  mandateId: string;
  status: "Active" | "Paused" | "Revoked";
  autoApproveLimit: string;
  perActionMaximum: string;
  dailyMaximum: string;
  monthlyMaximum: string;
  dailySpent: string;
  monthlySpent: string;
  currency: string;
  expiresAt: string;
  permittedCategories: string[];
  counterparties: { party: string; label: string }[];
  version: number;
}

export interface ActivityItem {
  type: "receipt" | "violation" | "pending" | "mandate-event";
  requestId: string;
  amount?: string;
  currency?: string;
  counterpartyLabel?: string;
  code?: string;
  category?: string;
  at: string;
  detail: string;
}

export interface ApprovalItem {
  pendingId: string;
  requestId: string;
  amount: string;
  currency: string;
  counterpartyLabel: string;
  category: string;
  purpose: string;
  createdAt: string;
}

export interface ChatActionResult {
  requestId: string;
  category: string;
  amount: string;
  counterpartyId: string;
  purpose: string;
  outcome: "executed" | "pending" | "denied";
  denialCode: string | null;
  receiptId: string | null;
}

export interface ChatResponse {
  reply: string;
  action: ChatActionResult | null;
}

export interface CreateMandateBody {
  autoApproveLimit: string;
  perActionMaximum: string;
  dailyMaximum: string;
  monthlyMaximum: string;
  expiresAt: string;
  counterpartyIds: string[];
  categories: string[];
}

// ── Auth helpers ───────────────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cation_token");
}

export function getRole(): Role | null {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem("cation_role") as Role) ?? null;
}

export function getDisplayName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cation_display_name");
}

export function setAuth(token: string, role: string, displayName: string) {
  localStorage.setItem("cation_token", token);
  localStorage.setItem("cation_role", role);
  localStorage.setItem("cation_display_name", displayName);
}

export function clearAuth() {
  localStorage.removeItem("cation_token");
  localStorage.removeItem("cation_role");
  localStorage.removeItem("cation_display_name");
}

// ── Fetch wrapper ──────────────────────────────────────────────────────────────

export async function apiFetch<T>(
  path: string,
  init: Omit<RequestInit, "headers"> & { headers?: Record<string, string> } = {}
): Promise<T> {
  const token = getToken();
  const { headers: extra = {}, ...rest } = init;

  const res = await fetch(path, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
  });

  if (res.status === 401) {
    clearAuth();
    if (typeof window !== "undefined") window.location.href = "/";
    throw new Error("Unauthenticated");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `HTTP ${res.status}`
    );
  }

  return res.json() as Promise<T>;
}

// ── Auth API ───────────────────────────────────────────────────────────────────

export async function login(
  username: string,
  password: string
): Promise<{ token: string; role: Role; displayName: string }> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Login failed");
  }
  return res.json();
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function formatUSD(amount: string | undefined | null): string {
  if (!amount) return "—";
  const n = parseFloat(amount);
  if (isNaN(n)) return amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function subtract(a: string, b: string): string {
  const result = parseFloat(a) - parseFloat(b);
  return isNaN(result) ? "0" : result.toFixed(2);
}

export const DENIAL_EXPLANATIONS: Record<string, string> = {
  COUNTERPARTY_NOT_ALLOWED: "Counterparty is not in the mandate allowlist",
  ACTION_CATEGORY_NOT_ALLOWED: "Transaction category is not permitted by mandate",
  MANDATE_EXPIRED: "Mandate has passed its expiry date",
  DAILY_LIMIT_EXCEEDED: "Transaction would exceed the daily spending cap",
  MONTHLY_LIMIT_EXCEEDED: "Transaction would exceed the monthly spending cap",
  MANDATE_REVOKED: "Mandate has been permanently revoked by the CFO",
  MANDATE_PAUSED: "Mandate is currently paused by the CFO",
  AMOUNT_ABOVE_HARD_LIMIT: "Amount exceeds the per-action maximum",
  DUPLICATE_REQUEST: "A request with this ID has already been processed",
};

export function getRoleRoute(role: Role): string {
  switch (role) {
    case "cfo":
      return "/dashboard";
    case "agent":
      return "/agent";
    case "compliance":
      return "/compliance";
    case "recipient":
      return "/recipient";
  }
}

export const ROLE_META: Record<
  Role,
  { label: string; shortLabel: string; color: string; dot: string }
> = {
  cfo: {
    label: "CFO",
    shortLabel: "CFO",
    color: "text-amber-400",
    dot: "bg-amber-400",
  },
  agent: {
    label: "AI Agent Console",
    shortLabel: "Agent",
    color: "text-cyan-400",
    dot: "bg-cyan-400",
  },
  compliance: {
    label: "Compliance",
    shortLabel: "Compliance",
    color: "text-violet-400",
    dot: "bg-violet-400",
  },
  recipient: {
    label: "Recipient",
    shortLabel: "Recipient",
    color: "text-emerald-400",
    dot: "bg-emerald-400",
  },
};
