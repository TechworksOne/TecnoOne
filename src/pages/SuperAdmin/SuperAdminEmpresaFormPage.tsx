import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { superAdminService } from '../../services/superAdminService';

const today = new Date().toISOString().slice(0, 10);

export default function SuperAdminEmpresaFormPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre: '',
    nombre_comercial: '',
    nit: '',
    slug: '',
    tipo_suscripcion: 'prueba',
    plan: 'demo',
    fecha_inicio: today,
    fecha_vencimiento: '',
    dias_gracia: 0,
    telefono: '',
    email: '',
    direccion: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (form.fecha_vencimiento && form.fecha_inicio > form.fecha_vencimiento) {
      setError('La fecha de inicio no puede ser posterior al vencimiento.');
      return;
    }
    if (Number(form.dias_gracia) < 0) {
      setError('Los días de gracia no pueden ser negativos.');
      return;
    }
    setSaving(true);
    try {
      const result = await superAdminService.createEmpresa({
        ...form,
        fecha_vencimiento: form.fecha_vencimiento || null,
        dias_gracia: Number(form.dias_gracia),
      });
      navigate(`/superadmin/empresas/${result.id}`);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'No fue posible crear la empresa.');
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 font-normal dark:border-slate-700';

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Crear empresa</h1>
        <p className="text-sm text-slate-500">Registra el tenant y su suscripción inicial en una sola operación.</p>
      </div>
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#191a1d] sm:grid-cols-2">
        {error && <div className="sm:col-span-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {([
          ['nombre', 'Nombre legal'],
          ['nombre_comercial', 'Nombre comercial'],
          ['nit', 'NIT'],
          ['slug', 'Slug'],
          ['plan', 'Plan actual'],
          ['telefono', 'Teléfono'],
          ['email', 'Correo'],
          ['direccion', 'Dirección'],
        ] as const).map(([key, label]) => (
          <label key={key} className={`text-sm font-semibold ${key === 'direccion' ? 'sm:col-span-2' : ''}`}>
            {label}
            <input
              required={key === 'nombre'}
              value={form[key]}
              onChange={event => setForm({ ...form, [key]: event.target.value })}
              className={inputClass}
            />
          </label>
        ))}

        <div className="sm:col-span-2 mt-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          <h2 className="font-bold">Suscripción inicial</h2>
        </div>
        <label className="text-sm font-semibold">
          Tipo
          <select
            value={form.tipo_suscripcion}
            onChange={event => setForm({ ...form, tipo_suscripcion: event.target.value })}
            className={inputClass}
          >
            <option value="prueba">Prueba</option>
            <option value="comercial">Comercial</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Días de gracia
          <input
            type="number"
            min={0}
            value={form.dias_gracia}
            onChange={event => setForm({ ...form, dias_gracia: Number(event.target.value) })}
            className={inputClass}
          />
        </label>
        <label className="text-sm font-semibold">
          Fecha de inicio
          <input
            type="date"
            required
            value={form.fecha_inicio}
            onChange={event => setForm({ ...form, fecha_inicio: event.target.value })}
            className={inputClass}
          />
        </label>
        <label className="text-sm font-semibold">
          Fecha de vencimiento
          <input
            type="date"
            value={form.fecha_vencimiento}
            min={form.fecha_inicio}
            onChange={event => setForm({ ...form, fecha_vencimiento: event.target.value })}
            className={inputClass}
          />
        </label>
        <div className="flex justify-end gap-2 pt-4 sm:col-span-2">
          <button type="button" onClick={() => navigate(-1)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold dark:border-slate-700">Cancelar</button>
          <button disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {saving ? 'Creando…' : 'Crear empresa'}
          </button>
        </div>
      </form>
    </div>
  );
}
