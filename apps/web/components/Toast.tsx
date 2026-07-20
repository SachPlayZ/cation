"use client";

import {
  useState,
  useCallback,
  useContext,
  createContext,
  type ReactNode,
} from "react";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const TOAST_STYLES: Record<ToastType, string> = {
  success: "bg-emerald-950 border-emerald-700 text-emerald-200",
  error: "bg-red-950 border-red-700 text-red-200",
  warning: "bg-amber-950 border-amber-700 text-amber-200",
  info: "bg-slate-900 border-slate-600 text-slate-200",
};

const TOAST_ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  warning: "!",
  info: "i",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2, 9);
    setItems((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {items.map((item) => (
          <div
            key={item.id}
            className={`
              flex items-start gap-3 px-4 py-3 rounded-lg border text-sm
              pointer-events-auto shadow-2xl animate-slide-in font-sans
              ${TOAST_STYLES[item.type]}
            `}
          >
            <span className="font-mono font-bold mt-px shrink-0 text-xs leading-none">
              {TOAST_ICONS[item.type]}
            </span>
            <span className="leading-relaxed">{item.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
