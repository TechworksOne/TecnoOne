import { useDroppable } from '@dnd-kit/core';
import KanbanCard from './KanbanCard';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ColumnConfig {
  id: string;
  label: string;
  /** Tailwind classes for the header background + border */
  headerCls: string;
  /** Tailwind class for the colored dot */
  dotCls: string;
  /** Tailwind classes for the count badge */
  countCls: string;
}

interface KanbanColumnProps {
  config: ColumnConfig;
  reps: any[];
  checkSet: Set<string>;
  onOpenHistorial: (rep: any) => void;
  onOpenEstado: (rep: any) => void;
  onNavigate: (path: string) => void;
  onOpenChecklist: (rep: any) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function KanbanColumn({
  config, reps, checkSet, onOpenHistorial, onOpenEstado, onNavigate, onOpenChecklist,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: config.id });

  return (
    <div className="flex flex-col w-[80vw] sm:w-[260px] lg:w-[272px] shrink-0">
      {/* ── Column header ── */}
      <div
        className={[
          'flex items-center justify-between',
          'px-3 py-2.5 rounded-t-xl border',
          config.headerCls,
        ].join(' ')}
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${config.dotCls} shrink-0`} />
          <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200 truncate">
            {config.label}
          </span>
        </div>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${config.countCls}`}>
          {reps.length}
        </span>
      </div>

      {/* ── Droppable body ── */}
      <div
        ref={setNodeRef}
        className={[
          'flex-1 rounded-b-xl border border-t-0 p-2 space-y-2',
          'overflow-y-auto',
          'transition-colors duration-150',
          isOver
            ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700'
            : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700',
        ].join(' ')}
        style={{ minHeight: 110, maxHeight: 'calc(100vh - 440px)' }}
      >
        {reps.length === 0 ? (
          <div
            className={[
              'h-16 flex items-center justify-center rounded-lg border-2 border-dashed text-[11px] font-medium',
              isOver
                ? 'border-blue-400 dark:border-blue-500 text-blue-500 dark:text-blue-400'
                : 'border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600',
            ].join(' ')}
          >
            {isOver ? '↓ Soltar aquí' : 'Sin reparaciones'}
          </div>
        ) : (
          reps.map(rep => (
            <KanbanCard
              key={rep.id}
              rep={rep}
              checkSet={checkSet}
              onOpenHistorial={onOpenHistorial}
              onOpenEstado={onOpenEstado}
              onNavigate={onNavigate}
              onOpenChecklist={onOpenChecklist}
            />
          ))
        )}
      </div>
    </div>
  );
}
