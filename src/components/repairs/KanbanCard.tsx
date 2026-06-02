import { useDraggable } from '@dnd-kit/core';
import {
  GripVertical, User, Smartphone, Wrench, Calendar,
  CheckCircle, History, Edit, ChevronRight,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface KanbanCardProps {
  rep: any;
  checkSet: Set<string>;
  onOpenHistorial: (rep: any) => void;
  onOpenEstado: (rep: any) => void;
  onNavigate: (path: string) => void;
  onOpenChecklist: (rep: any) => void;
  isDragOverlay?: boolean;
}

// ── Style maps ────────────────────────────────────────────────────────────────
const PRIORIDAD_BORDER: Record<string, string> = {
  ALTA:  'border-l-red-500',
  MEDIA: 'border-l-amber-400',
  BAJA:  'border-l-teal-400',
};

const PRIORIDAD_BADGE: Record<string, string> = {
  ALTA:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  MEDIA: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  BAJA:  'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
};

const PRIORIDAD_LABEL: Record<string, string> = {
  ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja',
};

// ── Helper ────────────────────────────────────────────────────────────────────
function safeDate(v?: string | null): string {
  if (!v) return '—';
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '—';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short' });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function KanbanCard({
  rep, checkSet, onOpenHistorial, onOpenEstado, onNavigate, onOpenChecklist, isDragOverlay = false,
}: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: rep.id,
    data: { rep },
    disabled: isDragOverlay,
  });

  const style = (!isDragOverlay && transform)
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const hasChecklist = checkSet.has(rep.id);
  const borderCls = PRIORIDAD_BORDER[rep.prioridad] || 'border-l-slate-300 dark:border-l-slate-600';
  const badgeCls  = PRIORIDAD_BADGE[rep.prioridad];

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={isDragOverlay ? undefined : style}
      {...(isDragOverlay ? {} : attributes)}
      className={[
        'bg-white dark:bg-slate-900',
        'border border-slate-200 dark:border-slate-700',
        'border-l-4', borderCls,
        'rounded-xl',
        'select-none',
        isDragging
          ? 'opacity-40 scale-95 shadow-none'
          : isDragOverlay
            ? 'shadow-2xl rotate-1 scale-105 ring-2 ring-blue-400/40'
            : 'shadow-sm hover:shadow-md hover:-translate-y-0.5',
        'transition-all duration-150',
      ].join(' ')}
    >
      {/* ── HEADER: grip + ID + prioridad + checklist ── */}
      <div className="flex items-center justify-between px-2.5 pt-2.5 pb-1 gap-1">
        {/* Left: grip + ID */}
        <div className="flex items-center gap-1 min-w-0">
          <div
            {...(isDragOverlay ? {} : listeners)}
            className="text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 cursor-grab active:cursor-grabbing shrink-0 p-0.5 -ml-0.5"
            title="Arrastrar"
          >
            <GripVertical size={13} />
          </div>
          <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate leading-none">
            {rep.id}
          </span>
        </div>

        {/* Right: priority + checklist */}
        <div className="flex items-center gap-1 shrink-0">
          {badgeCls && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-none ${badgeCls}`}>
              {PRIORIDAD_LABEL[rep.prioridad] || rep.prioridad}
            </span>
          )}
          {hasChecklist && (
            <CheckCircle
              size={12}
              className="text-emerald-500 dark:text-emerald-400 shrink-0"
              title="Checklist OK"
            />
          )}
        </div>
      </div>

      {/* ── BODY: client + device + tech + date ── */}
      <div
        className="px-3 pb-2 pt-0.5 space-y-1.5 cursor-pointer"
        onClick={() => onNavigate(`/flujo-reparaciones/${rep.id}`)}
      >
        {/* Cliente */}
        <div className="flex items-center gap-1.5 min-w-0">
          <User size={10} className="text-slate-400 shrink-0" />
          <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 truncate leading-tight">
            {rep.clienteNombre || '—'}
          </span>
        </div>

        {/* Equipo */}
        <div className="flex items-center gap-1.5 min-w-0">
          <Smartphone size={10} className="text-slate-400 shrink-0" />
          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-tight">
            {[rep.recepcion?.marca, rep.recepcion?.modelo].filter(Boolean).join(' ') || '—'}
          </span>
        </div>

        {/* Técnico */}
        <div className="flex items-center gap-1.5 min-w-0">
          <Wrench size={10} className="text-slate-400 shrink-0" />
          <span className={`text-[11px] truncate leading-tight ${
            (rep.tecnicoNombre?.trim() || rep.tecnicoAsignado)
              ? 'text-slate-500 dark:text-slate-400'
              : 'text-slate-400 dark:text-slate-500 italic'
          }`}>
            {rep.tecnicoNombre?.trim() || rep.tecnicoAsignado || 'Sin asignar'}
          </span>
        </div>

        {/* Fecha */}
        <div className="flex items-center gap-1.5">
          <Calendar size={10} className="text-slate-400 shrink-0" />
          <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
            {safeDate(rep.fechaIngreso)}
          </span>
        </div>
      </div>

      {/* ── FOOTER: action buttons ── */}
      <div
        className="flex items-center border-t border-slate-100 dark:border-slate-800 px-1.5 py-1.5 gap-0.5"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => onOpenHistorial(rep)}
          title="Ver historial"
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
        >
          <History size={11} />
          Historial
        </button>

        <div className="w-px h-4 bg-slate-100 dark:bg-slate-800 shrink-0" />

        <button
          onClick={() => onOpenEstado(rep)}
          title="Cambiar estado"
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Edit size={11} />
          Estado
        </button>

        <div className="w-px h-4 bg-slate-100 dark:bg-slate-800 shrink-0" />

        <button
          onClick={() => onOpenChecklist(rep)}
          title="Ver / editar checklist"
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        >
          <ChevronRight size={11} />
          Ver
        </button>
      </div>
    </div>
  );
}
