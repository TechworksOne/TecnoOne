import { ShieldCheck, ShieldOff, ShieldAlert } from 'lucide-react';

export type EstadoGarantia = 'vigente' | 'vencida' | 'sin_garantia';

interface Props {
  estadoGarantia: EstadoGarantia | string | null | undefined;
  fechaGarantiaFin?: string | null;
  garantiaDias?: number | null;
  size?: 'sm' | 'md';
}

function calcularEstadoLocal(garantiaDias?: number | null, fechaEntregaCalc?: string | null): EstadoGarantia {
  if (!garantiaDias || garantiaDias === 0) return 'sin_garantia';
  if (!fechaEntregaCalc) return 'sin_garantia';
  const fin = new Date(fechaEntregaCalc);
  fin.setDate(fin.getDate() + garantiaDias);
  fin.setHours(23, 59, 59, 999);
  return fin >= new Date() ? 'vigente' : 'vencida';
}

function formatFecha(iso?: string | null): string {
  if (!iso) return '—';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '—';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function GarantiaStatusBadge({ estadoGarantia, fechaGarantiaFin, size = 'sm' }: Props) {
  const estado = (estadoGarantia as EstadoGarantia) || 'sin_garantia';
  const iconSize = size === 'md' ? 14 : 11;
  const textCls = size === 'md' ? 'text-xs' : 'text-[10px]';

  if (estado === 'vigente') {
    return (
      <div className="flex flex-col gap-0.5">
        <span className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full ${textCls} bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50`}>
          <ShieldCheck size={iconSize} />
          Garantía vigente
        </span>
        {fechaGarantiaFin && (
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 pl-1">
            hasta {formatFecha(fechaGarantiaFin)}
          </span>
        )}
      </div>
    );
  }

  if (estado === 'vencida') {
    return (
      <div className="flex flex-col gap-0.5">
        <span className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full ${textCls} bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-700/50`}>
          <ShieldOff size={iconSize} />
          Garantía vencida
        </span>
        {fechaGarantiaFin && (
          <span className="text-[10px] text-red-500 dark:text-red-400 pl-1">
            venció el {formatFecha(fechaGarantiaFin)}
          </span>
        )}
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full ${textCls} bg-slate-100 text-slate-500 dark:bg-slate-700/50 dark:text-slate-400 border border-slate-200 dark:border-slate-600`}>
      <ShieldAlert size={iconSize} />
      Sin garantía
    </span>
  );
}

export { calcularEstadoLocal, formatFecha };
