import { useCallback, useEffect, useState } from 'react';
import { Building2, Edit2, MapPin, Plus, Power, Star } from 'lucide-react';
import Modal from '../ui/Modal';
import {
  sucursalErrorMessage,
  type Sucursal,
  type SucursalApi,
  type SucursalPayload,
} from '../../services/sucursalService';

const emptyForm: SucursalPayload = {
  codigo: '', nombre: '', direccion: '', telefono: '', email: '', es_principal: false,
};

export default function SucursalManager({
  api,
  used,
  limit,
  title = 'Sucursales',
}: {
  api: SucursalApi;
  used?: number | null;
  limit?: number | null;
  title?: string;
}) {
  const [rows, setRows] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<Sucursal | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<SucursalPayload>(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await api.listar());
    } catch (requestError) {
      setError(sucursalErrorMessage(requestError, 'No fue posible cargar las sucursales.'));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  }

  function openEdit(row: Sucursal) {
    setEditing(row);
    setForm({
      codigo: row.codigo,
      nombre: row.nombre,
      direccion: row.direccion || '',
      telefono: row.telefono || '',
      email: row.email || '',
      es_principal: Boolean(row.es_principal),
    });
    setError('');
    setModalOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) await api.editar(editing.id, form);
      else await api.crear(form);
      setModalOpen(false);
      setMessage(editing ? 'Sucursal actualizada.' : 'Sucursal creada.');
      await load();
    } catch (requestError) {
      setError(sucursalErrorMessage(requestError, 'No fue posible guardar la sucursal.'));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(row: Sucursal) {
    const next = !Boolean(row.activa);
    const action = next ? 'activar' : 'desactivar';
    if (!window.confirm(`¿Desea ${action} ${row.nombre}?`)) return;
    setError('');
    setMessage('');
    try {
      await api.cambiarEstado(row.id, next);
      setMessage(`Sucursal ${next ? 'activada' : 'desactivada'}.`);
      await load();
    } catch (requestError) {
      setError(sucursalErrorMessage(requestError, `No fue posible ${action} la sucursal.`));
    }
  }

  const activeCount = rows.filter(row => Boolean(row.activa)).length;
  const displayedUsed = loading && used != null ? used : activeCount;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#191a1d]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-bold"><Building2 size={19} />{title}</h2>
          {(used !== undefined || limit !== undefined) && (
            <p className="mt-1 text-sm text-slate-500">
              Activas: {displayedUsed} de {limit == null ? 'ilimitadas' : limit}
            </p>
          )}
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">
          <Plus size={16} /> Nueva sucursal
        </button>
      </div>

      {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}

      {loading ? (
        <div className="mt-5 h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" />
      ) : rows.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">No hay sucursales registradas.</div>
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {rows.map(row => (
            <article key={row.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{row.nombre}</h3>
                    {Boolean(row.es_principal) && <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800"><Star size={12} /> Principal</span>}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${row.activa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{row.activa ? 'Activa' : 'Inactiva'}</span>
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{row.codigo}</p>
                  {row.direccion && <p className="mt-3 flex gap-2 text-sm text-slate-600 dark:text-slate-300"><MapPin size={15} className="mt-0.5 shrink-0" />{row.direccion}</p>}
                  {(row.telefono || row.email) && <p className="mt-2 text-sm text-slate-500">{[row.telefono, row.email].filter(Boolean).join(' · ')}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(row)} aria-label="Editar sucursal" className="rounded-lg border p-2 dark:border-slate-700"><Edit2 size={15} /></button>
                  <button onClick={() => void toggle(row)} aria-label={row.activa ? 'Desactivar sucursal' : 'Activar sucursal'} className="rounded-lg border p-2 dark:border-slate-700"><Power size={15} /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar sucursal' : 'Nueva sucursal'} size="lg">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</div>}
          {([
            ['nombre', 'Nombre', true], ['codigo', 'Código', true],
            ['telefono', 'Teléfono', false], ['email', 'Correo', false],
          ] as const).map(([key, label, required]) => (
            <label key={key} className="text-sm font-semibold">{label}
              <input required={required} type={key === 'email' ? 'email' : 'text'} value={form[key] || ''} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 font-normal dark:border-slate-700" />
            </label>
          ))}
          <label className="text-sm font-semibold sm:col-span-2">Dirección
            <input value={form.direccion || ''} onChange={event => setForm(current => ({ ...current, direccion: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 font-normal dark:border-slate-700" />
          </label>
          {editing && !Boolean(editing.es_principal) && (
            <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
              <input type="checkbox" checked={Boolean(form.es_principal)} onChange={event => setForm(current => ({ ...current, es_principal: event.target.checked }))} />
              Convertir en sucursal principal y activarla
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold dark:border-slate-700">Cancelar</button>
            <button disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
