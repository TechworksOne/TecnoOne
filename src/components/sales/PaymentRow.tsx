import React from 'react';
import { Trash2, CreditCard, Banknote, ArrowLeftRight } from 'lucide-react';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { PaymentMethod } from '../../types/sale';
import { isCardMethod } from '../../constants/paymentMethods';
import { formatMoney } from '../../lib/format';

interface PaymentRowData {
  id: string;
  metodo: Exclude<PaymentMethod, 'MIXTO'>;
  monto: number;
  referencia?: string;
  comprobanteUrl?: string;
}

interface PaymentRowProps {
  payment: PaymentRowData;
  onChange: (id: string, updates: Partial<PaymentRowData>) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
  totalRestante: number;
}

export default function PaymentRow({ payment, onChange, onRemove, canRemove, totalRestante }: PaymentRowProps) {
  const handleMetodoChange = (metodo: Exclude<PaymentMethod, 'MIXTO'>) => {
    onChange(payment.id, { metodo, referencia: '', comprobanteUrl: '' });
  };

  const handleMontoChange = (monto: number) => {
    onChange(payment.id, { monto });
  };

  const handleReferenciaChange = (referencia: string) => {
    onChange(payment.id, { referencia });
  };

  const handleComprobanteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange(payment.id, { comprobanteUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const getIcon = () => {
    switch (payment.metodo) {
      case 'EFECTIVO':
        return <Banknote size={18} className="text-green-600" />;
      case 'TARJETA_BAC':
        return <CreditCard size={18} className="text-blue-600" />;
      case 'TARJETA_NEONET':
        return <CreditCard size={18} className="text-cyan-600" />;
      case 'TARJETA':
      case 'TARJETA_OTRA':
        return <CreditCard size={18} className="text-blue-600" />;
      case 'TRANSFERENCIA':
        return <ArrowLeftRight size={18} className="text-purple-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg border-2 border-gray-200 space-y-3">
      <div className="flex items-center gap-3">
        {/* Método */}
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 dark:text-slate-300 mb-1">
            Método de Pago
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
              {getIcon()}
            </div>
            <Select
              value={payment.metodo}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleMetodoChange(e.target.value as Exclude<PaymentMethod, 'MIXTO'>)}
              className="pl-10"
            >
              <option value="EFECTIVO">Efectivo</option>
              <option value="TARJETA_BAC">Tarjeta BAC</option>
              <option value="TARJETA_NEONET">Tarjeta Neonet</option>
              <option value="TARJETA_OTRA">Otra tarjeta</option>
              <option value="TRANSFERENCIA">Transferencia</option>
            </Select>
          </div>
        </div>

        {/* Monto */}
        <div className="w-40">
          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 dark:text-slate-300 mb-1">
            Monto
          </label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={payment.monto}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleMontoChange(Number(e.target.value))}
            placeholder="0.00"
          />
          {totalRestante > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Restante: {formatMoney(totalRestante)}
            </p>
          )}
        </div>

        {/* Eliminar */}
        {canRemove && (
          <div className="pt-5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(payment.id)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        )}
      </div>

      {/* Campos adicionales según método */}
      {payment.metodo === 'TRANSFERENCIA' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 dark:text-slate-300 mb-1">
              Referencia / Voucher
            </label>
            <Input
              type="text"
              value={payment.referencia || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleReferenciaChange(e.target.value)}
              placeholder="#123456"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 dark:text-slate-300 mb-1">
              Comprobante
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleComprobanteChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
            />
            {payment.comprobanteUrl && (
              <img
                src={payment.comprobanteUrl}
                alt="Comprobante"
                className="mt-2 h-20 rounded border"
              />
            )}
          </div>
        </div>
      )}

      {isCardMethod(payment.metodo) && (
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 dark:text-slate-300 mb-1">
            Últimos 4 dígitos
          </label>
          <Input
            type="text"
            maxLength={4}
            value={payment.referencia || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleReferenciaChange(e.target.value)}
            placeholder="1234"
          />
          <p className="text-xs text-orange-600 mt-1">
            ℹ️ Nota: Considerar comisión bancaria
          </p>
        </div>
      )}
    </div>
  );
}
