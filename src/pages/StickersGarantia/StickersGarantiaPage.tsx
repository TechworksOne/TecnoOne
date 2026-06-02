import { useState, useEffect, useRef } from 'react';
import {
  Tag, Search, Package, CheckCircle, Calendar, RefreshCw,
  Hash, Wrench, Layers, Plus, Ban, Printer, List, ChevronDown, Filter,
} from 'lucide-react';
import * as stickerService from '../../services/stickerGarantiaService';
import type { StickerGarantia, StickerLote } from '../../services/stickerGarantiaService';
import GenerarLoteModal from './GenerarLoteModal';

// ─── StatCard ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string; value: number | string; description: string;
  icon: React.ReactNode; iconBg: string; iconColor: string;
}
function StatCard({ label, value, description, icon, iconBg, iconColor }: StatCardProps) {
  return (
    <div className="rounded-2xl border p-5 flex flex-col gap-3"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-1">{label}</p>
          <p className="text-4xl font-extrabold text-[var(--color-text)] leading-none">{value}</p>
        </div>
        <div className={`p-3 rounded-xl shrink-0 ${iconBg}`}>
          <span className={iconColor}>{icon}</span>
        </div>
      </div>
      <p className="text-xs text-[var(--color-text-sec)]">{description}</p>
    </div>
  );
}

// ─── EstadoBadge ──────────────────────────────────────────────────────────────

const ESTADO_CLS: Record<string, string> = {
  DISPONIBLE: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/40',
  ASIGNADO:   'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-700/40',
  ANULADO:    'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700/40',
  USADO:      'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/40',
};
function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${ESTADO_CLS[estado] ?? ESTADO_CLS.USADO}`}>
      {estado}
    </span>
  );
}

// ─── Print helper ─────────────────────────────────────────────────────────────

function imprimirStickers(stickers: StickerGarantia[]) {
  const fecha = new Date().toLocaleDateString('es-GT');
  const rows = stickers.map((s) => `
    <div class="stk">
      <div class="stk-header">TecnoCell</div>
      <div class="stk-code">${s.numero_sticker}</div>
      ${s.dias_garantia ? `<div class="stk-meta">Garantía: ${s.dias_garantia} días</div>` : ''}
      ${s.tipo_garantia ? `<div class="stk-meta">${s.tipo_garantia}</div>` : ''}
      <div class="stk-footer">Garantía válida según condiciones</div>
      <div class="stk-date">${fecha}</div>
    </div>`).join('');
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Stickers</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;background:#fff}
      .title{padding:10px 16px;font-size:13px;color:#555;border-bottom:1px solid #ddd}
      .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:12px}
      .stk{border:1.5px solid #222;border-radius:6px;padding:8px;text-align:center;display:flex;flex-direction:column;gap:3px;min-height:90px}
      .stk-header{font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase}
      .stk-code{font-size:13px;font-weight:900;font-family:'Courier New',monospace;margin:2px 0}
      .stk-meta{font-size:8px;color:#555}
      .stk-footer{font-size:7px;color:#888;margin-top:auto}
      .stk-date{font-size:7px;color:#aaa}
      @media print{.title{display:none}@page{margin:8mm}.stk{break-inside:avoid}}
    </style></head><body>
    <div class="title">TecnoCell — ${stickers.length} sticker${stickers.length!==1?'s':''} — ${fecha}</div>
    <div class="grid">${rows}</div>
    <script>window.onload=function(){window.print()}<\/script>
  </body></html>`);
  w.document.close();
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Vista = 'disponibles' | 'asignados' | 'lotes' | 'todos';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StickersGarantiaPage() {
  const [vista, setVista]               = useState<Vista>('disponibles');
  const [stickers, setStickers]         = useState<StickerGarantia[]>([]);
  const [lotes, setLotes]               = useState<StickerLote[]>([]);
  const [stats, setStats]               = useState({ total: 0, disponibles: 0, asignados: 0, usados: 0 });
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroLote, setFiltroLote]     = useState<number | ''>('');
  const [selected, setSelected]         = useState<Set<number>>(new Set());
  const [showLote, setShowLote]         = useState(false);
  const [anulando, setAnulando]         = useState(false);
  const [toast, setToast]               = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const toastTimer                      = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [statsData, stickersData, lotesData] = await Promise.all([
        stickerService.getEstadisticas(),
        stickerService.getStickers(),
        stickerService.getLotes(),
      ]);
      setStats(statsData as any);
      setStickers(stickersData);
      setLotes(lotesData);
    } catch { /* non-critical */ } finally { setLoading(false); }
  };

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const toggleSelect = (id: number) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectAll = (list: StickerGarantia[]) =>
    setSelected(list.length > 0 && list.every((r) => selected.has(r.id)) ? new Set() : new Set(list.map((s) => s.id)));

  const handleAnular = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`¿Anular ${selected.size} sticker${selected.size !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`)) return;
    setAnulando(true);
    let ok = 0, fail = 0;
    for (const id of selected) {
      try { await stickerService.anularSticker(id); ok++; } catch { fail++; }
    }
    setSelected(new Set());
    await loadAll();
    setAnulando(false);
    showToast(fail === 0 ? `${ok} sticker${ok!==1?'s':''} anulado${ok!==1?'s':''}` : `${ok} anulados, ${fail} fallaron`, fail===0?'ok':'err');
  };

  const handlePrint = () => {
    const list = selected.size > 0 ? stickers.filter((s) => selected.has(s.id)) : currentList;
    if (!list.length) { showToast('No hay stickers para imprimir', 'err'); return; }
    imprimirStickers(list);
  };

  // ── filtros ───────────────────────────────────────────────────────────────

  const currentList: StickerGarantia[] = stickers.filter((s) => {
    const term = search.toLowerCase();
    const matchSearch = !term || s.numero_sticker.toLowerCase().includes(term) || (s.codigo_lote ?? '').toLowerCase().includes(term);
    const matchEstado = !filtroEstado || s.estado === filtroEstado;
    const matchLote   = !filtroLote   || s.lote_id === Number(filtroLote);
    return matchSearch && matchEstado && matchLote;
  });

  const disponibles = currentList.filter((s) => s.estado === 'DISPONIBLE');
  const asignados   = currentList.filter((s) => s.estado === 'ASIGNADO' || s.estado === 'USADO');

  const tabBtn = (active: boolean) =>
    `flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
      active ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-[var(--color-text-sec)] hover:text-[var(--color-text)] hover:bg-[var(--color-row-hover)]'
    }`;

  const TABS: { key: Vista; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'disponibles', label: 'Disponibles', icon: <Package size={14} />,     count: stats.disponibles },
    { key: 'asignados',   label: 'Asignados',   icon: <CheckCircle size={14} />, count: stats.asignados  },
    { key: 'lotes',       label: 'Lotes',       icon: <Layers size={14} />,      count: lotes.length     },
    { key: 'todos',       label: 'Todos',       icon: <List size={14} />,        count: stats.total      },
  ];

  const visibleList = vista === 'disponibles' ? disponibles : vista === 'asignados' ? asignados : currentList;

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold transition-all ${toast.type==='ok'?'bg-emerald-600':'bg-red-600'} text-white`}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Stickers de Garantía</h1>
          <p className="text-sm text-[var(--color-text-sec)] mt-0.5">Control y generación por lote de stickers de garantía</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.size > 0 && (
            <>
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors hover:bg-[var(--color-row-hover)]"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                <Printer size={14} /> Imprimir ({selected.size})
              </button>
              <button onClick={handleAnular} disabled={anulando}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-60">
                <Ban size={14} /> Anular ({selected.size})
              </button>
            </>
          )}
          {selected.size === 0 && vista !== 'lotes' && (
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors hover:bg-[var(--color-row-hover)]"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-sec)' }}>
              <Printer size={13} /> Imprimir vista
            </button>
          )}
          <button onClick={loadAll} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors hover:bg-[var(--color-row-hover)] disabled:opacity-50"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-sec)' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
          <button onClick={() => setShowLote(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all hover:opacity-90"
            style={{ background: 'var(--color-primary)', color: '#fff' }}>
            <Plus size={16} /> Generar lote
          </button>
        </div>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total" value={stats.total} description="Stickers registrados"
          icon={<Tag size={22} />} iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-500 dark:text-blue-400" />
        <StatCard label="Disponibles" value={stats.disponibles} description="Listos para asignarse"
          icon={<Package size={22} />} iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-500 dark:text-emerald-400" />
        <StatCard label="Asignados" value={stats.asignados} description="Stickers activos en garantía"
          icon={<CheckCircle size={22} />} iconBg="bg-violet-100 dark:bg-violet-900/30" iconColor="text-violet-500 dark:text-violet-400" />
        <StatCard label="Lotes" value={lotes.length} description="Lotes de stickers generados"
          icon={<Layers size={22} />} iconBg="bg-amber-100 dark:bg-amber-900/30" iconColor="text-amber-500 dark:text-amber-400" />
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1 p-1 rounded-xl border w-fit"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-soft)' }}>
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setVista(tab.key)} className={tabBtn(vista === tab.key)}>
            {tab.icon} {tab.label}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${vista === tab.key ? 'bg-white/20 text-white' : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Filtros ───────────────────────────────────────────────────────── */}
      {vista !== 'lotes' && (
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={14} />
            <input placeholder="Buscar código…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm rounded-xl border outline-none focus:ring-2 transition-colors w-56"
              style={{ background: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
          </div>
          {vista === 'todos' && (
            <>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={14} />
                <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
                  className="pl-9 pr-8 py-2 text-sm rounded-xl border outline-none appearance-none cursor-pointer"
                  style={{ background: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                  <option value="">Todos los estados</option>
                  {['DISPONIBLE','ASIGNADO','ANULADO','USADO'].map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
              </div>
              {lotes.length > 0 && (
                <div className="relative">
                  <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={14} />
                  <select value={filtroLote} onChange={(e) => setFiltroLote(e.target.value ? Number(e.target.value) : '')}
                    className="pl-9 pr-8 py-2 text-sm rounded-xl border outline-none appearance-none cursor-pointer"
                    style={{ background: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                    <option value="">Todos los lotes</option>
                    {lotes.map((l) => <option key={l.id} value={l.id}>{l.codigo_lote}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
          <p className="text-sm text-[var(--color-text-muted)]">Cargando stickers…</p>
        </div>
      )}

      {/* ── Vistas ────────────────────────────────────────────────────────── */}
      {!loading && vista !== 'lotes' && (
        <StickerTable
          rows={visibleList}
          selected={selected}
          onToggle={toggleSelect}
          onSelectAll={selectAll}
          showReparacion={vista === 'asignados' || vista === 'todos'}
          showLote={vista === 'todos'}
          emptyText={vista==='disponibles' ? 'No hay stickers disponibles' : vista==='asignados' ? 'No hay stickers asignados' : 'No se encontraron stickers'}
          emptyIcon={vista==='asignados' ? <CheckCircle size={40} /> : <Package size={40} />}
        />
      )}

      {!loading && vista === 'lotes' && (
        <LotesTable lotes={lotes} onVerLote={(id) => { setFiltroLote(id); setVista('todos'); }} />
      )}

      {/* ── Modal Generar Lote ────────────────────────────────────────────── */}
      <GenerarLoteModal
        open={showLote}
        onClose={() => setShowLote(false)}
        onSuccess={() => { setShowLote(false); loadAll(); }}
      />
    </div>
  );
}

// ─── StickerTable ─────────────────────────────────────────────────────────────

interface StickerTableProps {
  rows: StickerGarantia[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onSelectAll: (rows: StickerGarantia[]) => void;
  showReparacion?: boolean;
  showLote?: boolean;
  emptyText: string;
  emptyIcon: React.ReactNode;
}

function StickerTable({ rows, selected, onToggle, onSelectAll, showReparacion, showLote, emptyText, emptyIcon }: StickerTableProps) {
  const thCls    = 'px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]';
  const tdCls    = 'px-4 py-3 text-sm text-[var(--color-text)]';
  const tdSecCls = 'px-4 py-3 text-sm text-[var(--color-text-sec)]';
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  return (
    <>
      {/* Desktop */}
      <div className="hidden sm:block rounded-2xl border overflow-hidden"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <table className="w-full">
          <thead style={{ background: 'var(--color-surface-soft)', borderBottom: '1px solid var(--color-border)' }}>
            <tr>
              <th className="px-4 py-3 w-10">
                <input type="checkbox" checked={allChecked} onChange={() => onSelectAll(rows)}
                  className="w-4 h-4 rounded accent-[var(--color-primary)]" />
              </th>
              <th className={thCls}>Código</th>
              <th className={thCls}>Estado</th>
              {showLote && <th className={thCls}>Lote</th>}
              <th className={thCls}>Garantía</th>
              {showReparacion && <th className={thCls}>Reparación</th>}
              <th className={thCls}>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} onClick={() => onToggle(s.id)}
                className={`border-t transition-colors cursor-pointer hover:bg-[var(--color-row-hover)] ${selected.has(s.id) ? 'bg-[rgba(72,185,230,0.06)]' : ''}`}
                style={{ borderColor: 'var(--color-border)' }}>
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => onToggle(s.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded accent-[var(--color-primary)]" />
                </td>
                <td className={tdCls}>
                  <span className="font-mono font-semibold text-[var(--color-primary)]">{s.numero_sticker}</span>
                </td>
                <td className={tdCls}><EstadoBadge estado={s.estado} /></td>
                {showLote && (
                  <td className={tdSecCls}>
                    {s.codigo_lote
                      ? <span className="text-xs font-mono">{s.codigo_lote}</span>
                      : <span className="text-[var(--color-text-muted)]">—</span>}
                  </td>
                )}
                <td className={tdSecCls}>
                  {s.dias_garantia
                    ? <span className="flex items-center gap-1"><Hash size={12} className="opacity-60" />{s.dias_garantia}d</span>
                    : <span className="text-[var(--color-text-muted)]">—</span>}
                </td>
                {showReparacion && (
                  <td className={tdSecCls}>
                    {s.reparacion_id
                      ? <span className="flex items-center gap-1.5"><Wrench size={13} className="opacity-60" />{s.reparacion_id}</span>
                      : <span className="text-[var(--color-text-muted)]">—</span>}
                  </td>
                )}
                <td className={tdSecCls}>
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} className="opacity-60" />
                    {new Date(s.created_at).toLocaleDateString('es-GT')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="text-center py-14">
            <span className="flex justify-center mb-3 opacity-25 text-[var(--color-text-muted)]">{emptyIcon}</span>
            <p className="text-sm text-[var(--color-text-muted)]">{emptyText}</p>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {rows.length === 0 ? (
          <div className="text-center py-12">
            <span className="flex justify-center mb-2 opacity-25 text-[var(--color-text-muted)]">{emptyIcon}</span>
            <p className="text-sm text-[var(--color-text-muted)]">{emptyText}</p>
          </div>
        ) : rows.map((s) => (
          <div key={s.id} onClick={() => onToggle(s.id)}
            className={`rounded-xl border p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors`}
            style={{
              borderColor: selected.has(s.id) ? 'var(--color-primary)' : 'var(--color-border)',
              background: selected.has(s.id) ? 'rgba(72,185,230,0.08)' : 'var(--color-surface)',
            }}>
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => onToggle(s.id)}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 rounded accent-[var(--color-primary)]" />
              <div>
                <p className="font-mono font-bold text-sm text-[var(--color-primary)]">{s.numero_sticker}</p>
                {s.codigo_lote && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{s.codigo_lote}</p>}
                <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1 mt-0.5">
                  <Calendar size={10} />{new Date(s.created_at).toLocaleDateString('es-GT')}
                </p>
              </div>
            </div>
            <EstadoBadge estado={s.estado} />
          </div>
        ))}
      </div>

      {rows.length > 0 && (
        <p className="text-xs text-[var(--color-text-muted)]">
          {rows.length} sticker{rows.length !== 1 ? 's' : ''}
          {selected.size > 0 && <span className="ml-2 text-[var(--color-primary)] font-semibold">· {selected.size} seleccionado{selected.size!==1?'s':''}</span>}
        </p>
      )}
    </>
  );
}

// ─── LotesTable ───────────────────────────────────────────────────────────────

const TIPO_LABEL: Record<string, string> = {
  correlativo: 'Correlativo', con_prefijo: 'Con prefijo',
  estructura: 'Estructura', aleatorio: 'Aleatorio', manual: 'Manual',
};

function LotesTable({ lotes, onVerLote }: { lotes: StickerLote[]; onVerLote: (id: number) => void }) {
  const thCls    = 'px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]';
  const tdCls    = 'px-4 py-3 text-sm text-[var(--color-text)]';
  const tdSecCls = 'px-4 py-3 text-sm text-[var(--color-text-sec)]';

  if (lotes.length === 0) {
    return (
      <div className="text-center py-20 rounded-2xl border"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <Layers size={48} className="mx-auto mb-4 opacity-20 text-[var(--color-text-muted)]" />
        <p className="font-medium text-[var(--color-text-muted)]">No hay lotes generados aún</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">Presiona "Generar lote" para crear tu primer lote</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden sm:block rounded-2xl border overflow-hidden"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <table className="w-full">
          <thead style={{ background: 'var(--color-surface-soft)', borderBottom: '1px solid var(--color-border)' }}>
            <tr>
              <th className={thCls}>Código de lote</th>
              <th className={thCls}>Tipo</th>
              <th className={thCls}>Total</th>
              <th className={thCls}>Disponibles</th>
              <th className={thCls}>Asignados</th>
              <th className={thCls}>Anulados</th>
              <th className={thCls}>Garantía</th>
              <th className={thCls}>Fecha</th>
              <th className={thCls}></th>
            </tr>
          </thead>
          <tbody>
            {lotes.map((l) => (
              <tr key={l.id} className="border-t transition-colors hover:bg-[var(--color-row-hover)]"
                style={{ borderColor: 'var(--color-border)' }}>
                <td className={tdCls}>
                  <span className="font-mono text-xs font-bold text-[var(--color-primary)]">{l.codigo_lote}</span>
                  {l.prefijo && <span className="ml-2 text-xs text-[var(--color-text-muted)]">{l.prefijo}</span>}
                </td>
                <td className={tdSecCls}>
                  <span className="text-xs px-2 py-0.5 rounded-full border"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-soft)' }}>
                    {TIPO_LABEL[l.tipo_generacion] ?? l.tipo_generacion}
                  </span>
                </td>
                <td className={tdCls}><span className="font-semibold">{l.total_generados ?? l.cantidad}</span></td>
                <td className={tdCls}><span className="text-emerald-600 font-semibold">{l.disponibles ?? 0}</span></td>
                <td className={tdCls}><span className="text-violet-600 font-semibold">{l.asignados ?? 0}</span></td>
                <td className={tdCls}><span className="text-red-500 font-semibold">{l.anulados ?? 0}</span></td>
                <td className={tdSecCls}>
                  {l.dias_garantia > 0
                    ? <span className="flex items-center gap-1"><Hash size={12} className="opacity-60" />{l.dias_garantia}d</span>
                    : <span className="text-[var(--color-text-muted)]">—</span>}
                </td>
                <td className={tdSecCls}>
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} className="opacity-60" />
                    {new Date(l.created_at).toLocaleDateString('es-GT')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => onVerLote(l.id)}
                    className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors hover:bg-[var(--color-row-hover)]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)' }}>
                    Ver stickers
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="sm:hidden space-y-3">
        {lotes.map((l) => (
          <div key={l.id} className="rounded-xl border p-4 space-y-3"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-sm font-bold text-[var(--color-primary)]">{l.codigo_lote}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {TIPO_LABEL[l.tipo_generacion] ?? l.tipo_generacion}
                  {l.prefijo && <span> · {l.prefijo}</span>}
                </p>
              </div>
              <span className="text-xs text-[var(--color-text-muted)]">{new Date(l.created_at).toLocaleDateString('es-GT')}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Total', value: l.total_generados??l.cantidad, cls: 'text-[var(--color-text)]' },
                { label: 'Disp.',  value: l.disponibles??0,  cls: 'text-emerald-600' },
                { label: 'Asig.',  value: l.asignados??0,    cls: 'text-violet-600'  },
                { label: 'Anul.',  value: l.anulados??0,     cls: 'text-red-500'     },
              ].map((m) => (
                <div key={m.label} className="rounded-lg py-2" style={{ background: 'var(--color-surface-soft)' }}>
                  <p className={`text-lg font-bold ${m.cls}`}>{m.value}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">{m.label}</p>
                </div>
              ))}
            </div>
            <button onClick={() => onVerLote(l.id)}
              className="w-full py-2 rounded-lg text-sm font-semibold border transition-colors hover:bg-[var(--color-row-hover)]"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)' }}>
              Ver stickers de este lote
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">{lotes.length} lote{lotes.length!==1?'s':''} generado{lotes.length!==1?'s':''}</p>
    </>
  );
}
