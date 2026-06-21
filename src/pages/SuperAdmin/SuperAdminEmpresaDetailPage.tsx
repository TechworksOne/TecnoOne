import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { superAdminService, type EmpresaGlobal } from '../../services/superAdminService';

export default function SuperAdminEmpresaDetailPage() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const [empresa, setEmpresa] = useState<EmpresaGlobal | null>(null);
  const [edit, setEdit] = useState(searchParams.get('editar') === '1');
  const [admin, setAdmin] = useState({ username: '', email: '', password: '', nombres: '', apellidos: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { superAdminService.getEmpresa(id).then(setEmpresa).catch(() => setError('Empresa no encontrada.')); }, [id]);
  if (!empresa) return <div className="rounded-2xl bg-white p-8 dark:bg-[#191a1d]">{error || 'Cargando…'}</div>;

  async function save() {
    try { const updated = await superAdminService.updateEmpresa(id, empresa as any); setEmpresa(updated); setEdit(false); setMessage('Empresa actualizada.'); }
    catch (requestError: any) { setError(requestError?.response?.data?.message || 'No fue posible actualizar.'); }
  }
  async function createAdmin(event: React.FormEvent) {
    event.preventDefault();
    try { await superAdminService.createAdministrador(id, admin); setMessage('Administrador principal creado.'); setEmpresa(await superAdminService.getEmpresa(id)); }
    catch (requestError: any) { setError(requestError?.response?.data?.message || 'No fue posible crear el administrador.'); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-extrabold">{empresa.nombre_comercial || empresa.nombre}</h1><p className="text-sm text-slate-500">{empresa.slug} · {empresa.estado}</p></div><button onClick={() => setEdit(!edit)} className="rounded-xl border px-4 py-2 text-sm font-semibold dark:border-slate-700">{edit ? 'Cancelar edición' : 'Editar'}</button></div>
      {message && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}{error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#191a1d] sm:grid-cols-2">
        {(['nombre','nombre_comercial','razon_social','nit','plan','telefono','email','direccion'] as const).map(key => <label key={key} className="text-xs font-bold uppercase text-slate-500">{key.replaceAll('_',' ')}<input disabled={!edit} value={(empresa as any)[key] || ''} onChange={e => setEmpresa({ ...empresa, [key]: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-transparent px-3 text-sm font-normal text-slate-900 disabled:opacity-70 dark:border-slate-700 dark:text-slate-100" /></label>)}
        {edit && <div className="sm:col-span-2 text-right"><button onClick={save} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white">Guardar cambios</button></div>}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#191a1d]">
        <h2 className="font-bold">Administrador principal</h2>
        {empresa.administrador_principal ? <div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-900"><p className="font-bold">{empresa.administrador_principal.name}</p><p className="text-slate-500">{empresa.administrador_principal.username} · {empresa.administrador_principal.email}</p></div> : (
          <form onSubmit={createAdmin} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Object.entries({ username: 'Usuario', email: 'Correo', password: 'Contraseña', nombres: 'Nombres', apellidos: 'Apellidos' }).map(([key,label]) => <label key={key} className="text-sm font-semibold">{label}<input type={key === 'password' ? 'password' : 'text'} required={key !== 'apellidos'} value={(admin as any)[key]} onChange={e => setAdmin({ ...admin, [key]: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-transparent px-3 font-normal dark:border-slate-700" /></label>)}
            <div className="sm:col-span-2"><button className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white">Crear administrador</button></div>
          </form>
        )}
      </section>
    </div>
  );
}
