import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import API_URL from "../../services/config";
import { formatMoney } from "../../lib/format";
import { useAuth } from "../../store/useAuth";
import {
  ShoppingCart, Package, AlertTriangle, FileText, Wrench,
  DollarSign, TrendingUp, TrendingDown, Users, ClipboardCheck, ClipboardX,
  Receipt, Wallet, Plus, ArrowRight, BarChart3, Tag, Clock,
  Activity, Zap, CheckCircle2, AlertCircle, Timer, CalendarCheck,
  CalendarClock, ListChecks, Boxes, Search,
  ArrowUpRight, ArrowDownRight, UserPlus, CreditCard, Percent,
  BadgeDollarSign, PieChart, Minus,
} from "lucide-react";

// ─── Tipos generales ──────────────────────────────────────────────────────────

interface TendenciaDia {
  fecha:    string;
  ventas:   number;
  ingresos: number;
  ganancia: number;
}

interface FinancieroStats {
  ingresos_hoy:        number;
  ganancia_hoy:        number;
  ventas_hoy:          number;
  ingresos_mes:        number;
  costo_ventas_mes:    number;
  ganancia_bruta_mes:  number;
  ganancia_neta_mes:   number;
  egresos_caja_mes:    number;
  compras_mes:         number;
  margen_bruto:        number;
  ticket_promedio:     number;
  ventas_mes:          number;
  cambio_ingresos_pct: number | null;
  cambio_ganancia_pct: number | null;
}

interface DashboardStats {
  ventas:       { hoy: number; mes: number; total: number; cantidad: number };
  productos:    { total: number; bajo_stock: number; sin_stock: number };
  reparaciones: {
    total: number; con_checklist: number; sin_checklist: number;
    completadas: number; completadas_mes?: number; atrasadas?: number;
  };
  cotizaciones: { total: number; abiertas: number; conversion_rate?: number };
  gastos:       { mes: number };
  ganancias:    { hoy: number; mes: number };
  financiero?:  FinancieroStats;
  tendencia?:   TendenciaDia[];
  clientes?:    { nuevos_mes: number; total: number };
}

interface TecnicoStats {
  asignadas:            number;
  en_proceso:           number;
  pendientes:           number;
  listas_para_entregar: number;
  atrasadas:            number;
  sin_checklist:        number;
  finalizadas_hoy:      number;
  finalizadas_mes:      number;
  repuestos_usados_mes: number;
}

interface ReparacionRow {
  id:                    string;
  cliente_nombre:        string;
  tipo_equipo:           string;
  marca:                 string;
  modelo:                string;
  estado:                string;
  prioridad:             string;
  fecha_ingreso:         string;
  fecha_estimada_entrega: string | null;
  observaciones:         string | null;
}

interface ActividadRow {
  reparacion_id:  string;
  estado:         string;
  nota:           string;
  user_nombre:    string;
  created_at:     string;
  cliente_nombre: string;
  tipo_equipo:    string;
  marca:          string;
  modelo:         string;
}

interface TecnicoData {
  tecnico:      string;
  stats:        TecnicoStats;
  estados:      Record<string, number>;
  reparaciones: ReparacionRow[];
  actividad:    ActividadRow[];
}

interface VentasStats {
  dashboardType: 'ventas';
  ventasHoy:    { cantidad: number; total: number };
  ventasMes:    { cantidad: number; total: number };
  ventasMesAnterior?: { cantidad: number; total: number };
  cambioMes?:   number | null;
  ticketHoy?:   number;
  ticketMes?:   number;
  cotizaciones: { total: number; abiertas: number; valor_abierto?: number };
  reparaciones: { activas: number; listas?: number };
  ventasParciales?: { cantidad: number; saldo: number };
  stock?: { sin_stock: number; bajo_stock: number };
  stockBajo:    number;
  clientesHoy:  number;
  clientesMes?: number;
  tendencia?:   Array<{ fecha: string; ventas: number; ingresos: number }>;
}

// ─── Helpers de color por estado ──────────────────────────────────────────────

const BRAND      = "#48B9E6";
const BRAND_DARK = "#2EA7D8";
const TEXT_MAIN  = "#14324A";
const TEXT_SEC   = "#5E7184";
const BORDER     = "#D6EEF8";

const ESTADO_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  RECIBIDA:               { bg: "rgba(72,185,230,0.10)",  text: "#1E7EA1",  label: "Recibida" },
  EN_DIAGNOSTICO:         { bg: "rgba(99,102,241,0.10)",  text: "#4338CA",  label: "En diagnóstico" },
  ESPERANDO_AUTORIZACION: { bg: "rgba(245,158,11,0.12)", text: "#92400E",  label: "Esperando autorización" },
  AUTORIZADA:             { bg: "rgba(34,197,94,0.10)",   text: "#15803D",  label: "Autorizada" },
  EN_REPARACION:          { bg: "rgba(99,102,241,0.15)",  text: "#3730A3",  label: "En reparación" },
  EN_PROCESO:             { bg: "rgba(99,102,241,0.15)",  text: "#3730A3",  label: "En proceso" },
  ESPERANDO_PIEZA:        { bg: "rgba(249,115,22,0.10)",  text: "#C2410C",  label: "Esperando pieza" },
  COMPLETADA:             { bg: "rgba(34,197,94,0.12)",   text: "#166534",  label: "Completada" },
  STAND_BY:               { bg: "rgba(148,163,184,0.12)", text: "#475569",  label: "Stand by" },
  ANTICIPO_REGISTRADO:    { bg: "rgba(72,185,230,0.08)",  text: "#0E7490",  label: "Anticipo registrado" },
};

const PRIORIDAD_COLOR: Record<string, string> = {
  ALTA:  "#EF4444",
  MEDIA: "#F59E0B",
  BAJA:  "#22C55E",
};

// ─── Componentes reutilizables ─────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  footnote: string;
  footnoteIcon?: ReactNode;
  icon: ReactNode;
  gradient: string;
}
function KpiCard({ label, value, footnote, footnoteIcon, icon, gradient }: KpiCardProps) {
  return (
    <div className={`${gradient} rounded-2xl p-5 text-white shadow-md flex flex-col justify-between min-h-[110px]`}>
      <div className="flex items-start justify-between">
        <p className="text-white/75 text-[10px] font-bold uppercase tracking-widest">{label}</p>
        <div className="bg-white/20 rounded-xl p-2 shrink-0">{icon}</div>
      </div>
      <div className="mt-2">
        <p className="text-[1.55rem] font-bold leading-none tracking-tight">{value}</p>
        <p className="flex items-center gap-1 text-white/70 text-[11px] mt-1.5">
          {footnoteIcon}{footnote}
        </p>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub: string;
  icon: ReactNode;
  iconBg: string;
  footer: ReactNode;
  onClick: () => void;
}
function StatCard({ label, value, sub, icon, iconBg, footer, onClick }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className="bg-white dark:bg-[#0D1526] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] rounded-2xl shadow-sm p-4 text-left w-full hover:shadow-md transition-all group cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-2">
          <p className="text-[10px] font-bold text-[#5E7184] dark:text-[#7F8A99] uppercase tracking-widest">{label}</p>
          <p className="text-2xl font-bold text-[#14324A] dark:text-[#F8FAFC] mt-0.5 leading-none">{value}</p>
          <p className="text-[11px] text-[#5E7184] dark:text-[#7F8A99] mt-0.5">{sub}</p>
        </div>
        <div className={`${iconBg} p-2.5 rounded-xl shrink-0 group-hover:scale-105 transition-transform`}>
          {icon}
        </div>
      </div>
      <div className="mt-3 pt-2.5 border-t border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] text-[11px]">{footer}</div>
    </button>
  );
}

/** Tarjeta KPI para técnico — estilo TecnoOne */
interface TecKpiCardProps {
  label:    string;
  value:    number;
  sub:      string;
  icon:     ReactNode;
  accent:   string;      // color HEX del acento
  onClick?: () => void;
  alert?:   boolean;     // si true, resalta con borde coloreado
}
function TecKpiCard({ label, value, sub, icon, accent, onClick, alert }: TecKpiCardProps) {
  return (
    <button
      onClick={onClick}
      className="bg-white dark:bg-[#0D1526] rounded-2xl p-4 text-left w-full transition-all hover:shadow-md"
      style={{
        border: alert ? `1.5px solid ${accent}` : `1px solid var(--color-border)`,
        boxShadow: "0 1px 6px rgba(20,50,74,0.06)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className="p-2 rounded-xl shrink-0"
          style={{ background: `${accent}18` }}
        >
          <span style={{ color: accent }}>{icon}</span>
        </div>
        <span
          className="text-[1.65rem] font-bold leading-none"
          style={{ color: "var(--color-text)" }}
        >
          {value}
        </span>
      </div>
      <p className="font-semibold text-sm mt-2.5" style={{ color: "var(--color-text)" }}>{label}</p>
      <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-sec)" }}>{sub}</p>
    </button>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonBlock({ h = "h-28" }: { h?: string }) {
  return <div className={`bg-slate-100 dark:bg-[#0A1220] animate-pulse rounded-2xl ${h}`} />;
}

// ─── Change indicator (%  vs mes anterior) ────────────────────────────────────

function ChangeIndicator({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
        <Minus size={10} /> sin datos anteriores
      </span>
    );
  }
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {up ? '+' : ''}{value.toFixed(1)}% vs mes ant.
    </span>
  );
}

// ─── Financial KPI card (admin only) ─────────────────────────────────────────

interface FinancialKpiCardProps {
  label:    string;
  value:    string;
  sub:      string;
  change?:  number | null;
  icon:     ReactNode;
  accent:   string;
  negative?: boolean;
}
function FinancialKpiCard({ label, value, sub, change, icon, accent, negative }: FinancialKpiCardProps) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-2.5 shadow-sm"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-sec)' }}>
          {label}
        </p>
        <div className="p-2 rounded-xl shrink-0" style={{ background: `${accent}18` }}>
          <span style={{ color: accent }}>{icon}</span>
        </div>
      </div>
      <div>
        <p
          className="text-[1.65rem] font-bold leading-none tracking-tight"
          style={{ color: negative ? '#EF4444' : 'var(--color-text)' }}
        >
          {value}
        </p>
        <div className="mt-1.5 flex flex-col gap-0.5">
          <ChangeIndicator value={change} />
          <p className="text-[11px]" style={{ color: 'var(--color-text-sec)' }}>{sub}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Operational KPI card ─────────────────────────────────────────────────────

interface OpKpiCardProps {
  label:   string;
  value:   string | number;
  sub:     string;
  icon:    ReactNode;
  accent:  string;
  alert?:  boolean;
  onClick?: () => void;
}
function OpKpiCard({ label, value, sub, icon, accent, alert, onClick }: OpKpiCardProps) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl p-4 text-left w-full transition-all hover:shadow-md"
      style={{
        background: 'var(--color-surface)',
        border: alert ? `1.5px solid ${accent}` : '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="p-2 rounded-xl shrink-0" style={{ background: `${accent}18` }}>
          <span style={{ color: accent }}>{icon}</span>
        </div>
        <span className="text-[1.5rem] font-bold leading-none" style={{ color: 'var(--color-text)' }}>
          {value}
        </span>
      </div>
      <p className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>{label}</p>
      <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-sec)' }}>{sub}</p>
    </button>
  );
}

// ─── Sparkline bar chart (7 días) ─────────────────────────────────────────────

function SparklineChart({ data }: { data: TendenciaDia[] }) {
  const maxIngresos = Math.max(...data.map(d => d.ingresos), 1);
  const todayKey = new Date().toISOString().split('T')[0];

  return (
    <div className="flex items-end gap-1 sm:gap-2" style={{ height: 80 }}>
      {data.map((d, i) => {
        const ingH  = Math.max((d.ingresos / maxIngresos) * 64, 2);
        const ganH  = d.ganancia > 0 ? Math.max((d.ganancia / maxIngresos) * 64, 2) : 2;
        const isToday = d.fecha === todayKey;
        const dayLabel = new Date(d.fecha + 'T12:00:00')
          .toLocaleDateString('es-GT', { weekday: 'short' })
          .replace('.', '').slice(0, 3);

        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex items-end justify-center gap-0.5" style={{ height: 64 }}>
              <div
                className={`rounded-t-sm flex-1 transition-all ${isToday ? 'bg-blue-500' : 'bg-blue-400/40 dark:bg-blue-500/25'}`}
                style={{ height: ingH }}
                title={`Ingresos ${d.fecha}: Q${d.ingresos.toLocaleString()}`}
              />
              <div
                className={`rounded-t-sm flex-1 transition-all ${isToday ? 'bg-emerald-500' : 'bg-emerald-400/40 dark:bg-emerald-500/25'}`}
                style={{ height: ganH }}
                title={`Ganancia ${d.fecha}: Q${d.ganancia.toLocaleString()}`}
              />
            </div>
            <span
              className={`text-[9px] font-medium capitalize ${isToday ? 'font-bold' : ''}`}
              style={{ color: isToday ? 'var(--color-text)' : 'var(--color-text-sec)' }}
            >
              {dayLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Reloj ────────────────────────────────────────────────────────────────────

function ClockWidget({ time }: { time: Date }) {
  const formatTime = (d: Date) =>
    d.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const formatDate = (d: Date) =>
    d.toLocaleDateString("es-GT", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-2.5 self-start"
      style={{ background: "var(--color-surface)", border: `1px solid var(--color-border)`, boxShadow: "0 1px 6px rgba(20,50,74,0.06)" }}
    >
      <Clock size={16} style={{ color: "var(--color-text-sec)" }} className="shrink-0" />
      <div>
        <p className="text-base font-bold font-mono leading-none" style={{ color: "var(--color-text)" }}>
          {formatTime(time)}
        </p>
        <p className="text-[10px] capitalize mt-0.5" style={{ color: "var(--color-text-sec)" }}>
          {formatDate(time)}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD TÉCNICO
// ═══════════════════════════════════════════════════════════════════════════════

function TecnicoDashboard({ data, time }: { data: TecnicoData; time: Date }) {
  const navigate = useNavigate();
  const { stats, reparaciones, actividad, estados } = data;

  const kpis: TecKpiCardProps[] = [
    {
      label:   "Asignadas",
      value:   stats.asignadas,
      sub:     "Total activas",
      icon:    <Wrench size={16} />,
      accent:  BRAND_DARK,
      onClick: () => navigate("/reparaciones"),
    },
    {
      label:   "En proceso",
      value:   stats.en_proceso,
      sub:     "Diagnóstico / reparación",
      icon:    <Activity size={16} />,
      accent:  "#6366F1",
      onClick: () => navigate("/flujo-reparaciones"),
    },
    {
      label:   "Pendientes",
      value:   stats.pendientes,
      sub:     "Sin iniciar",
      icon:    <Timer size={16} />,
      accent:  "#F59E0B",
      alert:   stats.pendientes > 0,
      onClick: () => navigate("/reparaciones"),
    },
    {
      label:   "Listas p/entregar",
      value:   stats.listas_para_entregar,
      sub:     "Completadas",
      icon:    <CheckCircle2 size={16} />,
      accent:  "#22C55E",
      alert:   stats.listas_para_entregar > 0,
      onClick: () => navigate("/reparaciones"),
    },
    {
      label:   "Atrasadas",
      value:   stats.atrasadas,
      sub:     "Pasaron fecha estimada",
      icon:    <AlertCircle size={16} />,
      accent:  "#EF4444",
      alert:   stats.atrasadas > 0,
      onClick: () => navigate("/reparaciones"),
    },
    {
      label:   "Sin checklist",
      value:   stats.sin_checklist,
      sub:     "Requieren revisión",
      icon:    <ListChecks size={16} />,
      accent:  "#F97316",
      alert:   stats.sin_checklist > 0,
      onClick: () => navigate("/reparaciones"),
    },
    {
      label:   "Finalizadas hoy",
      value:   stats.finalizadas_hoy,
      sub:     "Cerradas el día de hoy",
      icon:    <CalendarCheck size={16} />,
      accent:  BRAND,
      onClick: () => navigate("/reparaciones"),
    },
    {
      label:   "Finalizadas este mes",
      value:   stats.finalizadas_mes,
      sub:     "Cerradas en el mes",
      icon:    <CalendarClock size={16} />,
      accent:  BRAND_DARK,
      onClick: () => navigate("/reparaciones"),
    },
  ];

  const quickActions = [
    { icon: Wrench,        label: "Mis reparaciones",  path: "/ordenes-trabajo" },
    { icon: Activity,      label: "Flujo",             path: "/flujo-reparaciones" },
    { icon: CheckCircle2,  label: "Checklist",         path: "/reparaciones" },
    { icon: Boxes,         label: "Repuestos",         path: "/repuestos" },
    { icon: Users,         label: "Clientes",          path: "/clientes" },
    { icon: Search,        label: "Buscar cliente",    path: "/clientes" },
  ];

  // Conteo por estado para la mini barra
  const estadosList = Object.entries(estados).map(([k, v]) => ({
    key: k, total: v, ...(ESTADO_COLOR[k] ?? { bg: "rgba(100,100,100,0.08)", text: "#555", label: k }),
  }));

  return (
    <div className="space-y-5 max-w-screen-2xl">

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <span
            className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest mb-1"
            style={{ color: BRAND }}
          >
            <Zap size={11} /> Panel Técnico
          </span>
          <h1 className="text-xl font-bold leading-tight" style={{ color: "var(--color-text)" }}>
            Bienvenido, {data.tecnico}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-sec)" }}>
            Resumen de reparaciones asignadas y actividad reciente
          </p>
        </div>
        <ClockWidget time={time} />
      </div>

      {/* ── KPI CARDS (8) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <TecKpiCard key={i} {...k} />
        ))}
      </div>

      {/* ── ACCIONES RÁPIDAS ── */}
      <div
        className="rounded-2xl px-5 py-4"
        style={{ background: "var(--color-surface)", border: `1px solid var(--color-border)`, boxShadow: "0 1px 6px rgba(20,50,74,0.06)" }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--color-text-sec)" }}>
          Acciones rápidas
        </p>
        <div className="flex flex-wrap gap-2">
          {quickActions.map(({ icon: Icon, label, path }, i) => (
            <button
              key={i}
              onClick={() => navigate(path)}
              className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all hover:shadow-sm"
              style={{
                background: `rgba(72,185,230,0.08)`,
                border: `1px solid ${BORDER}`,
                color: BRAND_DARK,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(72,185,230,0.18)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(72,185,230,0.08)";
              }}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-6">

        {/* ── REPARACIONES ACTIVAS (2/3) ── */}
        <div
          className="lg:col-span-2 rounded-2xl p-5"
          style={{ background: "var(--color-surface)", border: `1px solid var(--color-border)`, boxShadow: "0 1px 6px rgba(20,50,74,0.06)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg" style={{ background: `${BRAND}18` }}>
                <Wrench size={13} style={{ color: BRAND_DARK }} />
              </div>
              <h3 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                Mis reparaciones activas
              </h3>
            </div>
            <button
              onClick={() => navigate("/reparaciones")}
              className="flex items-center gap-1 text-xs font-medium transition-colors"
              style={{ color: BRAND_DARK }}
            >
              Ver todas <ArrowRight size={12} />
            </button>
          </div>

          {reparaciones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <CheckCircle2 size={32} style={{ color: BRAND, opacity: 0.4 }} />
              <p className="text-sm" style={{ color: "var(--color-text-sec)" }}>No tienes reparaciones activas asignadas.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: `1px solid var(--color-border)` }}>
                    {["ID", "Cliente", "Equipo", "Estado", "Prioridad", "Ingreso"].map(h => (
                      <th
                        key={h}
                        className="text-left pb-2 pr-3 font-semibold uppercase tracking-wider"
                        style={{ color: "var(--color-text-sec)", fontSize: 10 }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reparaciones.map((r) => {
                    const ec = ESTADO_COLOR[r.estado] ?? { bg: "#f1f5f9", text: "#475569", label: r.estado };
                    return (
                      <tr
                        key={r.id}
                        style={{ borderBottom: `1px solid var(--color-border)` }}
                        className="hover:bg-[#F6FCFF] dark:hover:bg-[rgba(72,185,230,0.05)] transition-colors cursor-pointer"
                        onClick={() => navigate("/reparaciones")}
                      >
                        <td className="py-2 pr-3 font-mono font-semibold" style={{ color: BRAND_DARK }}>
                          {r.id.replace("REP", "")}
                        </td>
                        <td className="py-2 pr-3 max-w-[120px] truncate" style={{ color: "var(--color-text)" }}>
                          {r.cliente_nombre}
                        </td>
                        <td className="py-2 pr-3" style={{ color: "var(--color-text-sec)" }}>
                          {r.marca} {r.modelo}
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                            style={{ background: ec.bg, color: ec.text }}
                          >
                            {ec.label}
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold"
                            style={{ color: PRIORIDAD_COLOR[r.prioridad] ?? "var(--color-text-sec)" }}
                          >
                            ● {r.prioridad}
                          </span>
                        </td>
                        <td className="py-2" style={{ color: "var(--color-text-sec)" }}>
                          {new Date(r.fecha_ingreso).toLocaleDateString("es-GT")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── PANEL DERECHO (1/3) ── */}
        <div className="flex flex-col gap-4">

          {/* Estados */}
          <div
            className="rounded-2xl p-4"
            style={{ background: "var(--color-surface)", border: `1px solid var(--color-border)`, boxShadow: "0 1px 6px rgba(20,50,74,0.06)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--color-text-sec)" }}>
              Distribución por estado
            </p>
            {estadosList.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--color-text-sec)" }}>Sin reparaciones activas.</p>
            ) : (
              <div className="space-y-1.5">
                {estadosList.map(e => (
                  <div key={e.key} className="flex items-center justify-between">
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full"
                      style={{ background: e.bg, color: e.text }}
                    >
                      {e.label}
                    </span>
                    <span className="text-xs font-bold" style={{ color: "var(--color-text)" }}>{e.total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Repuestos usados este mes */}
          <div
            className="rounded-2xl p-4"
            style={{ background: `${BRAND}0A`, border: `1px solid var(--color-border)` }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Boxes size={14} style={{ color: BRAND_DARK }} />
              <p className="text-[11px] font-semibold" style={{ color: "var(--color-text)" }}>
                Repuestos usados este mes
              </p>
            </div>
            <p className="text-3xl font-bold" style={{ color: BRAND_DARK }}>
              {stats.repuestos_usados_mes}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-sec)" }}>ítems en reparaciones del mes</p>
          </div>

          {/* Actividad reciente */}
          <div
            className="rounded-2xl p-4 flex-1"
            style={{ background: "var(--color-surface)", border: `1px solid var(--color-border)`, boxShadow: "0 1px 6px rgba(20,50,74,0.06)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--color-text-sec)" }}>
              Actividad reciente
            </p>
            {actividad.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--color-text-sec)" }}>Sin actividad reciente.</p>
            ) : (
              <div className="space-y-2.5">
                {actividad.slice(0, 5).map((a, i) => (
                  <div key={i} className="flex gap-2">
                    <div
                      className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                      style={{ background: BRAND }}
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium leading-tight truncate" style={{ color: "var(--color-text)" }}>
                        {a.cliente_nombre} — {a.marca} {a.modelo}
                      </p>
                      <p className="text-[10px] truncate" style={{ color: "var(--color-text-sec)" }}>
                        {a.nota.slice(0, 60)}{a.nota.length > 60 ? "…" : ""}
                      </p>
                      <p className="text-[9px] mt-0.5" style={{ color: "#A8BDD0" }}>
                        {new Date(a.created_at).toLocaleString("es-GT")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD VENTAS
// ═══════════════════════════════════════════════════════════════════════════════

function VentasDashboard({ stats, time, userName }: { stats: VentasStats; time: Date; userName?: string }) {
  const navigate = useNavigate();

  const mesLabel   = time.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });
  const todayKey   = new Date().toISOString().split('T')[0];
  const trend      = stats.tendencia ?? [];
  const maxIng     = Math.max(...trend.map(d => d.ingresos), 1);
  const repListas  = stats.reparaciones.listas ?? 0;
  const cobros     = stats.ventasParciales ?? { cantidad: 0, saldo: 0 };
  const sinStock   = stats.stock?.sin_stock  ?? 0;
  const bajoStock  = stats.stock?.bajo_stock ?? stats.stockBajo ?? 0;
  const clientesMes = stats.clientesMes ?? stats.clientesHoy;
  const todayRow   = trend.find(d => d.fecha === todayKey);
  const weekTotal  = trend.reduce((s, d) => s + d.ingresos, 0);
  const weekVentas = trend.reduce((s, d) => s + d.ventas, 0);

  const quickActions = [
    { icon: ShoppingCart, label: 'Nueva Venta',      color: 'bg-emerald-500', path: '/ventas/nueva' },
    { icon: FileText,     label: 'Cotización',       color: 'bg-blue-500',    path: '/cotizaciones' },
    { icon: Users,        label: 'Nuevo Cliente',    color: 'bg-indigo-500',  path: '/clientes' },
    { icon: Wrench,       label: 'Nueva Reparación', color: 'bg-violet-500',  path: '/reparaciones' },
  ];

  return (
    <div className="space-y-5 max-w-screen-2xl">

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">
            <TrendingUp size={11} /> Panel de Ventas · Operaciones Comerciales
          </span>
          <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--color-text)' }}>
            Dashboard de Ventas
          </h1>
          <p className="text-sm mt-0.5 capitalize" style={{ color: 'var(--color-text-sec)' }}>
            {userName ? `Bienvenido, ${userName} · ` : ''}{mesLabel}
          </p>
        </div>
        <ClockWidget time={time} />
      </div>

      {/* ── ROW 1: KPIs PRINCIPALES (4 cards) ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <FinancialKpiCard
          label="Ventas Hoy"
          value={formatMoney(stats.ventasHoy.total)}
          sub={`${stats.ventasHoy.cantidad} transacciones · ${stats.clientesHoy} clientes`}
          icon={<ShoppingCart size={16} />}
          accent="#10B981"
        />
        <FinancialKpiCard
          label="Ventas del Mes"
          value={formatMoney(stats.ventasMes.total)}
          sub={`${stats.ventasMes.cantidad} ventas`}
          change={stats.cambioMes}
          icon={<TrendingUp size={16} />}
          accent="#3B82F6"
        />
        <FinancialKpiCard
          label="Ticket Promedio Hoy"
          value={(stats.ticketHoy ?? 0) > 0 ? formatMoney(stats.ticketHoy!) : '—'}
          sub={`Mes: ${formatMoney(stats.ticketMes ?? 0)} por venta`}
          icon={<Receipt size={16} />}
          accent="#F59E0B"
        />
        <FinancialKpiCard
          label="Clientes del Mes"
          value={String(clientesMes)}
          sub={`${stats.clientesHoy} atendidos hoy`}
          icon={<Users size={16} />}
          accent="#8B5CF6"
        />
      </div>

      {/* ── ROW 2: ALERTAS OPERACIONALES (3 cards) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <OpKpiCard
          label="Reparaciones Listas"
          value={repListas}
          sub={repListas > 0 ? 'Completadas · pendientes de entrega' : 'Todas entregadas'}
          icon={<CheckCircle2 size={16} />}
          accent="#F59E0B"
          alert={repListas > 0}
          onClick={() => navigate('/ordenes-trabajo')}
        />
        <OpKpiCard
          label="Cotizaciones Abiertas"
          value={stats.cotizaciones.abiertas}
          sub={(stats.cotizaciones.valor_abierto ?? 0) > 0
            ? `${formatMoney(stats.cotizaciones.valor_abierto!)} valor total`
            : 'pendientes de respuesta'}
          icon={<FileText size={16} />}
          accent="#3B82F6"
          alert={false}
          onClick={() => navigate('/cotizaciones')}
        />
        <OpKpiCard
          label="Cobros Pendientes"
          value={cobros.cantidad}
          sub={cobros.cantidad > 0
            ? `${formatMoney(cobros.saldo)} saldo por cobrar`
            : 'sin saldos pendientes'}
          icon={<AlertTriangle size={16} />}
          accent="#EF4444"
          alert={cobros.cantidad > 0}
          onClick={() => navigate('/ventas')}
        />
      </div>

      {/* ── ROW 3: TENDENCIA + ACCIONES ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Sparkline 7 días */}
        <div
          className="lg:col-span-2 rounded-2xl p-5"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-sec)' }}>
                Tendencia — Últimos 7 días
              </p>
              <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--color-text)' }}>
                {todayRow
                  ? `Hoy: ${formatMoney(todayRow.ingresos)} · ${todayRow.ventas} ventas`
                  : 'Sin ventas hoy aún'}
              </p>
            </div>
            <span
              className="text-[10px] font-semibold rounded-lg px-2 py-1"
              style={{ background: '#10B98112', color: '#059669' }}
            >
              Ingresos diarios
            </span>
          </div>

          {/* Barras */}
          <div className="flex items-end gap-1 sm:gap-2" style={{ height: 80 }}>
            {trend.map((d, i) => {
              const h = Math.max((d.ingresos / maxIng) * 68, 4);
              const isToday = d.fecha === todayKey;
              const dayLabel = new Date(d.fecha + 'T12:00:00')
                .toLocaleDateString('es-GT', { weekday: 'short' })
                .replace('.', '').slice(0, 3);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end" style={{ height: 68 }}>
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        isToday ? 'bg-emerald-500' : 'bg-emerald-400/40 dark:bg-emerald-500/25'
                      }`}
                      style={{ height: h }}
                      title={`${d.fecha}: ${formatMoney(d.ingresos)} · ${d.ventas} ventas`}
                    />
                  </div>
                  <span
                    className={`text-[9px] capitalize ${isToday ? 'font-bold' : 'font-medium'}`}
                    style={{ color: isToday ? 'var(--color-text)' : 'var(--color-text-sec)' }}
                  >
                    {dayLabel}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] mt-3" style={{ color: 'var(--color-text-sec)' }}>
            Semana: <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{formatMoney(weekTotal)}</span>
            {' '}·{' '}{weekVentas} ventas en 7 días
          </p>
        </div>

        {/* Acciones rápidas + alerta stock */}
        <div
          className="rounded-2xl p-5 flex flex-col gap-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-sec)' }}>
            Acciones Rápidas
          </p>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map(({ icon: Icon, label, color, path }, i) => (
              <button
                key={i}
                onClick={() => navigate(path)}
                className={`${color} text-white flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 px-2 hover:opacity-90 hover:shadow-lg transition-all`}
              >
                <Icon size={16} />
                <span className="text-[10px] font-semibold leading-tight text-center">{label}</span>
              </button>
            ))}
          </div>

          {/* Alerta inventario */}
          {(sinStock > 0 || bajoStock > 0) ? (
            <button
              onClick={() => navigate('/productos')}
              className="rounded-xl px-3 py-3 text-left w-full transition-all hover:shadow-sm"
              style={{ background: '#F59E0B0D', border: '1px solid #F59E0B30' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                <span className="text-[11px] font-bold" style={{ color: '#B45309' }}>Alertas de Inventario</span>
              </div>
              {sinStock > 0 && (
                <p className="text-[11px]" style={{ color: 'var(--color-text-sec)' }}>
                  <span className="font-semibold text-red-600 dark:text-red-400">{sinStock}</span> sin stock · no disponibles
                </p>
              )}
              {bajoStock > 0 && (
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-sec)' }}>
                  <span className="font-semibold text-orange-600 dark:text-orange-400">{bajoStock}</span> bajo mínimo · reabastecer
                </p>
              )}
            </button>
          ) : (
            <div
              className="rounded-xl px-3 py-2.5"
              style={{ background: '#10B9810D', border: '1px solid #10B98130' }}
            >
              <p className="text-[11px] font-semibold" style={{ color: '#059669' }}>✓ Stock en buen estado</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-sec)' }}>Ningún producto bajo mínimo</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD PRINCIPAL (admin)
// ═══════════════════════════════════════════════════════════════════════════════

function AdminDashboard({ stats, time }: { stats: DashboardStats; time: Date }) {
  const navigate = useNavigate();
  const fin  = stats.financiero;
  const trend = stats.tendencia ?? [];
  const cli  = stats.clientes;

  const mesLabel = time.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });

  const quickActions = [
    { icon: ShoppingCart, label: "Nueva Venta",  color: "bg-emerald-500", path: "/ventas/nueva" },
    { icon: FileText,     label: "Cotización",   color: "bg-blue-500",    path: "/cotizaciones" },
    { icon: Wrench,       label: "Reparación",   color: "bg-violet-500",  path: "/reparaciones" },
    { icon: Users,        label: "Clientes",     color: "bg-indigo-500",  path: "/clientes" },
    { icon: Package,      label: "Productos",    color: "bg-orange-500",  path: "/productos" },
    { icon: Receipt,      label: "Compras",      color: "bg-teal-500",    path: "/compras" },
    { icon: Wallet,       label: "Caja",         color: "bg-pink-500",    path: "/caja-bancos" },
    { icon: Tag,          label: "Stickers",     color: "bg-purple-500",  path: "/stickers-garantia" },
  ];

  return (
    <div className="space-y-5 max-w-screen-2xl">

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">
            <BarChart3 size={11} /> Panel de Control · Administrador
          </span>
          <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--color-text)' }}>
            Dashboard Financiero
          </h1>
          <p className="text-sm mt-0.5 capitalize" style={{ color: 'var(--color-text-sec)' }}>
            Resumen de negocio · {mesLabel}
          </p>
        </div>
        <ClockWidget time={time} />
      </div>

      {/* ── ROW 1: KPIs FINANCIEROS ── */}
      {fin ? (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <FinancialKpiCard
            label="Ingresos del Mes"
            value={formatMoney(fin.ingresos_mes)}
            change={fin.cambio_ingresos_pct}
            sub={`${fin.ventas_mes} ventas · hoy ${formatMoney(fin.ingresos_hoy)}`}
            icon={<TrendingUp size={16} />}
            accent="#22C55E"
          />
          <FinancialKpiCard
            label="Ganancia Bruta"
            value={formatMoney(fin.ganancia_bruta_mes)}
            change={fin.cambio_ganancia_pct}
            sub={`Margen ${fin.margen_bruto.toFixed(1)}% · COGS ${formatMoney(fin.costo_ventas_mes)}`}
            icon={<BarChart3 size={16} />}
            accent="#3B82F6"
          />
          <FinancialKpiCard
            label="Ganancia Neta"
            value={formatMoney(fin.ganancia_neta_mes)}
            sub={`Egresos operativos: ${formatMoney(fin.egresos_caja_mes)}`}
            icon={<DollarSign size={16} />}
            accent={fin.ganancia_neta_mes >= 0 ? "#6366F1" : "#EF4444"}
            negative={fin.ganancia_neta_mes < 0}
          />
          <FinancialKpiCard
            label="Ticket Promedio"
            value={formatMoney(fin.ticket_promedio)}
            sub={`Compras inventario: ${formatMoney(fin.compras_mes)}`}
            icon={<CreditCard size={16} />}
            accent="#8B5CF6"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonBlock key={i} />)}
        </div>
      )}

      {/* ── ROW 2: KPIs OPERACIONALES ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <OpKpiCard
          label="Reparaciones Activas"
          value={stats.reparaciones.total}
          sub={`${stats.reparaciones.completadas} completadas · ${stats.reparaciones.atrasadas ?? 0} atrasadas`}
          icon={<Wrench size={15} />}
          accent="#6366F1"
          alert={(stats.reparaciones.atrasadas ?? 0) > 0}
          onClick={() => navigate('/flujo-reparaciones')}
        />
        <OpKpiCard
          label="Complet. este mes"
          value={stats.reparaciones.completadas_mes ?? 0}
          sub="reparaciones cerradas"
          icon={<CheckCircle2 size={15} />}
          accent="#22C55E"
          onClick={() => navigate('/ordenes-trabajo')}
        />
        <OpKpiCard
          label="Clientes Nuevos"
          value={cli?.nuevos_mes ?? 0}
          sub={`${(cli?.total ?? 0).toLocaleString()} clientes totales`}
          icon={<UserPlus size={15} />}
          accent="#48B9E6"
          onClick={() => navigate('/clientes')}
        />
        <OpKpiCard
          label="Conversión Cotiz."
          value={`${stats.cotizaciones.conversion_rate ?? 0}%`}
          sub={`${stats.cotizaciones.abiertas} pendientes de ${stats.cotizaciones.total} total`}
          icon={<Percent size={15} />}
          accent="#F59E0B"
          alert={stats.cotizaciones.abiertas > 5}
          onClick={() => navigate('/cotizaciones')}
        />
      </div>

      {/* ── ROW 3: TENDENCIA + RESUMEN FINANCIERO ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Sparkline 7 días */}
        <div
          className="lg:col-span-2 rounded-2xl p-5"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 1px 6px rgba(20,50,74,0.06)' }}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg" style={{ background: '#3B82F618' }}>
                <PieChart size={13} style={{ color: '#3B82F6' }} />
              </div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                Tendencia 7 días
              </h3>
            </div>
            <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--color-text-sec)' }}>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" /> Ingresos</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> Ganancia</span>
            </div>
          </div>

          {/* Valores hoy */}
          {fin && (
            <div className="flex gap-4 mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-sec)' }}>Ingresos hoy</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatMoney(fin.ingresos_hoy)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-sec)' }}>Ganancia hoy</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(fin.ganancia_hoy)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-sec)' }}>Ventas hoy</p>
                <p className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>{fin.ventas_hoy}</p>
              </div>
            </div>
          )}

          {trend.length > 0 ? (
            <SparklineChart data={trend} />
          ) : (
            <div className="flex items-center justify-center h-20 rounded-xl" style={{ background: 'var(--color-bg)' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-sec)' }}>Sin ventas en los últimos 7 días</p>
            </div>
          )}

          {/* Eje de montos */}
          {trend.length > 0 && fin && (
            <div className="flex justify-between mt-2">
              <p className="text-[9px]" style={{ color: 'var(--color-text-sec)' }}>Q0</p>
              <p className="text-[9px]" style={{ color: 'var(--color-text-sec)' }}>
                máx {formatMoney(Math.max(...trend.map(d => d.ingresos)))}
              </p>
            </div>
          )}
        </div>

        {/* Resumen P&L del mes */}
        {fin && (
          <div
            className="rounded-2xl p-5"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 1px 6px rgba(20,50,74,0.06)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg" style={{ background: '#22C55E18' }}>
                <BadgeDollarSign size={13} style={{ color: '#22C55E' }} />
              </div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                P&L del Mes
              </h3>
            </div>

            <div className="space-y-2.5">
              {[
                { label: 'Ingresos brutos',    value: fin.ingresos_mes,       color: '#22C55E', symbol: '+' },
                { label: 'Costo de ventas',     value: fin.costo_ventas_mes,   color: '#EF4444', symbol: '−' },
                { label: 'Ganancia bruta',      value: fin.ganancia_bruta_mes, color: '#3B82F6', symbol: '=', bold: true },
                { label: 'Egresos operativos',  value: fin.egresos_caja_mes,   color: '#F59E0B', symbol: '−' },
                { label: 'Ganancia neta',       value: fin.ganancia_neta_mes,  color: fin.ganancia_neta_mes >= 0 ? '#6366F1' : '#EF4444', symbol: '=', bold: true, divider: true },
              ].map((row, i) => (
                <div key={i}>
                  {row.divider && <div className="border-t my-2" style={{ borderColor: 'var(--color-border)' }} />}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono w-3 text-center" style={{ color: row.color }}>{row.symbol}</span>
                      <span
                        className={`text-[12px] ${row.bold ? 'font-bold' : ''}`}
                        style={{ color: row.bold ? 'var(--color-text)' : 'var(--color-text-sec)' }}
                      >
                        {row.label}
                      </span>
                    </div>
                    <span
                      className={`text-[12px] font-mono ${row.bold ? 'font-bold' : 'font-medium'}`}
                      style={{ color: row.color }}
                    >
                      {formatMoney(Math.abs(row.value))}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Margen badge */}
            <div
              className="mt-4 rounded-xl px-3 py-2 flex items-center justify-between"
              style={{ background: '#3B82F610', border: '1px solid #3B82F620' }}
            >
              <span className="text-[11px] font-semibold" style={{ color: '#3B82F6' }}>Margen bruto</span>
              <span className="text-sm font-bold" style={{ color: '#3B82F6' }}>{fin.margen_bruto.toFixed(1)}%</span>
            </div>
            <div
              className="mt-2 rounded-xl px-3 py-2 flex items-center justify-between"
              style={{ background: '#8B5CF610', border: '1px solid #8B5CF620' }}
            >
              <span className="text-[11px] font-semibold" style={{ color: '#8B5CF6' }}>Ticket promedio</span>
              <span className="text-sm font-bold" style={{ color: '#8B5CF6' }}>{formatMoney(fin.ticket_promedio)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── ROW 4: REPARACIONES + STOCK + QUICK ACTIONS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-6">

        {/* Reparaciones pipeline */}
        <div
          className="rounded-2xl p-5"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 1px 6px rgba(20,50,74,0.06)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="bg-violet-100 dark:bg-violet-950/30 p-1.5 rounded-lg">
                <Wrench size={13} className="text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Pipeline Reparaciones</h3>
            </div>
            <button
              onClick={() => navigate('/flujo-reparaciones')}
              className="flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-700 transition-colors"
            >
              Ver todas <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {[
              { icon: <Activity size={13} className="text-white" />,     bg: 'bg-blue-500',    rowBg: 'bg-blue-50 dark:bg-blue-950/30',      label: 'Activas',        sub: 'en flujo',               value: stats.reparaciones.total,                     textColor: 'text-blue-700 dark:text-blue-300'    },
              { icon: <CheckCircle2 size={13} className="text-white" />, bg: 'bg-emerald-500', rowBg: 'bg-emerald-50 dark:bg-emerald-950/30', label: 'Complet. mes',   sub: 'cerradas este mes',      value: stats.reparaciones.completadas_mes ?? 0,      textColor: 'text-emerald-700 dark:text-emerald-300'},
              { icon: <ClipboardCheck size={13} className="text-white" />,bg:'bg-teal-500',    rowBg: 'bg-teal-50 dark:bg-teal-950/30',       label: 'Con checklist',  sub: 'proceso documentado',    value: stats.reparaciones.con_checklist,             textColor: 'text-teal-700 dark:text-teal-300'    },
              { icon: <ClipboardX size={13} className="text-white" />,   bg: 'bg-orange-500',  rowBg: 'bg-orange-50 dark:bg-orange-950/30',  label: 'Sin checklist',  sub: 'requieren atención',     value: stats.reparaciones.sin_checklist,             textColor: 'text-orange-700 dark:text-orange-300'},
              { icon: <AlertCircle size={13} className="text-white" />,  bg: 'bg-red-500',     rowBg: 'bg-red-50 dark:bg-red-950/30',        label: 'Atrasadas',      sub: 'pasaron fecha estimada', value: stats.reparaciones.atrasadas ?? 0,            textColor: 'text-red-700 dark:text-red-300'      },
            ].map((row, i) => (
              <div key={i} className={`flex items-center justify-between ${row.rowBg} rounded-xl px-3 py-2`}>
                <div className="flex items-center gap-2">
                  <div className={`${row.bg} p-1.5 rounded-lg shrink-0`}>{row.icon}</div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>{row.label}</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-sec)' }}>{row.sub}</p>
                  </div>
                </div>
                <span className={`text-lg font-bold ${row.textColor}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Inventario + alertas stock */}
        <div
          className="rounded-2xl p-5"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 1px 6px rgba(20,50,74,0.06)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="bg-amber-100 dark:bg-amber-950/30 p-1.5 rounded-lg">
                <Package size={13} className="text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Inventario</h3>
            </div>
            <button
              onClick={() => navigate('/productos')}
              className="flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-700 transition-colors"
            >
              Ver productos <ArrowRight size={12} />
            </button>
          </div>

          {/* Total productos */}
          <div
            className="rounded-xl px-4 py-3 mb-3 flex items-center justify-between"
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-2">
              <Boxes size={14} className="text-blue-500" />
              <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Total productos</span>
            </div>
            <span className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{stats.productos.total}</span>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-800/40 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2">
                <AlertTriangle size={13} className="text-red-500 shrink-0" />
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>Sin Stock</p>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-sec)' }}>Reposición inmediata</p>
                </div>
              </div>
              <span className="text-lg font-bold text-red-700 dark:text-red-300">{stats.productos.sin_stock}</span>
            </div>
            <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-800/40 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Package size={13} className="text-orange-500 shrink-0" />
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>Stock Bajo</p>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-sec)' }}>Por debajo del mínimo</p>
                </div>
              </div>
              <span className="text-lg font-bold text-orange-700 dark:text-orange-300">{stats.productos.bajo_stock}</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/compras')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Plus size={14} /> Crear Orden de Compra
          </button>
        </div>

        {/* Acciones rápidas */}
        <div
          className="rounded-2xl p-5"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 1px 6px rgba(20,50,74,0.06)' }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-sec)' }}>
            Acciones Rápidas
          </p>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map(({ icon: Icon, label, color, path }, i) => (
              <button
                key={i}
                onClick={() => navigate(path)}
                className={`${color} text-white flex items-center gap-2 rounded-xl py-2.5 px-3 hover:opacity-90 hover:shadow-md transition-all`}
              >
                <Icon size={14} />
                <span className="text-[11px] font-semibold leading-tight">{label}</span>
              </button>
            ))}
          </div>

          {/* Mini cotizaciones */}
          <div
            className="mt-4 rounded-xl px-3 py-2.5"
            style={{ background: '#F59E0B0D', border: '1px solid #F59E0B25' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={13} className="text-amber-500" />
                <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>Cotizaciones abiertas</span>
              </div>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{stats.cotizaciones.abiertas}</span>
            </div>
            <button
              onClick={() => navigate('/cotizaciones')}
              className="mt-2 w-full text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1 hover:underline"
            >
              Ver cotizaciones <ArrowRight size={11} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRY POINT — Detecta rol y carga el dashboard correcto
// ═══════════════════════════════════════════════════════════════════════════════

function normalizeRole(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getStoredAuthToken(): string | null {
  // authService saves to sessionStorage — check it first
  const sessionToken = sessionStorage.getItem('token');
  if (sessionToken && sessionToken !== 'null' && sessionToken !== 'undefined') {
    return sessionToken;
  }

  // Fallback: legacy localStorage keys
  const directToken =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken");

  if (directToken && directToken !== "null" && directToken !== "undefined") {
    return directToken;
  }

  for (const key of Object.keys(localStorage)) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);

      const possibleToken =
        parsed?.token ||
        parsed?.accessToken ||
        parsed?.state?.token ||
        parsed?.state?.accessToken ||
        parsed?.state?.auth?.token ||
        parsed?.state?.user?.token ||
        parsed?.user?.token;

      if (
        possibleToken &&
        possibleToken !== "null" &&
        possibleToken !== "undefined"
      ) {
        return possibleToken;
      }
    } catch {
      // Ignorar entradas que no son JSON
    }
  }

  return null;
}

export default function DashboardPage() {
  const { user } = useAuth();

  // Detectar rol usando array RBAC (user.roles) y campo legado (user.role)
  const userRoles: string[] = user?.roles ?? [];
  const legacyRole          = (user?.role ?? '').toLowerCase();
  const isAdminUser   = userRoles.includes('ADMINISTRADOR') || legacyRole === 'admin';
  const isTecnicoUser = userRoles.includes('TECNICO')       || legacyRole === 'tecnico';
  const isVentasUser  = userRoles.includes('VENTAS')        || legacyRole === 'ventas';

  const [adminStats,  setAdminStats]  = useState<DashboardStats | null>(null);
  const [tecnicoData, setTecnicoData] = useState<TecnicoData | null>(null);
  const [ventasStats, setVentasStats] = useState<VentasStats | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      setLoading(true);
      setError(null);

      const token = getStoredAuthToken();

      if (!token) {
        if (!mounted) return;
        setError("Sesión no válida. Vuelve a iniciar sesión.");
        if (isAdminUser) {
          setAdminStats({
            ventas:       { hoy: 0, mes: 0, total: 0, cantidad: 0 },
            productos:    { total: 0, bajo_stock: 0, sin_stock: 0 },
            reparaciones: { total: 0, con_checklist: 0, sin_checklist: 0, completadas: 0, completadas_mes: 0, atrasadas: 0 },
            cotizaciones: { total: 0, abiertas: 0, conversion_rate: 0 },
            gastos:       { mes: 0 },
            ganancias:    { hoy: 0, mes: 0 },
            clientes:     { nuevos_mes: 0, total: 0 },
          });
        }
        setLoading(false);
        return;
      }

      try {
        // Endpoint unificado: el backend detecta el rol y devuelve el dashboard correcto
        const res = await fetch(`${API_URL}/dashboard`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);

        const data = await res.json();

        if (!mounted) return;

        if (data.dashboardType === 'tecnico') {
          setTecnicoData(data as TecnicoData);
        } else if (data.dashboardType === 'ventas') {
          setVentasStats(data as VentasStats);
        } else {
          // admin
          setAdminStats(data as DashboardStats);
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        if (!mounted) return;
        setError("No se pudieron cargar las estadísticas. Verifica la sesión o permisos.");
        if (isAdminUser) {
          setAdminStats({
            ventas:       { hoy: 0, mes: 0, total: 0, cantidad: 0 },
            productos:    { total: 0, bajo_stock: 0, sin_stock: 0 },
            reparaciones: { total: 0, con_checklist: 0, sin_checklist: 0, completadas: 0, completadas_mes: 0, atrasadas: 0 },
            cotizaciones: { total: 0, abiertas: 0, conversion_rate: 0 },
            gastos:       { mes: 0 },
            ganancias:    { hoy: 0, mes: 0 },
            clientes:     { nuevos_mes: 0, total: 0 },
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadDashboard();
    return () => { mounted = false; };
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-4 max-w-screen-2xl">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <SkeletonBlock key={i} />)}
        </div>
        <SkeletonBlock h="h-12" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SkeletonBlock h="h-64" />
          <SkeletonBlock h="h-64" />
          <SkeletonBlock h="h-64" />
        </div>
      </div>
    );
  }

  const errorBanner = error && (
    <div
      className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm mb-4"
      style={{
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.20)",
        color: "#B91C1C",
      }}
    >
      <AlertTriangle size={14} /> {error}
    </div>
  );

  if (isTecnicoUser && tecnicoData) {
    return (
      <>
        {errorBanner}
        <TecnicoDashboard data={tecnicoData} time={currentTime} />
      </>
    );
  }

  if (isVentasUser && ventasStats) {
    return (
      <>
        {errorBanner}
        <VentasDashboard stats={ventasStats} time={currentTime} userName={user?.name} />
      </>
    );
  }

  if (adminStats) {
    return (
      <>
        {errorBanner}
        <AdminDashboard stats={adminStats} time={currentTime} />
      </>
    );
  }

  return <>{errorBanner}</>;
}
