import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, Search, UserCheck, UserX, RefreshCw,
  Eye, Wrench, X, Check, AlertCircle, ChevronDown,
  Calendar, User, Clock,
  BarChart3, AlertTriangle, Package, Users, Activity,
  CheckCircle2, History,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/useAuth';
import { isAdmin } from '../../lib/permissions';
import {
  getOrdenesTrabajo,
  getTecnicos,
  asignarTecnico,
  quitarAsignacion,
  getHistorialOT,
  getResumenOT,
  type OTFilters,
  type HistorialFilters,
} from '../../services/otService';
import type {
  OrdenTrabajo,
  Tecnico,
  ResumenAdmin,
  ResumenTecnico,
  CargaTecnico,
} from '../../types/ot';
import Modal from '../../components/ui/Modal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import ModalActualizarEstado from '../../components/repairs/ModalActualizarEstado';
import { getInitialsFromName, getSafeImageUrl } from '../../lib/avatar';

// ── Status maps ────────────────────────────────────────────────────────────
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

const STATUS_LABEL: Record<string, string> = {
  RECIBIDA:               'Recibida',
  EN_PROCESO:             'En Proceso',
  EN_DIAGNOSTICO:         'En Diagnóstico',
  ESPERANDO_AUTORIZACION: 'Esp. Autorización',
  AUTORIZADA:             'Autorizada',
  EN_REPARACION:          'En Reparación',
  ESPERANDO_PIEZA:        'Esp. Pieza',
  STAND_BY:               'Stand By',
  COMPLETADA:             'Lista p/entregar',
  ENTREGADA:              'Entregada',
  CANCELADA:              'Cancelada',
};

// Estados que NO son activos (solo van al historial)
const ESTADOS_INACTIVOS = new Set(['CANCELADA', 'ENTREGADA']);

// ── Helpers ────────────────────────────────────────────────────────────────
function safeDate(v?: string | null): string {
  if (!v) return '—';
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '—';
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function safeDatetime(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-GT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isVencida(fecha?: string | null, estado?: string): boolean {
  if (!fecha || ESTADOS_INACTIVOS.has(estado ?? '')) return false;
  return new Date(fecha) < new Date();
}

function tecnicoDisplay(ot: OrdenTrabajo): string {
  if (!ot.tecnico_asignado_id) return '';
  const n = ot.tecnico_nombre?.trim();
  return n && n !== ' ' ? n : (ot.tecnico_username ?? '');
}

// ── StatusBadge ────────────────────────────────────────────────────────────
function StatusBadge({ estado }: { estado: string }) {
  return (
    <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_PILL[estado] ?? 'bg-slate-100 text-slate-600 border border-slate-300'}`}>
      {STATUS_LABEL[estado] ?? estado}
    </span>
  );
}

// ── Modal Asignar Técnico ──────────────────────────────────────────────────
interface ModalAsignarProps {
  ot: OrdenTrabajo;
  tecnicos: Tecnico[];
  currentUserId: number;
  onClose: () => void;
  onSuccess: () => void;
}

function ModalAsignarTecnico({ ot, tecnicos, currentUserId, onClose, onSuccess }: ModalAsignarProps) {
  const [selectedId, setSelectedId] = useState<number | ''>(ot.tecnico_asignado_id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleSave = async () => {
    if (!selectedId) { setError('Selecciona un técnico'); return; }
    try {
      setSaving(true);
      setError('');
      await asignarTecnico(ot.id, { tecnico_id: selectedId as number });
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error al asignar técnico');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 text-sm rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40';

  return (
    <Modal open onClose={onClose} title={`Asignar Técnico — ${ot.id}`}>
      <div className="space-y-4 text-sm">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3 space-y-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Cliente: <span className="font-semibold text-slate-800 dark:text-slate-200">{ot.cliente_nombre}</span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Equipo: <span className="text-slate-700 dark:text-slate-300">{[ot.marca, ot.modelo].filter(Boolean).join(' ') || ot.tipo_equipo}</span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            Estado: <StatusBadge estado={ot.estado} />
          </p>
        </div>

        <div>
          <label className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Técnico a asignar</label>
          <select
            className={inputCls}
            value={selectedId}
            onChange={e => { setSelectedId(e.target.value ? Number(e.target.value) : ''); setError(''); }}
          >
            <option value="">— Seleccionar técnico —</option>
            {tecnicos.map(t => (
              <option key={t.id} value={t.id}>
                {(t.nombre_completo?.trim() && t.nombre_completo !== ' ') ? t.nombre_completo : t.username}
                {t.id === currentUserId ? ' (yo)' : ''} — {t.roles.join(', ')}
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
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !selectedId} className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
            {saving ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
            {saving ? 'Asignando…' : 'Asignar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── OTCard ─────────────────────────────────────────────────────────────────
interface OTCardProps {
  ot: OrdenTrabajo;
  userIsAdmin: boolean;
  onAsignar?: (ot: OrdenTrabajo) => void;
  onQuitar?:  (ot: OrdenTrabajo) => void;
  onVer:      (id: string) => void;
  onFlujo:    (id: string) => void;
}

function OTCard({ ot, userIsAdmin, onAsignar, onQuitar, onVer, onFlujo }: OTCardProps) {
  const tec       = tecnicoDisplay(ot);
  const isInactive = ESTADOS_INACTIVOS.has(ot.estado);
  const vencida    = isVencida(ot.fecha_entrega_programada, ot.estado);

  return (
    <div className={`border rounded-2xl p-4 shadow-sm transition-all
      ${isInactive
        ? 'opacity-70 bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
        : vencida
          ? 'bg-red-50/30 dark:bg-red-950/10 border-red-200 dark:border-red-900 hover:shadow-md'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:shadow-md'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        {/* Left: info */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800">
              {ot.id}
            </span>
            <StatusBadge estado={ot.estado} />
            {ot.prioridad === 'ALTA' && !isInactive && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800">
                Alta prioridad
              </span>
            )}
            {vencida && (
              <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800">
                <AlertTriangle size={9} /> Vencida
              </span>
            )}
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1.5">
            <div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide flex items-center gap-0.5 mb-0.5"><User size={9} /> Cliente</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{ot.cliente_nombre}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{ot.cliente_telefono || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-0.5">Equipo</p>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                {[ot.marca, ot.modelo].filter(Boolean).join(' ') || ot.tipo_equipo}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{ot.tipo_equipo}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide flex items-center gap-0.5 mb-0.5"><Calendar size={9} /> Ingreso</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{safeDate(ot.fecha_ingreso)}</p>
              {ot.fecha_entrega_programada && (
                <p className={`text-xs flex items-center gap-0.5 mt-0.5 ${vencida ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
                  <Clock size={9} /> Entrega: {safeDate(ot.fecha_entrega_programada)}
                </p>
              )}
            </div>
          </div>

          {/* Asignación */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs border
            ${ot.tecnico_asignado_id
              ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
              : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
            }`}
          >
            {ot.tecnico_asignado_id
              ? <><UserCheck size={12} className="text-blue-600 dark:text-blue-400 shrink-0" /><span className="font-semibold text-blue-700 dark:text-blue-300">Técnico: {tec}</span></>
              : <><UserX size={12} className="text-amber-600 dark:text-amber-400 shrink-0" /><span className="font-semibold text-amber-700 dark:text-amber-300">Sin asignar</span></>
            }
            {ot.asignado_en && (
              <span className="ml-auto text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <Clock size={9} />{safeDatetime(ot.asignado_en)}
              </span>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex flex-row sm:flex-col gap-1.5 sm:w-32 shrink-0 flex-wrap">
          <button
            onClick={() => onVer(ot.id)}
            className="flex-1 sm:flex-none h-9 flex items-center justify-center gap-1.5 px-2.5 rounded-xl text-xs font-semibold border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 transition-colors"
          >
            <Eye size={12} /> Ver
          </button>
          {!isInactive && (
            <button
              onClick={() => onFlujo(ot.id)}
              className="flex-1 sm:flex-none h-9 flex items-center justify-center gap-1.5 px-2.5 rounded-xl text-xs font-semibold border bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800 transition-colors"
            >
              <Wrench size={12} /> Flujo
            </button>
          )}
          {userIsAdmin && onAsignar && !isInactive && (
            <button
              onClick={() => onAsignar(ot)}
              className="flex-1 sm:flex-none h-9 flex items-center justify-center gap-1.5 px-2.5 rounded-xl text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 transition-colors"
            >
              <UserCheck size={12} /> {ot.tecnico_asignado_id ? 'Cambiar' : 'Asignar'}
            </button>
          )}
          {userIsAdmin && onQuitar && ot.tecnico_asignado_id && !isInactive && (
            <button
              onClick={() => onQuitar(ot)}
              className="flex-1 sm:flex-none h-9 flex items-center justify-center gap-1.5 px-2.5 rounded-xl text-xs font-semibold border bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800 transition-colors"
            >
              <X size={12} /> Quitar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── KPI Card base ──────────────────────────────────────────────────────────
interface KpiCardData {
  label: string; value: number; icon: React.ReactNode;
  color: string; bg: string; iconBg: string;
}

function KpiCard({ label, value, icon, color, bg, iconBg }: KpiCardData) {
  return (
    <div className={`rounded-2xl border p-4 ${bg}`}>
      <div className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center text-white mb-2`}>
        {icon}
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

// ── Admin KPI Cards ────────────────────────────────────────────────────────
function AdminKpiCards({ resumen }: { resumen: ResumenAdmin }) {
  const p     = resumen.porEstado;
  const total = Object.values(p).reduce((a, v) => a + (v ?? 0), 0);

  const cards: KpiCardData[] = [
    { label: 'Total activas',     value: total,                      icon: <BarChart3 size={16} />,    color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',         iconBg: 'bg-blue-600' },
    { label: 'Sin asignar',       value: resumen.sinAsignar,         icon: <UserX size={16} />,        color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',     iconBg: 'bg-amber-500' },
    { label: 'En diagnóstico',    value: p['EN_DIAGNOSTICO']  ?? 0,  icon: <Search size={16} />,       color: 'text-sky-600 dark:text-sky-400',       bg: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800',             iconBg: 'bg-sky-500' },
    { label: 'En reparación',     value: p['EN_REPARACION']   ?? 0,  icon: <Wrench size={16} />,       color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',     iconBg: 'bg-amber-600' },
    { label: 'Esp. pieza',        value: p['ESPERANDO_PIEZA'] ?? 0,  icon: <Package size={16} />,      color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800', iconBg: 'bg-purple-600' },
    { label: 'Listas p/entregar', value: p['COMPLETADA']      ?? 0,  icon: <CheckCircle2 size={16} />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800', iconBg: 'bg-emerald-600' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {cards.map(c => <KpiCard key={c.label} {...c} />)}
    </div>
  );
}

// ── Técnico KPI Cards ──────────────────────────────────────────────────────
function TecnicoKpiCards({ resumen }: { resumen: ResumenTecnico }) {
  const p     = resumen.porEstado;
  const total = Object.values(p).reduce((a, v) => a + (v ?? 0), 0);

  const cards: KpiCardData[] = [
    { label: 'Mis OT activas',    value: total,                      icon: <ClipboardList size={16} />, color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',         iconBg: 'bg-blue-600' },
    { label: 'En diagnóstico',    value: p['EN_DIAGNOSTICO']  ?? 0,  icon: <Search size={16} />,        color: 'text-sky-600 dark:text-sky-400',       bg: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800',             iconBg: 'bg-sky-500' },
    { label: 'En reparación',     value: p['EN_REPARACION']   ?? 0,  icon: <Wrench size={16} />,        color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',     iconBg: 'bg-amber-600' },
    { label: 'Esp. pieza',        value: p['ESPERANDO_PIEZA'] ?? 0,  icon: <Package size={16} />,       color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800', iconBg: 'bg-purple-600' },
    { label: 'Listas p/entregar', value: p['COMPLETADA']      ?? 0,  icon: <CheckCircle2 size={16} />,  color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800', iconBg: 'bg-emerald-600' },
    ...(resumen.vencidas > 0 ? [{
      label: 'Vencidas', value: resumen.vencidas,
      icon: <AlertTriangle size={16} />,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
      iconBg: 'bg-red-600',
    }] : []),
  ];

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 ${resumen.vencidas > 0 ? 'lg:grid-cols-6' : 'lg:grid-cols-5'} gap-3 mb-6`}>
      {cards.map(c => <KpiCard key={c.label} {...c} />)}
    </div>
  );
}

// ── Carga por técnico (admin) ──────────────────────────────────────────────
function CargaTecnicos({ tecnicos, onFiltrar }: { tecnicos: CargaTecnico[]; onFiltrar: (id: number) => void }) {
  if (tecnicos.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Users size={14} className="text-slate-500 dark:text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Carga por técnico</h2>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          ({tecnicos.length} técnico{tecnicos.length !== 1 ? 's' : ''} con OT activas)
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {tecnicos.map(t => {
          const tecnicoFoto = getSafeImageUrl(t.foto_perfil);

          return (
          <div key={t.id} className="rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-4 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                {tecnicoFoto ? (
                  <img
                    src={tecnicoFoto}
                    alt={t.nombre}
                    loading="lazy"
                    className="w-9 h-9 rounded-xl object-cover shrink-0"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {getInitialsFromName(t.nombre, 'U')}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{t.nombre}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">@{t.username}</p>
                </div>
              </div>
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400 shrink-0 ml-2">{t.total_activas}</span>
            </div>

            <div className="grid grid-cols-3 gap-1 text-center mb-3">
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-2">
                <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{t.en_reparacion}</p>
                <p className="text-[9px] text-slate-500 dark:text-slate-400">Reparando</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950/30 rounded-xl p-2">
                <p className="text-sm font-bold text-purple-600 dark:text-purple-400">{t.esperando_pieza}</p>
                <p className="text-[9px] text-slate-500 dark:text-slate-400">Esp. pieza</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-2">
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{t.listas}</p>
                <p className="text-[9px] text-slate-500 dark:text-slate-400">Listas</p>
              </div>
            </div>

            <button
              onClick={() => onFiltrar(t.id)}
              className="w-full h-8 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 transition-colors"
            >
              <Eye size={11} /> Ver OT
            </button>
          </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tabs ───────────────────────────────────────────────────────────────────
interface TabDef { id: string; label: string; icon: React.ReactNode; count?: number }

function Tabs({ active, onChange, tabs }: { active: string; onChange: (id: string) => void; tabs: TabDef[] }) {
  return (
    <div className="flex gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 mb-5 w-fit">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl transition-all
            ${active === t.id
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
        >
          {t.icon}
          {t.label}
          {t.count !== undefined && t.count > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold
              ${active === t.id ? 'bg-blue-600 text-white' : 'bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-300'}`}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Filter Bar ─────────────────────────────────────────────────────────────
interface FilterBarProps {
  busqueda: string; onBusqueda: (v: string) => void;
  estadoFilt: string; onEstado: (v: string) => void;
  isHistorial?: boolean;
  userIsAdmin: boolean;
  tecnicoFilt?: string; onTecnico?: (v: string) => void; tecnicos?: Tecnico[];
}

function FilterBar({ busqueda, onBusqueda, estadoFilt, onEstado, isHistorial, userIsAdmin, tecnicoFilt, onTecnico, tecnicos }: FilterBarProps) {
  const inputCls  = 'h-9 px-3 text-sm rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40';
  const selectCls = `${inputCls} pr-8 appearance-none`;

  const estadoOpts = isHistorial
    ? [{ v: 'CANCELADA', l: 'Cancelada' }, { v: 'ENTREGADA', l: 'Entregada' }]
    : Object.entries(STATUS_LABEL).filter(([k]) => !ESTADOS_INACTIVOS.has(k)).map(([k, v]) => ({ v: k, l: v }));

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <div className="relative flex-1 min-w-[180px]">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className={`${inputCls} pl-8 w-full`} placeholder="Buscar por cliente, equipo, OT…" value={busqueda} onChange={e => onBusqueda(e.target.value)} />
      </div>
      <div className="relative">
        <select className={selectCls} value={estadoFilt} onChange={e => onEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {estadoOpts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
      {userIsAdmin && tecnicos && tecnicos.length > 0 && onTecnico && (
        <div className="relative">
          <select className={selectCls} value={tecnicoFilt ?? ''} onChange={e => onTecnico(e.target.value)}>
            <option value="">Todos los técnicos</option>
            {!isHistorial && <option value="0">Sin asignar</option>}
            {tecnicos.map(t => (
              <option key={t.id} value={t.id}>
                {(t.nombre_completo?.trim() && t.nombre_completo !== ' ') ? t.nombre_completo : t.username}
              </option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      )}
    </div>
  );
}

// ── OT List ────────────────────────────────────────────────────────────────
interface OTListProps {
  ots: OrdenTrabajo[]; loading: boolean; userIsAdmin: boolean;
  onAsignar?: (ot: OrdenTrabajo) => void; onQuitar?: (ot: OrdenTrabajo) => void;
  onVer: (id: string) => void; onFlujo: (id: string) => void; emptyMsg?: string;
}

function OTList({ ots, loading, userIsAdmin, onAsignar, onQuitar, onVer, onFlujo, emptyMsg }: OTListProps) {
  if (loading) {
    return <div className="flex items-center justify-center py-16"><RefreshCw size={24} className="animate-spin text-blue-500" /></div>;
  }
  if (ots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
        <ClipboardList size={40} className="mb-3 opacity-30" />
        <p className="text-sm font-medium">{emptyMsg ?? 'No hay órdenes de trabajo'}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">{ots.length} orden{ots.length !== 1 ? 'es' : ''}</p>
      {ots.map(ot => (
        <OTCard key={ot.id} ot={ot} userIsAdmin={userIsAdmin} onAsignar={onAsignar} onQuitar={onQuitar} onVer={onVer} onFlujo={onFlujo} />
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function OrdenesTrabajoPage() {
  const navigate    = useNavigate();
  const { user }    = useAuth();
  const userIsAdmin = isAdmin(user?.roles);

  // Data
  const [ots,          setOts]          = useState<OrdenTrabajo[]>([]);
  const [historial,    setHistorial]    = useState<OrdenTrabajo[]>([]);
  const [tecnicos,     setTecnicos]     = useState<Tecnico[]>([]);
  const [resumenAdmin, setResumenAdmin] = useState<ResumenAdmin | null>(null);
  const [resumenTec,   setResumenTec]   = useState<ResumenTecnico | null>(null);

  // UI
  const [activeTab, setActiveTab] = useState<'activas' | 'historial'>('activas');
  const [loading,   setLoading]   = useState(true);
  const [loadingH,  setLoadingH]  = useState(false);
  const [error,     setError]     = useState('');
  const [toast,     setToast]     = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [confirmOt, setConfirmOt] = useState<OrdenTrabajo | null>(null);

  // Filters — activas
  const [busqueda,    setBusqueda]    = useState('');
  const [estadoFilt,  setEstadoFilt]  = useState('');
  const [tecnicoFilt, setTecnicoFilt] = useState('');

  // Filters — historial
  const [hBusqueda,    setHBusqueda]    = useState('');
  const [hEstadoFilt,  setHEstadoFilt]  = useState('');
  const [hTecnicoFilt, setHTecnicoFilt] = useState('');

  // Modal
  const [asignarOT, setAsignarOT] = useState<OrdenTrabajo | null>(null);
  const [flujoOT,   setFlujoOT]   = useState<OrdenTrabajo | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Loaders ───────────────────────────────────────────────────────────────
  const loadOts = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const filters: OTFilters = {};
      if (estadoFilt)                 filters.estado     = estadoFilt;
      if (tecnicoFilt && userIsAdmin) filters.tecnico_id = Number(tecnicoFilt);
      if (busqueda)                   filters.busqueda   = busqueda;
      setOts(await getOrdenesTrabajo(filters));
    } catch {
      setError('No se pudieron cargar las órdenes de trabajo');
    } finally {
      setLoading(false);
    }
  }, [estadoFilt, tecnicoFilt, busqueda, userIsAdmin]);

  const loadHistorial = useCallback(async () => {
    try {
      setLoadingH(true);
      const filters: HistorialFilters = {};
      if (hBusqueda)                   filters.busqueda   = hBusqueda;
      if (hTecnicoFilt && userIsAdmin) filters.tecnico_id = Number(hTecnicoFilt);
      setHistorial(await getHistorialOT(filters));
    } catch {
      // fallo silencioso
    } finally {
      setLoadingH(false);
    }
  }, [hBusqueda, hTecnicoFilt, userIsAdmin]);

  const loadResumen = useCallback(async () => {
    try {
      const data = await getResumenOT();
      if (userIsAdmin) setResumenAdmin(data as ResumenAdmin);
      else             setResumenTec(data as ResumenTecnico);
    } catch {
      // fallo silencioso
    }
  }, [userIsAdmin]);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => { loadOts(); loadResumen(); }, [loadOts, loadResumen]);

  useEffect(() => {
    if (activeTab === 'historial') loadHistorial();
  }, [activeTab, loadHistorial]);

  useEffect(() => {
    if (!userIsAdmin) return;
    getTecnicos().then(setTecnicos).catch(() => {});
  }, [userIsAdmin]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleQuitarAsignacion = async (ot: OrdenTrabajo) => {
    setConfirmOt(ot);
  };

  const doQuitarAsignacion = async (ot: OrdenTrabajo) => {
    setConfirmOt(null);
    try {
      await quitarAsignacion(ot.id);
      showToast('Asignación eliminada');
      loadOts(); loadResumen();
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Error al quitar asignación', 'error');
    }
  };

  const handleFiltrarTecnico = (id: number) => {
    setTecnicoFilt(String(id));
    setActiveTab('activas');
    setTimeout(() => document.getElementById('ot-list-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  // Historial filtrado client-side por estado
  const historialFiltrado = hEstadoFilt ? historial.filter(h => h.estado === hEstadoFilt) : historial;

  const tabs: TabDef[] = [
    { id: 'activas',   label: 'Trabajo Activo', icon: <Activity size={12} />, count: ots.length },
    { id: 'historial', label: 'Historial OT',   icon: <History size={12} /> },
  ];

  return (
    <>
    <div className="min-h-screen" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg">
              <ClipboardList size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Órdenes de Trabajo</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {userIsAdmin
                  ? 'Dashboard administrador — gestión de reparaciones y técnicos'
                  : `Dashboard técnico — ${user?.username ?? ''}`}
              </p>
            </div>
          </div>
          <button
            onClick={() => { loadOts(); loadResumen(); if (activeTab === 'historial') loadHistorial(); }}
            className="h-9 px-4 flex items-center gap-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>

        {/* KPI Cards */}
        {userIsAdmin && resumenAdmin && <AdminKpiCards resumen={resumenAdmin} />}
        {!userIsAdmin && resumenTec   && <TecnicoKpiCards resumen={resumenTec} />}

        {/* Carga por técnico — solo admin */}
        {userIsAdmin && resumenAdmin && resumenAdmin.tecnicos.length > 0 && (
          <CargaTecnicos tecnicos={resumenAdmin.tecnicos} onFiltrar={handleFiltrarTecnico} />
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm mb-4">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Tabs */}
        <div id="ot-list-anchor">
          <Tabs active={activeTab} onChange={v => setActiveTab(v as 'activas' | 'historial')} tabs={tabs} />
        </div>

        {/* Tab: Trabajo Activo */}
        {activeTab === 'activas' && (
          <>
            <FilterBar
              busqueda={busqueda} onBusqueda={setBusqueda}
              estadoFilt={estadoFilt} onEstado={setEstadoFilt}
              userIsAdmin={userIsAdmin}
              tecnicoFilt={tecnicoFilt} onTecnico={setTecnicoFilt} tecnicos={tecnicos}
            />
            <OTList
              ots={ots} loading={loading} userIsAdmin={userIsAdmin}
              onAsignar={userIsAdmin ? setAsignarOT : undefined}
              onQuitar={userIsAdmin ? handleQuitarAsignacion : undefined}
              onVer={id => navigate('/reparaciones', { state: { highlightId: id } })}
              onFlujo={id => setFlujoOT(ots.find(o => o.id === id) ?? null)}
              emptyMsg={userIsAdmin ? 'No hay OT activas con esos filtros' : 'No tienes reparaciones activas asignadas'}
            />
          </>
        )}

        {/* Tab: Historial */}
        {activeTab === 'historial' && (
          <>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 mb-4">
              <History size={13} className="text-slate-500 dark:text-slate-400 shrink-0" />
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Historial de reparaciones <strong>canceladas</strong> y <strong>entregadas</strong>.
                {!userIsAdmin && ' Solo tus propias reparaciones.'}
              </p>
            </div>
            <FilterBar
              busqueda={hBusqueda} onBusqueda={setHBusqueda}
              estadoFilt={hEstadoFilt} onEstado={setHEstadoFilt}
              isHistorial
              userIsAdmin={userIsAdmin}
              tecnicoFilt={hTecnicoFilt} onTecnico={setHTecnicoFilt} tecnicos={tecnicos}
            />
            <OTList
              ots={historialFiltrado} loading={loadingH} userIsAdmin={userIsAdmin}
              onVer={id => navigate('/reparaciones', { state: { highlightId: id } })}
              onFlujo={id => setFlujoOT(historialFiltrado.find(o => o.id === id) ?? null)}
              emptyMsg={userIsAdmin ? 'No hay historial con esos filtros' : 'No tienes historial de OT'}
            />
          </>
        )}
      </div>

      {/* Modal actualizar estado/flujo */}
      {flujoOT && (
        <ModalActualizarEstado
          isOpen={!!flujoOT}
          onClose={() => setFlujoOT(null)}
          reparacion={{
            id: flujoOT.id,
            clienteNombre: flujoOT.cliente_nombre,
            estado: flujoOT.estado,
          }}
          onSuccess={() => { setFlujoOT(null); showToast('Estado actualizado'); loadOts(); loadResumen(); }}
        />
      )}

      {/* Modal asignar técnico */}
      {asignarOT && (
        <ModalAsignarTecnico
          ot={asignarOT}
          tecnicos={tecnicos}
          currentUserId={user?.id ?? 0}
          onClose={() => setAsignarOT(null)}
          onSuccess={() => { showToast('Técnico asignado correctamente'); loadOts(); loadResumen(); }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg text-sm font-semibold border transition-all
          ${toast.type === 'success'
            ? 'bg-emerald-600 text-white border-emerald-700'
            : 'bg-red-600 text-white border-red-700'
          }`}
        >
          {toast.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
    {confirmOt && (
      <ConfirmModal
        isOpen
        title="Quitar asignación"
        message={`¿Quitar asignación de la reparación ${confirmOt.id}?`}
        confirmLabel="Quitar"
        variant="danger"
        onConfirm={() => doQuitarAsignacion(confirmOt)}
        onCancel={() => setConfirmOt(null)}
      />
    )}
    </>
  );
}
