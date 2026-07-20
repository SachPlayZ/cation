"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  createContext,
  type ReactNode,
} from "react";
import {
  ArrowSquareOut,
  CheckCircle,
  Info,
  Warning,
  WarningCircle,
  X,
} from "@phosphor-icons/react";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastLink {
  label: string;
  href: string;
}

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  link?: ToastLink;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string, link?: ToastLink) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const TOAST_STYLES: Record<ToastType, string> = {
  success: "border-emerald-900/70 text-emerald-100",
  error: "border-red-900/70 text-red-100",
  warning: "border-amber-900/70 text-amber-100",
  info: "border-rim-strong text-ink",
};

function ToastIcon({ type }: { type: ToastType }) {
  const cls = "mt-0.5 size-5 shrink-0";
  if (type === "success") {
    return <CheckCircle className={`${cls} text-emerald-400`} weight="fill" />;
  }
  if (type === "error") {
    return <WarningCircle className={`${cls} text-red-400`} weight="fill" />;
  }
  if (type === "warning") {
    return <Warning className={`${cls} text-amber-400`} weight="fill" />;
  }
  return <Info className={`${cls} text-muted`} weight="fill" />;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, message: string, link?: ToastLink) => {
      const id = crypto.randomUUID();
      setItems((prev) => [...prev, { id, type, message, link }]);
      const timer = setTimeout(() => dismiss(id), link ? 7000 : 4500);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      activeTimers.forEach(clearTimeout);
      activeTimers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] ml-auto flex max-w-sm flex-col-reverse gap-2 sm:left-auto"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role={item.type === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex flex-col gap-1.5 rounded-panel border bg-surface px-4 py-3 panel-shadow animate-slide-in ${TOAST_STYLES[item.type]}`}
          >
            <div className="flex items-start gap-3">
              <ToastIcon type={item.type} />
              <span className="min-w-0 flex-1 text-sm leading-5">{item.message}</span>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="-mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-elevated hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>
            {item.link && (
              <a
                href={item.link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-8 text-xs underline decoration-dotted opacity-80 transition-opacity hover:opacity-100"
              >
                <span className="inline-flex items-center gap-1">
                  {item.link.label}
                  <ArrowSquareOut className="size-3.5" />
                </span>
              </a>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
