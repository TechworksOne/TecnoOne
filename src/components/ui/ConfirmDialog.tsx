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
        return 'bg-blue-600 hover:bg-blue-700 text-white';
      default:
        return 'bg-red-600 hover:bg-red-700 text-white';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow p-6 w-full max-w-md">
        {title && <h3 className="text-lg font-semibold dark:text-slate-100">{title}</h3>}
        <div className="mt-4">
          {message && <p className="text-gray-700 dark:text-slate-300">{message}</p>}
          {children}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
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
