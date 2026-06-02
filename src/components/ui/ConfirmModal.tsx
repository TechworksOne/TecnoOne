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
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70" />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
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
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-base leading-tight mb-1">
                {title}
              </h3>
            )}
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug">{message}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-2 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300
              bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600
              rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors text-white ${
              isDanger
                ? "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
                : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
