import { AlertTriangle, Trash2 } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" muestra el botón de confirmar en rojo (para eliminar/acciones destructivas) */
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const isDanger = variant === "danger";

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/45 dark:bg-black/65 backdrop-blur-sm" />

      {/* Dialog */}
      <div className="relative w-full max-w-sm overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
        {/* Header */}
        <div className={`px-5 pt-5 pb-3 flex items-start gap-3`}>
          <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
            isDanger ? "bg-red-100 dark:bg-red-900/40" : "bg-amber-100 dark:bg-amber-900/40"
          }`}>
            {isDanger
              ? <Trash2 size={20} className="text-red-600 dark:text-red-400" />
              : <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
            }
          </div>
          <div className="flex-1 pt-1">
            {title && (
              <h3 className="mb-1 text-base font-semibold leading-tight text-[var(--color-text)]">
                {title}
              </h3>
            )}
            <p className="text-sm leading-snug text-[var(--color-text-sec)]">{message}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-2 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-4 py-2 text-sm font-medium text-[var(--color-text-sec)] transition-colors hover:bg-[var(--color-row-hover)]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors text-white ${
              isDanger
                ? "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
                : "bg-[var(--tenant-primary-color)] hover:bg-[var(--tenant-primary-dark)]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
