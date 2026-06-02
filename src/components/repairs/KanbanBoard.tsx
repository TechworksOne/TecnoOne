import { useState, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import KanbanColumn, { type ColumnConfig } from './KanbanColumn';
import KanbanCard from './KanbanCard';

// ── Column configuration ───────────────────────────────────────────────────────
export const KANBAN_COLUMNS: ColumnConfig[] = [
  {
    id: 'RECIBIDA',
    label: 'Recibida',
    headerCls: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
    dotCls: 'bg-blue-500',
    countCls: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  },
  {
    id: 'EN_DIAGNOSTICO',
    label: 'En Diagnóstico',
    headerCls: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
    dotCls: 'bg-amber-500',
    countCls: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
  },
  {
    id: 'ESPERANDO_AUTORIZACION',
    label: 'Esp. Autorización',
    headerCls: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800',
    dotCls: 'bg-yellow-400',
    countCls: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300',
  },
  {
    id: 'AUTORIZADA',
    label: 'Autorizada',
    headerCls: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800',
    dotCls: 'bg-sky-500',
    countCls: 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300',
  },
  {
    id: 'EN_REPARACION',
    label: 'En Reparación',
    headerCls: 'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800',
    dotCls: 'bg-violet-500',
    countCls: 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300',
  },
  {
    id: 'ESPERANDO_PIEZA',
    label: 'Esp. Pieza',
    headerCls: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800',
    dotCls: 'bg-orange-500',
    countCls: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300',
  },
  {
    id: 'STAND_BY',
    label: 'Stand By',
    headerCls: 'bg-slate-100 dark:bg-slate-800/60 border-slate-300 dark:border-slate-600',
    dotCls: 'bg-slate-400',
    countCls: 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  },
  {
    id: 'COMPLETADA',
    label: 'Completada',
    headerCls: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
    dotCls: 'bg-emerald-500',
    countCls: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
  },
  {
    id: 'ENTREGADA',
    label: 'Entregada',
    headerCls: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
    dotCls: 'bg-green-500',
    countCls: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
  },
];

/**
 * Maps a repair's `estado` value to the kanban column id.
 * EN_PROCESO is grouped under EN_REPARACION.
 */
export function getColumnForEstado(estado: string): string {
  if (estado === 'EN_PROCESO') return 'EN_REPARACION';
  const known = new Set(KANBAN_COLUMNS.map(c => c.id));
  return known.has(estado) ? estado : 'RECIBIDA';
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface KanbanBoardProps {
  /** Repairs already filtered by search / priority (with checklist done) */
  reps: any[];
  checkSet: Set<string>;
  onOpenHistorial: (rep: any) => void;
  onOpenEstado: (rep: any) => void;
  onNavigate: (path: string) => void;
  onOpenChecklist: (rep: any) => void;
  /** Called when a card is dropped on a different column */
  onEstadoChange: (repId: string, newEstado: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function KanbanBoard({
  reps, checkSet, onOpenHistorial, onOpenEstado, onNavigate, onOpenChecklist, onEstadoChange,
}: KanbanBoardProps) {
  const [activeRep, setActiveRep] = useState<any>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Group repairs by column
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const col of KANBAN_COLUMNS) map[col.id] = [];
    for (const rep of reps) {
      const colId = getColumnForEstado(rep.estado);
      map[colId]?.push(rep);
    }
    return map;
  }, [reps]);

  function handleDragStart(event: DragStartEvent) {
    const found = reps.find(r => r.id === String(event.active.id));
    setActiveRep(found ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveRep(null);
    const { active, over } = event;
    if (!over) return;

    const repId = String(active.id);
    const targetColId = String(over.id);
    const rep = reps.find(r => r.id === repId);
    if (!rep) return;

    // Don't do anything if dropped in the same column
    const currentColId = getColumnForEstado(rep.estado);
    if (currentColId === targetColId) return;

    onEstadoChange(repId, targetColId);
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Horizontal scroll container */}
      <div
        className="flex gap-3 overflow-x-auto pb-3"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
      >
        {KANBAN_COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            config={col}
            reps={grouped[col.id] ?? []}
            checkSet={checkSet}
            onOpenHistorial={onOpenHistorial}
            onOpenEstado={onOpenEstado}
            onNavigate={onNavigate}
            onOpenChecklist={onOpenChecklist}
          />
        ))}
      </div>

      {/* Drag overlay — renders a floating copy of the dragged card */}
      <DragOverlay dropAnimation={null}>
        {activeRep ? (
          <KanbanCard
            rep={activeRep}
            checkSet={checkSet}
            onOpenHistorial={() => {}}
            onOpenEstado={() => {}}
            onNavigate={() => {}}
            onOpenChecklist={() => {}}
            isDragOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
