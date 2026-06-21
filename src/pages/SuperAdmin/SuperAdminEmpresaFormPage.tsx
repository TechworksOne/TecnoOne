import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { superAdminService } from '../../services/superAdminService';

export default function SuperAdminEmpresaFormPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nombre: '', nombre_comercial: '', nit: '', slug: '', estado: 'demo', plan: 'demo', telefono: '', email: '', direccion: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const result = await superAdminService.createEmpresa(form);
      navigate(`/superadmin/empresas/${result.id}`);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'No fue posible crear la empresa.');
    } finally { setSaving(false); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div><h1 className="text-2xl font-extrabold">Crear empresa</h1><p className="text-sm text-slate-500">Registra un nuevo tenant sin crear todavía su administrador.</p></div>
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#191a1d] sm:grid-cols-2">
        {error && <div className="sm:col-span-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {Object.entries({ nombre: 'Nombre legal', nombre_comercial: 'Nombre comercial', nit: 'NIT', slug: 'Slug', plan: 'Plan', telefono: 'Teléfono', email: 'Correo', direccion: 'Dirección' }).map(([key, label]) => (
          <label key={key} className={`text-sm font-semibold ${key === 'direccion' ? 'sm:col-span-2' : ''}`}>{label}<input required={key === 'nombre'} value={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 font-normal dark:border-slate-700" /></label>
        ))}
        <label className="text-sm font-semibold">Estado<select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 font-normal dark:border-slate-700">{['demo','prueba','activa','suspendida'].map(v => <option key={v}>{v}</option>)}</select></label>
        <div className="flex justify-end gap-2 pt-4 sm:col-span-2"><button type="button" onClick={() => navigate(-1)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold dark:border-slate-700">Cancelar</button><button disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Creando…' : 'Crear empresa'}</button></div>
      </form>
    </div>
  );
}
