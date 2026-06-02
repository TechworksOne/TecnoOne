import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Plus, Search, RefreshCw, AlertCircle,
  TrendingDown, Eye, Ban, CreditCard, X, ChevronDown,
  ShoppingCart, Wrench, FileText, Trash2, ArrowLeft, ArrowRight,
  CheckCircle, Package, Calendar,
} from 'lucide-react';
import {
  deudoresService, Deudor, DeudoresResumen,
  ItemCarritoVenta, ReparacionBusqueda, TipoOrigen, FrecuenciaPago,
} from '../../services/deudoresService';
import { useAuth } from '../../store/useAuth';
import CustomerPicker from '../../components/customers/CustomerPicker';
import type { Customer } from '../../types/customer';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (v: number | string) =>
  `Q${Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toNum = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// Safe date formatter — handles MySQL 'YYYY-MM-DD HH:mm:ss' and ISO strings
const fmtDate = (v?: string | null, opts?: Intl.DateTimeFormatOptions): string => {
  if (!v) return '—';
  const d = new Date(String(v).replace(' ', 'T'));
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-GT', opts);
};

const ESTADO_BADGE: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
  PARCIAL:   'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
  PAGADO:    'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
  ANULADO:   'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
  VENCIDO:   'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400',
};

const TIPO_BADGE: Record<TipoOrigen, string> = {
  VENTA:      'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300',
  REPARACION: 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300',
  MANUAL:     'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
};

const TIPO_LABEL: Record<TipoOrigen, string> = {
  VENTA: 'Venta', REPARACION: 'Reparación', MANUAL: 'Manual',
};

type FrecuenciaDias = 7 | 15 | 'month';
const FRECUENCIA_DIAS: Record<FrecuenciaPago, FrecuenciaDias> = {
  SEMANAL: 7, QUINCENAL: 15, MENSUAL: 'month',
};

function addPeriod(date: Date, freq: FrecuenciaPago): Date {
  const d = new Date(date);
  const delta = FRECUENCIA_DIAS[freq];
  if (delta === 'month') d.setMonth(d.getMonth() + 1);
  else d.setDate(d.getDate() + (delta as number));
  return d;
}

function calcCuotas(total: number, numCuotas: number, freq: FrecuenciaPago, primerFecha: string) {
  const cuotaBase = Math.floor((total / numCuotas) * 100) / 100;
  const cuotaUlt  = parseFloat((total - cuotaBase * (numCuotas - 1)).toFixed(2));
  const rows: { numero: number; monto: number; fecha: Date }[] = [];
  let fecha = new Date(primerFecha + 'T12:00:00');
  for (let i = 1; i <= numCuotas; i++) {
    rows.push({ numero: i, monto: i === numCuotas ? cuotaUlt : cuotaBase, fecha: new Date(fecha) });
    fecha = addPeriod(fecha, freq);
  }
  return rows;
}

function useDebounce<T>(value: T, ms: number): T {
  const [dv, setDv] = useState<T>(value);
  useEffect(() => {
    const id = setTimeout(() => setDv(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return dv;
}

// ─────────────────────────────────────────────────────────────────────────────
// WIZARD STATE
// ─────────────────────────────────────────────────────────────────────────────
type WizardStep = 1 | 2 | 3 | 4;

interface WizardState {
  cliente?: Customer;
  tipoOrigen: TipoOrigen;
  carrito: ItemCarritoVenta[];
  reparacion?: ReparacionBusqueda;
  descripcion: string;
  montoManual: string;
  montoReparacion: string;  // monto editable para tipo REPARACION
  numeroCuotas: number;
  frecuenciaPago: FrecuenciaPago;
  fechaPrimerPago: string;
  fechaVencimiento: string;
  notas: string;
}

const INITIAL_WIZARD: WizardState = {
  tipoOrigen: 'MANUAL', carrito: [], descripcion: '', montoManual: '', montoReparacion: '',
  numeroCuotas: 1, frecuenciaPago: 'MENSUAL', fechaPrimerPago: '', fechaVencimiento: '', notas: '',
};

// ─── Step 1 ───────────────────────────────────────────────────────────────
function Step1({ state, setState }: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>> }) {
  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">Cliente *</label>
        <CustomerPicker value={state.cliente} onChange={c => setState(s => ({ ...s, cliente: c || undefined }))} allowCreate placeholder="Buscar o crear cliente..." />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 block">Tipo de crédito *</label>
        <div className="grid grid-cols-3 gap-2">
          {([
            { key: 'VENTA' as TipoOrigen, icon: <ShoppingCart size={18} />, label: 'Venta', desc: 'Productos' },
            { key: 'REPARACION' as TipoOrigen, icon: <Wrench size={18} />, label: 'Reparación', desc: 'Servicio' },
            { key: 'MANUAL' as TipoOrigen, icon: <FileText size={18} />, label: 'Manual', desc: 'Libre' },
          ] as const).map(({ key, icon, label, desc }) => (
            <button key={key} type="button"
              onClick={() => setState(s => ({ ...s, tipoOrigen: key, carrito: [], reparacion: undefined, montoManual: '', montoReparacion: '', descripcion: '' }))}
              className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all ${
                state.tipoOrigen === key
                  ? 'border-[#48B9E6] bg-[#48B9E6]/10 text-[#48B9E6]'
                  : 'border-slate-200 dark:border-[rgba(72,185,230,0.16)] text-slate-600 dark:text-slate-300 hover:border-slate-300'
              }`}>
              {icon}
              <span className="text-xs font-semibold">{label}</span>
              <span className="text-[10px] opacity-70">{desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Step 2 ───────────────────────────────────────────────────────────────
function Step2({ state, setState }: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>> }) {
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 320);
  const [results, setResults] = useState<unknown[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!dq.trim()) { setResults([]); return; }
    setSearching(true);
    const fn = state.tipoOrigen === 'VENTA'
      ? deudoresService.searchProductos(dq)
      : deudoresService.searchReparaciones(dq);
    fn.then(d => setResults(d as unknown[])).catch(() => setResults([])).finally(() => setSearching(false));
  }, [dq, state.tipoOrigen]);

  const inputCls = "w-full border border-slate-200 dark:border-[rgba(72,185,230,0.16)] rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#0A1220] text-slate-800 dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#48B9E6]";

  if (state.tipoOrigen === 'MANUAL') {
    return (
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">Descripción</label>
          <input className={inputCls} placeholder="Ej: Préstamo, servicio especial..." value={state.descripcion}
            onChange={e => setState(s => ({ ...s, descripcion: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">Monto total (Q) *</label>
          <input type="number" min="0" step="0.01" className={inputCls} placeholder="0.00" value={state.montoManual}
            onChange={e => setState(s => ({ ...s, montoManual: e.target.value }))} />
        </div>
      </div>
    );
  }

  if (state.tipoOrigen === 'REPARACION') {
    return (
      <div className="space-y-3">
        {state.reparacion ? (
          <div className="bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800/40 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-violet-900 dark:text-violet-200">{state.reparacion.cliente_nombre}</p>
                <p className="text-sm text-violet-700 dark:text-violet-300 mt-0.5">{state.reparacion.marca} {state.reparacion.modelo}</p>
                {state.reparacion.numero_reparacion && <p className="text-xs text-violet-500 font-mono mt-0.5">#{state.reparacion.numero_reparacion}</p>}
                {state.reparacion.estado && <p className="text-[10px] text-violet-400 uppercase tracking-wide mt-0.5">{state.reparacion.estado.replace('_',' ')}</p>}
                <div className="mt-2 space-y-0.5">
                  <p className="text-xs text-violet-600 dark:text-violet-400">Total reparación: <span className="font-semibold">{fmt(state.reparacion.total)}</span></p>
                  {(state.reparacion.monto_anticipo ?? 0) > 0 && (
                    <p className="text-xs text-violet-600 dark:text-violet-400">Anticipo pagado: <span className="font-semibold text-emerald-600 dark:text-emerald-400">− {fmt(state.reparacion.monto_anticipo ?? 0)}</span></p>
                  )}
                  <p className="text-sm font-bold text-violet-900 dark:text-violet-100">Saldo calculado: {fmt(Math.max(0, toNum(state.reparacion.total) - toNum(state.reparacion.monto_anticipo)))}</p>
                </div>
              </div>
              <button onClick={() => { setState(s => ({ ...s, reparacion: undefined, montoReparacion: '' })); setQ(''); }}
                className="p-1.5 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/30 text-violet-400 shrink-0">
                <X size={16} />
              </button>
            </div>
            {/* ── Monto a financiar editable ── */}
            <div className="mt-3 pt-3 border-t border-violet-200 dark:border-violet-800/40">
              <label className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide mb-1.5 block">Monto a financiar (Q) *</label>
              <input
                type="number" min="0.01" step="0.01"
                className={inputCls}
                value={state.montoReparacion}
                onChange={e => setState(s => ({ ...s, montoReparacion: e.target.value }))}
                placeholder="0.00"
              />
              <p className="text-[11px] text-violet-400 dark:text-violet-500 mt-1">
                Puedes ajustar el monto si difiere del saldo calculado.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className={`${inputCls} pl-9`} placeholder="Buscar por cliente, marca, modelo..." value={q} onChange={e => setQ(e.target.value)} />
            </div>
            {searching && <p className="text-xs text-slate-400 text-center py-1">Buscando...</p>}
            {results.length > 0 && (
              <div className="border border-slate-200 dark:border-[rgba(72,185,230,0.16)] rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                {(results as ReparacionBusqueda[]).map(r => {
                  const saldo = Math.max(0, toNum(r.total) - toNum(r.monto_anticipo));
                  return (
                    <button key={r.id} type="button"
                      onClick={() => {
                        const saldo = Math.max(0, toNum(r.total) - toNum(r.monto_anticipo));
                        setState(s => ({ ...s, reparacion: r, montoReparacion: String(saldo) }));
                        setQ(''); setResults([]);
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-[#0A1220] border-b last:border-b-0 border-slate-100 dark:border-[rgba(72,185,230,0.08)]">
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-[#F8FAFC]">{r.cliente_nombre}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{r.marca} {r.modelo}{r.estado ? ` · ${r.estado.replace('_',' ')}` : ''}</p>
                        {(r.monto_anticipo ?? 0) > 0 && <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Anticipo: {fmt(r.monto_anticipo ?? 0)}</p>}
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-sm font-semibold text-[#48B9E6]">{fmt(saldo)}</p>
                        {(r.monto_anticipo ?? 0) > 0 && <p className="text-[10px] text-slate-400 line-through">{fmt(r.total)}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // VENTA
  type ProdResult = { id: number; nombre: string; sku?: string; precio_venta: number; stock: number };
  const totalCarrito = state.carrito.reduce((s, i) => s + i.subtotal, 0);
  const agregarProducto = (p: ProdResult) => {
    setState(s => {
      const exist = s.carrito.find(i => i.id === p.id);
      if (exist) return { ...s, carrito: s.carrito.map(i => i.id === p.id ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precio_unitario } : i) };
      return { ...s, carrito: [...s.carrito, { id: p.id, nombre: p.nombre, sku: p.sku, precio_unitario: p.precio_venta, cantidad: 1, subtotal: p.precio_venta }] };
    });
    setQ(''); setResults([]);
  };
  const quitarItem = (id: number) => setState(s => ({ ...s, carrito: s.carrito.filter(i => i.id !== id) }));
  const cambiarQty = (id: number, qty: number) => {
    if (qty <= 0) { quitarItem(id); return; }
    setState(s => ({ ...s, carrito: s.carrito.map(i => i.id === id ? { ...i, cantidad: qty, subtotal: qty * i.precio_unitario } : i) }));
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className={`${inputCls} pl-9`} placeholder="Buscar producto por nombre o SKU..." value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {searching && <p className="text-xs text-slate-400 text-center py-1">Buscando...</p>}
      {results.length > 0 && (
        <div className="border border-slate-200 dark:border-[rgba(72,185,230,0.16)] rounded-xl overflow-hidden max-h-40 overflow-y-auto">
          {(results as ProdResult[]).map(p => (
            <button key={p.id} type="button" onClick={() => agregarProducto(p)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-[#0A1220] border-b last:border-b-0 border-slate-100 dark:border-[rgba(72,185,230,0.08)]">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-[#F8FAFC]">{p.nombre}</p>
                {p.sku && <p className="text-xs text-slate-400 font-mono">{p.sku}</p>}
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-[#48B9E6]">{fmt(p.precio_venta)}</p>
                <p className="text-xs text-slate-400">Stock: {p.stock}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {state.carrito.length > 0 && (
        <div className="border border-slate-200 dark:border-[rgba(72,185,230,0.16)] rounded-xl overflow-hidden">
          {state.carrito.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0 border-slate-100 dark:border-[rgba(72,185,230,0.08)]">
              <Package size={14} className="text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-[#F8FAFC] truncate">{item.nombre}</p>
                <p className="text-xs text-slate-400">{fmt(item.precio_unitario)} c/u</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => cambiarQty(item.id, item.cantidad - 1)} className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center hover:bg-slate-200">−</button>
                <span className="text-sm font-semibold text-slate-800 dark:text-[#F8FAFC] w-6 text-center">{item.cantidad}</span>
                <button onClick={() => cambiarQty(item.id, item.cantidad + 1)} className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center hover:bg-slate-200">+</button>
              </div>
              <span className="text-sm font-semibold text-[#48B9E6] w-20 text-right">{fmt(item.subtotal)}</span>
              <button onClick={() => quitarItem(item.id)} className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-400"><Trash2 size={13} /></button>
            </div>
          ))}
          <div className="px-3 py-2 bg-slate-50 dark:bg-[#0A1220] flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total carrito</span>
            <span className="text-base font-bold text-[#48B9E6]">{fmt(totalCarrito)}</span>
          </div>
        </div>
      )}
      {state.carrito.length === 0 && !q && (
        <div className="text-center py-4 text-slate-400 dark:text-slate-500 text-sm">Busca productos para agregar al crédito</div>
      )}
    </div>
  );
}

// ─── Step 3 ───────────────────────────────────────────────────────────────
const FREQ_LABEL: Record<FrecuenciaPago, string> = {
  SEMANAL: 'Semanal', QUINCENAL: 'Quincenal', MENSUAL: 'Mensual',
};

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Step3({ state, setState, montoTotal }: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>; montoTotal: number }) {
  const numCuotas = Math.max(1, state.numeroCuotas || 1);

  // Pre-calculate cuota amounts
  const cuotaBase = (montoTotal > 0 && numCuotas > 0)
    ? Math.floor((montoTotal / numCuotas) * 100) / 100 : 0;
  const cuotaUlt = (montoTotal > 0 && numCuotas > 0)
    ? parseFloat((montoTotal - cuotaBase * (numCuotas - 1)).toFixed(2)) : 0;

  // Generate preview rows
  const cuotasList = (state.fechaPrimerPago && montoTotal > 0)
    ? calcCuotas(montoTotal, numCuotas, state.frecuenciaPago, state.fechaPrimerPago)
    : null;

  // Last cuota date → auto-populate fechaVencimiento
  const lastDate = cuotasList?.at(-1)?.fecha ?? null;
  const lastDateStr = lastDate ? toDateStr(lastDate) : '';
  useEffect(() => {
    setState(s => ({ ...s, fechaVencimiento: lastDateStr }));
  }, [lastDateStr]); // eslint-disable-line react-hooks/exhaustive-deps

  const inputCls = "w-full border border-slate-200 dark:border-[rgba(72,185,230,0.16)] rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#0A1220] text-slate-800 dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#48B9E6]";
  const lbl = "text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 block";

  return (
    <div className="space-y-4">
      {/* ── Monto badge ── */}
      <div className="bg-[#48B9E6]/10 border border-[#48B9E6]/30 rounded-xl p-3 flex items-center justify-between">
        <span className="text-sm text-slate-600 dark:text-slate-300">Monto total del crédito</span>
        <span className="text-lg font-bold text-[#48B9E6]">{fmt(montoTotal)}</span>
      </div>

      {/* ── Cuotas + Frecuencia ── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Núm. cuotas *</label>
          <input type="number" min="1" max="60" className={inputCls}
            value={state.numeroCuotas}
            onChange={e => setState(s => ({ ...s, numeroCuotas: Math.max(1, parseInt(e.target.value) || 1) }))} />
          {montoTotal > 0 && (
            <p className="text-xs text-[#48B9E6] mt-1 font-medium">
              {numCuotas === 1
                ? `Pago único ${fmt(montoTotal)}`
                : numCuotas > 1 && cuotaBase > 0
                  ? cuotaBase === cuotaUlt
                    ? `${numCuotas} × ${fmt(cuotaBase)}`
                    : `${numCuotas - 1} × ${fmt(cuotaBase)} + ${fmt(cuotaUlt)}`
                  : ''}
            </p>
          )}
        </div>
        <div>
          <label className={lbl}>Frecuencia</label>
          <select className={inputCls} value={state.frecuenciaPago}
            onChange={e => setState(s => ({ ...s, frecuenciaPago: e.target.value as FrecuenciaPago }))}>
            <option value="SEMANAL">Semanal</option>
            <option value="QUINCENAL">Quincenal</option>
            <option value="MENSUAL">Mensual</option>
          </select>
        </div>
      </div>

      {/* ── Primer pago ── */}
      <div>
        <label className={lbl}>Fecha primer pago *</label>
        <input type="date" className={inputCls}
          value={state.fechaPrimerPago}
          onChange={e => setState(s => ({ ...s, fechaPrimerPago: e.target.value }))} />
        {!state.fechaPrimerPago && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
            <Calendar size={11} /> Requerido para generar el plan de cuotas
          </p>
        )}
      </div>

      {/* ── Vencimiento (auto-read-only) ── */}
      {lastDateStr && (
        <div>
          <label className={lbl}>Vencimiento límite (última cuota)</label>
          <div className="w-full border border-[#48B9E6]/30 rounded-xl px-3 py-2.5 text-sm bg-[#48B9E6]/5 dark:bg-[#48B9E6]/10 text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <Calendar size={14} className="text-[#48B9E6] shrink-0" />
            {new Date(lastDateStr + 'T12:00:00').toLocaleDateString('es-GT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      )}

      {/* ── Notas ── */}
      <div>
        <label className={lbl}>Notas</label>
        <textarea rows={2} className={`${inputCls} resize-none`}
          placeholder="Observaciones, condiciones especiales..."
          value={state.notas}
          onChange={e => setState(s => ({ ...s, notas: e.target.value }))} />
      </div>

      {/* ── Resumen del plan ── */}
      {cuotasList && montoTotal > 0 && (
        <div className="space-y-3">
          {/* Stats card */}
          <div className="bg-slate-50 dark:bg-[#0A1220] border border-slate-200 dark:border-[rgba(72,185,230,0.16)] rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 dark:border-[rgba(72,185,230,0.08)] flex items-center gap-1.5">
              <Calendar size={13} className="text-[#48B9E6]" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Resumen del plan</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-0 divide-x divide-y divide-slate-100 dark:divide-[rgba(72,185,230,0.08)]">
              <div className="px-4 py-3 text-center">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">Total</p>
                <p className="text-base font-bold text-[#48B9E6] mt-0.5">{fmt(montoTotal)}</p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">Cuotas</p>
                <p className="text-base font-bold text-slate-800 dark:text-[#F8FAFC] mt-0.5">{numCuotas}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">{FREQ_LABEL[state.frecuenciaPago]}</p>
              </div>
              <div className="px-4 py-3 text-center col-span-2 sm:col-span-1">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">Por cuota</p>
                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{fmt(cuotaBase)}</p>
                {cuotaBase !== cuotaUlt && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">última {fmt(cuotaUlt)}</p>
                )}
              </div>
            </div>
            <div className="px-4 py-2.5 bg-slate-100/60 dark:bg-[#060B14]/50 border-t border-slate-100 dark:border-[rgba(72,185,230,0.08)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-slate-500 dark:text-slate-400">
              <span>Primer pago: <span className="font-semibold text-slate-700 dark:text-slate-200">{new Date(state.fechaPrimerPago + 'T12:00:00').toLocaleDateString('es-GT')}</span></span>
              <span>Último pago: <span className="font-semibold text-slate-700 dark:text-slate-200">{new Date(lastDateStr + 'T12:00:00').toLocaleDateString('es-GT')}</span></span>
            </div>
          </div>

          {/* Cuota preview table */}
          <div className="border border-slate-200 dark:border-[rgba(72,185,230,0.16)] rounded-xl overflow-hidden">
            <div className="grid grid-cols-12 bg-slate-50 dark:bg-[#060B14] px-3 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-slate-100 dark:border-[rgba(72,185,230,0.08)]">
              <span className="col-span-2">N°</span>
              <span className="col-span-5">Fecha vencimiento</span>
              <span className="col-span-3 text-right">Monto</span>
              <span className="col-span-2 text-right">Estado</span>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-[rgba(72,185,230,0.06)]">
              {cuotasList.map(c => (
                <div key={c.numero} className="grid grid-cols-12 items-center px-3 py-2 text-sm">
                  <span className="col-span-2 text-slate-400 dark:text-slate-500 text-xs font-mono">#{c.numero}</span>
                  <span className="col-span-5 text-slate-700 dark:text-slate-300 text-xs">{isNaN(c.fecha.getTime()) ? '—' : c.fecha.toLocaleDateString('es-GT')}</span>
                  <span className="col-span-3 text-right font-semibold text-[#48B9E6] text-xs">{fmt(c.monto)}</span>
                  <span className="col-span-2 text-right">
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">PEND.</span>
                  </span>
                </div>
              ))}
            </div>
            {numCuotas > 12 && (
              <div className="px-3 py-2 bg-slate-50 dark:bg-[#060B14] border-t border-slate-100 dark:border-[rgba(72,185,230,0.08)] text-center text-xs text-slate-400 dark:text-slate-500">
                {numCuotas} cuotas en total · suma exacta {fmt(montoTotal)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 4 ───────────────────────────────────────────────────────────────
function Step4({ state, montoTotal }: { state: WizardState; montoTotal: number }) {
  const cuotas = state.fechaPrimerPago && state.numeroCuotas > 1
    ? calcCuotas(montoTotal, state.numeroCuotas, state.frecuenciaPago, state.fechaPrimerPago)
    : null;
  const lbl = (label: string, value: string) => (
    <div className="flex justify-between py-1.5 text-sm border-b border-slate-100 dark:border-[rgba(72,185,230,0.08)] last:border-b-0">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-semibold text-slate-800 dark:text-[#F8FAFC]">{value}</span>
    </div>
  );
  const nombreCliente = state.cliente?.nombre
    ? `${state.cliente.nombre}${state.cliente.apellido ? ' ' + state.cliente.apellido : ''}`.trim()
    : `${state.cliente?.firstName || ''} ${state.cliente?.lastName || ''}`.trim() || '—';
  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-[#0A1220] border border-slate-200 dark:border-[rgba(72,185,230,0.16)] rounded-xl p-4 space-y-0.5">
        {lbl('Cliente', nombreCliente)}
        {lbl('Tipo', TIPO_LABEL[state.tipoOrigen])}
        {lbl('Monto total', fmt(montoTotal))}
        {lbl('Cuotas', `${state.numeroCuotas} × ${state.frecuenciaPago.toLowerCase()}`)}
        {state.fechaPrimerPago && lbl('Primer pago', new Date(state.fechaPrimerPago + 'T12:00:00').toLocaleDateString('es-GT'))}
        {state.notas && lbl('Notas', state.notas)}
      </div>
      {state.tipoOrigen === 'VENTA' && state.carrito.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Productos</p>
          <div className="border border-slate-200 dark:border-[rgba(72,185,230,0.16)] rounded-xl overflow-hidden">
            {state.carrito.map(i => (
              <div key={i.id} className="flex justify-between items-center px-3 py-2 text-sm border-b last:border-b-0 border-slate-100 dark:border-[rgba(72,185,230,0.08)]">
                <span className="text-slate-700 dark:text-slate-300">{i.nombre} <span className="text-slate-400 text-xs">×{i.cantidad}</span></span>
                <span className="font-semibold text-[#48B9E6]">{fmt(i.subtotal)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {cuotas && (
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Plan de cuotas</p>
          <div className="border border-slate-200 dark:border-[rgba(72,185,230,0.16)] rounded-xl overflow-hidden max-h-44 overflow-y-auto">
            <div className="flex bg-slate-50 dark:bg-[#060B14] px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase border-b border-slate-100 dark:border-[rgba(72,185,230,0.08)]">
              <span className="w-10">N°</span><span className="flex-1">Fecha</span><span>Monto</span>
            </div>
            {cuotas.map(c => (
              <div key={c.numero} className="flex items-center px-3 py-2 text-sm border-b last:border-b-0 border-slate-100 dark:border-[rgba(72,185,230,0.08)]">
                <span className="w-10 text-slate-400 text-xs">#{c.numero}</span>
                <span className="flex-1 text-slate-700 dark:text-slate-300">{isNaN(c.fecha.getTime()) ? '—' : c.fecha.toLocaleDateString('es-GT')}</span>
                <span className="font-semibold text-[#48B9E6]">{fmt(c.monto)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Wizard container ─────────────────────────────────────────────────────
function WizardNuevoCredito({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState<WizardStep>(1);
  const [state, setState] = useState<WizardState>(INITIAL_WIZARD);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const montoTotal = (() => {
    if (state.tipoOrigen === 'MANUAL') return toNum(state.montoManual);
    if (state.tipoOrigen === 'REPARACION') {
      if (state.montoReparacion && toNum(state.montoReparacion) > 0) return toNum(state.montoReparacion);
      const total = toNum(state.reparacion?.total);
      const anticipo = toNum(state.reparacion?.monto_anticipo);
      return Math.max(0, total - anticipo);
    }
    return state.carrito.reduce((s, i) => s + i.subtotal, 0);
  })();

  const canNext = useCallback((): boolean => {
    if (step === 1) return !!state.cliente;
    if (step === 2) {
      if (state.tipoOrigen === 'MANUAL') return toNum(state.montoManual) > 0;
      if (state.tipoOrigen === 'REPARACION') return !!state.reparacion && montoTotal > 0;
      return state.carrito.length > 0;
    }
    if (step === 3) {
      if (!state.fechaPrimerPago) return false;
      if (state.numeroCuotas < 1) return false;
      return montoTotal > 0;
    }
    return true;
  }, [step, state, montoTotal]);

  const next = () => { if (!canNext()) { setErr('Completa los campos requeridos'); return; } setErr(''); setStep(s => (s + 1) as WizardStep); };
  const back = () => { setErr(''); setStep(s => (s - 1) as WizardStep); };

  const handleSubmit = async () => {
    setLoading(true); setErr('');
    try {
      const nombre = state.cliente!.nombre
        ? `${state.cliente!.nombre}${(state.cliente as any).apellido ? ' ' + (state.cliente as any).apellido : ''}`.trim()
        : `${state.cliente?.firstName || ''} ${state.cliente?.lastName || ''}`.trim();
      await deudoresService.create({
        cliente_id: state.cliente!.id ? parseInt(String(state.cliente!.id)) : null,
        cliente_nombre: nombre,
        cliente_telefono: state.cliente!.telefono || (state.cliente as any).phone,
        descripcion: state.tipoOrigen === 'MANUAL' ? state.descripcion : undefined,
        monto_total: montoTotal,
        tipo_origen: state.tipoOrigen,
        numero_cuotas: state.numeroCuotas,
        frecuencia_pago: state.frecuenciaPago,
        fecha_primer_pago: state.fechaPrimerPago || undefined,
        fecha_vencimiento: state.fechaVencimiento || undefined,
        items_detalle: state.tipoOrigen === 'VENTA' && state.carrito.length > 0 ? state.carrito : null,
        referencia_reparacion_id: state.reparacion?.id,
        notas: state.notas || undefined,
        created_by: user?.username || user?.nombre || 'Sistema',
      });
      onCreated(); onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.response?.data?.message || 'Error al crear el crédito');
      setLoading(false);
    }
  };

  const STEPS = ['Cliente', 'Origen', 'Plan de pagos', 'Resumen'];
  const btnBase = "w-full border border-slate-200 dark:border-[rgba(72,185,230,0.16)] rounded-xl py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#0A1220]";
  const btnPrimary = "flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-[#48B9E6] to-[#2196c4] hover:from-[#3aace0] hover:to-[#1a84b0] disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold shadow-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-[#0D1526] rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[rgba(72,185,230,0.16)] shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-[#F8FAFC]">Nuevo crédito interno</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Paso {step} de 4 — {STEPS[step - 1]}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#0A1220] text-slate-500"><X size={18} /></button>
        </div>
        <div className="h-1 bg-slate-100 dark:bg-[#0A1220] shrink-0">
          <div className="h-full bg-[#48B9E6] transition-all duration-300" style={{ width: `${(step / 4) * 100}%` }} />
        </div>
        <div className="flex px-6 py-3 gap-2 shrink-0">
          {STEPS.map((label, i) => (
            <div key={i} className={`flex items-center gap-1.5 flex-1 ${i < step - 1 ? 'text-[#48B9E6]' : i === step - 1 ? 'text-slate-800 dark:text-[#F8FAFC]' : 'text-slate-300 dark:text-slate-600'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                i < step - 1 ? 'bg-[#48B9E6] text-white' : i === step - 1 ? 'bg-slate-800 dark:bg-[#48B9E6] text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
              }`}>
                {i < step - 1 ? <CheckCircle size={12} /> : i + 1}
              </div>
              <span className="text-[10px] font-semibold hidden sm:block truncate">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {err && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-xl px-3 py-2 mb-4">{err}</p>}
          {step === 1 && <Step1 state={state} setState={setState} />}
          {step === 2 && <Step2 state={state} setState={setState} />}
          {step === 3 && <Step3 state={state} setState={setState} montoTotal={montoTotal} />}
          {step === 4 && <Step4 state={state} montoTotal={montoTotal} />}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-[rgba(72,185,230,0.16)] shrink-0">
          {step > 1
            ? <button onClick={back} className="flex items-center gap-1.5 border border-slate-200 dark:border-[rgba(72,185,230,0.16)] rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#0A1220]"><ArrowLeft size={15} /> Atrás</button>
            : <button onClick={onClose} className={btnBase}>Cancelar</button>
          }
          {step < 4
            ? <button onClick={next} className={btnPrimary}>Siguiente <ArrowRight size={15} /></button>
            : <button onClick={handleSubmit} disabled={loading} className={btnPrimary}>{loading ? 'Guardando...' : <><CheckCircle size={15} /> Crear crédito</>}</button>
          }
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL PAGO
// ─────────────────────────────────────────────────────────────────────────────
const RECARGO_PCT: Record<string, number> = {
  EFECTIVO: 0, TRANSFERENCIA: 0,
  TARJETA_BAC: 3, TARJETA_NEONET: 3, TARJETA_OTRA: 3.5,
};

function ModalPago({ deudor, onClose, onPaid }: { deudor: Deudor; onClose: () => void; onPaid: () => void }) {
  const { user } = useAuth();
  const defaultMonto = (() => {
    const cuota = toNum(deudor.monto_cuota);
    const saldo = toNum(deudor.saldo_pendiente);
    // Use cuota amount if this is a multi-cuota credit and cuota <= saldo
    if (deudor.numero_cuotas && deudor.numero_cuotas > 1 && cuota > 0 && cuota <= saldo)
      return cuota.toFixed(2);
    return saldo.toFixed(2);
  })();
  const [monto, setMonto] = useState(defaultMonto);
  const [metodo, setMetodo] = useState('EFECTIVO');
  const [pctInput, setPctInput] = useState(String(RECARGO_PCT['EFECTIVO'] ?? 0));
  const [referencia, setReferencia] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [cuentaBancariaId, setCuentaBancariaId] = useState('');
  const [cuentasBancarias, setCuentasBancarias] = useState<Array<{ id: number; nombre: string; numero_cuenta?: string; tipo_cuenta?: string; activa: boolean }>>([]);

  useEffect(() => {
    deudoresService.getCuentasBancarias().then(data => setCuentasBancarias(data)).catch(() => {});
  }, []);

  const handleMetodoChange = (m: string) => {
    setMetodo(m);
    setReferencia('');
    setCuentaBancariaId('');
    setPctInput(String(RECARGO_PCT[m] ?? 0));
  };

  const montoBase   = parseFloat(monto) || 0;
  const pctRecargo  = Math.max(0, parseFloat(pctInput) || 0);
  const montoRecargo = parseFloat((montoBase * pctRecargo / 100).toFixed(2));
  const totalCobrado = parseFloat((montoBase + montoRecargo).toFixed(2));
  const saldoDespues = Math.max(0, toNum(deudor.saldo_pendiente) - montoBase);
  const hasRecargo  = pctRecargo > 0;
  const isTarjeta   = metodo.startsWith('TARJETA');
  const requireRef  = ['TRANSFERENCIA', 'TARJETA_BAC', 'TARJETA_NEONET', 'TARJETA_OTRA'].includes(metodo);

  const handlePagar = async () => {
    const n = parseFloat(monto);
    if (!n || n <= 0) { setErr('Ingresa un monto válido'); return; }
    if (requireRef && !referencia.trim()) { setErr('La referencia es requerida para este método de pago'); return; }
    if (metodo === 'TRANSFERENCIA' && !cuentaBancariaId) { setErr('Selecciona la cuenta bancaria destino'); return; }
    setLoading(true); setErr('');
    try {
      await deudoresService.registrarPago(deudor.id, {
        monto: n,
        metodo_pago: metodo,
        referencia: referencia || undefined,
        notas: observaciones || undefined,
        realizado_por: user?.username || user?.nombre || 'Sistema',
        porcentaje_recargo: pctRecargo,
        usuario_id: (user as any)?.id,
        cuenta_id: metodo === 'TRANSFERENCIA' && cuentaBancariaId ? Number(cuentaBancariaId) : undefined,
      });
      onPaid(); onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Error al registrar el pago');
    } finally { setLoading(false); }
  };

  const inputCls = "w-full border border-slate-200 dark:border-[rgba(72,185,230,0.16)] rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#0A1220] text-slate-800 dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-slate-400 dark:placeholder:text-slate-500";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-[#0D1526] rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[rgba(72,185,230,0.16)] shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-[#F8FAFC]">Registrar pago</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">{deudor.numero_credito}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#0A1220] text-slate-500"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {err && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/30 rounded-xl px-3 py-2">{err}</p>}

          {/* Cliente info */}
          <div className="bg-slate-50 dark:bg-[#0A1220] rounded-xl p-3 text-sm">
            <p className="font-semibold text-slate-800 dark:text-[#F8FAFC]">{deudor.cliente_nombre}</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-slate-500 dark:text-slate-400 text-xs">Saldo pendiente</span>
              <span className="font-bold text-red-600 dark:text-red-400">{fmt(deudor.saldo_pendiente)}</span>
            </div>
            {deudor.numero_cuotas && deudor.numero_cuotas > 1 && (
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-slate-400 dark:text-slate-500 text-xs">Cuota programada</span>
                <span className="text-xs font-medium text-[#48B9E6]">{fmt(deudor.monto_cuota || 0)} · {deudor.frecuencia_pago?.toLowerCase()}</span>
              </div>
            )}
          </div>

          {/* Monto */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Monto a abonar (Q)</label>
              {deudor.numero_cuotas && deudor.numero_cuotas > 1 && deudor.monto_cuota && (
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                  <span>Cuota: <strong className="text-[#48B9E6]">{fmt(deudor.monto_cuota)}</strong></span>
                  <button type="button"
                    onClick={() => setMonto(toNum(deudor.saldo_pendiente).toFixed(2))}
                    className="text-[10px] px-1.5 py-0.5 rounded-lg bg-slate-100 dark:bg-[#060B14] hover:bg-[#48B9E6]/10 hover:text-[#48B9E6] transition-colors">
                    Saldo completo
                  </button>
                </div>
              )}
            </div>
            <input type="number" min="0.01" step="0.01" className={inputCls} value={monto} onChange={e => setMonto(e.target.value)} autoFocus />
          </div>

          {/* Método */}
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">Método de pago</label>
            <select className={inputCls} value={metodo} onChange={e => handleMetodoChange(e.target.value)}>
              <option value="EFECTIVO">💵 Efectivo</option>
              <option value="TRANSFERENCIA">🏦 Transferencia bancaria</option>
              <option value="TARJETA_BAC">💳 Tarjeta BAC</option>
              <option value="TARJETA_NEONET">💳 Tarjeta Neonet</option>
              <option value="TARJETA_OTRA">💳 Tarjeta otra</option>
            </select>
          </div>

          {/* % Recargo tarjeta — editable */}
          {isTarjeta && (
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">% Recargo por tarjeta</label>
              <div className="relative">
                <input
                  type="number" min="0" max="99" step="0.1"
                  className={inputCls + ' pr-8'}
                  value={pctInput}
                  onChange={e => setPctInput(e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400 dark:text-slate-500">%</span>
              </div>
            </div>
          )}

          {/* Cuenta bancaria (solo transferencia) */}
          {metodo === 'TRANSFERENCIA' && (
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">
                Cuenta bancaria destino <span className="text-red-500">*</span>
              </label>
              <select
                className={inputCls}
                value={cuentaBancariaId}
                onChange={e => setCuentaBancariaId(e.target.value)}
              >
                <option value="">-- Selecciona una cuenta --</option>
                {cuentasBancarias.map(c => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nombre}{c.tipo_cuenta ? ` — ${c.tipo_cuenta}` : ''}{c.numero_cuenta ? ` (${c.numero_cuenta})` : ''}
                  </option>
                ))}
              </select>
              {cuentasBancarias.length === 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">No hay cuentas bancarias activas registradas.</p>
              )}
            </div>
          )}

          {/* Referencia */}
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">
              Referencia / No. autorización{requireRef && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input className={inputCls} placeholder={requireRef ? 'Requerida para este método' : 'Opcional'} value={referencia} onChange={e => setReferencia(e.target.value)} />
          </div>

          {/* Recargo breakdown */}
          {hasRecargo && montoBase > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-xs text-amber-700 dark:text-amber-300">Monto base</span>
                <span className="font-medium text-amber-700 dark:text-amber-300">{fmt(montoBase)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-xs text-amber-700 dark:text-amber-300">Recargo {pctInput}%</span>
                <span className="font-medium text-amber-600 dark:text-amber-400">+ {fmt(montoRecargo)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-amber-200 dark:border-amber-800/30 pt-1.5">
                <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">Total a cobrar</span>
                <span className="font-bold text-amber-900 dark:text-amber-200 text-base">{fmt(totalCobrado)}</span>
              </div>
            </div>
          )}

          {/* Saldo después */}
          {montoBase > 0 && (
            <div className="flex justify-between items-center text-sm px-1">
              <span className="text-slate-500 dark:text-slate-400 text-xs">Saldo después del pago</span>
              <span className={`font-bold ${saldoDespues <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
                {saldoDespues <= 0 ? '✓ Saldado' : fmt(saldoDespues)}
              </span>
            </div>
          )}

          {/* Observaciones */}
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">Observaciones</label>
            <textarea rows={2} className={`${inputCls} resize-none`} placeholder="Notas del pago (opcional)" value={observaciones} onChange={e => setObservaciones(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-[rgba(72,185,230,0.16)] shrink-0">
          <button onClick={onClose} className="flex-1 border border-slate-200 dark:border-[rgba(72,185,230,0.16)] rounded-xl py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#0A1220]">Cancelar</button>
          <button onClick={handlePagar} disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold">
            {loading ? 'Registrando...' : `Registrar ${hasRecargo && montoBase > 0 ? fmt(totalCobrado) : fmt(montoBase)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL ANULAR
// ─────────────────────────────────────────────────────────────────────────────
function ModalAnular({ deudor, onClose, onAnulado }: { deudor: Deudor; onClose: () => void; onAnulado: () => void }) {
  const { user } = useAuth();
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const hasItems = (() => {
    try { return deudor.items_detalle ? JSON.parse(deudor.items_detalle).length > 0 : false; } catch { return false; }
  })();
  const hasPagos = toNum(deudor.monto_pagado) > 0;

  const handleAnularConfirm = async () => {
    if (!motivo.trim()) { setErr('El motivo de anulación es requerido'); return; }
    setLoading(true); setErr('');
    try {
      await deudoresService.anular(deudor.id, motivo.trim(), (user as any)?.id);
      onAnulado(); onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Error al anular el crédito');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white dark:bg-[#0D1526] rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[rgba(72,185,230,0.16)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center shrink-0">
              <Ban size={15} className="text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-[#F8FAFC]">Anular crédito</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#0A1220] text-slate-500"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {err && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/30 rounded-xl px-3 py-2">{err}</p>}

          <div className="bg-slate-50 dark:bg-[#0A1220] rounded-xl p-3 text-sm">
            <p className="font-semibold text-slate-800 dark:text-[#F8FAFC]">{deudor.cliente_nombre}</p>
            <div className="flex justify-between mt-1">
              <span className="font-mono text-xs text-slate-400 dark:text-slate-500">{deudor.numero_credito}</span>
              <span className="text-xs font-medium text-red-600 dark:text-red-400">Saldo: {fmt(deudor.saldo_pendiente)}</span>
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded-xl p-3 space-y-1.5">
            <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">⚠ Esta acción es irreversible</p>
            <ul className="text-xs text-red-600 dark:text-red-300 space-y-1 pl-3 list-disc">
              <li>El crédito quedará marcado como <strong>ANULADO</strong></li>
              {hasItems && <li>El stock de los productos será restituido</li>}
              {hasPagos && <li>Los pagos de <strong>{fmt(deudor.monto_pagado)}</strong> generarán reversas en caja/banco</li>}
            </ul>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">
              Motivo de anulación <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              className="w-full border border-slate-200 dark:border-[rgba(72,185,230,0.16)] rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#0A1220] text-slate-800 dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-red-400 resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              placeholder="Describe el motivo de la anulación..."
              value={motivo}
              onChange={e => setMotivo(e.target.value.slice(0, 500))}
              autoFocus
            />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 text-right">{motivo.length}/500</p>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onClose} className="flex-1 border border-slate-200 dark:border-[rgba(72,185,230,0.16)] rounded-xl py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#0A1220]">Cancelar</button>
          <button onClick={handleAnularConfirm} disabled={loading || !motivo.trim()} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold">
            {loading ? 'Anulando...' : 'Confirmar anulación'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL DETALLE
// ─────────────────────────────────────────────────────────────────────────────
function ModalDetalle({ initial, onClose, onAction }: { initial: Deudor; onClose: () => void; onAction: () => void }) {
  const [deudor, setDeudor] = useState<Deudor>(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    deudoresService.getById(initial.id).then(d => setDeudor(d)).catch(() => {}).finally(() => setLoading(false));
  }, [initial.id]);

  const porcentaje = toNum(deudor.monto_total) > 0 ? Math.min(100, (toNum(deudor.monto_pagado) / toNum(deudor.monto_total)) * 100) : 0;
  let itemsDetalle: ItemCarritoVenta[] | null = null;
  try { if (deudor.items_detalle) itemsDetalle = JSON.parse(deudor.items_detalle); } catch {}
  const cuotasPlan = deudor.numero_cuotas && deudor.numero_cuotas > 1 && deudor.fecha_primer_pago
    ? calcCuotas(toNum(deudor.monto_total), deudor.numero_cuotas, deudor.frecuencia_pago || 'MENSUAL', deudor.fecha_primer_pago) : null;
  const pagosReales = (deudor.pagos || []).filter(p => p.fecha_pago && toNum(p.monto) > 0);

  // onAction is available for future use (e.g. refresh after action from detail)
  void onAction;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-[#0D1526] rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[rgba(72,185,230,0.16)] shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-[#F8FAFC] font-mono">{deudor.numero_credito}</h2>
            {deudor.tipo_origen && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${TIPO_BADGE[deudor.tipo_origen]}`}>{TIPO_LABEL[deudor.tipo_origen]}</span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#0A1220] text-slate-500"><X size={18} /></button>
        </div>
        {loading ? (
          <div className="p-10 text-center text-slate-400 dark:text-slate-500">Cargando...</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="bg-slate-50 dark:bg-[#0A1220] rounded-xl p-4">
              <p className="font-semibold text-slate-800 dark:text-[#F8FAFC]">{deudor.cliente_nombre}</p>
              {deudor.cliente_telefono && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">📞 {deudor.cliente_telefono}</p>}
              {deudor.descripcion && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{deudor.descripcion}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-50 dark:bg-[#0A1220] rounded-xl p-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total</p>
                <p className="font-bold text-slate-800 dark:text-[#F8FAFC] mt-1">{fmt(deudor.monto_total)}</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-3">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Pagado</p>
                <p className="font-bold text-emerald-700 dark:text-emerald-300 mt-1">{fmt(deudor.monto_pagado)}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-3">
                <p className="text-xs text-red-500 dark:text-red-400 uppercase tracking-wide">Pendiente</p>
                <p className="font-bold text-red-600 dark:text-red-400 mt-1">{fmt(deudor.saldo_pendiente)}</p>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span>Progreso de pago</span><span>{porcentaje.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${porcentaje}%` }} />
              </div>
            </div>
            {deudor.numero_cuotas && deudor.numero_cuotas > 1 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Calendar size={12} /> Plan de pagos · {deudor.frecuencia_pago?.toLowerCase()}
                </p>
                <div className="border border-slate-200 dark:border-[rgba(72,185,230,0.16)] rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                  <div className="flex bg-slate-50 dark:bg-[#060B14] px-3 py-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-b border-slate-100 dark:border-[rgba(72,185,230,0.08)]">
                    <span className="w-8">N°</span><span className="flex-1">Fecha</span><span>Monto</span>
                  </div>
                  {(cuotasPlan || []).map(c => (
                    <div key={c.numero} className="flex items-center px-3 py-1.5 text-sm border-b last:border-b-0 border-slate-100 dark:border-[rgba(72,185,230,0.08)]">
                      <span className="w-8 text-slate-400 text-xs">#{c.numero}</span>
                      <span className="flex-1 text-slate-600 dark:text-slate-300 text-xs">{isNaN(c.fecha.getTime()) ? '—' : c.fecha.toLocaleDateString('es-GT')}</span>
                      <span className="text-xs font-semibold text-[#48B9E6]">{fmt(c.monto)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {itemsDetalle && itemsDetalle.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1"><ShoppingCart size={12} /> Productos incluidos</p>
                <div className="border border-slate-200 dark:border-[rgba(72,185,230,0.16)] rounded-xl overflow-hidden">
                  {itemsDetalle.map((i, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-2 text-sm border-b last:border-b-0 border-slate-100 dark:border-[rgba(72,185,230,0.08)]">
                      <span className="text-slate-700 dark:text-slate-300">{i.nombre} <span className="text-slate-400 text-xs">×{i.cantidad}</span></span>
                      <span className="font-semibold text-[#48B9E6]">{fmt(i.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {pagosReales.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Historial de pagos</p>
                <div className="space-y-2">
                  {pagosReales.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-sm bg-slate-50 dark:bg-[#0A1220] rounded-xl px-3 py-2">
                      <div>
                        <span className="font-medium text-slate-800 dark:text-[#F8FAFC]">{fmt(p.monto)}</span>
                        <span className="text-slate-400 dark:text-slate-500 ml-2">— {p.metodo_pago}</span>
                        {p.referencia && <span className="text-slate-400 dark:text-slate-500 ml-1">#{p.referencia}</span>}
                      </div>
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {fmtDate(p.fecha_pago)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {deudor.notas && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">Notas</p>
                <p className="text-sm text-amber-800 dark:text-amber-300 whitespace-pre-line">{deudor.notas}</p>
              </div>
            )}
            {deudor.estado === 'ANULADO' && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded-xl p-3 space-y-1">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide flex items-center gap-1">
                  <Ban size={11} /> Crédito anulado
                </p>
                {deudor.motivo_anulacion && (
                  <p className="text-sm text-red-800 dark:text-red-300 whitespace-pre-line">{deudor.motivo_anulacion}</p>
                )}
                {deudor.fecha_anulacion && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                    Anulado el {fmtDate(deudor.fecha_anulacion)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-[rgba(72,185,230,0.16)] shrink-0">
          <button onClick={onClose} className="w-full border border-slate-200 dark:border-[rgba(72,185,230,0.16)] rounded-xl py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#0A1220]">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function DeudoresPage() {
  const [deudores, setDeudores] = useState<Deudor[]>([]);
  const [resumen, setResumen] = useState<DeudoresResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [showNuevo, setShowNuevo] = useState(false);
  const [pagoTarget, setPagoTarget] = useState<Deudor | null>(null);
  const [detalleTarget, setDetalleTarget] = useState<Deudor | null>(null);
  const [anularTarget, setAnularTarget] = useState<Deudor | null>(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [data, stats] = await Promise.all([
        deudoresService.getAll({ estado: filtroEstado || undefined, search: search || undefined, tipo_origen: filtroTipo || undefined }),
        deudoresService.getResumen(),
      ]);
      setDeudores(data); setResumen(stats);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error al cargar datos');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filtroEstado, filtroTipo]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); load(); };

  const isVencido = (d: Deudor) =>
    !!d.fecha_vencimiento && d.estado !== 'PAGADO' && d.estado !== 'ANULADO' && new Date(d.fecha_vencimiento) < new Date();

  const selectCls = "appearance-none border border-slate-200 dark:border-[rgba(72,185,230,0.16)] rounded-xl px-3 py-2 pr-7 text-sm bg-white dark:bg-[#0A1220] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#48B9E6]";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#14324A] dark:text-[#F8FAFC]">Deudores / Crédito interno</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Control de créditos y cuentas por cobrar</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 border border-slate-200 dark:border-[rgba(72,185,230,0.16)] rounded-xl px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#0A1220]">
            <RefreshCw size={15} /> Actualizar
          </button>
          <button onClick={() => setShowNuevo(true)} className="flex items-center gap-1.5 bg-gradient-to-r from-[#48B9E6] to-[#2196c4] hover:from-[#3aace0] hover:to-[#1a84b0] text-white rounded-xl px-4 py-2 text-sm font-semibold shadow-sm">
            <Plus size={16} /> Nuevo crédito
          </button>
        </div>
      </div>

      {resumen && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-[#0D1526] rounded-2xl border border-slate-200 dark:border-[rgba(72,185,230,0.16)] shadow-sm p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total pendiente</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{fmt(resumen.total_pendiente)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{resumen.pendientes + resumen.parciales} activos</p>
          </div>
          <div className="bg-white dark:bg-[#0D1526] rounded-2xl border border-slate-200 dark:border-[rgba(72,185,230,0.16)] shadow-sm p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total cobrado</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{fmt(resumen.total_cobrado)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{resumen.pagados} pagados</p>
          </div>
          <div className="bg-white dark:bg-[#0D1526] rounded-2xl border border-amber-200 dark:border-amber-800/30 shadow-sm p-4">
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">Pendientes</p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{resumen.pendientes}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Sin abonos</p>
          </div>
          <div className="bg-white dark:bg-[#0D1526] rounded-2xl border border-blue-200 dark:border-blue-800/30 shadow-sm p-4">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Parciales</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{resumen.parciales}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Con abonos</p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#0D1526] rounded-2xl border border-slate-200 dark:border-[rgba(72,185,230,0.16)] shadow-sm p-4 flex flex-col sm:flex-row gap-3 flex-wrap">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-[rgba(72,185,230,0.16)] rounded-xl text-sm bg-white dark:bg-[#0A1220] text-slate-800 dark:text-[#F8FAFC] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#48B9E6]"
              placeholder="Buscar cliente, número..." value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button type="submit" className="bg-[#48B9E6] hover:bg-[#3aace0] text-white rounded-xl px-4 py-2 text-sm font-medium shrink-0">Buscar</button>
        </form>
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <select className={selectCls} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="PARCIAL">Parciales</option>
              <option value="PAGADO">Pagados</option>
              <option value="ANULADO">Anulados</option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select className={selectCls} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
              <option value="">Todos los tipos</option>
              <option value="VENTA">Venta</option>
              <option value="REPARACION">Reparación</option>
              <option value="MANUAL">Manual</option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0D1526] rounded-2xl border border-slate-200 dark:border-[rgba(72,185,230,0.16)] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400 dark:text-slate-500 animate-pulse">Cargando...</div>
        ) : error ? (
          <div className="p-10 text-center flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400">
            <AlertCircle size={36} className="text-red-400" />
            <p>{error}</p>
            <button onClick={load} className="text-[#48B9E6] underline text-sm">Reintentar</button>
          </div>
        ) : deudores.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">
            <TrendingDown size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay créditos registrados</p>
            <p className="text-sm mt-1">Crea el primero con el botón "Nuevo crédito"</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm hidden md:table">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[rgba(72,185,230,0.1)] bg-slate-50 dark:bg-[#0A1220]">
                  {['N° Crédito','Cliente','Tipo','Total','Pendiente','Cuotas','Estado','Vence','Acciones'].map(h => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide ${h === 'Cliente' || h === 'N° Crédito' ? 'text-left' : 'text-center'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[rgba(72,185,230,0.08)]">
                {deudores.map(d => {
                  const vencido = isVencido(d);
                  const estadoKey = vencido ? 'VENCIDO' : d.estado;
                  return (
                    <tr key={d.id} className={`hover:bg-slate-50 dark:hover:bg-[#0A1220]/60 transition-colors ${vencido ? 'bg-red-50/40 dark:bg-red-950/10' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{d.numero_credito}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 dark:text-[#F8FAFC]">{d.cliente_nombre}</p>
                        {d.cliente_telefono && <p className="text-xs text-slate-400 dark:text-slate-500">{d.cliente_telefono}</p>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {d.tipo_origen ? <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${TIPO_BADGE[d.tipo_origen]}`}>{TIPO_LABEL[d.tipo_origen]}</span> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-200">{fmt(d.monto_total)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600 dark:text-red-400">{fmt(d.saldo_pendiente)}</td>
                      <td className="px-4 py-3 text-center text-xs">
                        {d.numero_cuotas && d.numero_cuotas > 1
                          ? <span className="font-semibold text-[#48B9E6]">{d.numero_cuotas}×</span>
                          : <span className="text-slate-300 dark:text-slate-600">1×</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${ESTADO_BADGE[estadoKey] || ESTADO_BADGE.PENDIENTE}`}>{estadoKey}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400">
                        {d.fecha_vencimiento ? <span className={vencido ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>{fmtDate(d.fecha_vencimiento)}{vencido && ' ⚠'}</span> : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button title="Ver detalle" onClick={() => setDetalleTarget(d)} className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400"><Eye size={14} /></button>
                          {(d.estado === 'PENDIENTE' || d.estado === 'PARCIAL') && (
                            <button title="Registrar pago" onClick={() => setPagoTarget(d)} className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400"><CreditCard size={14} /></button>
                          )}
                          {d.estado !== 'ANULADO' && (
                            <button title="Anular" onClick={() => setAnularTarget(d)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 dark:text-red-400"><Ban size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="md:hidden divide-y divide-slate-100 dark:divide-[rgba(72,185,230,0.08)]">
              {deudores.map(d => {
                const vencido = isVencido(d);
                const estadoKey = vencido ? 'VENCIDO' : d.estado;
                return (
                  <div key={d.id} className={`p-4 ${vencido ? 'bg-red-50/40 dark:bg-red-950/10' : ''}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-[#F8FAFC]">{d.cliente_nombre}</p>
                        <p className="font-mono text-xs text-slate-400 dark:text-slate-500">{d.numero_credito}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {d.tipo_origen && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${TIPO_BADGE[d.tipo_origen]}`}>{TIPO_LABEL[d.tipo_origen]}</span>}
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ESTADO_BADGE[estadoKey] || ESTADO_BADGE.PENDIENTE}`}>{estadoKey}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                      <div className="bg-slate-50 dark:bg-[#0A1220] rounded-lg p-1.5">
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">Total</p>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{fmt(d.monto_total)}</p>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-1.5">
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Pagado</p>
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{fmt(d.monto_pagado)}</p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-1.5">
                        <p className="text-[10px] text-red-500 dark:text-red-400">Pendiente</p>
                        <p className="text-xs font-semibold text-red-600 dark:text-red-400">{fmt(d.saldo_pendiente)}</p>
                      </div>
                    </div>
                    {d.fecha_vencimiento && (
                      <p className={`text-xs mb-2 ${vencido ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-slate-400 dark:text-slate-500'}`}>
                        <Calendar size={11} className="inline mr-1" />Vence: {fmtDate(d.fecha_vencimiento)}
                        {d.numero_cuotas && d.numero_cuotas > 1 && ` · ${d.numero_cuotas} cuotas`}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => setDetalleTarget(d)} className="flex-1 flex items-center justify-center gap-1 border border-slate-200 dark:border-[rgba(72,185,230,0.16)] rounded-xl py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#0A1220]"><Eye size={12} /> Detalle</button>
                      {(d.estado === 'PENDIENTE' || d.estado === 'PARCIAL') && (
                        <button onClick={() => setPagoTarget(d)} className="flex-1 flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 rounded-xl py-1.5 text-xs font-medium text-white"><CreditCard size={12} /> Pagar</button>
                      )}
                      {d.estado !== 'ANULADO' && (
                        <button onClick={() => setAnularTarget(d)} className="p-1.5 rounded-xl border border-red-200 dark:border-red-800/30 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 dark:text-red-400"><Ban size={14} /></button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showNuevo && <WizardNuevoCredito onClose={() => setShowNuevo(false)} onCreated={load} />}
      {pagoTarget && <ModalPago deudor={pagoTarget} onClose={() => setPagoTarget(null)} onPaid={load} />}
      {detalleTarget && <ModalDetalle initial={detalleTarget} onClose={() => setDetalleTarget(null)} onAction={load} />}
      {anularTarget && <ModalAnular deudor={anularTarget} onClose={() => setAnularTarget(null)} onAnulado={load} />}
    </div>
  );
}
