import React from "react";

interface ConfirmDialogProps {
  open?: boolean;
  isOpen?: boolean; // Alias para compatibilidad
  title?: string;
  message?: string;
  children?: React.ReactNode;
  onConfirm?: () => void;
  onClose?: () => void;
  confirmText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmDialog({
  open,
  isOpen,
  title,
  message,
  children,
  onConfirm,
  onClose,
  confirmText = 'Confirmar',
  type = 'danger'
}: ConfirmDialogProps) {
  const isVisible = open || isOpen;
  
  if (!isVisible) return null;
  
  const getButtonClass = () => {
    switch (type) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 text-white';
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700 text-white';
      case 'info':
        return 'bg-[var(--tenant-primary-color)] hover:bg-[var(--tenant-primary-dark)] text-white';
      default:
        return 'bg-red-600 hover:bg-red-700 text-white';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm dark:bg-black/65">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl">
        {title && <h3 className="text-lg font-semibold text-[var(--color-text)]">{title}</h3>}
        <div className="mt-4">
          {message && <p className="text-[var(--color-text-sec)]">{message}</p>}
          {children}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-4 py-2 text-[var(--color-text-sec)] transition-colors hover:bg-[var(--color-row-hover)]">
            Cancelar
          </button>
          <button
            onClick={() => {
              onConfirm && onConfirm();
              onClose && onClose();
            }}
            className={`px-4 py-2 rounded-lg ${getButtonClass()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// Exportación nombrada para compatibilidad
export { ConfirmDialog };
