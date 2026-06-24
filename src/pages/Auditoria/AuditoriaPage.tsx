import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, RefreshCw, Search } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { auditoriaService, type AuditoriaFilters, type AuditoriaLog } from '../../services/auditoriaService';

const inputClass =
  'h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[rgba(var(--tenant-primary-rgb),0.18)]';

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-GT', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <pre className="custom-scrollbar max-h-72 overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-4 text-xs text-[var(--color-text-sec)]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditoriaLog[]>([]);
  const [filters, setFilters] = useState<AuditoriaFilters>({ page: 1, limit: 25 });
  const [draft, setDraft] = useState<AuditoriaFilters>({});
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<AuditoriaLog | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadLogs(next = filters) {
    setLoading(true);
    setError('');

    try {
      const response = await auditoriaService.getLogs(next);
      setLogs(response.data);
      setPagination(response.pagination);
    } catch (loadError) {
      console.error('Error cargando auditoría:', loadError);
      setLogs([]);
      setPagination({
        page: Number(next.page) || 1,
        total: 0,
        totalPages: 1,
      });
      setError('No se pudo cargar la auditoría.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadLogs(filters); }, [filters]);

  const applyFilters = () => setFilters({ ...draft, page: 1, limit: 25 });
  const clearFilters = () => {
    setDraft({});
    setFilters({ page: 1, limit: 25 });
  };

  async function openDetail(id: number) {
    setDetailLoading(true);
    setError('');

    try {
      setDetail(await auditoriaService.getLog(id));
    } catch (detailError) {
      console.error('Error cargando detalle de auditoría:', detailError);
      setDetail(null);
      setError('No se pudo cargar el detalle de auditoría.');
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Auditoría</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Historial inmutable de acciones administrativas y operativas.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
        >
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-3 text-[var(--color-text-muted)]" size={16} />
            <input
              className={`${inputClass} w-full pl-9`}
              placeholder="Buscar usuario, descripción o ID"
              value={draft.search || ''}
              onChange={e => setDraft({ ...draft, search: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
            />
          </div>
          <input
            className={inputClass}
            placeholder="ID de usuario"
            inputMode="numeric"
            value={draft.usuario_id || ''}
            onChange={e =>
              setDraft({
                ...draft,
                usuario_id: e.target.value.replace(/\D/g, ''),
              })
            }
          />
          <input
            className={inputClass}
            placeholder="ID de entidad"
            value={draft.entidad_id || ''}
            onChange={e =>
              setDraft({
                ...draft,
                entidad_id: e.target.value.slice(0, 100),
              })
            }
          />
          <select className={inputClass} value={draft.accion || ''} onChange={e => setDraft({ ...draft, accion: e.target.value })}>
            <option value="">Todas las acciones</option>
            {['CREAR', 'EDITAR', 'ACTIVAR', 'DESACTIVAR', 'ELIMINAR', 'CAMBIAR_ROLES', 'CANCELAR', 'ASIGNAR_TECNICO', 'ANULAR', 'REGISTRAR_PAGO'].map(item => <option key={item}>{item}</option>)}
          </select>
          <select className={inputClass} value={draft.entidad || ''} onChange={e => setDraft({ ...draft, entidad: e.target.value })}>
            <option value="">Todas las entidades</option>
            {['USUARIO', 'EMPRESA', 'REPARACION', 'VENTA', 'COMPRA'].map(item => <option key={item}>{item}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={applyFilters} className="flex h-10 flex-1 items-center justify-center rounded-xl bg-[var(--color-primary)] px-3 text-sm font-semibold text-white hover:bg-[var(--color-primary-dark)]">
              Filtrar
            </button>
            <button onClick={clearFilters} title="Limpiar filtros" className="h-10 rounded-xl border border-[var(--color-border)] px-3 text-[var(--color-text-sec)] hover:bg-[var(--color-row-hover)]">
              <RefreshCw size={16} />
            </button>
          </div>
          <label className="text-xs text-[var(--color-text-muted)]">
            Desde
            <input type="date" className={`${inputClass} mt-1 w-full`} value={draft.fecha_desde || ''} onChange={e => setDraft({ ...draft, fecha_desde: e.target.value })} />
          </label>
          <label className="text-xs text-[var(--color-text-muted)]">
            Hasta
            <input type="date" className={`${inputClass} mt-1 w-full`} value={draft.fecha_hasta || ''} onChange={e => setDraft({ ...draft, fecha_hasta: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full">
            <thead className="bg-[var(--color-surface-soft)]">
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                {['Fecha', 'Usuario', 'Acción', 'Entidad', 'Identificador', 'Descripción', ''].map(label => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-[var(--color-text-muted)]">Cargando auditoría…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-[var(--color-text-muted)]">No hay registros para los filtros seleccionados.</td></tr>
              ) : logs.map(log => (
                <tr key={log.id} className="text-sm hover:bg-[var(--color-row-hover)]">
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-sec)]">{formatDate(log.created_at)}</td>
                  <td className="px-4 py-3 font-medium text-[var(--color-text)]">{log.usuario_nombre}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-[var(--color-active-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]">{log.accion}</span></td>
                  <td className="px-4 py-3 text-[var(--color-text-sec)]">{log.entidad}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-sec)]">{log.entidad_id || '—'}</td>
                  <td className="max-w-sm truncate px-4 py-3 text-[var(--color-text-sec)]">{log.descripcion}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => openDetail(log.id)} className="rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-text-sec)] hover:bg-[var(--color-row-hover)]" aria-label="Ver detalle">
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--color-border)] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[var(--color-text-muted)]">{pagination.total} registros</span>
          <div className="flex items-center justify-end gap-2">
            <button disabled={pagination.page <= 1} onClick={() => setFilters({ ...filters, page: pagination.page - 1 })} className="rounded-lg border border-[var(--color-border)] p-2 disabled:opacity-40"><ChevronLeft size={16} /></button>
            <span className="text-[var(--color-text-sec)]">Página {pagination.page} de {Math.max(1, pagination.totalPages)}</span>
            <button disabled={pagination.page >= pagination.totalPages} onClick={() => setFilters({ ...filters, page: pagination.page + 1 })} className="rounded-lg border border-[var(--color-border)] p-2 disabled:opacity-40"><ChevronRight size={16} /></button>
          </div>
        </div>
      </section>

      <Modal open={detailLoading || Boolean(detail)} onClose={() => { setDetail(null); setDetailLoading(false); }} title="Detalle de auditoría" size="3xl">
        {detailLoading || !detail ? <p className="text-sm text-[var(--color-text-muted)]">Cargando detalle…</p> : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                ['Fecha', formatDate(detail.created_at)],
                ['Usuario', detail.usuario_nombre],
                ['Acción', detail.accion],
                ['Entidad', `${detail.entidad}${detail.entidad_id ? ` · ${detail.entidad_id}` : ''}`],
                ['Solicitud', `${detail.metodo_http || '—'} ${detail.ruta || ''}`],
                ['IP', detail.ip || '—'],
              ].map(([label, value]) => <div key={label} className="rounded-xl bg-[var(--color-surface-soft)] p-3"><p className="text-xs text-[var(--color-text-muted)]">{label}</p><p className="mt-1 break-all text-sm font-medium text-[var(--color-text)]">{value}</p></div>)}
            </div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Descripción</p><p className="mt-2 text-sm text-[var(--color-text-sec)]">{detail.descripcion}</p></div>
            <JsonBlock label="Datos anteriores" value={detail.datos_anteriores} />
            <JsonBlock label="Datos nuevos" value={detail.datos_nuevos} />
            {detail.user_agent && <div><p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">User agent</p><p className="mt-2 break-all text-xs text-[var(--color-text-sec)]">{detail.user_agent}</p></div>}
          </div>
        )}
      </Modal>
    </div>
  );
}
