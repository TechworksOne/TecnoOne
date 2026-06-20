import React, { useState, useEffect } from 'react';
import {
  Plus, Search, Eye, EyeOff, Clock, History, Printer, FileSearch,
  User, Smartphone, CalendarDays, Tag, Wrench,
  ChevronDown, DollarSign, X, AlertTriangle, CheckCircle2,
  Ban, UserCheck, AlertCircle, RefreshCw, Check,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRepairs } from '../../store/useRepairs';
import { Repair, RepairPriority } from '../../types/repair';
import Modal from '../../components/ui/Modal';
import ModalHistorialReparacion from '../../components/repairs/ModalHistorialReparacion';
import NuevaReparacionModal from '../../components/repairs/NuevaReparacionModal';
import PatternPreview from '../../components/repairs/PatternPreview';
import { useEmpresa } from '../../store/useEmpresa';
import { getImageUrl } from '../../utils/getImageUrl';
import {
  getAllReparaciones,
  abrirContratoReparacion,
  updatePrioridad,
  registrarPagoSaldo,
  cancelarReparacion,
} from '../../services/repairService';
import { getTecnicos, asignarTecnico } from '../../services/otService';
import type { Tecnico } from '../../types/ot';
import { isAdmin } from '../../lib/permissions';
import { useAuth } from '../../store/useAuth';

// ── Style maps ────────────────────────────────────────────────────────────
const STATUS_PILL: Record<string, string> = {
  RECIBIDA:               'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
  EN_PROCESO:             'bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800',
  EN_DIAGNOSTICO:         'bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
  ESPERANDO_AUTORIZACION: 'bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-950/60 dark:text-yellow-300 dark:border-yellow-800',
  AUTORIZADA:             'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
  EN_REPARACION:          'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  ESPERANDO_PIEZA:        'bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
  STAND_BY:               'bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  COMPLETADA:             'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  ENTREGADA:              'bg-green-100 text-green-700 border border-green-200 dark:bg-green-950/60 dark:text-green-300 dark:border-green-800',
  CANCELADA:              'bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
};
const PRIORITY_PILL: Record<string, string> = {
  BAJA:  'bg-teal-100 text-teal-700 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
  MEDIA: 'bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-950/60 dark:text-yellow-300 dark:border-yellow-800',
  ALTA:  'bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
};
const STATUS_LABEL: Record<string, string> = {
  RECIBIDA: 'Recibida', EN_PROCESO: 'En Proceso', EN_DIAGNOSTICO: 'En Diagnóstico',
  ESPERANDO_AUTORIZACION: 'Esp. Autorización', AUTORIZADA: 'Autorizada',
  EN_REPARACION: 'En Reparación', ESPERANDO_PIEZA: 'Esp. Pieza',
  STAND_BY: 'Stand By', COMPLETADA: 'Completada', ENTREGADA: 'Entregada', CANCELADA: 'Cancelada',
};

// ── Grupos de filtro rápido ───────────────────────────────────────────────
type GrupoFiltro = 'proceso' | 'entregadas' | 'canceladas' | 'historial';
const GRUPO_ESTADOS: Record<GrupoFiltro, string[]> = {
  proceso:    ['RECIBIDA','EN_DIAGNOSTICO','ESPERANDO_AUTORIZACION','AUTORIZADA',
               'EN_REPARACION','ESPERANDO_PIEZA','COMPLETADA','STAND_BY',
               'EN_PROCESO','ANTICIPO_REGISTRADO'],
  entregadas: ['ENTREGADA'],
  canceladas: ['CANCELADA'],
  historial:  ['ENTREGADA','CANCELADA'],
};

// ── Helpers ───────────────────────────────────────────────────────────────
function safeDate(v?: string | null): string {
  if (!v) return 'No registrada';
  // Always extract the YYYY-MM-DD part and parse as local time to avoid UTC offset shifting the date
  const match = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return 'No registrada';
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (isNaN(d.getTime())) return 'No registrada';
  return d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function calcSaldo(r: Repair): number {
  const total = r.total || 0;
  const pagado = (r.recepcion.montoAnticipo || 0) + (r.montoPagadoAdicional || 0);
  return Math.max(0, total - pagado);
}

type AccessInfo = {
  tipo: 'ninguno' | 'pin' | 'patron';
  valor: string;
  label: string | null;
};

function normalizeAccessType(value?: string | null): AccessInfo['tipo'] {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalized === 'patron' || normalized === 'pattern') return 'patron';
  if (normalized === 'pin' || normalized === 'password' || normalized === 'contrasena') return 'pin';

  return 'ninguno';
}

function formatPatternSequence(value?: string | null): string {
  const nodes = String(value || '').match(/[1-9]/g) || [];
  return nodes.join(' → ');
}

function getAccessInfo(recepcion?: any): AccessInfo {
  const tipoRaw = normalizeAccessType(recepcion?.accesoTipo ?? recepcion?.acceso_tipo);

  const valor = String(
    recepcion?.accesoValor ??
    recepcion?.acceso_valor ??
    recepcion?.contrasena ??
    recepcion?.contraseña ??
    recepcion?.patronContrasena ??
    recepcion?.patronContraseña ??
    recepcion?.patron_contrasena ??
    ''
  ).trim();

  const looksLikePattern =
    /^[1-9](?:[-,\s→]*[1-9]){1,8}$/.test(valor) && /[-,\s→]/.test(valor);

  const tipo = tipoRaw === 'ninguno' && valor
    ? (looksLikePattern ? 'patron' : 'pin')
    : tipoRaw;

  if (tipo === 'patron') {
    const sequence = formatPatternSequence(valor);
    return {
      tipo: 'patron',
      valor,
      label: valor ? `Patrón: ${sequence || valor}` : 'Patrón registrado',
    };
  }

  if (tipo === 'pin') {
    return {
      tipo: 'pin',
      valor,
      label: valor ? `PIN: ${valor}` : 'PIN registrado',
    };
  }

  if (valor) {
    return {
      tipo: 'pin',
      valor,
      label: `PIN: ${valor}`,
    };
  }

  return {
    tipo: 'ninguno',
    valor: '',
    label: null,
  };
}

function calcTotalPagado(r: Repair): number {
  return (r.recepcion.montoAnticipo || 0) + (r.montoPagadoAdicional || 0);
}

// ── Modal: Editar prioridad ───────────────────────────────────────────────
function ModalEditarPrioridad({
  repair,
  onClose,
  onSuccess,
}: { repair: Repair; onClose: () => void; onSuccess: (id: string, p: RepairPriority) => void }) {
  const [prioridad, setPrioridad] = useState<RepairPriority>(repair.prioridad);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (prioridad === repair.prioridad) { onClose(); return; }
    try {
      setSaving(true);
      setError('');
      await updatePrioridad(repair.id, prioridad);
      onSuccess(repair.id, prioridad);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error al actualizar la prioridad');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Editar Prioridad — ${repair.id}`}>
      <div className="space-y-4 text-sm">
        <p className="text-slate-500 dark:text-slate-400">
          Reparación: <span className="text-slate-800 dark:text-slate-200 font-medium">{repair.clienteNombre}</span>
          {' · '}{[repair.recepcion.marca, repair.recepcion.modelo].filter(Boolean).join(' ')}
        </p>
        <div>
          <label className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Nueva prioridad</label>
          <div className="flex gap-2">
            {(['BAJA', 'MEDIA', 'ALTA'] as RepairPriority[]).map(p => (
              <button
                key={p}
                onClick={() => setPrioridad(p)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  prioridad === p
                    ? PRIORITY_PILL[p]
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs">
            <AlertTriangle size={13} /> {error}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Modal: Pago de saldo pendiente ────────────────────────────────────────
function ModalPagoSaldo({
  repair,
  onClose,
  onSuccess,
}: { repair: Repair; onClose: () => void; onSuccess: (id: string, montoPagado: number, metodo: string) => void }) {
  const saldoPendiente = calcSaldo(repair);
  const [monto, setMonto] = useState(saldoPendiente.toFixed(2));
  const [metodo, setMetodo] = useState<'efectivo' | 'tarjeta'>('efectivo');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handlePagar = async () => {
    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      setError('Ingresa un monto válido mayor a cero');
      return;
    }
    if (montoNum > saldoPendiente + 0.005) {
      setError(`El monto no puede exceder el saldo pendiente de Q${saldoPendiente.toFixed(2)}`);
      return;
    }
    try {
      setSaving(true);
      setError('');
      await registrarPagoSaldo(repair.id, montoNum, metodo);
      onSuccess(repair.id, montoNum, metodo);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error al registrar el pago');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Registrar Pago — ${repair.id}`}>
      <div className="space-y-4 text-sm">
        {/* Resumen financiero */}
        <div className="bg-slate-100 dark:bg-slate-950 rounded-xl p-3 grid grid-cols-3 gap-3 text-center border border-slate-200 dark:border-slate-800">
          <div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">Total</p>
            <p className="text-slate-900 dark:text-slate-100 font-bold">Q{(repair.total || 0).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">Ya pagado</p>
            <p className="text-emerald-600 dark:text-emerald-400 font-bold">Q{calcTotalPagado(repair).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">Saldo pendiente</p>
            <p className="text-amber-600 dark:text-amber-400 font-bold">Q{saldoPendiente.toFixed(2)}</p>
          </div>
        </div>

        {/* Monto */}
        <div>
          <label className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Monto a pagar (Q)</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            max={saldoPendiente}
            value={monto}
            onChange={e => { setMonto(e.target.value); setError(''); }}
            className="w-full px-3 py-2 text-sm rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>

        {/* Método de pago */}
        <div>
          <label className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Método de pago</label>
          <div className="flex gap-2">
            {(['efectivo', 'tarjeta'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMetodo(m)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border capitalize transition-colors ${
                  metodo === m
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {m === 'efectivo' ? '💵 Efectivo' : '💳 Tarjeta'}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs">
            <AlertTriangle size={13} /> {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handlePagar}
            disabled={saving}
            className="flex-1 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Registrando…' : 'Registrar Pago'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Modal: Cancelar reparación ────────────────────────────────────────────
function ModalCancelar({
  repair,
  onClose,
  onSuccess,
}: { repair: Repair; onClose: () => void; onSuccess: (id: string) => void }) {
  const montoAnticipo = repair.recepcion.montoAnticipo ?? 0;
  const metodo        = repair.recepcion.metodoAnticipo ?? 'efectivo';
  const tieneAnticipo = montoAnticipo > 0;

  const [motivo,           setMotivo]           = useState('');
  const [devolucion,       setDevolucion]       = useState<boolean | null>(null); // null = sin elegir
  const [montoDevolucion,  setMontoDevolucion]  = useState(montoAnticipo);
  const [motivoRetencion,  setMotivoRetencion]  = useState('');
  const [saving,           setSaving]           = useState(false);
  const [error,            setError]            = useState('');

  const montoRetenido = parseFloat(
    tieneAnticipo && devolucion
      ? Math.max(0, montoAnticipo - (Number(montoDevolucion) || 0)).toFixed(2)
      : montoAnticipo.toFixed(2)
  );
  const requiereMotRet = montoRetenido > 0.01;

  const handleCancelar = async () => {
    setError('');
    if (!motivo.trim()) { setError('El motivo de cancelación es requerido'); return; }
    if (tieneAnticipo && devolucion === null) { setError('Indica si se devuelve dinero al cliente'); return; }
    if (tieneAnticipo && devolucion && (Number(montoDevolucion) || 0) > montoAnticipo) {
      setError(`No se puede devolver más del anticipo recibido (Q${montoAnticipo.toFixed(2)})`);
      return;
    }
    if (requiereMotRet && !motivoRetencion.trim()) {
      setError('El motivo de retención es requerido cuando se retiene parte del anticipo');
      return;
    }
    try {
      setSaving(true);
      const montoDev = tieneAnticipo && devolucion ? Number(montoDevolucion) : 0;
      const retenido = tieneAnticipo ? parseFloat(Math.max(0, montoAnticipo - montoDev).toFixed(2)) : 0;
      await cancelarReparacion(repair.id, {
        motivo_cancelacion: motivo.trim(),
        devolver_dinero:    tieneAnticipo ? (devolucion ?? false) : false,
        devolucion_monto:   montoDev,
        monto_retenido:     retenido,
        motivo_retencion:   retenido > 0.01 ? (motivoRetencion.trim() || null) : null,
      });
      onSuccess(repair.id);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error al cancelar la reparación');
    } finally {
      setSaving(false);
    }
  };

  const labelCls = 'block text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5';
  const inputCls = 'w-full px-3 py-2 text-sm rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40';

  const metodoPago: Record<string, string> = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    tarjeta: 'Tarjeta',
    tarjeta_bac: 'Tarjeta BAC',
    tarjeta_neonet: 'Tarjeta Neonet',
    tarjeta_otra: 'Otra tarjeta',
  };

  return (
    <Modal open onClose={onClose} title={`Cancelar Reparación — ${repair.id}`}>
      <div className="space-y-4 text-sm">

        {/* Advertencia */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
          <AlertTriangle size={16} className="text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-700 dark:text-red-300 font-semibold text-xs">Esta acción no se puede deshacer</p>
            <p className="text-red-600/80 dark:text-red-400/80 text-xs mt-0.5">
              La reparación quedará bloqueada para nuevos pagos y gestión de flujo.
            </p>
          </div>
        </div>

        {/* Datos básicos */}
        <p className="text-slate-500 dark:text-slate-400 text-xs">
          Cliente: <span className="text-slate-800 dark:text-slate-200 font-medium">{repair.clienteNombre}</span>
          {' · '}{[repair.recepcion.marca, repair.recepcion.modelo].filter(Boolean).join(' ')}
        </p>

        {/* Sección anticipo */}
        {tieneAnticipo ? (
          <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">Anticipo recibido</span>
              <span className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Q{montoAnticipo.toFixed(2)}
                <span className="text-xs font-normal ml-1 text-amber-700 dark:text-amber-400">({metodoPago[metodo] ?? metodo})</span>
              </span>
            </div>

            {/* ¿Devolver? */}
            <div>
              <p className={labelCls}>¿Se devuelve dinero al cliente? *</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setDevolucion(true); setMontoDevolucion(montoAnticipo); setMotivoRetencion(''); setError(''); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${devolucion === true ? 'bg-green-600 text-white border-green-600' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  Sí, devolver
                </button>
                <button
                  type="button"
                  onClick={() => { setDevolucion(false); setMontoDevolucion(0); setError(''); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${devolucion === false ? 'bg-red-600 text-white border-red-600' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  No devolver
                </button>
              </div>
            </div>

            {/* Monto a devolver */}
            {devolucion === true && (
              <div>
                <label className={labelCls}>Monto a devolver (máx Q{montoAnticipo.toFixed(2)})</label>
                <input
                  type="number"
                  min={0}
                  max={montoAnticipo}
                  step={0.01}
                  value={montoDevolucion}
                  onChange={e => setMontoDevolucion(Math.min(montoAnticipo, Math.max(0, Number(e.target.value) || 0)))}
                  className={inputCls + ' resize-none'}
                />
              </div>
            )}

            {/* Resumen devolución / retención */}
            {devolucion !== null && (
              <div className="flex gap-3 text-xs">
                <div className="flex-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 text-center">
                  <p className="text-slate-500 dark:text-slate-400">A devolver</p>
                  <p className="font-bold text-green-700 dark:text-green-400 mt-0.5">
                    Q{(devolucion ? montoDevolucion : 0).toFixed(2)}
                  </p>
                </div>
                <div className="flex-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 text-center">
                  <p className="text-slate-500 dark:text-slate-400">Retenido</p>
                  <p className={`font-bold mt-0.5 ${montoRetenido > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
                    Q{montoRetenido.toFixed(2)}
                  </p>
                </div>
              </div>
            )}

            {/* Motivo retención */}
            {requiereMotRet && (
              <div>
                <label className={labelCls}>Motivo de retención * (Q{montoRetenido.toFixed(2)} retenidos)</label>
                <textarea
                  rows={2}
                  placeholder="Ej: Diagnóstico ya realizado, costo de gestión..."
                  value={motivoRetencion}
                  onChange={e => { setMotivoRetencion(e.target.value); setError(''); }}
                  className={inputCls + ' resize-none'}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
            Sin anticipo registrado — no hay devolución de dinero.
          </div>
        )}

        {/* Motivo de cancelación */}
        <div>
          <label className={labelCls}>Motivo de cancelación *</label>
          <textarea
            rows={3}
            placeholder="Ej: Cliente desistió de la reparación..."
            value={motivo}
            onChange={e => { setMotivo(e.target.value); setError(''); }}
            className={inputCls + ' resize-none'}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs">
            <AlertTriangle size={13} /> {error}
          </div>
        )}

        {/* Acciones */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            No cancelar
          </button>
          <button
            onClick={handleCancelar}
            disabled={saving}
            className="flex-1 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Cancelando…' : 'Sí, Cancelar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Modal Asignar Técnico (inline en RepairsPage) ─────────────────────────
function ModalAsignarTecnicoRepairs({
  repair, tecnicos, currentUserId, onClose, onSuccess,
}: { repair: Repair; tecnicos: Tecnico[]; currentUserId: number; onClose: () => void; onSuccess: () => void; }) {
  const [selectedId, setSelectedId] = useState<number | ''>(repair.tecnicoAsignadoId ?? '');
  const [saving, setSaving]         = useState(false);
  const [error,  setError]          = useState('');
  const inputCls = 'w-full px-3 py-2 text-sm rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40';

  const handleSave = async () => {
    if (!selectedId) { setError('Selecciona un técnico'); return; }
    try {
      setSaving(true); setError('');
      await asignarTecnico(repair.id, { tecnico_id: selectedId as number });
      onSuccess(); onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error al asignar técnico');
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Asignar Técnico — ${repair.id}`}>
      <div className="space-y-4 text-sm">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3 space-y-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">Cliente: <span className="font-semibold text-slate-800 dark:text-slate-200">{repair.clienteNombre}</span></p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Equipo: <span className="text-slate-700 dark:text-slate-300">{[repair.recepcion.marca, repair.recepcion.modelo].filter(Boolean).join(' ')}</span></p>
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Técnico a asignar</label>
          <select className={inputCls} value={selectedId} onChange={e => { setSelectedId(e.target.value ? Number(e.target.value) : ''); setError(''); }}>
            <option value="">— Seleccionar técnico —</option>
            {tecnicos.map(t => (
              <option key={t.id} value={t.id}>
                {(t.nombre_completo?.trim() && t.nombre_completo !== ' ') ? t.nombre_completo : t.username}{t.id === currentUserId ? ' (yo)' : ''} — {t.roles.join(', ')}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
            <AlertCircle size={12} /> {error}
          </div>
        )}
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !selectedId} className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
            {saving ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
            {saving ? 'Asignando…' : 'Asignar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── RepairCard ────────────────────────────────────────────────────────────
function RepairCard({
  repair,
  onViewDetail,
  onHistory,
  onFlowManage,
  onPrintPDF,
  onPrintTicket,
  onEditPriority,
  onPayBalance,
  onCancel,
  onAssignTech,
  userIsAdmin,
}: {
  repair: Repair;
  onViewDetail: (r: Repair) => void;
  onHistory: (id: string) => void;
  onFlowManage: () => void;
  onPrintPDF: (r: Repair) => void;
  onPrintTicket: (r: Repair) => void;
  onEditPriority: (r: Repair) => void;
  onPayBalance: (r: Repair) => void;
  onCancel: (r: Repair) => void;
  onAssignTech: (r: Repair) => void;
  userIsAdmin: boolean;
}) {
  const isCancelled = repair.estado === 'CANCELADA';
  const isDelivered = repair.estado === 'ENTREGADA';
  const canEditOperationalData = !isCancelled && !isDelivered;
  const saldo = calcSaldo(repair);
  const totalPagado = calcTotalPagado(repair);
  const isPaid = repair.total > 0 && saldo <= 0;
  const hasTotal = repair.total > 0;
  const accessInfo = getAccessInfo(repair.recepcion);

  return (
    <div className={`border rounded-2xl p-4 shadow-sm transition-all ${isCancelled ? 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900/60' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:shadow-md hover:border-slate-300 dark:hover:bg-slate-900/90'}`}>
      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800">
          {repair.id}
        </span>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_PILL[repair.estado] || 'bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`}>
          {STATUS_LABEL[repair.estado] || repair.estado.replace(/_/g, ' ')}
        </span>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY_PILL[repair.prioridad] || 'bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`}>
          {repair.prioridad}
        </span>
        {repair.garantiaDias > 0 && !isCancelled && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800">
            Garantía {repair.garantiaDias}d
          </span>
        )}
        {repair.stickerSerieInterna && (
          <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800">
            <Tag size={9} />{repair.stickerSerieInterna}
          </span>
        )}
        {/* Payment status badge */}
        {hasTotal && !isCancelled && (
          isPaid
            ? <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"><CheckCircle2 size={9} /> Pagada</span>
            : <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">Saldo: Q{saldo.toFixed(2)}</span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Info grid */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2.5 min-w-0">
          {/* Cliente */}
          <div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1 mb-0.5"><User size={9} /> Cliente</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight truncate">{repair.clienteNombre || 'No registrado'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{repair.clienteTelefono || 'No registrado'}</p>
            {(repair.recepcion.montoAnticipo || 0) > 0 ? (
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                Anticipo: Q{(repair.recepcion.montoAnticipo || 0).toFixed(2)}
                {repair.recepcion.metodoAnticipo && (
                  <span className="font-normal text-slate-500 dark:text-slate-400 ml-1">
                    ({repair.recepcion.metodoAnticipo.replace('tarjeta_', 'tarjeta ')})
                  </span>
                )}
              </p>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 italic">Sin anticipo</p>
            )}
            {(repair.montoPagadoAdicional || 0) > 0 && (
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                + Q{(repair.montoPagadoAdicional || 0).toFixed(2)}
                {repair.metodoPagoAdicional && (
                  <span className="font-normal text-slate-500 dark:text-slate-400 ml-1">({repair.metodoPagoAdicional})</span>
                )}
              </p>
            )}
          </div>

          {/* Equipo */}
          <div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1 mb-0.5"><Smartphone size={9} /> Equipo</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
              {[repair.recepcion.marca, repair.recepcion.modelo].filter(Boolean).join(' ') || 'No registrado'}
            </p>
            {(repair.recepcion.tipoEquipo || repair.recepcion.color) && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{[repair.recepcion.tipoEquipo, repair.recepcion.color].filter(Boolean).join(' · ')}</p>
            )}
            {accessInfo.label && (
            <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-1">
              {accessInfo.label}
            </p>
          )}
          </div>

          {/* Fecha + diagnóstico */}
          <div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1 mb-0.5"><CalendarDays size={9} /> Ingreso</p>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {safeDate(repair.fechaIngreso)}
              {repair.createdAt && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-1.5">
                  {new Date(String(repair.createdAt).replace(' ', 'T')).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </p>
            {repair.recepcion.userRecepcion && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                <span className="opacity-60">Creado por:</span> <span className="font-medium">{repair.recepcion.userRecepcion}</span>
              </p>
            )}
            {repair.recepcion.diagnosticoInicial ? (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-1 line-clamp-2 border-l-2 border-slate-300 dark:border-slate-600 pl-1.5">
                {repair.recepcion.diagnosticoInicial}
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 italic mt-1 pl-1.5">Sin observaciones</p>
            )}
            {isCancelled && repair.motivoCancelacion && (
              <p className="text-[11px] text-red-600 dark:text-red-400/70 italic mt-1 border-l-2 border-red-300 dark:border-red-800 pl-1.5 line-clamp-2">
                Cancelado: {repair.motivoCancelacion}
              </p>
            )}
            {repair.fechaEntregaProgramada && (
              <p className="text-[11px] text-sky-600 dark:text-sky-400 font-medium mt-1 flex items-center gap-1">
                <CalendarDays size={9} />
                Entrega: {safeDate(repair.fechaEntregaProgramada)}
              </p>
            )}
            {/* OT: técnico asignado chip */}
            {repair.tecnicoAsignadoId ? (
              <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                <UserCheck size={9} /> {
                  (repair.tecnicoNombre?.trim() && repair.tecnicoNombre.trim() !== '')
                    ? repair.tecnicoNombre.trim()
                    : repair.tecnicoUsername
                    ? repair.tecnicoUsername
                    : repair.tecnicoAsignado
                    || 'Técnico asignado'
                }
              </p>
            ) : repair.tecnicoAsignado ? (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                <UserCheck size={9} /> {repair.tecnicoAsignado}
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                <UserCheck size={9} /> Sin asignar
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-row flex-wrap lg:flex-col gap-1.5 lg:w-36 lg:shrink-0">
          <button onClick={() => onViewDetail(repair)} className="flex-1 lg:flex-none h-9 flex items-center justify-center gap-1.5 px-2.5 rounded-xl text-xs font-semibold border transition-colors bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
            <Eye size={12} /> Ver Detalle
          </button>
          <button onClick={() => onHistory(repair.id)} className="flex-1 lg:flex-none h-9 flex items-center justify-center gap-1.5 px-2.5 rounded-xl text-xs font-semibold border transition-colors bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
            <History size={12} /> Ver Historial
          </button>
          {canEditOperationalData && (
            <button onClick={onFlowManage} className="flex-1 lg:flex-none h-9 flex items-center justify-center gap-1.5 px-2.5 rounded-xl text-xs font-semibold border transition-colors bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800">
              <Clock size={12} /> Flujo
            </button>
          )}
          <button onClick={() => onPrintPDF(repair)} className="flex-1 lg:flex-none h-9 flex items-center justify-center gap-1.5 px-2.5 rounded-xl text-xs font-semibold border transition-colors bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
            <Printer size={12} /> Contrato
          </button>
          <button onClick={() => onPrintTicket(repair)} className="flex-1 lg:flex-none h-9 flex items-center justify-center gap-1.5 px-2.5 rounded-xl text-xs font-semibold border transition-colors bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" title="Imprimir ticket térmico">
            <Printer size={12} /> Ticket
          </button>
          {canEditOperationalData && (
            <button onClick={() => onEditPriority(repair)} className="flex-1 lg:flex-none h-9 flex items-center justify-center gap-1.5 px-2.5 rounded-xl text-xs font-semibold border transition-colors bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800">
              <ChevronDown size={12} /> Prioridad
            </button>
          )}
          {!isCancelled && hasTotal && !isPaid && (
            <button onClick={() => onPayBalance(repair)} className="flex-1 lg:flex-none h-9 flex items-center justify-center gap-1.5 px-2.5 rounded-xl text-xs font-semibold border transition-colors bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
              <DollarSign size={12} /> Pagar Saldo
            </button>
          )}
          {!isCancelled && repair.estado !== 'ENTREGADA' && (
            <button onClick={() => onCancel(repair)} className="flex-1 lg:flex-none h-9 flex items-center justify-center gap-1.5 px-2.5 rounded-xl text-xs font-semibold border transition-colors bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800">
              <Ban size={12} /> Cancelar
            </button>
          )}
          {userIsAdmin && canEditOperationalData && (
            <button onClick={() => onAssignTech(repair)} className="flex-1 lg:flex-none h-9 flex items-center justify-center gap-1.5 px-2.5 rounded-xl text-xs font-semibold border transition-colors bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800">
              <UserCheck size={12} /> {repair.tecnicoAsignadoId ? 'Técnico' : 'Asignar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function RepairsPage() {
  const navigate = useNavigate();
  const { repairs, deleteRepair, changeRepairState, updateRepair, searchRepairs, isLoading, validateStickerUniqueness } = useRepairs();
  const { user } = useAuth();
  const userIsAdmin = isAdmin(user?.roles);
  const { empresa, loadEmpresa } = useEmpresa();

  const [searchQuery,    setSearchQuery]    = useState('');
  const [statusFilter,   setStatusFilter]   = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [selectedRepair, setSelectedRepair] = useState<Repair | null>(null);
  const [showDetailModal,   setShowDetailModal]   = useState(false);
  const [showHistoryModal,  setShowHistoryModal]  = useState<string | null>(null);
  const [showPriorityModal, setShowPriorityModal] = useState<Repair | null>(null);
  const [showPayModal,      setShowPayModal]      = useState<Repair | null>(null);
  const [showCancelModal,   setShowCancelModal]   = useState<Repair | null>(null);
  const [showAssignModal,   setShowAssignModal]   = useState<Repair | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [loadingRepairs, setLoadingRepairs] = useState(true);
  const [showDetailPin, setShowDetailPin]   = useState(false);
  const [backendRepairs, setBackendRepairs] = useState<Repair[]>([]);
  const [tecnicos,       setTecnicos]       = useState<Tecnico[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [grupoFiltro, setGrupoFiltro]       = useState<GrupoFiltro>('proceso');

  useEffect(() => { loadRepairs(); loadEmpresa(); }, [loadEmpresa]);

  useEffect(() => {
    if (userIsAdmin) {
      getTecnicos().then(setTecnicos).catch(() => {});
    }
  }, [userIsAdmin]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadRepairs = async () => {
    try {
      setLoadingRepairs(true);
      setBackendRepairs(await getAllReparaciones());
    } catch (e) {
      console.error('Error cargando reparaciones:', e);
      showToast('Error al cargar reparaciones', 'error');
    } finally {
      setLoadingRepairs(false);
    }
  };

  // ── Optimistic updates ────────────────────────────────────────────────
  const handlePrioritySuccess = (id: string, prioridad: RepairPriority) => {
    setBackendRepairs(prev => prev.map(r => r.id === id ? { ...r, prioridad } : r));
    if (selectedRepair?.id === id) setSelectedRepair(prev => prev ? { ...prev, prioridad } : prev);
    showToast('Prioridad actualizada');
  };

  const handlePaySuccess = (id: string, montoPagado: number, metodo: string) => {
    setBackendRepairs(prev => prev.map(r => {
      if (r.id !== id) return r;
      const nuevoPagado = (r.montoPagadoAdicional || 0) + montoPagado;
      return { ...r, montoPagadoAdicional: nuevoPagado, metodoPagoAdicional: metodo as any };
    }));
    if (selectedRepair?.id === id) {
      setSelectedRepair(prev => prev ? {
        ...prev,
        montoPagadoAdicional: (prev.montoPagadoAdicional || 0) + montoPagado,
        metodoPagoAdicional: metodo as any,
      } : prev);
    }
    showToast('Pago registrado exitosamente');
  };

  const handleCancelSuccess = (id: string) => {
    setBackendRepairs(prev => prev.map(r =>
      r.id === id ? { ...r, estado: 'CANCELADA' as any } : r
    ));
    if (selectedRepair?.id === id) setSelectedRepair(prev => prev ? { ...prev, estado: 'CANCELADA' as any } : prev);
    showToast('Reparación cancelada');
  };

  const handleRepairCreated = async () => {
    showToast('Reparación creada exitosamente');
    await loadRepairs();
  };

  // ── Filters ───────────────────────────────────────────────────────────
  const totalProceso    = backendRepairs.filter(r => GRUPO_ESTADOS.proceso.includes(r.estado)).length;
  const totalEntregadas = backendRepairs.filter(r => GRUPO_ESTADOS.entregadas.includes(r.estado)).length;
  const totalCanceladas = backendRepairs.filter(r => GRUPO_ESTADOS.canceladas.includes(r.estado)).length;
  const totalHistorial  = backendRepairs.filter(r => GRUPO_ESTADOS.historial.includes(r.estado)).length;

  const handleGrupoChange = (g: GrupoFiltro) => {
    setGrupoFiltro(g);
    setStatusFilter(''); // limpiar filtro de estado al cambiar grupo
  };

  const filteredRepairs = backendRepairs.filter(r => {
    if (!GRUPO_ESTADOS[grupoFiltro].includes(r.estado)) return false;
    const q = searchQuery.toLowerCase();
    const okSearch = !q ||
      r.clienteNombre?.toLowerCase().includes(q) ||
      r.clienteTelefono?.toLowerCase().includes(q) ||
      r.recepcion.marca?.toLowerCase().includes(q) ||
      r.recepcion.modelo?.toLowerCase().includes(q) ||
      r.recepcion.imei?.toLowerCase().includes(q) ||
      r.id?.toLowerCase().includes(q);
    return okSearch &&
      (!statusFilter || r.estado === statusFilter) &&
      (!priorityFilter || r.prioridad === priorityFilter);
  });

  // ── PDF helpers ───────────────────────────────────────────────────────
  // Contrato de recepción se genera desde backend para respetar tenant, logo, firmas y formato oficial.
  const handleOpenContrato = async (r: Repair) => {
    try {
      await abrirContratoReparacion(r.id);
    } catch (error: any) {
      showToast(error?.message || 'Error al obtener contrato', 'error');
    }
  };

const handleImprimirTicket = (r: Repair) => {
  const printWindow = window.open(
    '',
    '_blank',
    'width=520,height=720,left=200,top=80,resizable=yes,scrollbars=yes'
  );

  if (!printWindow) return;

  const equipo = [r.recepcion.marca, r.recepcion.modelo].filter(Boolean).join(' ') || 'N/A';

  const anticipo = r.recepcion.montoAnticipo ?? 0;
  const pagadoAdicional = r.montoPagadoAdicional ?? 0;
  const saldo = Math.max(0, (r.total || 0) - anticipo - pagadoAdicional);

  const fechaIngreso = (() => {
    const v = r.recepcion.fechaRecepcion || r.fechaIngreso;

    if (!v) return 'N/A';

    const match = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (!match) return String(v);

    const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

    return isNaN(d.getTime())
      ? String(v)
      : d.toLocaleDateString('es-GT', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
  })();

  const problema = r.recepcion.diagnosticoInicial || r.observaciones || 'N/A';
  const creadoPor = r.recepcion.userRecepcion || 'N/A';

  const accessInfo = getAccessInfo(r.recepcion);

  const formatPatternForTicket = (value?: string | null): string => {
    const nodes = String(value || '').match(/[1-9]/g) || [];
    return nodes.join(' > ');
  };

  const accesoLabel = accessInfo.label
    ? accessInfo.tipo === 'patron'
      ? `Patrón: ${formatPatternForTicket(accessInfo.valor) || accessInfo.valor}`
      : accessInfo.label
    : null;

  const esc = (s: unknown) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const logoUrl = empresa?.logo_url ? getImageUrl(empresa.logo_url) : '';
  const empresaNombre = empresa?.nombre_comercial || empresa?.nombre || 'TecnoOne';

  const logoHtml = logoUrl
    ? `<img class="brand-logo" src="${esc(logoUrl)}" alt="${esc(empresaNombre)}" />`
    : '<div class="brand-mark">TO</div>';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Ticket ${esc(r.id)}</title>
  <style>
    @page {
      size: 2in 1in;
      margin: 0.7mm;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: Arial, sans-serif;
      font-size: 5.6px;
      line-height: 1.2;
    }

    .ticket {
      width: 100%;
      max-width: 2in;
      padding: 0;
      overflow: hidden;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 1mm;
      border-bottom: 1px solid #000;
      padding-bottom: 0.4mm;
      margin-bottom: 0.4mm;
      min-height: 7mm;
    }

    .brand-mark {
      width: 7mm;
      height: 7mm;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 5px;
      font-weight: bold;
      border: 1px solid #000;
      border-radius: 1mm;
      color: #000;
      background: #fff;
    }

    .brand-logo {
      max-width: 13mm;
      max-height: 7mm;
      object-fit: contain;
      filter: grayscale(1) contrast(1.25);
      -webkit-filter: grayscale(1) contrast(1.25);
      flex-shrink: 0;
    }

    .header-text {
      font-size: 7px;
      font-weight: bold;
      line-height: 1.05;
      overflow: hidden;
    }

    .header-text span {
      display: block;
      font-size: 5.2px;
      font-weight: normal;
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 1mm;
    }

    .row {
      line-height: 1.22;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .row.full {
      grid-column: span 2;
      white-space: normal;
      word-break: break-word;
    }

    .b {
      font-weight: bold;
    }

    .access {
      font-weight: bold;
      font-size: 5.8px;
    }

    .nota {
      font-size: 5.2px;
      line-height: 1.15;
      max-height: 7mm;
      overflow: hidden;
    }

    @media screen {
      body {
        padding: 18px;
        background: #e5e7eb;
      }

      .ticket {
        background: #fff;
        border: 1px solid #111;
        padding: 3mm;
        width: 2in;
        max-width: 2in;
        min-height: 1in;
        margin: 0 auto;
        transform: scale(2.2);
        transform-origin: top center;
      }
    }

    @media print {
      body {
        background: #fff !important;
        color: #000 !important;
      }

      .ticket {
        border: none !important;
        transform: none !important;
        padding: 0 !important;
      }
    }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="header">
      ${logoHtml}
      <div class="header-text">
        ${esc(empresaNombre)}
        <span>Ticket de reparación</span>
      </div>
    </div>

    <div class="grid">
      <div class="row full"><span class="b"># </span>${esc(r.id)}</div>
      <div class="row"><span class="b">Cliente: </span>${esc(r.clienteNombre || 'N/A')}</div>
      <div class="row"><span class="b">Tel: </span>${esc(r.clienteTelefono || 'N/A')}</div>
      <div class="row"><span class="b">Equipo: </span>${esc(equipo)}</div>
      <div class="row"><span class="b">Ingreso: </span>${esc(fechaIngreso)}</div>
      <div class="row"><span class="b">Recibido: </span>${esc(creadoPor)}</div>
      ${accesoLabel ? `<div class="row full access"><span class="b">Acceso: </span>${esc(accesoLabel)}</div>` : ''}
      ${r.total > 0 ? `<div class="row"><span class="b">Total: </span>Q${Number(r.total || 0).toFixed(2)}</div>` : ''}
      ${saldo > 0 ? `<div class="row"><span class="b">Saldo: </span>Q${saldo.toFixed(2)}</div>` : ''}
      <div class="row full nota"><span class="b">Nota: </span>${esc(problema)}</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);

      window.onafterprint = function() {
        setTimeout(function() {
          window.close();
        }, 400);
      };
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};

  return (
    <div className="space-y-4">
      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-20 sm:bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-xl text-sm font-semibold transition-all ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Reparaciones</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Gestión de equipos en servicio técnico</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          <Plus size={16} /> Nueva Reparación
        </button>
      </div>

      {/* Pestañas de grupo */}
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {([
          { key: 'proceso'    as GrupoFiltro, label: 'En Proceso',  count: totalProceso,
            active: 'bg-blue-600  border-blue-600  text-white',
            badge:  'bg-blue-500/30 text-white' },
          { key: 'entregadas' as GrupoFiltro, label: 'Entregadas',  count: totalEntregadas,
            active: 'bg-emerald-600 border-emerald-600 text-white',
            badge:  'bg-emerald-500/30 text-white' },
          { key: 'canceladas' as GrupoFiltro, label: 'Canceladas',  count: totalCanceladas,
            active: 'bg-red-600  border-red-600  text-white',
            badge:  'bg-red-500/30 text-white' },
          { key: 'historial'  as GrupoFiltro, label: 'Historial',   count: totalHistorial,
            active: 'bg-slate-700 border-slate-700 text-white dark:bg-slate-600 dark:border-slate-600',
            badge:  'bg-white/20 text-white' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => handleGrupoChange(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all whitespace-nowrap ${
              grupoFiltro === tab.key
                ? tab.active
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
            <span className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-xs font-bold ${
              grupoFiltro === tab.key
                ? tab.badge
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por cliente, equipo, código, IMEI..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-sm rounded-xl border px-3 py-2 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 sm:w-44">
          <option value="">Todos los estados</option>
          <option value="RECIBIDA">Recibida</option>
          <option value="EN_DIAGNOSTICO">En Diagnóstico</option>
          <option value="EN_REPARACION">En Reparación</option>
          <option value="ESPERANDO_PIEZA">Esperando Pieza</option>
          <option value="COMPLETADA">Completada</option>
          <option value="ENTREGADA">Entregada</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
          className="text-sm rounded-xl border px-3 py-2 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 sm:w-44">
          <option value="">Todas las prioridades</option>
          <option value="BAJA">Baja</option>
          <option value="MEDIA">Media</option>
          <option value="ALTA">Alta</option>
        </select>
      </div>

      {/* Count */}
      {!loadingRepairs && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {filteredRepairs.length} reparación{filteredRepairs.length !== 1 ? 'es' : ''}
          {(searchQuery || statusFilter || priorityFilter) ? ' (filtradas)' : ''}
        </p>
      )}

      {/* List */}
      <div className="space-y-2">
        {loadingRepairs ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mb-3" />
            <p className="text-sm">Cargando reparaciones...</p>
          </div>
        ) : filteredRepairs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Wrench size={40} className="mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No se encontraron reparaciones</p>
            <p className="text-xs mt-1 text-slate-400 dark:text-slate-500">
              {searchQuery || statusFilter || priorityFilter
                ? 'Prueba ajustando los filtros'
                : 'Crea tu primera reparación con el botón de arriba'}
            </p>
          </div>
        ) : filteredRepairs.map(r => (
          <RepairCard
            key={r.id}
            repair={r}
            onViewDetail={rep => { setSelectedRepair(rep); setShowDetailModal(true); setShowDetailPin(false); }}
            onHistory={id => setShowHistoryModal(id)}
            onFlowManage={() => navigate('/flujo-reparaciones')}
            onPrintPDF={handleOpenContrato}
            onPrintTicket={handleImprimirTicket}
            onEditPriority={rep => setShowPriorityModal(rep)}
            onPayBalance={rep => setShowPayModal(rep)}
            onCancel={rep => setShowCancelModal(rep)}
            onAssignTech={rep => setShowAssignModal(rep)}
            userIsAdmin={userIsAdmin}
          />
        ))}
      </div>

      {/* ── Modals ── */}

      {/* Historial */}
      {showHistoryModal && (
        <ModalHistorialReparacion
          isOpen
          onClose={() => setShowHistoryModal(null)}
          reparacionId={showHistoryModal}
        />
      )}

      {/* Editar prioridad */}
      {showPriorityModal &&
        !['ENTREGADA', 'CANCELADA'].includes(showPriorityModal.estado) && (
        <ModalEditarPrioridad
          repair={showPriorityModal}
          onClose={() => setShowPriorityModal(null)}
          onSuccess={handlePrioritySuccess}
        />
      )}

      {/* Pago saldo pendiente */}
      {showPayModal && (
        <ModalPagoSaldo
          repair={showPayModal}
          onClose={() => setShowPayModal(null)}
          onSuccess={handlePaySuccess}
        />
      )}

      {/* Cancelar */}
      {showCancelModal && (
        <ModalCancelar
          repair={showCancelModal}
          onClose={() => setShowCancelModal(null)}
          onSuccess={handleCancelSuccess}
        />
      )}

      {/* Asignar técnico */}
      {showAssignModal &&
        !['ENTREGADA', 'CANCELADA'].includes(showAssignModal.estado) && (
        <ModalAsignarTecnicoRepairs
          repair={showAssignModal}
          tecnicos={tecnicos}
          currentUserId={user?.id ?? 0}
          onClose={() => setShowAssignModal(null)}
          onSuccess={() => { showToast('Técnico asignado correctamente'); loadRepairs(); setShowAssignModal(null); }}
        />
      )}

      {/* Detalle modal */}
      {showDetailModal && selectedRepair && (() => {
        const r = selectedRepair;
        const saldo = calcSaldo(r);
        const totalPagado = calcTotalPagado(r);
        const isPaid = r.total > 0 && saldo <= 0;
        const isCancelled = r.estado === 'CANCELADA';
        const isDelivered = r.estado === 'ENTREGADA';
        const canEditOperationalData = !isCancelled && !isDelivered;
        return (
          <Modal
            open={showDetailModal}
            onClose={() => { setShowDetailModal(false); setSelectedRepair(null); }}
            title={`Detalle — ${r.id}`}
          >
            <div className="space-y-4 text-sm">
              {/* Cancelled banner */}
              {isCancelled && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
                  <Ban size={14} className="text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-700 dark:text-red-300 font-semibold text-xs">Reparación Cancelada</p>
                    {r.motivoCancelacion && <p className="text-red-600/70 dark:text-red-400/70 text-xs mt-0.5">{r.motivoCancelacion}</p>}
                    {r.fechaCancelacion && <p className="text-red-500/50 dark:text-red-400/50 text-xs mt-0.5">Fecha: {safeDate(r.fechaCancelacion)}</p>}
                  </div>
                </div>
              )}

              {/* Cliente */}
              <section>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1"><User size={10} /> Cliente</p>
                <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3 grid grid-cols-2 gap-2 border border-slate-200 dark:border-slate-800">
                  <div><p className="text-[10px] text-slate-500 dark:text-slate-400">Nombre</p><p className="text-slate-900 dark:text-slate-100 font-medium">{r.clienteNombre || '—'}</p></div>
                  <div><p className="text-[10px] text-slate-500 dark:text-slate-400">Teléfono</p><p className="text-slate-900 dark:text-slate-100 font-medium">{r.clienteTelefono || 'No registrado'}</p></div>
                  {r.clienteEmail && <div className="col-span-2"><p className="text-[10px] text-slate-500 dark:text-slate-400">Email</p><p className="text-slate-800 dark:text-slate-200">{r.clienteEmail}</p></div>}
                </div>
              </section>

              {/* Equipo */}
              <section>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1"><Smartphone size={10} /> Equipo</p>
                <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3 grid grid-cols-2 gap-2 border border-slate-200 dark:border-slate-800">
                  <div><p className="text-[10px] text-slate-500 dark:text-slate-400">Tipo</p><p className="text-slate-900 dark:text-slate-100 font-medium">{r.recepcion.tipoEquipo || '—'}</p></div>
                  <div><p className="text-[10px] text-slate-500 dark:text-slate-400">Marca / Modelo</p><p className="text-slate-900 dark:text-slate-100 font-medium">{[r.recepcion.marca, r.recepcion.modelo].filter(Boolean).join(' ') || '—'}</p></div>
                  <div><p className="text-[10px] text-slate-500 dark:text-slate-400">Color</p><p className="text-slate-800 dark:text-slate-200">{r.recepcion.color || '—'}</p></div>
                  {r.recepcion.imei && <div><p className="text-[10px] text-slate-500 dark:text-slate-400">IMEI / Serie</p><p className="text-slate-800 dark:text-slate-200 font-mono text-xs">{r.recepcion.imei}</p></div>}
                  {/* Acceso — se muestra sólo en detalle, nunca en tabla general */}
                  {(() => {
                    const tipo  = r.recepcion.accesoTipo;
                    const valor = r.recepcion.accesoValor;
                    const legacy = r.recepcion.contraseña;

                    if (tipo === 'patron' && valor) {
                      return (
                        <div className="col-span-2">
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1.5">Patrón de desbloqueo</p>
                          <PatternPreview value={valor} size={88} />
                        </div>
                      );
                    }

                    if (tipo === 'pin' && valor) {
                      return (
                        <div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">PIN / Contraseña</p>
                          <div className="flex items-center gap-2">
                            <p className="text-slate-800 dark:text-slate-200 font-mono text-xs">
                              {showDetailPin ? valor : '•'.repeat(valor.length || 4)}
                            </p>
                            <button type="button" onClick={() => setShowDetailPin(v => !v)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" aria-label={showDetailPin ? 'Ocultar' : 'Mostrar'}>
                              {showDetailPin ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                          </div>
                        </div>
                      );
                    }

                    if (tipo === 'ninguno') {
                      return (
                        <div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">Acceso</p>
                          <p className="text-slate-400 dark:text-slate-500 text-xs italic">Sin acceso registrado</p>
                        </div>
                      );
                    }

                    // Legacy: registro anterior sin acceso_tipo
                    if (legacy) {
                      return <div><p className="text-[10px] text-slate-500 dark:text-slate-400">Acceso</p><p className="text-slate-800 dark:text-slate-200">{legacy}</p></div>;
                    }
                    return null;
                  })()}
                  {r.recepcion.diagnosticoInicial ? (
                    <div className="col-span-2"><p className="text-[10px] text-slate-500 dark:text-slate-400">Diagnóstico inicial</p><p className="text-slate-600 dark:text-slate-300 italic mt-0.5">{r.recepcion.diagnosticoInicial}</p></div>
                  ) : (
                    <div className="col-span-2"><p className="text-[10px] text-slate-500 dark:text-slate-400">Diagnóstico inicial</p><p className="text-slate-400 dark:text-slate-500 italic mt-0.5">Sin observaciones</p></div>
                  )}
                </div>
              </section>

              {/* Estado */}
              <section>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Estado y asignación</p>
                <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3 grid grid-cols-2 gap-2 border border-slate-200 dark:border-slate-800">
                  <div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">Estado</p>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_PILL[r.estado] || 'bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`}>
                      {STATUS_LABEL[r.estado] || r.estado.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">Prioridad</p>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY_PILL[r.prioridad] || 'bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`}>
                      {r.prioridad}
                    </span>
                  </div>
                  {r.tecnicoAsignado && <div className="col-span-2"><p className="text-[10px] text-slate-500 dark:text-slate-400">Técnico</p><p className="text-slate-800 dark:text-slate-200">{r.tecnicoAsignado}</p></div>}
                  <div><p className="text-[10px] text-slate-500 dark:text-slate-400">Fecha ingreso</p><p className="text-slate-800 dark:text-slate-200">{safeDate(r.fechaIngreso)}</p></div>
                </div>
              </section>

              {/* Resumen económico — solo mostrar cuando ya hay un total definido */}
              {r.total > 0 && (
              <section>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Resumen económico</p>
                <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3 space-y-1.5 border border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400"><span>Subtotal</span><span className="text-slate-700 dark:text-slate-300">Q{(r.subtotal || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400"><span>Impuestos</span><span className="text-slate-700 dark:text-slate-300">Q{(r.impuestos || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold border-t border-slate-200 dark:border-slate-800 pt-1.5">
                    <span className="text-slate-700 dark:text-slate-200">Total</span>
                    <span className="text-emerald-600 dark:text-emerald-400 text-base">
                      {r.total > 0 ? `Q${r.total.toFixed(2)}` : 'No definido'}
                    </span>
                  </div>
                  {r.total > 0 && (
                    <>
                      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                        <span>Anticipo recibido
                          {r.recepcion.metodoAnticipo && (
                            <span className="ml-1 text-slate-400 dark:text-slate-500">({r.recepcion.metodoAnticipo.replace('tarjeta_', 'tarjeta ')})</span>
                          )}
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400">Q{(r.recepcion.montoAnticipo || 0).toFixed(2)}</span>
                      </div>
                      {(r.montoPagadoAdicional || 0) > 0 && (
                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>Pago adicional
                            {r.metodoPagoAdicional && <span className="ml-1 text-slate-400 dark:text-slate-500">({r.metodoPagoAdicional})</span>}
                          </span>
                          <span className="text-emerald-600 dark:text-emerald-400">Q{(r.montoPagadoAdicional || 0).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs font-semibold pt-1 border-t border-slate-200 dark:border-slate-800">
                        <span className={saldo > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                          {saldo > 0 ? 'Saldo pendiente' : '✓ Pagada'}
                        </span>
                        <span className={saldo > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                          {saldo > 0 ? `Q${saldo.toFixed(2)}` : 'Q0.00'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </section>
              )} {/* end r.total > 0 */}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={() => handleOpenContrato(r)} className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-950/60 transition-colors">
                  <FileSearch size={13} /> Ver contrato
                </button>
                <button onClick={() => handleOpenContrato(r)} className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors">
                  <Printer size={13} /> Descargar contrato
                </button>
                <button onClick={() => handleImprimirTicket(r)} className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-950/60 text-amber-700 dark:text-amber-300 transition-colors">
                  <Printer size={13} /> Imprimir Ticket
                </button>
                {canEditOperationalData && (
                  <button onClick={() => navigate('/flujo-reparaciones')} className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white transition-colors">
                    <Clock size={13} /> Gestionar Flujo
                  </button>
                )}
                {canEditOperationalData && (
                  <button
                    onClick={() => { setShowDetailModal(false); setShowPriorityModal(r); }}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-950/60 text-violet-700 dark:text-violet-300 transition-colors"
                  >
                    <ChevronDown size={13} /> Editar Prioridad
                  </button>
                )}
                {!isCancelled && r.total > 0 && saldo > 0 && (
                  <button
                    onClick={() => { setShowDetailModal(false); setShowPayModal(r); }}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white transition-colors"
                  >
                    <DollarSign size={13} /> Pagar Saldo
                  </button>
                )}
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Nueva Reparación Modal */}
      <NuevaReparacionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleRepairCreated}
      />
    </div>
  );
}
