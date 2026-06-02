import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, ShoppingCart, DollarSign,
  Calendar, Download, AlertTriangle, RefreshCw, Shield,
  Users, Package, Wrench, FileText, PieChart as PieIcon,
  ArrowUpRight, ArrowDownRight, Filter
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  getResumen, getDiario, getSemanal, getProductosMasVendidos,
  getHistorialVentas, getMetricasFinancieras,
  ResumenData, DiarioData, SemanalData,
  ProductosMasVendidosData, HistorialVentasData, MetricasFinancieras, HistorialFiltros
} from '../../services/reportesService';
import { formatMoney, formatDate } from '../../lib/format';

// ===== HELPERS =====

const hoy = () => new Date().toISOString().split('T')[0];

const primerDiaMes = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

function safeNumber(v: unknown): number {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

function fmt(n: number): string {
  return formatMoney(isFinite(n) ? n : 0);
}

function shortDate(fecha: string) {
  const d = new Date(fecha + 'T12:00:00');
  return d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short' });
}

// ===== COLORS & CHART TOKENS =====

const CHART_COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const CHART_GRID = 'rgba(72,185,230,0.14)';
const CHART_TICK = { fontSize: 11, fill: '#7F8A99' };

const ESTADO_STYLES: Record<string, string> = {
  PAGADA:   'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  PENDIENTE:'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  PARCIAL:  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  ANULADA:  'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

// ===== TABS =====

const TABS = [
  { id: 'resumen',    label: 'Resumen',    icon: <BarChart3 size={15} /> },
  { id: 'diario',     label: 'Diario',     icon: <Calendar size={15} /> },
  { id: 'semanal',    label: 'Semanal',    icon: <TrendingUp size={15} /> },
  { id: 'productos',  label: 'Productos',  icon: <Package size={15} /> },
  { id: 'historial',  label: 'Historial',  icon: <FileText size={15} /> },
  { id: 'metricas',   label: 'Metricas',   icon: <PieIcon size={15} /> },
];

// ===== SHARED STYLE TOKENS =====

const inputCls = 'rounded-xl px-3 py-1.5 text-sm border outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-colors';
const inputStyle = { background: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' };
const btnPrimary = 'flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-medium rounded-xl px-4 py-1.5 transition-colors';
const btnSuccess = 'flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl px-4 py-1.5 transition-colors';
const thCls = 'text-left py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] whitespace-nowrap';
const tdCls = 'py-2.5 px-3 text-sm text-[var(--color-text)]';
const tdSecCls = 'py-2.5 px-3 text-sm text-[var(--color-text-sec)]';
const tdMutedCls = 'py-2.5 px-3 text-xs text-[var(--color-text-muted)]';
const labelCls = 'text-xs font-medium text-[var(--color-text-muted)] block mb-1';

// ===== KPI CARD =====

function KpiCard({
  label, value, sub, icon, color, trend
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div
      className="rounded-2xl border p-5 flex items-start justify-between gap-3 transition-colors"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] truncate">{label}</p>
        <p className="text-2xl font-extrabold text-[var(--color-text)] mt-1 leading-tight">{value}</p>
        {sub && (
          <p className="text-xs text-[var(--color-text-sec)] mt-0.5 flex items-center gap-1">
            {trend === 'up' && <ArrowUpRight size={12} className="text-emerald-500" />}
            {trend === 'down' && <ArrowDownRight size={12} className="text-red-500" />}
            {sub}
          </p>
        )}
      </div>
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
    </div>
  );
}

// ===== SECTION CARD =====

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border p-6"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      {title && (
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">{title}</h3>
      )}
      {children}
    </div>
  );
}

// ===== SECTION LABEL =====

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mt-1">
      {children}
    </h3>
  );
}

// ===== UTILITY COMPONENTS =====

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div
        className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-primary)' }}
      />
    </div>
  );
}

function ErrorBox({ msg, onRetry }: { msg: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <AlertTriangle size={32} className="text-amber-400" />
      <p className="text-sm text-[var(--color-text-sec)]">{msg}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs text-[var(--color-primary)] underline">
          Reintentar
        </button>
      )}
    </div>
  );
}

function WarningBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
      <AlertTriangle size={14} className="shrink-0" /> {msg}
    </div>
  );
}

function EmptyState({ msg = 'Sin datos para el periodo seleccionado' }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-[var(--color-text-muted)]">
      <BarChart3 size={32} className="opacity-30" />
      <p className="text-sm">{msg}</p>
    </div>
  );
}

// ===== CSV EXPORT =====

function exportarCSV(data: HistorialVentasData['data']) {
  if (!data.length) return;
  const headers = [
    'Codigo','Fecha','Cliente','Telefono','Vendedor','Estado',
    'Metodo de Pago','Subtotal','Descuento','Total','Costo','Ganancia'
  ];
  const rows = data.map(v => [
    v.codigo, new Date(v.fecha).toLocaleDateString('es-GT'),
    v.cliente, v.cliente_telefono || '', v.vendedor, v.estado,
    v.metodo_pago || '', v.subtotal, v.descuento, v.total, v.costo_total, v.ganancia_estimada
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `historial-ventas-${hoy()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== TAB: RESUMEN =====

function ResumenTab() {
  const [data, setData] = useState<ResumenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await getResumen()); }
    catch { setError('No se pudo cargar el resumen.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBox msg={error} onRetry={cargar} />;
  if (!data) return null;

  const ingMes = safeNumber(data.ingresos_mes);
  const ganMes = safeNumber(data.ganancia_mes);
  const perdMes = safeNumber(data.perdidas_mes);
  const margen = ingMes > 0 ? ((ganMes / ingMes) * 100).toFixed(1) : '0.0';
  const barPerd = ingMes > 0 ? Math.min(100, (perdMes / ingMes) * 100) : 0;
  const barGan  = ingMes > 0 ? Math.min(100, (ganMes / ingMes) * 100) : 0;

  return (
    <div className="space-y-4">
      {data.advertencia_costos && <WarningBanner msg={data.advertencia_costos} />}

      {/* Hoy */}
      <SectionLabel>Hoy</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Ventas del dia"   value={String(safeNumber(data.ventas_dia))}
          icon={<ShoppingCart size={18} className="text-cyan-600 dark:text-cyan-400" />}
          color="bg-cyan-50 dark:bg-cyan-900/25" />
        <KpiCard label="Ingresos del dia" value={fmt(safeNumber(data.ingresos_dia))}
          icon={<DollarSign size={18} className="text-emerald-600 dark:text-emerald-400" />}
          color="bg-emerald-50 dark:bg-emerald-900/25" />
        <KpiCard label="Ganancia del dia" value={fmt(safeNumber(data.ganancia_dia))}
          icon={<TrendingUp size={18} className="text-green-600 dark:text-green-400" />}
          color="bg-green-50 dark:bg-green-900/25" />
        <KpiCard label="Perdidas del dia" value={fmt(safeNumber(data.perdidas_dia))}
          icon={<TrendingDown size={18} className="text-red-500 dark:text-red-400" />}
          color="bg-red-50 dark:bg-red-900/25" />
      </div>

      {/* Este mes */}
      <SectionLabel>Este mes</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Ventas del mes"   value={String(safeNumber(data.ventas_mes))}
          icon={<ShoppingCart size={18} className="text-blue-600 dark:text-blue-400" />}
          color="bg-blue-50 dark:bg-blue-900/25" />
        <KpiCard label="Ingresos del mes" value={fmt(safeNumber(data.ingresos_mes))}
          icon={<DollarSign size={18} className="text-cyan-600 dark:text-cyan-400" />}
          color="bg-cyan-50 dark:bg-cyan-900/25" />
        <KpiCard label="Ganancia del mes" value={fmt(ganMes)}
          icon={<TrendingUp size={18} className="text-emerald-600 dark:text-emerald-400" />}
          color="bg-emerald-50 dark:bg-emerald-900/25" />
        <KpiCard label="Perdidas del mes" value={fmt(perdMes)}
          icon={<TrendingDown size={18} className="text-orange-500 dark:text-orange-400" />}
          color="bg-orange-50 dark:bg-orange-900/25" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Productos vendidos" value={String(safeNumber(data.productos_vendidos))}
          icon={<Package size={18} className="text-violet-600 dark:text-violet-400" />}
          color="bg-violet-50 dark:bg-violet-900/25" />
        <KpiCard label="Repuestos vendidos" value={String(safeNumber(data.repuestos_vendidos))}
          icon={<Wrench size={18} className="text-indigo-600 dark:text-indigo-400" />}
          color="bg-indigo-50 dark:bg-indigo-900/25" />
        <KpiCard label="Ticket promedio"    value={fmt(safeNumber(data.ticket_promedio))}
          icon={<BarChart3 size={18} className="text-pink-600 dark:text-pink-400" />}
          color="bg-pink-50 dark:bg-pink-900/25" />
        <KpiCard label="Ventas anuladas"    value={String(safeNumber(data.ventas_anuladas))}
          sub={fmt(safeNumber(data.monto_anulado))}
          icon={<TrendingDown size={18} className="text-red-500 dark:text-red-400" />}
          color="bg-red-50 dark:bg-red-900/25" />
      </div>

      {/* Resumen financiero del mes */}
      <div
        className="rounded-2xl border p-5"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-5">
          Resumen financiero del mes
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Ingresos</p>
            <p className="text-lg font-extrabold text-[var(--color-text)]">{fmt(ingMes)}</p>
            <div className="h-1.5 rounded-full" style={{ background: 'var(--color-border)' }}>
              <div className="h-1.5 rounded-full bg-cyan-500" style={{ width: '100%' }} />
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Costos / Perdidas</p>
            <p className="text-lg font-extrabold text-orange-500 dark:text-orange-400">{fmt(perdMes)}</p>
            <div className="h-1.5 rounded-full" style={{ background: 'var(--color-border)' }}>
              <div className="h-1.5 rounded-full bg-orange-500" style={{ width: `${barPerd.toFixed(1)}%` }} />
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Ganancia estimada</p>
            <p className="text-lg font-extrabold text-emerald-500 dark:text-emerald-400">{fmt(ganMes)}</p>
            <div className="h-1.5 rounded-full" style={{ background: 'var(--color-border)' }}>
              <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${barGan.toFixed(1)}%` }} />
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Margen aprox.</p>
            <p className="text-lg font-extrabold text-[var(--color-primary)]">{margen}%</p>
            <div className="h-1.5 rounded-full" style={{ background: 'var(--color-border)' }}>
              <div className="h-1.5 rounded-full bg-[var(--color-primary)]" style={{ width: `${Math.min(100, parseFloat(margen))}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== TAB: DIARIO =====

function DiarioTab() {
  const [fecha, setFecha] = useState(hoy());
  const [data, setData] = useState<DiarioData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await getDiario(fecha)); }
    catch { setError('No se pudo cargar el reporte diario.'); }
    finally { setLoading(false); }
  }, [fecha]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-[var(--color-text-sec)]">Fecha:</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className={inputCls} style={inputStyle} />
          <button onClick={cargar} className={btnPrimary}>
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
      </SectionCard>

      {loading && <LoadingSpinner />}
      {error && !loading && <ErrorBox msg={error} onRetry={cargar} />}

      {!loading && !error && data && (
        <>
          {data.advertencia_costos && <WarningBanner msg={data.advertencia_costos} />}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Ventas realizadas" value={String(safeNumber(data.total_ventas))}
              icon={<ShoppingCart size={18} className="text-cyan-600 dark:text-cyan-400" />}    color="bg-cyan-50 dark:bg-cyan-900/25" />
            <KpiCard label="Total ingresado"   value={fmt(safeNumber(data.total_ingresos))}
              icon={<DollarSign size={18} className="text-emerald-600 dark:text-emerald-400" />} color="bg-emerald-50 dark:bg-emerald-900/25" />
            <KpiCard label="Costo total"       value={fmt(safeNumber(data.costo_total))}
              icon={<TrendingDown size={18} className="text-orange-500 dark:text-orange-400" />} color="bg-orange-50 dark:bg-orange-900/25" />
            <KpiCard label="Descuentos"        value={fmt(safeNumber(data.descuentos))}
              icon={<Package size={18} className="text-slate-500 dark:text-slate-400" />}        color="bg-slate-50 dark:bg-slate-800/60" />
            <KpiCard label="Ganancia bruta"    value={fmt(safeNumber(data.ganancia_bruta))}
              icon={<TrendingUp size={18} className="text-green-600 dark:text-green-400" />}     color="bg-green-50 dark:bg-green-900/25" />
            <KpiCard label="Perdidas"          value={fmt(safeNumber(data.perdidas))}
              icon={<TrendingDown size={18} className="text-red-500 dark:text-red-400" />}       color="bg-red-50 dark:bg-red-900/25" />
            <KpiCard label="Ganancia neta"     value={fmt(safeNumber(data.ganancia_neta))}
              icon={<TrendingUp size={18} className="text-emerald-700 dark:text-emerald-400" />} color="bg-emerald-50 dark:bg-emerald-900/25" />
            <KpiCard label="Ventas anuladas"   value={String(safeNumber(data.ventas_anuladas))}
              sub={fmt(safeNumber(data.monto_anulado))}
              icon={<TrendingDown size={18} className="text-red-400" />}                         color="bg-red-50 dark:bg-red-900/25" />
          </div>

          {data.metodos_pago.length > 0 && (
            <SectionCard title="Metodos de pago usados">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {data.metodos_pago.map(mp => (
                  <div key={mp.metodo} className="rounded-xl border p-3"
                    style={{ background: 'var(--color-surface-soft)', borderColor: 'var(--color-border)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{mp.metodo}</p>
                    <p className="text-base font-extrabold text-[var(--color-text)] mt-0.5">{fmt(safeNumber(mp.monto))}</p>
                    <p className="text-xs text-[var(--color-text-sec)]">{mp.count} venta{mp.count !== 1 ? 's' : ''}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}

// ===== TAB: SEMANAL =====

function SemanalTab() {
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [data, setData] = useState<SemanalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await getSemanal(fechaInicio || undefined, fechaFin || undefined)); }
    catch { setError('No se pudo cargar el reporte semanal.'); }
    finally { setLoading(false); }
  }, [fechaInicio, fechaFin]);

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBox msg={error} onRetry={cargar} />;

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-[var(--color-text-sec)]">Semana:</label>
          <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
            className={inputCls} style={inputStyle} />
          <span className="text-[var(--color-text-muted)]">&#8212;</span>
          <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
            className={inputCls} style={inputStyle} />
          <button onClick={cargar} className={btnPrimary}>
            <RefreshCw size={14} /> Buscar
          </button>
        </div>
      </SectionCard>

      {data && (
        <>
          {data.advertencia_costos && <WarningBanner msg={data.advertencia_costos} />}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <KpiCard label="Ventas"   value={String(safeNumber(data.total_ventas))}
              icon={<ShoppingCart size={18} className="text-cyan-600 dark:text-cyan-400" />}    color="bg-cyan-50 dark:bg-cyan-900/25" />
            <KpiCard label="Ingresos" value={fmt(safeNumber(data.total_ingresos))}
              icon={<DollarSign size={18} className="text-emerald-600 dark:text-emerald-400" />} color="bg-emerald-50 dark:bg-emerald-900/25" />
            <KpiCard label="Ganancia" value={fmt(safeNumber(data.ganancia))}
              icon={<TrendingUp size={18} className="text-green-600 dark:text-green-400" />}    color="bg-green-50 dark:bg-green-900/25" />
          </div>

          {data.comparacion_semana_anterior && (
            <SectionCard title="Comparacion semana anterior">
              <div className="grid grid-cols-3 gap-4 text-center">
                {([
                  { label: 'Ventas',   actual: data.total_ventas,   prev: data.comparacion_semana_anterior.ventas,   fmt: (v: number) => String(v) },
                  { label: 'Ingresos', actual: data.total_ingresos, prev: data.comparacion_semana_anterior.ingresos, fmt },
                  { label: 'Ganancia', actual: data.ganancia,       prev: data.comparacion_semana_anterior.ganancia, fmt },
                ] as const).map(({ label, actual, prev, fmt: fmtFn }) => {
                  const diff = actual - prev;
                  const up = diff >= 0;
                  return (
                    <div key={label}>
                      <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
                      <p className="text-lg font-extrabold text-[var(--color-text)]">{fmtFn(actual)}</p>
                      <p className={`text-xs flex items-center justify-center gap-1 ${up ? 'text-emerald-500' : 'text-red-500'}`}>
                        {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        vs {fmtFn(prev)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {data.por_dia.length > 0 ? (
            <SectionCard title="Ventas y ganancias por dia">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.por_dia.map(d => ({ ...d, fecha: shortDate(d.fecha) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis dataKey="fecha" tick={CHART_TICK} />
                  <YAxis tick={CHART_TICK} tickFormatter={v => `Q${v}`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="ingresos" name="Ingresos" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ganancia" name="Ganancia" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          ) : (
            <SectionCard><EmptyState /></SectionCard>
          )}

          {data.productos_mas_vendidos.length > 0 && (
            <SectionCard title="Productos mas vendidos de la semana">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: 'var(--color-surface-soft)', borderBottom: '1px solid var(--color-border)' }}>
                    <tr>
                      {['Producto','Categoria','Cant.','Ingresos','Ganancia','Stock'].map(h => (
                        <th key={h} className={thCls}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.productos_mas_vendidos.map((p, i) => (
                      <tr key={i} className="border-t transition-colors hover:bg-[var(--color-row-hover)]"
                        style={{ borderColor: 'var(--color-border)' }}>
                        <td className="py-2.5 px-3 text-sm font-medium text-[var(--color-text)]">{p.nombre}</td>
                        <td className={tdSecCls}>{p.categoria}</td>
                        <td className="py-2.5 px-3 text-sm font-bold text-[var(--color-text)]">{p.cantidad}</td>
                        <td className={tdSecCls}>{fmt(safeNumber(p.ingresos))}</td>
                        <td className="py-2.5 px-3 text-sm text-emerald-500 font-medium">{fmt(safeNumber(p.ganancia ?? 0))}</td>
                        <td className={tdMutedCls}>{p.stock_actual}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}

// ===== TAB: PRODUCTOS MAS VENDIDOS =====

function ProductosTab() {
  const [desde, setDesde] = useState(primerDiaMes());
  const [hasta, setHasta] = useState(hoy());
  const [data, setData] = useState<ProductosMasVendidosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const PRESET_BUTTONS = [
    { label: 'Hoy',         fn: () => { setDesde(hoy()); setHasta(hoy()); } },
    { label: 'Esta semana', fn: () => {
      const t = new Date(); const d = t.getDay(); const diff = d === 0 ? -6 : 1 - d;
      const mon = new Date(t); mon.setDate(t.getDate() + diff);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      setDesde(mon.toISOString().split('T')[0]); setHasta(sun.toISOString().split('T')[0]);
    }},
    { label: 'Este mes',    fn: () => { setDesde(primerDiaMes()); setHasta(hoy()); } },
  ];

  const cargar = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await getProductosMasVendidos(desde, hasta)); }
    catch { setError('No se pudo cargar el ranking de productos.'); }
    finally { setLoading(false); }
  }, [desde, hasta]);

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            {PRESET_BUTTONS.map(b => (
              <button key={b.label} onClick={b.fn}
                className="text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium text-[var(--color-text-sec)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-soft)' }}>
                {b.label}
              </button>
            ))}
          </div>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            className={inputCls} style={inputStyle} />
          <span className="text-[var(--color-text-muted)]">&#8212;</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            className={inputCls} style={inputStyle} />
          <button onClick={cargar} className={btnPrimary}>
            <RefreshCw size={14} /> Buscar
          </button>
        </div>
      </SectionCard>

      {loading && <LoadingSpinner />}
      {error && !loading && <ErrorBox msg={error} onRetry={cargar} />}

      {!loading && !error && data && (
        <>
          {data.advertencia_costos && <WarningBanner msg={data.advertencia_costos} />}

          {data.data.length === 0 ? (
            <SectionCard><EmptyState /></SectionCard>
          ) : (
            <>
              {data.data.slice(0, 8).length > 0 && (
                <SectionCard title="Top productos por cantidad vendida">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.data.slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                      <XAxis type="number" tick={CHART_TICK} />
                      <YAxis type="category" dataKey="nombre" width={130} tick={CHART_TICK} />
                      <Tooltip />
                      <Bar dataKey="cantidad_vendida" name="Unidades" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </SectionCard>
              )}

              <SectionCard title={`${data.total} producto${data.total !== 1 ? 's' : ''} encontrado${data.total !== 1 ? 's' : ''}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead style={{ background: 'var(--color-surface-soft)', borderBottom: '1px solid var(--color-border)' }}>
                      <tr>
                        {['#','Producto','Codigo','Tipo','Categoria','Cant.','Ingresos','Costo','Ganancia','Stock'].map(h => (
                          <th key={h} className={thCls}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.map((p, i) => (
                        <tr key={i} className="border-t transition-colors hover:bg-[var(--color-row-hover)]"
                          style={{ borderColor: 'var(--color-border)' }}>
                          <td className={tdMutedCls}>{i + 1}</td>
                          <td className="py-2.5 px-3 text-sm font-medium text-[var(--color-text)] max-w-[160px] truncate">{p.nombre}</td>
                          <td className="py-2.5 px-3 text-xs font-mono text-[var(--color-text-muted)]">{p.codigo || '-'}</td>
                          <td className="py-2.5 px-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.tipo === 'REPUESTO' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400'}`}>
                              {p.tipo}
                            </span>
                          </td>
                          <td className={tdMutedCls}>{p.categoria}</td>
                          <td className="py-2.5 px-3 text-sm font-bold text-[var(--color-text)]">{p.cantidad_vendida}</td>
                          <td className={tdSecCls}>{fmt(safeNumber(p.ingresos))}</td>
                          <td className="py-2.5 px-3 text-sm text-orange-500 dark:text-orange-400">{fmt(safeNumber(p.costo_total ?? 0))}</td>
                          <td className={`py-2.5 px-3 text-sm font-medium ${safeNumber(p.ganancia_estimada ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{fmt(safeNumber(p.ganancia_estimada ?? 0))}</td>
                          <td className={tdMutedCls}>{p.stock_actual}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ===== TAB: HISTORIAL =====

function HistorialTab() {
  const [filtros, setFiltros] = useState<HistorialFiltros>({
    desde: primerDiaMes(),
    hasta: hoy(),
    estado: '',
    metodo_pago: '',
    vendedor: '',
    cliente: '',
    limit: 200,
  });
  const [data, setData] = useState<HistorialVentasData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true); setError('');
    const params: HistorialFiltros = { ...filtros };
    if (!params.estado) delete params.estado;
    if (!params.metodo_pago) delete params.metodo_pago;
    if (!params.vendedor) delete params.vendedor;
    if (!params.cliente) delete params.cliente;
    try { setData(await getHistorialVentas(params)); }
    catch { setError('No se pudo cargar el historial.'); }
    finally { setLoading(false); }
  }, [filtros]);

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  const set = (k: keyof HistorialFiltros, v: string) =>
    setFiltros(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className={labelCls}>Desde</label>
            <input type="date" value={filtros.desde} onChange={e => set('desde', e.target.value)}
              className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls}>Hasta</label>
            <input type="date" value={filtros.hasta} onChange={e => set('hasta', e.target.value)}
              className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls}>Estado</label>
            <select value={filtros.estado} onChange={e => set('estado', e.target.value)}
              className={inputCls} style={inputStyle}>
              <option value="">Todos</option>
              {['PAGADA','PENDIENTE','PARCIAL','ANULADA'].map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Metodo de pago</label>
            <select value={filtros.metodo_pago} onChange={e => set('metodo_pago', e.target.value)}
              className={inputCls} style={inputStyle}>
              <option value="">Todos</option>
              {['EFECTIVO','TARJETA','TRANSFERENCIA','MIXTO'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Cliente</label>
            <input type="text" placeholder="Nombre cliente" value={filtros.cliente}
              onChange={e => set('cliente', e.target.value)}
              className={inputCls} style={{ ...inputStyle, width: '9rem' }} />
          </div>
          <div>
            <label className={labelCls}>Vendedor</label>
            <input type="text" placeholder="Nombre vendedor" value={filtros.vendedor}
              onChange={e => set('vendedor', e.target.value)}
              className={inputCls} style={{ ...inputStyle, width: '9rem' }} />
          </div>
          <button onClick={cargar} className={btnPrimary}>
            <Filter size={14} /> Filtrar
          </button>
          {data && data.data.length > 0 && (
            <button onClick={() => exportarCSV(data.data)} className={btnSuccess}>
              <Download size={14} /> Exportar CSV
            </button>
          )}
        </div>
      </SectionCard>

      {loading && <LoadingSpinner />}
      {error && !loading && <ErrorBox msg={error} onRetry={cargar} />}

      {!loading && !error && data && (
        <>
          {data.advertencia_costos && <WarningBanner msg={data.advertencia_costos} />}
          {data.data.length === 0 ? (
            <SectionCard><EmptyState /></SectionCard>
          ) : (
            <SectionCard title={`${data.total} venta${data.total !== 1 ? 's' : ''} encontrada${data.total !== 1 ? 's' : ''}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: 'var(--color-surface-soft)', borderBottom: '1px solid var(--color-border)' }}>
                    <tr>
                      {['Codigo','Fecha','Cliente','Vendedor','Estado','Metodo','Subtotal','Desc.','Total','Costo','Ganancia'].map(h => (
                        <th key={h} className={thCls}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map(v => (
                      <tr key={v.id} className="border-t transition-colors hover:bg-[var(--color-row-hover)]"
                        style={{ borderColor: 'var(--color-border)' }}>
                        <td className="py-2.5 px-3 font-mono text-xs text-[var(--color-text-muted)]">{v.codigo}</td>
                        <td className="py-2.5 px-3 text-sm text-[var(--color-text-sec)] whitespace-nowrap">{formatDate(v.fecha)}</td>
                        <td className="py-2.5 px-3 text-sm text-[var(--color-text)] max-w-[120px] truncate">{v.cliente}</td>
                        <td className={tdMutedCls}>{v.vendedor}</td>
                        <td className="py-2.5 px-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_STYLES[v.estado] || 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400'}`}>
                            {v.estado}
                          </span>
                        </td>
                        <td className={tdMutedCls}>{v.metodo_pago || '-'}</td>
                        <td className={tdSecCls}>{fmt(safeNumber(v.subtotal))}</td>
                        <td className="py-2.5 px-3 text-sm text-orange-500 dark:text-orange-400">{v.descuento > 0 ? fmt(v.descuento) : '-'}</td>
                        <td className="py-2.5 px-3 text-sm font-semibold text-[var(--color-text)]">{fmt(safeNumber(v.total))}</td>
                        <td className="py-2.5 px-3 text-sm text-orange-500 dark:text-orange-400">{fmt(safeNumber(v.costo_total))}</td>
                        <td className={`py-2.5 px-3 text-sm font-medium ${safeNumber(v.ganancia_estimada) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{fmt(safeNumber(v.ganancia_estimada))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}

// ===== TAB: METRICAS FINANCIERAS =====

function MetricasTab() {
  const [desde, setDesde] = useState(primerDiaMes());
  const [hasta, setHasta] = useState(hoy());
  const [data, setData] = useState<MetricasFinancieras | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await getMetricasFinancieras(desde, hasta)); }
    catch { setError('No se pudo cargar las metricas financieras.'); }
    finally { setLoading(false); }
  }, [desde, hasta]);

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-[var(--color-text-sec)]">Periodo:</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            className={inputCls} style={inputStyle} />
          <span className="text-[var(--color-text-muted)]">&#8212;</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            className={inputCls} style={inputStyle} />
          <button onClick={cargar} className={btnPrimary}>
            <RefreshCw size={14} /> Analizar
          </button>
        </div>
      </SectionCard>

      {loading && <LoadingSpinner />}
      {error && !loading && <ErrorBox msg={error} onRetry={cargar} />}

      {!loading && !error && data && (
        <>
          {data.advertencia_costos && <WarningBanner msg={data.advertencia_costos} />}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Ingresos totales"  value={fmt(safeNumber(data.ingresos_totales))}
              icon={<DollarSign size={18} className="text-cyan-600 dark:text-cyan-400" />}       color="bg-cyan-50 dark:bg-cyan-900/25" />
            <KpiCard label="Costos totales"    value={fmt(safeNumber(data.costos_totales))}
              icon={<TrendingDown size={18} className="text-orange-500 dark:text-orange-400" />}  color="bg-orange-50 dark:bg-orange-900/25" />
            <KpiCard label="Ganancia bruta"    value={fmt(safeNumber(data.ganancia_bruta))}
              icon={<TrendingUp size={18} className="text-green-600 dark:text-green-400" />}      color="bg-green-50 dark:bg-green-900/25" />
            <KpiCard label="Ganancia neta"     value={fmt(safeNumber(data.ganancia_neta))}
              icon={<TrendingUp size={18} className="text-emerald-700 dark:text-emerald-400" />}  color="bg-emerald-50 dark:bg-emerald-900/25" />
            <KpiCard label="Perdidas"          value={fmt(safeNumber(data.perdidas))}
              icon={<TrendingDown size={18} className="text-red-500 dark:text-red-400" />}        color="bg-red-50 dark:bg-red-900/25" />
            <KpiCard label="Descuentos"        value={fmt(safeNumber(data.descuentos))}
              icon={<Package size={18} className="text-slate-500 dark:text-slate-400" />}         color="bg-slate-50 dark:bg-slate-800/60" />
            <KpiCard label="Ticket promedio"   value={fmt(safeNumber(data.ticket_promedio))}
              icon={<BarChart3 size={18} className="text-pink-600 dark:text-pink-400" />}         color="bg-pink-50 dark:bg-pink-900/25" />
            <KpiCard label="Margen promedio"   value={`${safeNumber(data.margen_promedio)}%`}
              icon={<Users size={18} className="text-violet-600 dark:text-violet-400" />}         color="bg-violet-50 dark:bg-violet-900/25" />
          </div>

          {data.por_dia.length > 0 ? (
            <SectionCard title="Ingresos y ganancias por dia">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.por_dia.map(d => ({ ...d, fecha: shortDate(d.fecha) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis dataKey="fecha" tick={CHART_TICK} />
                  <YAxis tick={CHART_TICK} tickFormatter={v => `Q${v}`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="ingresos" name="Ingresos" stroke="#06b6d4" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ganancia" name="Ganancia" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </SectionCard>
          ) : (
            <SectionCard><EmptyState /></SectionCard>
          )}

          {data.metodos_pago.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-4">
              <SectionCard title="Distribucion por metodo de pago">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={data.metodos_pago}
                      dataKey="monto"
                      nameKey="metodo"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ metodo, percent }) => `${metodo} ${(percent * 100).toFixed(0)}%`}
                    >
                      {data.metodos_pago.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </SectionCard>

              <SectionCard title="Detalle por metodo">
                <div className="space-y-3">
                  {data.metodos_pago.map((mp, i) => {
                    const pct = data.ingresos_totales > 0 ? (mp.monto / data.ingresos_totales) * 100 : 0;
                    return (
                      <div key={mp.metodo} className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium text-[var(--color-text)]">{mp.metodo}</span>
                            <span className="text-[var(--color-text-sec)]">{fmt(safeNumber(mp.monto))}</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full mt-1" style={{ background: 'var(--color-border)' }}>
                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct.toFixed(1)}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{mp.count} venta{mp.count !== 1 ? 's' : ''} &#8226; {pct.toFixed(1)}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            </div>
          )}

          <SectionCard title="Detalle de perdidas y egresos">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border p-3"
                style={{ background: 'var(--color-surface-soft)', borderColor: 'var(--color-border)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 dark:text-red-400">Ventas anuladas</p>
                <p className="text-lg font-extrabold text-[var(--color-text)] mt-0.5">{safeNumber(data.ventas_anuladas.count)}</p>
                <p className="text-sm text-red-500 dark:text-red-400">{fmt(safeNumber(data.ventas_anuladas.monto))}</p>
              </div>
              <div className="rounded-xl border p-3"
                style={{ background: 'var(--color-surface-soft)', borderColor: 'var(--color-border)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-500 dark:text-orange-400">Egresos de caja</p>
                <p className="text-lg font-extrabold text-[var(--color-text)] mt-0.5">{fmt(safeNumber(data.egresos_caja))}</p>
              </div>
              <div className="rounded-xl border p-3"
                style={{ background: 'var(--color-surface-soft)', borderColor: 'var(--color-border)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 dark:text-amber-400">Descuentos aplicados</p>
                <p className="text-lg font-extrabold text-[var(--color-text)] mt-0.5">{fmt(safeNumber(data.descuentos))}</p>
              </div>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

// ===== MAIN PAGE =====

export default function ReportesPage() {
  const [activeTab, setActiveTab] = useState('resumen');

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)] flex items-center gap-2.5">
            <BarChart3 size={24} className="text-[var(--color-primary)]" />
            Reportes
          </h1>
          <p className="text-sm text-[var(--color-text-sec)] mt-0.5">
            Analisis financiero y estadisticas del negocio
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap"
          style={{ borderColor: 'rgba(72,185,230,0.28)', background: 'rgba(72,185,230,0.08)', color: 'var(--color-primary)' }}
        >
          <Shield size={12} />
          Solo visible para administradores
        </span>
      </div>

      {/* Segmented Tabs */}
      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <div
          className="flex gap-1 p-1 rounded-2xl w-max sm:w-fit"
          style={{ background: 'var(--color-surface-soft)', border: '1px solid var(--color-border)' }}
        >
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                  : 'text-[var(--color-text-sec)] hover:text-[var(--color-text)] hover:bg-[var(--color-row-hover)]'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'resumen'   && <ResumenTab />}
      {activeTab === 'diario'    && <DiarioTab />}
      {activeTab === 'semanal'   && <SemanalTab />}
      {activeTab === 'productos' && <ProductosTab />}
      {activeTab === 'historial' && <HistorialTab />}
      {activeTab === 'metricas'  && <MetricasTab />}
    </div>
  );
}
