import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  superAdminService,
  type EmpresaGlobal,
  type HistorialSuscripcion,
  type Suscripcion,
} from '../../services/superAdminService';

const badgeStyles: Record<string, string> = {
  prueba: 'bg-violet-100 text-violet-700',
  vigente: 'bg-emerald-100 text-emerald-700',
  gracia: 'bg-amber-100 text-amber-800',
  vencida: 'bg-red-100 text-red-700',
};

function displayDate(value: string | null | undefined) {
  if (!value) return 'Sin vencimiento';
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('es-GT');
}

export default function SuperAdminEmpresaDetailPage() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const [empresa, setEmpresa] = useState<EmpresaGlobal | null>(null);
  const [suscripcion, setSuscripcion] = useState<Suscripcion | null>(null);
  const [historial, setHistorial] = useState<HistorialSuscripcion[]>([]);
  const [edit, setEdit] = useState(searchParams.get('editar') === '1');
  const [admin, setAdmin] = useState({ username: '', email: '', password: '', nombres: '', apellidos: '' });
  const [motivo, setMotivo] = useState('');
  const [renewing, setRenewing] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const [empresaData, suscripcionData, historialData] = await Promise.all([
      superAdminService.getEmpresa(id),
      superAdminService.getSuscripcion(id),
      superAdminService.getHistorialSuscripcion(id),
    ]);
    setEmpresa(empresaData);
    setSuscripcion(suscripcionData);
    setHistorial(historialData);
  }

  useEffect(() => {
    load().catch(() => setError('Empresa o suscripción no encontrada.'));
  }, [id]);

  if (!empresa || !suscripcion) {
    return <div className="rounded-2xl bg-white p-8 dark:bg-[#191a1d]">{error || 'Cargando…'}</div>;
  }

  async function save() {
    try {
      await superAdminService.updateEmpresa(id, empresa as unknown as Record<string, unknown>);
      await load();
      setEdit(false);
      setMessage('Empresa actualizada.');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'No fue posible actualizar.');
    }
  }

  async function createAdmin(event: React.FormEvent) {
    event.preventDefault();
    try {
      await superAdminService.createAdministrador(id, admin);
      setMessage('Administrador principal creado.');
      setEmpresa(await superAdminService.getEmpresa(id));
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'No fue posible crear el administrador.');
    }
  }

  async function renew(months: 1 | 3 | 6 | 12) {
    setRenewing(months);
    setError('');
    try {
      const updated = await superAdminService.renovarSuscripcion(id, {
        meses: months,
        dias_gracia: suscripcion.dias_gracia,
        motivo: motivo || `Renovación por ${months} mes${months === 1 ? '' : 'es'}`,
      });
      setSuscripcion(updated);
      await load();
      setMotivo('');
      setMessage(
        updated.requiere_reactivacion_explicita
          ? 'Suscripción renovada. La empresa cancelada requiere reactivación explícita.'
          : 'Suscripción renovada correctamente.'
      );
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'No fue posible renovar.');
    } finally {
      setRenewing(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">{empresa.nombre_comercial || empresa.nombre}</h1>
          <p className="text-sm text-slate-500">{empresa.slug} · {empresa.estado}</p>
        </div>
        <button onClick={() => setEdit(!edit)} className="rounded-xl border px-4 py-2 text-sm font-semibold dark:border-slate-700">
          {edit ? 'Cancelar edición' : 'Editar'}
        </button>
      </div>

      {message && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#191a1d] sm:grid-cols-2">
        {(['nombre', 'nombre_comercial', 'razon_social', 'nit', 'telefono', 'email', 'direccion'] as const).map(key => (
          <label key={key} className="text-xs font-bold uppercase text-slate-500">
            {key.replaceAll('_', ' ')}
            <input
              disabled={!edit}
              value={empresa[key] || ''}
              onChange={event => setEmpresa({ ...empresa, [key]: event.target.value })}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-transparent px-3 text-sm font-normal text-slate-900 disabled:opacity-70 dark:border-slate-700 dark:text-slate-100"
            />
          </label>
        ))}
        {edit && <div className="sm:col-span-2 text-right"><button onClick={save} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white">Guardar cambios</button></div>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#191a1d]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">Suscripción</h2>
            <p className="text-sm text-slate-500">Control de vigencia y renovación de acceso.</p>
          </div>
          <div className="flex gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${badgeStyles[suscripcion.estado] || 'bg-slate-100 text-slate-700'}`}>
              {suscripcion.estado}
            </span>
            {suscripcion.proxima_a_vencer && <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold uppercase text-orange-700">Próxima a vencer</span>}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div><p className="text-xs uppercase text-slate-500">Tipo</p><p className="font-bold">{suscripcion.tipo}</p></div>
          <div><p className="text-xs uppercase text-slate-500">Plan</p><p className="font-bold">{suscripcion.plan}</p></div>
          <div><p className="text-xs uppercase text-slate-500">Inicio</p><p className="font-bold">{displayDate(suscripcion.fecha_inicio)}</p></div>
          <div><p className="text-xs uppercase text-slate-500">Vencimiento</p><p className="font-bold">{displayDate(suscripcion.fecha_vencimiento)}</p></div>
          <div><p className="text-xs uppercase text-slate-500">Fin de gracia</p><p className="font-bold">{displayDate(suscripcion.fecha_fin_gracia)}</p></div>
          <div><p className="text-xs uppercase text-slate-500">Días de gracia</p><p className="font-bold">{suscripcion.dias_gracia}</p></div>
          <div><p className="text-xs uppercase text-slate-500">Días restantes</p><p className="font-bold">{suscripcion.dias_restantes ?? 'Sin límite'}</p></div>
          <div><p className="text-xs uppercase text-slate-500">Empresa</p><p className="font-bold">{suscripcion.estado_empresa}</p></div>
        </div>

        <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
          <label className="text-sm font-semibold">
            Motivo de renovación
            <input value={motivo} onChange={event => setMotivo(event.target.value)} placeholder="Ej. Renovación trimestral" className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-transparent px-3 font-normal dark:border-slate-700" />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {([1, 3, 6, 12] as const).map(months => (
              <button
                key={months}
                onClick={() => renew(months)}
                disabled={renewing !== null}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {renewing === months ? 'Renovando…' : `Renovar ${months} ${months === 1 ? 'mes' : 'meses'}`}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
          <h3 className="font-bold">Historial reciente</h3>
          <div className="mt-3 space-y-2">
            {historial.length === 0 ? <p className="text-sm text-slate-500">Sin movimientos registrados.</p> : historial.map(item => (
              <div key={item.id} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-bold">{item.tipo_evento.replaceAll('_', ' ')}</p>
                  <p className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString('es-GT')}</p>
                </div>
                <p className="mt-1 text-slate-500">
                  {item.estado_suscripcion_anterior || '—'} → {item.estado_suscripcion_nuevo || '—'}
                  {item.meses_renovados ? ` · ${item.meses_renovados} meses` : ''}
                </p>
                {item.motivo && <p className="mt-1">{item.motivo}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#191a1d]">
        <h2 className="font-bold">Administrador principal</h2>
        {empresa.administrador_principal ? (
          <div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-900">
            <p className="font-bold">{empresa.administrador_principal.name}</p>
            <p className="text-slate-500">{empresa.administrador_principal.username} · {empresa.administrador_principal.email}</p>
          </div>
        ) : (
          <form onSubmit={createAdmin} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Object.entries({ username: 'Usuario', email: 'Correo', password: 'Contraseña', nombres: 'Nombres', apellidos: 'Apellidos' }).map(([key, label]) => (
              <label key={key} className="text-sm font-semibold">
                {label}
                <input
                  type={key === 'password' ? 'password' : 'text'}
                  required={key !== 'apellidos'}
                  value={admin[key as keyof typeof admin]}
                  onChange={event => setAdmin({ ...admin, [key]: event.target.value })}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-transparent px-3 font-normal dark:border-slate-700"
                />
              </label>
            ))}
            <div className="sm:col-span-2"><button className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white">Crear administrador</button></div>
          </form>
        )}
      </section>
    </div>
  );
}
