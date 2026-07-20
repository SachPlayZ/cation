"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CircleNotch,
  SignOut,
  ShieldCheck,
} from "@phosphor-icons/react";
import {
  getToken,
  getRole,
  getDisplayName,
  setAuth,
  clearAuth,
  login,
  getRoleRoute,
  type Role,
} from "@/components/api";
import { ToastProvider, useToast } from "@/components/Toast";

const ALL_ROLES: Role[] = ["cfo", "agent", "compliance", "recipient"];
const ROLE_LABELS: Record<Role, string> = {
  cfo: "CFO",
  agent: "Agent",
  compliance: "Compliance",
  recipient: "Recipient",
};

function SessionLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading secure workspace"
      className="app-backdrop flex min-h-[100dvh] items-center justify-center"
    >
      <div className="flex items-center gap-3 text-sm text-muted">
        <CircleNotch className="size-5 animate-spin text-brand" />
        Loading secure workspace
      </div>
    </div>
  );
}

function TopBar({
  currentRole,
  displayName,
  onSwitch,
  switchingTo,
}: {
  currentRole: Role;
  displayName: string;
  onSwitch: (role: Role) => void;
  switchingTo: Role | null;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-rim bg-canvas/92 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-3 px-4 sm:px-6">
        <div className="flex shrink-0 items-center gap-2.5">
          <Image
            src="/android-chrome-192x192.png"
            alt=""
            width={32}
            height={32}
            className="size-8 rounded-[8px]"
          />
          <span className="hidden text-xs font-semibold tracking-[0.16em] text-ink sm:block">
            CATION
          </span>
        </div>

        <div className="hidden h-5 w-px bg-rim md:block" />

        <nav
          aria-label="Switch ledger role"
          className="hidden items-center gap-1 md:flex"
        >
          {ALL_ROLES.map((role) => {
            const active = role === currentRole;
            const switching = role === switchingTo;
            return (
              <button
                key={role}
                type="button"
                aria-pressed={active}
                onClick={() => !active && onSwitch(role)}
                disabled={switchingTo !== null}
                className={`inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-control px-3 text-xs font-medium transition active:scale-[0.98] disabled:cursor-not-allowed ${
                  active
                    ? "bg-brand-soft text-brand-strong"
                    : "text-muted hover:bg-elevated hover:text-ink"
                }`}
              >
                {switching && <CircleNotch className="size-3.5 animate-spin" />}
                {ROLE_LABELS[role]}
              </button>
            );
          })}
        </nav>

        <label className="relative min-w-0 flex-1 md:hidden">
          <span className="sr-only">Current ledger role</span>
          <select
            value={currentRole}
            disabled={switchingTo !== null}
            onChange={(event) => onSwitch(event.target.value as Role)}
            className="h-10 w-full appearance-none rounded-control border border-rim bg-elevated px-3 pr-8 text-sm text-ink focus:outline-none"
          >
            {ALL_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]} view
              </option>
            ))}
          </select>
          {switchingTo && (
            <CircleNotch className="pointer-events-none absolute right-3 top-3 size-4 animate-spin text-brand" />
          )}
        </label>

        <div className="flex-1" />

        <div className="hidden items-center gap-2 text-xs text-faint lg:flex">
          <ShieldCheck className="size-4 text-brand-strong" weight="fill" />
          Party-scoped ledger view
        </div>

        <div className="hidden h-5 w-px bg-rim sm:block" />

        <div className="hidden max-w-32 truncate text-xs text-muted sm:block">
          {displayName}
        </div>
        <button
          type="button"
          aria-label="Sign out"
          onClick={() => {
            clearAuth();
            window.location.href = "/";
          }}
          className="flex size-10 shrink-0 items-center justify-center rounded-control text-muted transition hover:bg-elevated hover:text-ink active:scale-[0.98]"
        >
          <SignOut className="size-5" />
        </button>
      </div>
    </header>
  );
}

function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [switchingTo, setSwitchingTo] = useState<Role | null>(null);

  useEffect(() => {
    const token = getToken();
    const storedRole = getRole();
    if (!token || !storedRole) {
      router.replace("/");
      return;
    }
    setRole(storedRole);
    setDisplayName(getDisplayName() ?? storedRole);
    setReady(true);
  }, [router, pathname]);

  const handleSwitch = useCallback(
    async (targetRole: Role) => {
      if (targetRole === role) return;
      setSwitchingTo(targetRole);
      try {
        const result = await login(targetRole, "cation-demo");
        setAuth(result.token, result.role, result.displayName);
        setRole(result.role);
        setDisplayName(result.displayName);
        router.push(getRoleRoute(result.role));
      } catch (error) {
        toast(
          "error",
          error instanceof Error ? error.message : "Could not switch role"
        );
      } finally {
        setSwitchingTo(null);
      }
    },
    [role, router, toast]
  );

  if (!ready || !role) return <SessionLoading />;

  return (
    <div className="app-backdrop min-h-[100dvh]">
      <TopBar
        currentRole={role}
        displayName={displayName}
        onSwitch={handleSwitch}
        switchingTo={switchingTo}
      />
      <main className="mx-auto max-w-[1320px] px-4 py-6 pb-12 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </ToastProvider>
  );
}
