import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, X, RefreshCw, Calendar, Filter,
  ChevronRight, History, Eye, RotateCcw, AlertCircle, CheckCircle,
} from 'lucide-react';
import { getEntregadas } from '../../services/flujoReparacionService';
import GarantiaStatusBadge from './GarantiaStatusBadge';
import ReingresarGarantiaModal from './ReingresarGarantiaModal';
import ModalHistorialReparacion from './ModalHistorialReparacion';
import { useNavigate } from 'react-router-dom';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(v?: string | null): string {
  if (!v) return '—';
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '—';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtQ(v?: number | null): string {
  if (v === null || v === undefined || isNaN(Number(v))) return '—';
  return `Q${Number(v).toFixed(2)}`;
}

type FiltroGarantia = '' | 'vigente' | 'vencida' | 'sin_garantia';

interface Props {
  onToast: (msg: string, type: 'ok' | 'error') => void;
}

export default function HistorialEntregadasTab({ onToast }: Props) {
  const navigate = useNavigate();

  // ── Data ──────────────────────────────────────────────────────────────────
  const [data,    setData]    = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [search,        setSearch]        = useState('');
  const [filtroGarantia, setFiltroGarantia] = useState<FiltroGarantia>('');
  const [fechaInicio,   setFechaInicio]   = useState('');
  const [fechaFin,      setFechaFin]      = useState('');
  const [showFilters,   setShowFilters]   = useState(false);

  // ── Modals ────────────────────────────────────────────────────────────────
  const [reingresarRep,  setReingresarRep]  = useState<any | null>(null);
  const [historialRepId, setHistorialRepId] = useState<string | null>(null);

  // Debounce search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (opts?: { search?: string }) => {
    setLoading(true);
    try {
      const res = await getEntregadas({
        search: opts?.search ?? search,
        estado_garantia: filtroGarantia || undefined,
        fecha_inicio: fechaInicio || undefined,
        fecha_fin: fechaFin || undefined,
        limit: 200,
      });
      setData(Array.isArray(res.data) ? res.data : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [search, filtroGarantia, fechaInicio, fechaFin]);

  useEffect(() => { load(); }, [filtroGarantia, fechaInicio, fechaFin]);

  // Debounce search input
  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load({ search: val }), 400);
  };

  const clearFilters = () => {
    setSearch('');
    setFiltroGarantia('');
    setFechaInicio('');
    setFechaFin('');
  };

  const hasFilters = search || filtroGarantia || fechaInicio || fechaFin;

  // ── Derived KPIs ──────────────────────────────────────────────────────────
  const kpiVigente     = data.filter(r => r.estado_garantia === 'vigente').length;
  const kpiVencida     = data.filter(r => r.estado_garantia === 'vencida').length;
  const kpiSinGarantia = data.filter(r => r.estado_garantia === 'sin_garantia').length;

  // ── Styles ────────────────────────────────────────────────────────────────
  const inputCls = [
    'pl-8 pr-3 py-1.5 text-xs rounded-xl border',
    'bg-white dark:bg-slate-900',
    'text-slate-800 dark:text-slate-100',
    'border-slate-300 dark:border-slate-700',
    'placeholder:text-slate-400 dark:placeholder:text-slate-500',
    'focus:outline-none focus:ring-2 focus:ring-blue-500/40',
    'transition w-full sm:w-56',
  ].join(' ');

  return (
    <div className="space-y-4">

      {/* KPI mini row */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setFiltroGarantia(filtroGarantia === 'vigente' ? '' : 'vigente')}
          className={[
            'rounded-xl p-3 border text-left transition-colors',
            filtroGarantia === 'vigente'
              ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-400 dark:border-emerald-600'
              : 'bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-600',
          ].join(' ')}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Garantía vigente</p>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-tight">{kpiVigente}</p>
        </button>
        <button
          onClick={() => setFiltroGarantia(filtroGarantia === 'vencida' ? '' : 'vencida')}
          className={[
            'rounded-xl p-3 border text-left transition-colors',
            filtroGarantia === 'vencida'
              ? 'bg-red-100 dark:bg-red-900/40 border-red-400 dark:border-red-600'
              : 'bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-600',
          ].join(' ')}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-red-500 dark:text-red-400">Garantía vencida</p>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-tight">{kpiVencida}</p>
        </button>
        <button
          onClick={() => setFiltroGarantia(filtroGarantia === 'sin_garantia' ? '' : 'sin_garantia')}
          className={[
            'rounded-xl p-3 border text-left transition-colors',
            filtroGarantia === 'sin_garantia'
              ? 'bg-slate-200 dark:bg-slate-700 border-slate-400 dark:border-slate-500'
              : 'bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500',
          ].join(' ')}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sin garantía</p>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-tight">{kpiSinGarantia}</p>
        </button>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por código REP, cliente, equipo, teléfono..."
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs rounded-xl border bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition w-full"
          />
        </div>
        <button
          onClick={() => setShowFilters(p => !p)}
          className={[
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap',
            showFilters
              ? 'bg-blue-600 text-white border-blue-600'
              : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
          ].join(' ')}
        >
          <Filter size={11} />
          Filtros {(fechaInicio || fechaFin) ? '●' : ''}
        </button>
        <button
          onClick={() => load()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <X size={11} /> Limpiar
          </button>
        )}
      </div>

      {/* Date range filter panel */}
      {showFilters && (
        <div className="flex flex-col sm:flex-row gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 flex-1">
            <Calendar size={12} className="text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Entrega desde:</span>
            <input
              type="date"
              value={fechaInicio}
              onChange={e => setFechaInicio(e.target.value)}
              className="flex-1 px-2 py-1 text-xs rounded-lg border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <Calendar size={12} className="text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Hasta:</span>
            <input
              type="date"
              value={fechaFin}
              onChange={e => setFechaFin(e.target.value)}
              className="flex-1 px-2 py-1 text-xs rounded-lg border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="py-14 flex flex-col items-center gap-3 text-slate-400">
            <div className="w-8 h-8 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />
            <p className="text-sm">Cargando historial...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="py-14 flex flex-col items-center gap-2">
            <CheckCircle size={36} className="text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              {hasFilters ? 'No hay resultados con los filtros actuales' : 'No hay reparaciones entregadas aún'}
            </p>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-blue-500 hover:underline">Limpiar filtros</button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Código</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cliente</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 hidden md:table-cell">Equipo</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 hidden sm:table-cell">F. Entrega</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 hidden lg:table-cell">Total cobrado</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Garantía</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.map(rep => (
                  <tr key={rep.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    {/* ID */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200">{rep.id}</span>
                        {rep.es_garantia ? (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 w-fit">
                            <RotateCcw size={8} /> GARANTÍA
                          </span>
                        ) : null}
                      </div>
                    </td>
                    {/* Cliente */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-700 dark:text-slate-200 text-xs max-w-[150px] truncate">
                        {rep.cliente_nombre || '—'}
                      </p>
                      {rep.cliente_telefono && (
                        <p className="text-[10px] text-slate-400">{rep.cliente_telefono}</p>
                      )}
                    </td>
                    {/* Equipo */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-xs text-slate-600 dark:text-slate-300 max-w-[140px] truncate">
                        {[rep.tipo_equipo, rep.marca, rep.modelo].filter(Boolean).join(' ')}
                      </p>
                    </td>
                    {/* Fecha entrega */}
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap hidden sm:table-cell">
                      <div className="flex flex-col gap-0.5">
                        <span>{fmt(rep.fecha_entrega || rep.fecha_entrega_calc || rep.fecha_cierre)}</span>
                        {rep.metodo_anticipo && (
                          <span className="text-[10px] text-slate-400 capitalize">{rep.metodo_anticipo.replace(/_/g, ' ')}</span>
                        )}
                      </div>
                    </td>
                    {/* Total cobrado */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{fmtQ(rep.total)}</span>
                        {Number(rep.monto_anticipo) > 0 && (
                          <span className="text-[10px] text-slate-400">Anticipo: {fmtQ(rep.monto_anticipo)}</span>
                        )}
                      </div>
                    </td>
                    {/* Garantía */}
                    <td className="px-4 py-3">
                      <GarantiaStatusBadge
                        estadoGarantia={rep.estado_garantia}
                        fechaGarantiaFin={rep.fecha_garantia_fin}
                      />
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {/* Ver detalle */}
                        <button
                          onClick={() => navigate(`/reparaciones/${rep.id}`)}
                          title="Ver detalle"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-blue-200 dark:border-blue-800 transition-colors"
                        >
                          <Eye size={10} />
                          <span className="hidden sm:inline">Ver</span>
                        </button>
                        {/* Ver historial */}
                        <button
                          onClick={() => setHistorialRepId(rep.id)}
                          title="Ver historial"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 transition-colors"
                        >
                          <History size={10} />
                          <span className="hidden sm:inline">Historial</span>
                        </button>
                        {/* Reingresar por garantía — solo si vigente */}
                        {rep.estado_garantia === 'vigente' && (
                          <button
                            onClick={() => setReingresarRep(rep)}
                            title="Reingresar por garantía"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 border border-purple-200 dark:border-purple-700 transition-colors"
                          >
                            <RotateCcw size={10} />
                            <span className="hidden sm:inline">Garantía</span>
                          </button>
                        )}
                        {rep.estado_garantia === 'vencida' && (
                          <span
                            title="La garantía ya venció"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-700 cursor-not-allowed"
                          >
                            <AlertCircle size={10} />
                            <span className="hidden sm:inline">Vencida</span>
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {reingresarRep && (
        <ReingresarGarantiaModal
          repair={reingresarRep}
          onClose={() => setReingresarRep(null)}
          onSuccess={() => {
            setReingresarRep(null);
            onToast('Reparación reingresada al flujo con prioridad ALTA.', 'ok');
            load();
          }}
        />
      )}
      {historialRepId && (
        <ModalHistorialReparacion
          isOpen={!!historialRepId}
          onClose={() => setHistorialRepId(null)}
          reparacionId={historialRepId}
        />
      )}
    </div>
  );
}
