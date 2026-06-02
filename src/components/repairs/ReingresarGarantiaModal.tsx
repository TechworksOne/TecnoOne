import { useState } from 'react';
import { X, ShieldCheck, AlertCircle, RotateCcw, Loader2 } from 'lucide-react';
import { reingresarGarantia } from '../../services/flujoReparacionService';
import GarantiaStatusBadge from './GarantiaStatusBadge';

interface Props {
  repair: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

function fmt(v?: string | null) {
  if (!v) return '—';
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '—';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtQ(v?: number | null) {
  if (v === null || v === undefined) return '—';
  return `Q${Number(v).toFixed(2)}`;
}

const REPUESTOS_COMUNES = [
  'Pantalla / Display',
  'Batería',
  'Puerto de carga',
  'Cámara trasera',
  'Cámara frontal',
  'Micrófono',
  'Bocina',
  'Botón Home / Touch ID',
  'Face ID / Sensor',
  'Flex de volumen / power',
  'Tapa trasera / carcasa',
  'Teclado',
  'Otro (especificar)',
];

export default function ReingresarGarantiaModal({ repair, onClose, onSuccess }: Props) {
  const [motivo,       setMotivo]       = useState('');
  const [repuesto,     setRepuesto]     = useState('');
  const [repuestoCustom, setRepuestoCustom] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  if (!repair) return null;

  const repuestoFinal = repuesto === 'Otro (especificar)' ? repuestoCustom : repuesto;

  const handleSubmit = async () => {
    setError(null);
    if (!motivo.trim()) { setError('El motivo del reingreso es obligatorio.'); return; }
    if (!repuestoFinal.trim()) { setError('Debe indicar el repuesto afectado.'); return; }

    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const userName = sessionStorage.getItem('userName') || 'Sistema';
      await reingresarGarantia(repair.id, {
        motivo:       motivo.trim(),
        repuesto:     repuestoFinal.trim(),
        observaciones: observaciones.trim() || undefined,
        userName,
      });
      onSuccess();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error al reingresar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const labelCls = 'block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1';
  const inputCls = [
    'w-full px-3 py-2 rounded-xl text-sm border',
    'bg-white dark:bg-slate-900',
    'text-slate-800 dark:text-slate-100',
    'border-slate-300 dark:border-slate-600',
    'focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500',
    'transition',
  ].join(' ');
  const selectCls = inputCls + ' cursor-pointer';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-purple-50 dark:bg-purple-950/30 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
              <RotateCcw size={15} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Reingresar por Garantía</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{repair.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Repair info card */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Cliente</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{repair.cliente_nombre || repair.clienteNombre || '—'}</p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Equipo</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {[repair.marca, repair.modelo].filter(Boolean).join(' ') || '—'}
                </p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Fecha de entrega</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {fmt(repair.fecha_entrega || repair.fecha_entrega_calc || repair.fecha_cierre)}
                </p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Total cobrado</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{fmtQ(repair.total)}</p>
              </div>
            </div>
            <div className="pt-1 border-t border-slate-200 dark:border-slate-700">
              <GarantiaStatusBadge
                estadoGarantia={repair.estado_garantia}
                fechaGarantiaFin={repair.fecha_garantia_fin}
                size="md"
              />
            </div>
          </div>

          {/* Warning badge */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700/50">
            <ShieldCheck size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Al confirmar, la reparación volverá al flujo activo con estado <strong>EN_DIAGNÓSTICO</strong> y prioridad <strong>ALTA</strong>.
            </p>
          </div>

          {/* Form */}
          <div>
            <label className={labelCls}>
              Motivo del reingreso <span className="text-red-500">*</span>
            </label>
            <textarea
              className={inputCls + ' resize-none'}
              rows={2}
              placeholder="Ej: La pantalla falló nuevamente después de la reparación..."
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              maxLength={500}
            />
          </div>

          <div>
            <label className={labelCls}>
              Repuesto a revisar / reemplazar <span className="text-red-500">*</span>
            </label>
            <select className={selectCls} value={repuesto} onChange={e => setRepuesto(e.target.value)}>
              <option value="">— Seleccionar repuesto —</option>
              {REPUESTOS_COMUNES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {repuesto === 'Otro (especificar)' && (
              <input
                type="text"
                className={inputCls + ' mt-2'}
                placeholder="Describe el repuesto..."
                value={repuestoCustom}
                onChange={e => setRepuestoCustom(e.target.value)}
                maxLength={200}
              />
            )}
          </div>

          <div>
            <label className={labelCls}>Observaciones técnicas</label>
            <textarea
              className={inputCls + ' resize-none'}
              rows={2}
              placeholder="Observaciones adicionales..."
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              maxLength={500}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-700/50">
              <AlertCircle size={14} className="text-red-600 dark:text-red-400 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-slate-200 dark:border-slate-700 shrink-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 rounded-xl text-sm font-semibold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !motivo.trim() || !repuestoFinal.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            Confirmar Reingreso
          </button>
        </div>
      </div>
    </div>
  );
}
