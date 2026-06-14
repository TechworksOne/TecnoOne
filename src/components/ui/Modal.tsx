import React, { useEffect } from "react";
import { X } from "lucide-react";

export default function Modal({
  open,
  isOpen,
  onClose,
  title,
  children,
  size = "4xl",
}: {
  open?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
}) {
  const modalOpen = open ?? isOpen ?? false;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose && onClose();
    }
    
    // Prevenir scroll del body cuando el modal está abierto
    if (modalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = 'unset';
    };
  }, [onClose, modalOpen]);

  if (!modalOpen) return null;

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
  };
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 dark:bg-black/65 backdrop-blur-sm p-4">
      <div
        className={`relative z-[110] flex max-h-[92vh] w-full ${sizeClasses[size]} flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]`}
        style={{ boxShadow: "0 24px 60px rgba(15,23,42,0.24)" }}
      >
        {/* Header del modal */}
        {title && (
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
            <h3 className="text-base font-semibold text-[var(--color-text)]">{title}</h3>
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 transition-colors"
                style={{
                  color: "var(--color-text-sec)",
                  background: "transparent",
                  border: "1px solid var(--color-border)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(var(--tenant-primary-rgb),0.10)";
                  (e.currentTarget as HTMLElement).style.color = "var(--tenant-primary-color)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "var(--color-text-sec)";
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* Contenido del modal */}
        <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
