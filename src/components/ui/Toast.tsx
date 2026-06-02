import React, { createContext, useContext, useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";
type ToastItem = { id: string; message: string; type: ToastType };

const ToastContext = createContext<{
  add: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
} | null>(null);

let toastCounter = 0;
function generateToastId() {
  return `${Date.now()}-${++toastCounter}-${Math.random().toString(36).substr(2, 9)}`;
}

const TOAST_CONFIG: Record<ToastType, { bg: string; border: string; icon: React.ReactNode }> = {
  success: {
    bg: "bg-green-50 dark:bg-green-900/30",
    border: "border-green-400 dark:border-green-600",
    icon: <CheckCircle size={18} className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" />,
  },
  error: {
    bg: "bg-red-50 dark:bg-red-900/30",
    border: "border-red-400 dark:border-red-600",
    icon: <XCircle size={18} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />,
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-900/30",
    border: "border-amber-400 dark:border-amber-600",
    icon: <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />,
  },
  info: {
    bg: "bg-blue-50 dark:bg-blue-900/30",
    border: "border-blue-400 dark:border-blue-600",
    icon: <Info size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />,
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  function add(message: string, type: ToastType = "success") {
    const t = { id: generateToastId(), message, type };
    setToasts((s) => [...s, t]);
    setTimeout(() => remove(t.id), 4000);
  }

  function remove(id: string) {
    setToasts((s) => s.filter((x) => x.id !== id));
  }

  const ctx = {
    add,
    success: (m: string) => add(m, "success"),
    error:   (m: string) => add(m, "error"),
    warning: (m: string) => add(m, "warning"),
    info:    (m: string) => add(m, "info"),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="fixed top-4 right-4 flex flex-col gap-2 z-[9999] max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          const cfg = TOAST_CONFIG[t.type];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-sm
                ${cfg.bg} ${cfg.border}
                text-slate-800 dark:text-slate-100`}
            >
              {cfg.icon}
              <span className="flex-1 leading-snug">{t.message}</span>
              <button
                onClick={() => remove(t.id)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0 mt-0.5"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
