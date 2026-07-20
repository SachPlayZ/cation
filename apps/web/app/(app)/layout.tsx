"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  getToken,
  getRole,
  getDisplayName,
  setAuth,
  clearAuth,
  login,
  getRoleRoute,
  ROLE_META,
  type Role,
} from "@/components/api";
import { ToastProvider } from "@/components/Toast";

const ALL_ROLES: Role[] = ["cfo", "agent", "compliance", "recipient"];

function LedgerBadge({ role }: { role: Role }) {
  const meta = ROLE_META[role];
  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-rim text-xs font-mono text-slate-500 shadow-lg select-none">
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      Ledger view: <span className={`font-semibold ${meta.color}`}>{meta.label}</span>
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
    <header className="sticky top-0 z-40 border-b border-rim bg-canvas/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 h-12 flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-white font-extrabold tracking-[-0.04em] text-lg leading-none">
            CATION
          </span>
          <span className="hidden sm:block h-3 w-px bg-rim" />
          <span className="hidden sm:block text-slate-600 text-[10px] font-mono uppercase tracking-wider">
            Control Plane
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* View as */}
        <div className="flex items-center gap-2">
          <span className="text-slate-600 text-[11px] font-mono tracking-wider hidden sm:block">
            VIEW AS
          </span>
          <div className="flex items-center gap-1 p-0.5 rounded-lg border border-rim bg-surface">
            {ALL_ROLES.map((role) => {
              const meta = ROLE_META[role];
              const isActive = role === currentRole;
              const isSwitching = role === switchingTo;
              return (
                <button
                  key={role}
                  onClick={() => !isActive && onSwitch(role)}
                  disabled={switchingTo !== null}
                  className={`
                    flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150
                    ${isActive
                      ? `${meta.color} bg-elevated border border-rim`
                      : "text-slate-500 hover:text-slate-300 hover:bg-elevated/60"
                    }
                    disabled:cursor-not-allowed
                  `}
                >
                  {isSwitching ? (
                    <span className="w-1.5 h-1.5 rounded-full border border-current border-t-transparent animate-spin" />
                  ) : (
                    <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} ${isActive ? "opacity-100" : "opacity-30"}`} />
                  )}
                  <span className="hidden sm:block">{meta.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* User */}
        <div className="flex items-center gap-2 shrink-0">
          <div className={`w-5 h-5 rounded-full ${ROLE_META[currentRole].dot} opacity-70 flex items-center justify-center text-[9px] font-bold text-black`}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <span className="text-slate-400 text-xs hidden sm:block">{displayName}</span>
        </div>

        {/* Logout */}
        <button
          onClick={() => { clearAuth(); window.location.href = "/"; }}
          className="text-slate-600 hover:text-slate-400 text-[11px] font-mono transition-colors"
        >
          out
        </button>
      </div>
    </header>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [switchingTo, setSwitchingTo] = useState<Role | null>(null);

  useEffect(() => {
    const token = getToken();
    const r = getRole();
    if (!token || !r) {
      router.replace("/");
      return;
    }
    setRole(r);
    setDisplayName(getDisplayName() ?? r);
    setReady(true);
  }, [router, pathname]);

  const handleSwitch = useCallback(
    async (targetRole: Role) => {
      setSwitchingTo(targetRole);
      try {
        const result = await login(targetRole, "cation-demo");
        setAuth(result.token, result.role, result.displayName);
        setRole(result.role);
        setDisplayName(result.displayName);
        router.push(getRoleRoute(result.role));
      } catch {
        // silent — stay on current role
      } finally {
        setSwitchingTo(null);
      }
    },
    [router]
  );

  if (!ready || !role) {
    return <div className="min-h-screen bg-canvas" />;
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-canvas">
        <TopBar
          currentRole={role}
          displayName={displayName}
          onSwitch={handleSwitch}
          switchingTo={switchingTo}
        />
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
        <LedgerBadge role={role} />
      </div>
    </ToastProvider>
  );
}
