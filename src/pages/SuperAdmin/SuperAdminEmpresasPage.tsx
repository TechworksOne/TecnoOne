import { ChevronLeft, ChevronRight, Eye, Pencil, Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { superAdminService, type EmpresaGlobal } from '../../services/superAdminService';

export default function SuperAdminEmpresasPage() {
  const [rows, setRows] = useState<EmpresaGlobal[]>([]);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      superAdminService.getEmpresas({ page, limit: 20, search: search || undefined, estado: estado || undefined })
        .then(response => {
          setRows(response.data);
          setPages(Math.max(1, response.pagination.totalPages));
          setTotal(response.pagination.total);
          setError('');
        })
        .catch(() => setError('No fue posible cargar las empresas.'))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [page, search, estado]);

  async function toggleState(empresa: EmpresaGlobal) {
    const next = empresa.estado.toLowerCase() === 'suspendida' ? 'activa' : 'suspendida';
    await superAdminService.updateEstado(empresa.id, next);
    setRows(current => current.map(item => item.id === empresa.id ? { ...item, estado: next } : item));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-extrabold">Empresas</h1><p className="text-sm text-slate-500">{total} empresas registradas</p></div>
        <Link to="/superadmin/empresas/nueva" className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"><Plus size={16} /> Crear empresa</Link>
      </div>
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#191a1d] sm:grid-cols-[1fr_220px]">
        <div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar por nombre o NIT" className="h-10 w-full rounded-xl border border-slate-200 bg-transparent pl-9 pr-3 text-sm dark:border-slate-700" /></div>
        <select value={estado} onChange={e => { setEstado(e.target.value); setPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-slate-700">
          <option value="">Todos los estados</option>
          {['demo', 'prueba', 'activa', 'suspendida', 'cancelada'].map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>
      {error && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#191a1d]">
        <div className="overflow-x-auto">
          <table className="min-w-[850px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900"><tr>{['Empresa', 'NIT', 'Estado', 'Plan', 'Usuarios', 'Creada', 'Acciones'].map(item => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? <tr><td colSpan={7} className="p-10 text-center text-slate-500">Cargando…</td></tr> : rows.length === 0 ? <tr><td colSpan={7} className="p-10 text-center text-slate-500">No hay empresas.</td></tr> : rows.map(row => (
                <tr key={row.id}>
                  <td className="px-4 py-3"><p className="font-bold">{row.nombre_comercial || row.nombre}</p><p className="text-xs text-slate-500">{row.slug}</p></td>
                  <td className="px-4 py-3">{row.nit || '—'}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold uppercase text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">{row.estado}</span></td>
                  <td className="px-4 py-3">{row.plan}</td><td className="px-4 py-3">{row.total_usuarios}</td>
                  <td className="px-4 py-3">{new Date(row.created_at).toLocaleDateString('es-GT')}</td>
                  <td className="px-4 py-3"><div className="flex gap-2"><Link title="Ver" to={`/superadmin/empresas/${row.id}`} className="rounded-lg border p-2 dark:border-slate-700"><Eye size={15} /></Link><Link title="Editar" to={`/superadmin/empresas/${row.id}?editar=1`} className="rounded-lg border p-2 dark:border-slate-700"><Pencil size={15} /></Link><button onClick={() => toggleState(row)} disabled={row.estado.toLowerCase() === 'cancelada'} className="rounded-lg border px-3 text-xs font-semibold dark:border-slate-700 disabled:opacity-40">{row.estado.toLowerCase() === 'suspendida' ? 'Activar' : 'Suspender'}</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800"><span className="text-sm text-slate-500">Página {page} de {pages}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border p-2 disabled:opacity-40 dark:border-slate-700"><ChevronLeft size={16} /></button><button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-lg border p-2 disabled:opacity-40 dark:border-slate-700"><ChevronRight size={16} /></button></div></div>
      </div>
    </div>
  );
}
