import { toBackendEstado } from "../../utils/estadoReparacion";
import {
  GitBranch, Search, CheckCircle, ClipboardList, Wrench,
  RefreshCw, X, AlertCircle, PackageCheck,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getAllReparaciones } from "../../services/repairService";
import API_URL from "../../services/config";
import axios from "axios";
import ModalActualizarEstado from "../../components/repairs/ModalActualizarEstado";
import ModalHistorialReparacion from "../../components/repairs/ModalHistorialReparacion";
import KanbanBoard from "../../components/repairs/KanbanBoard";
import ChecklistIngresoModal from "../../components/repairs/ChecklistIngresoModal";
import HistorialEntregadasTab from "../../components/repairs/HistorialEntregadasTab";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CheckEquipo {
  id: number;
  reparacion_id: string;
  fecha_checklist: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const EXCLUDED_STATES = ['CANCELADA', 'ANULADA', 'CANCELADO', 'ENTREGADA'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function safeDate(v?: string | null): string {
  if (!v) return '—';
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '—';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function matchesSearch(rep: any, q: string): boolean {
  const lq = q.toLowerCase();
  return (
    rep.clienteNombre?.toLowerCase().includes(lq) ||
    rep.clienteTelefono?.toLowerCase().includes(lq) ||
    rep.id?.toLowerCase().includes(lq) ||
    rep.recepcion?.marca?.toLowerCase().includes(lq) ||
    rep.recepcion?.modelo?.toLowerCase().includes(lq) ||
    rep.tecnicoAsignado?.toLowerCase().includes(lq)
  );
}

// ── Style maps (for checklist table) ─────────────────────────────────────────
const ESTADO_MAP: Record<string, { label: string; cls: string }> = {
  RECIBIDA:               { label: 'Recibida',           cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  EN_DIAGNOSTICO:         { label: 'En Diagnóstico',     cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  ESPERANDO_AUTORIZACION: { label: 'Esp. Autorización',  cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
  AUTORIZADA:             { label: 'Autorizada',         cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300' },
  EN_REPARACION:          { label: 'En Reparación',      cls: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300' },
  EN_PROCESO:             { label: 'En Proceso',         cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
  ESPERANDO_PIEZA:        { label: 'Esp. Pieza',         cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
  STAND_BY:               { label: 'Stand By',           cls: 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300' },
  COMPLETADA:             { label: 'Completada',         cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  ENTREGADA:              { label: 'Entregada',          cls: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
};

// ── Main component ─────────────────────────────────────────────────────────────
export default function FlujoReparacionesPage() {
  const navigate = useNavigate();

  // ── Data state ──────────────────────────────────────────────────────────────
  const [reparaciones, setReparaciones]   = useState<any[]>([]);
  const [checksEquipo, setChecksEquipo]   = useState<CheckEquipo[]>([]);
  const [loading, setLoading]             = useState(false);

  // ── Tab state ─────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'flujo' | 'historial'>('flujo');

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [searchChecklist, setSearchChecklist] = useState('');
  const [searchKanban,    setSearchKanban]    = useState('');
  const [filterPrioridad, setFilterPrioridad] = useState<'' | 'ALTA' | 'MEDIA' | 'BAJA'>('');

  // ── Modal state ──────────────────────────────────────────────────────────────
  const [modalEstadoOpen,       setModalEstadoOpen]       = useState(false);
  const [modalHistorialOpen,    setModalHistorialOpen]    = useState(false);
  const [reparacionSeleccionada, setReparacionSeleccionada] = useState<any>(null);

  // Checklist modal
  const [checklistModalOpen,         setChecklistModalOpen]         = useState(false);
  const [selectedRepairForChecklist, setSelectedRepairForChecklist] = useState<any>(null);

  // ── Toast state ──────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string, type: 'ok' | 'error' = 'ok') {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => { loadData(); }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [reps, checks] = await Promise.all([
        getAllReparaciones().then(r => Array.isArray(r) ? r : (r as any).data || []),
        loadAllChecks(),
      ]);
      setReparaciones(reps);
      setChecksEquipo(checks);
    } catch (e) {
      console.error('Error al cargar datos:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAllChecks = async (): Promise<CheckEquipo[]> => {
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.get(`${API_URL}/check-equipo`, {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: s => s < 500,
      });
      return res.data.success && Array.isArray(res.data.data) ? res.data.data : [];
    } catch {
      return [];
    }
  };

  // ── Optimistic estado change (used by Kanban DnD) ────────────────────────────
  const handleEstadoChange = useCallback(async (repId: string, newEstado: string) => {
    // Save snapshot for rollback
    const snapshot = reparaciones.slice();

    // Optimistic update
    setReparaciones(prev => prev.map(r => r.id === repId ? { ...r, estado: newEstado } : r));

    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    const url = `${API_URL}/reparaciones/${repId}/estado`;
    const estadoBackend = toBackendEstado(newEstado);

    // Debug: URL, método, presencia de token
    console.debug('[FlujoReparaciones] PUT', url, { hasToken: !!token });

    try {
      const response = await axios.put(
        url,
        { estado: estadoBackend },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.debug('[FlujoReparaciones] Respuesta status:', response.status);
      showToast(`Estado actualizado a ${newEstado.replace(/_/g, ' ')}`);
    } catch (err: any) {
      setReparaciones(snapshot);
      const status = err.response?.status;
      const serverMsg = err.response?.data?.message;
      console.error('[FlujoReparaciones] Error status:', status, 'body:', err.response?.data);

      if (status === 403) {
        const msg = serverMsg === 'Token no proporcionado'
          ? 'Sesión no válida. Por favor inicia sesión nuevamente.'
          : (serverMsg || 'No tienes permisos para esta acción');
        showToast(msg, 'error');
      } else {
        showToast('Error al cambiar estado. Intenta de nuevo.', 'error');
      }
    }
  }, [reparaciones]);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const activeReps = useMemo(() =>
    reparaciones.filter(r => !EXCLUDED_STATES.includes(String(r.estado).toUpperCase())),
    [reparaciones]
  );

  const checkSet = useMemo(() => new Set(checksEquipo.map(c => c.reparacion_id)), [checksEquipo]);

  // Section 1: Pending checklist (no check), sorted by fecha desc
  const pendingChecklist = useMemo(() =>
    activeReps
      .filter(r => !checkSet.has(r.id) && matchesSearch(r, searchChecklist))
      .sort((a, b) => {
        const ta = a.fechaIngreso ? new Date(String(a.fechaIngreso).replace(' ', 'T')).getTime() : 0;
        const tb = b.fechaIngreso ? new Date(String(b.fechaIngreso).replace(' ', 'T')).getTime() : 0;
        return tb - ta;
      }),
    [activeReps, checkSet, searchChecklist]
  );

  // Section 2: Kanban (with checklist), filtered by search + priority
  const kanbanReps = useMemo(() =>
    activeReps.filter(r =>
      checkSet.has(r.id) &&
      matchesSearch(r, searchKanban) &&
      (filterPrioridad === '' || r.prioridad === filterPrioridad)
    ),
    [activeReps, checkSet, searchKanban, filterPrioridad]
  );

  // KPIs (unfiltered counts)
  const kpiSinCheck  = useMemo(() => activeReps.filter(r => !checkSet.has(r.id)).length, [activeReps, checkSet]);
  const kpiConCheck  = useMemo(() => activeReps.filter(r =>  checkSet.has(r.id)).length, [activeReps, checkSet]);
  const kpiEnProceso = useMemo(() =>
    activeReps.filter(r => ['EN_DIAGNOSTICO','EN_REPARACION','EN_PROCESO','ESPERANDO_PIEZA','AUTORIZADA'].includes(r.estado)).length,
    [activeReps]
  );

  // ── Modal handlers ───────────────────────────────────────────────────────────
  const openModalEstado    = (r: any) => { setReparacionSeleccionada(r); setModalEstadoOpen(true); };
  const openModalHistorial = (r: any) => { setReparacionSeleccionada(r); setModalHistorialOpen(true); };
  const closeModalEstado    = () => { setModalEstadoOpen(false);    setReparacionSeleccionada(null); };
  const closeModalHistorial = () => { setModalHistorialOpen(false); setReparacionSeleccionada(null); };

  const openChecklistModal  = (rep: any) => { setSelectedRepairForChecklist(rep); setChecklistModalOpen(true); };
  const closeChecklistModal = () => { setChecklistModalOpen(false); setSelectedRepairForChecklist(null); };
  const handleChecklistCompleted = () => {
    closeChecklistModal();
    loadData();
    showToast('Checklist guardado correctamente.');
  };

  // ── Shared style helpers ─────────────────────────────────────────────────────
  const inputCls = [
    'pl-8 pr-3 py-1.5 text-xs rounded-xl border',
    'bg-white dark:bg-slate-900',
    'text-slate-800 dark:text-slate-100',
    'border-slate-300 dark:border-slate-700',
    'placeholder:text-slate-400 dark:placeholder:text-slate-500',
    'focus:outline-none focus:ring-2 focus:ring-blue-500/40',
    'transition w-full sm:w-56',
  ].join(' ');

  const sectionCls = 'rounded-2xl border bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-700 overflow-hidden';

  return (
    <div className="space-y-5">

      {/* ── TOAST ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={[
          'fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium',
          toast.type === 'ok'
            ? 'bg-emerald-600 text-white'
            : 'bg-red-600 text-white',
        ].join(' ')}>
          {toast.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-1 opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Flujo de Reparaciones
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Gestión del avance de equipos en servicio técnico
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* ── TABS ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-fit">
        <button
          onClick={() => setActiveTab('flujo')}
          className={[
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors',
            activeTab === 'flujo'
              ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
          ].join(' ')}
        >
          <GitBranch size={13} />
          Flujo Activo
          {activeReps.length > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
              {activeReps.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('historial')}
          className={[
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors',
            activeTab === 'historial'
              ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
          ].join(' ')}
        >
          <PackageCheck size={13} />
          Historial Entregadas
        </button>
      </div>
      {activeTab === 'flujo' && (<>      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total activas */}
        <div className="rounded-2xl p-4 bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
            <GitBranch size={18} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total activas</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-tight">{activeReps.length}</p>
          </div>
        </div>

        {/* Sin checklist */}
        <div className="rounded-2xl p-4 bg-white dark:bg-slate-900/70 border border-amber-300 dark:border-amber-700/50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
            <ClipboardList size={18} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Sin checklist</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-tight">{kpiSinCheck}</p>
          </div>
        </div>

        {/* Con checklist */}
        <div className="rounded-2xl p-4 bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
            <CheckCircle size={18} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Con checklist</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-tight">{kpiConCheck}</p>
          </div>
        </div>

        {/* En proceso */}
        <div className="rounded-2xl p-4 bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
            <Wrench size={18} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">En proceso</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-tight">{kpiEnProceso}</p>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 1: PENDIENTES DE CHECKLIST ────────────────────────────── */}
      <div className={sectionCls}>
        {/* Section header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <ClipboardList size={15} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Pendientes de Checklist</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Reparaciones ingresadas sin checklist</p>
            </div>
            {kpiSinCheck > 0 && (
              <span className="ml-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50">
                {kpiSinCheck}
              </span>
            )}
          </div>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchChecklist}
              onChange={e => setSearchChecklist(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        {/* Section body */}
        {loading ? (
          <div className="py-12 flex flex-col items-center gap-3 text-slate-400">
            <div className="w-8 h-8 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />
            <p className="text-sm">Cargando...</p>
          </div>
        ) : pendingChecklist.length === 0 ? (
          <div className="py-10 flex flex-col items-center gap-2">
            <CheckCircle size={36} className="text-emerald-400 dark:text-emerald-500" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              {searchChecklist ? 'Sin resultados para esta búsqueda' : 'Todas las reparaciones activas tienen checklist'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {searchChecklist ? 'Intenta con otro término' : 'No hay reparaciones pendientes'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                  <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">ID</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cliente</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 hidden sm:table-cell">Equipo</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Estado</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 hidden md:table-cell">Fecha ingreso</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pendingChecklist.map(rep => {
                  const est = ESTADO_MAP[rep.estado];
                  return (
                    <tr key={rep.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        {rep.id}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200 max-w-[180px] truncate">
                        {rep.clienteNombre || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 hidden sm:table-cell max-w-[160px] truncate">
                        {[rep.recepcion?.marca, rep.recepcion?.modelo].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {est
                          ? <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${est.cls}`}>{est.label}</span>
                          : <span className="text-xs text-slate-400">{rep.estado}</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap hidden md:table-cell">
                        {safeDate(rep.fechaIngreso)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openChecklistModal(rep)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                        >
                          <ClipboardList size={11} />
                          <span className="hidden sm:inline">Iniciar </span>Checklist
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── SECCIÓN 2: TABLERO KANBAN ─────────────────────────────────────── */}
      <div className={sectionCls}>
        {/* Section header */}
        <div className="flex flex-col gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          {/* Row 1: title + search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <CheckCircle size={15} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Tablero de Flujo</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Reparaciones con checklist — arrastrar para cambiar estado
                </p>
              </div>
              {kpiConCheck > 0 && (
                <span className="ml-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50">
                  {kpiConCheck}
                </span>
              )}
            </div>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar código, cliente, equipo, técnico..."
                value={searchKanban}
                onChange={e => setSearchKanban(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition w-full sm:w-72"
              />
            </div>
          </div>

          {/* Row 2: priority filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Prioridad:</span>
            {(['', 'ALTA', 'MEDIA', 'BAJA'] as const).map(p => (
              <button
                key={p}
                onClick={() => setFilterPrioridad(p)}
                className={[
                  'px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors',
                  filterPrioridad === p
                    ? p === 'ALTA'  ? 'bg-red-600 border-red-600 text-white'
                    : p === 'MEDIA' ? 'bg-amber-500 border-amber-500 text-white'
                    : p === 'BAJA'  ? 'bg-teal-600 border-teal-600 text-white'
                    : 'bg-slate-700 border-slate-700 text-white dark:bg-slate-200 dark:border-slate-200 dark:text-slate-900'
                    : p === 'ALTA'  ? 'border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                    : p === 'MEDIA' ? 'border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                    : p === 'BAJA'  ? 'border-teal-300 dark:border-teal-700 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20'
                    : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
                ].join(' ')}
              >
                {p === '' ? 'Todas' : p.charAt(0) + p.slice(1).toLowerCase()}
              </button>
            ))}
            {(searchKanban || filterPrioridad) && (
              <button
                onClick={() => { setSearchKanban(''); setFilterPrioridad(''); }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <X size={11} />
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Kanban body */}
        <div className="p-4">
          {loading ? (
            <div className="py-12 flex flex-col items-center gap-3 text-slate-400">
              <div className="w-8 h-8 border-2 border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" />
              <p className="text-sm">Cargando tablero...</p>
            </div>
          ) : (
            <KanbanBoard
              reps={kanbanReps}
              checkSet={checkSet}
              onOpenHistorial={openModalHistorial}
              onOpenEstado={openModalEstado}
              onNavigate={path => navigate(path)}
              onOpenChecklist={openChecklistModal}
              onEstadoChange={handleEstadoChange}
            />
          )}
        </div>
      </div>      </>)}

      {/* ── HISTORIAL TAB ────────────────────────────────────────── */}
      {activeTab === 'historial' && (
        <HistorialEntregadasTab onToast={showToast} />
      )}
      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {modalEstadoOpen && reparacionSeleccionada && (
        <ModalActualizarEstado
          isOpen={modalEstadoOpen}
          onClose={closeModalEstado}
          reparacion={reparacionSeleccionada}
          onSuccess={loadData}
        />
      )}
      {modalHistorialOpen && reparacionSeleccionada && (
        <ModalHistorialReparacion
          isOpen={modalHistorialOpen}
          onClose={closeModalHistorial}
          reparacionId={reparacionSeleccionada.id}
        />
      )}
      <ChecklistIngresoModal
        isOpen={checklistModalOpen}
        repair={selectedRepairForChecklist}
        onClose={closeChecklistModal}
        onCompleted={handleChecklistCompleted}
      />
    </div>
  );
}
