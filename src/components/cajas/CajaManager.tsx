import { useCallback, useEffect, useState } from 'react';
import { Edit2, Plus, Power, Trash2, WalletCards } from 'lucide-react';
import Modal from '../ui/Modal';
import { cajaError, type CajaApi, type CajaCatalogo, type CajaPayload } from '../../services/cajaCatalogoService';
import type { Sucursal } from '../../services/sucursalService';

const empty: CajaPayload = { nombre: '', codigo: '', descripcion: '' };

export default function CajaManager({ api, sucursales = [], sucursalActivaId }: { api: CajaApi; sucursales?: Sucursal[]; sucursalActivaId?: number }) {
  const platform = sucursales.length > 0;
  const [filter, setFilter] = useState<number | undefined>(sucursalActivaId);
  const [rows, setRows] = useState<CajaCatalogo[]>([]);
  const [form, setForm] = useState<CajaPayload>(empty);
  const [editing, setEditing] = useState<CajaCatalogo | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (!platform) setFilter(sucursalActivaId); }, [platform, sucursalActivaId]);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setRows(await api.listar(platform ? filter : undefined)); }
    catch (e) { setError(cajaError(e, 'No fue posible cargar las cajas.')); }
    finally { setLoading(false); }
  }, [api, filter, platform, sucursalActivaId]);
  useEffect(() => { void load(); }, [load]);

  function create() {
    setEditing(null);
    setForm({ ...empty, sucursal_id: platform ? filter || sucursales.find(s => Boolean(s.activa))?.id : undefined });
    setOpen(true); setError('');
  }
  function edit(row: CajaCatalogo) {
    setEditing(row); setForm({ nombre: row.nombre, codigo: row.codigo, descripcion: row.descripcion || '', sucursal_id: platform ? row.sucursal_id : undefined });
    setOpen(true); setError('');
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try { editing ? await api.editar(editing, form) : await api.crear(form); setOpen(false); await load(); }
    catch (e) { setError(cajaError(e, 'No fue posible guardar la caja.')); }
    finally { setSaving(false); }
  }
  async function toggle(row: CajaCatalogo) {
    const activa = !Boolean(row.activa);
    if (!window.confirm(`¿Desea ${activa ? 'activar' : 'desactivar'} ${row.nombre}?`)) return;
    try { await api.cambiarEstado(row, activa); await load(); } catch (e) { setError(cajaError(e, 'No fue posible cambiar el estado.')); }
  }
  async function remove(row: CajaCatalogo) {
    if (!window.confirm(`¿Eliminar permanentemente la caja ${row.nombre}?`)) return;
    try { await api.eliminar(row); await load(); } catch (e) { setError(cajaError(e, 'No fue posible eliminar la caja.')); }
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#191a1d]">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-bold"><WalletCards size={19}/>Cajas</h2><p className="mt-1 text-sm text-slate-500">Catálogo operativo; no incluye saldos ni movimientos.</p></div>
      <div className="flex gap-2">{platform && <select aria-label="Filtrar por sucursal" value={filter || ''} onChange={e => setFilter(Number(e.target.value) || undefined)} className="rounded-xl border bg-transparent px-3 dark:border-slate-700"><option value="">Todas las sucursales</option>{sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select>}<button onClick={create} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white"><Plus size={16}/>Nueva caja</button></div>
    </div>
    {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {loading ? <div className="mt-5 h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900"/> : rows.length === 0 ? <div className="mt-5 rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">No hay cajas en la sucursal seleccionada.</div> : <div className="mt-5 grid gap-3 md:grid-cols-2">{rows.map(row => <article key={row.id} className="rounded-xl border p-4 dark:border-slate-800"><div className="flex justify-between gap-3"><div><h3 className="font-bold">{row.nombre}</h3><p className="text-xs uppercase text-slate-500">{row.codigo}{row.sucursal_nombre ? ` · ${row.sucursal_nombre}` : ''}</p>{row.descripcion && <p className="mt-2 text-sm text-slate-500">{row.descripcion}</p>}<span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${row.activa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{row.activa ? 'Activa' : 'Inactiva'}</span></div><div className="flex gap-2"><button aria-label="Editar caja" onClick={() => edit(row)} className="rounded-lg border p-2 dark:border-slate-700"><Edit2 size={15}/></button><button aria-label="Cambiar estado" onClick={() => void toggle(row)} className="rounded-lg border p-2 dark:border-slate-700"><Power size={15}/></button><button aria-label="Eliminar caja" onClick={() => void remove(row)} className="rounded-lg border p-2 text-red-600 dark:border-slate-700"><Trash2 size={15}/></button></div></div></article>)}</div>}
    <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar caja' : 'Nueva caja'} size="lg"><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">{error && <div className="sm:col-span-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}{platform && !editing && <label className="text-sm font-semibold sm:col-span-2">Sucursal<select required value={form.sucursal_id || ''} onChange={e => setForm(v => ({...v, sucursal_id: Number(e.target.value)}))} className="mt-1.5 h-11 w-full rounded-xl border bg-transparent px-3 dark:border-slate-700"><option value="">Seleccione</option>{sucursales.filter(s => Boolean(s.activa)).map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>}<label className="text-sm font-semibold">Nombre<input required value={form.nombre} onChange={e => setForm(v => ({...v,nombre:e.target.value}))} className="mt-1.5 h-11 w-full rounded-xl border bg-transparent px-3 dark:border-slate-700"/></label><label className="text-sm font-semibold">Código<input required value={form.codigo} onChange={e => setForm(v => ({...v,codigo:e.target.value}))} className="mt-1.5 h-11 w-full rounded-xl border bg-transparent px-3 uppercase dark:border-slate-700"/></label><label className="text-sm font-semibold sm:col-span-2">Descripción<textarea value={form.descripcion || ''} onChange={e => setForm(v => ({...v,descripcion:e.target.value}))} className="mt-1.5 min-h-24 w-full rounded-xl border bg-transparent p-3 dark:border-slate-700"/></label><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setOpen(false)} className="rounded-xl border px-4 py-2.5 dark:border-slate-700">Cancelar</button><button disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 font-bold text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button></div></form></Modal>
  </section>;
}

