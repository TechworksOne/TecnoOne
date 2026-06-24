import { Building2, Gauge, LogOut, Menu, ScrollText, Settings, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../store/useAuth';

const links = [
  { to: '/superadmin', label: 'Dashboard', icon: Gauge, end: true },
  { to: '/superadmin/empresas', label: 'Empresas', icon: Building2 },
  { to: '/superadmin/auditoria', label: 'Auditoría', icon: ScrollText },
  { to: '/superadmin/configuracion', label: 'Configuración', icon: Settings },
];

export default function SuperAdminLayout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-[#111214] dark:text-slate-100">
      {open && <button className="fixed inset-0 z-30 bg-black/45 md:hidden" onClick={() => setOpen(false)} aria-label="Cerrar menú" />}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-[#191a1d] md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
          <div>
            <p className="font-extrabold tracking-tight">TecnoOne</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-500">Plataforma</p>
          </div>
          <button onClick={() => setOpen(false)} className="md:hidden"><X size={18} /></button>
        </div>
        <nav className="space-y-1 p-3">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
              <Icon size={17} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute inset-x-3 bottom-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <p className="truncate text-sm font-semibold">{user?.name || user?.username}</p>
          <p className="truncate text-xs text-slate-500">{user?.email}</p>
          <button onClick={logout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold dark:bg-slate-800">
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="md:pl-64">
        <header className="flex h-16 items-center border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-[#191a1d] sm:px-6">
          <button onClick={() => setOpen(true)} className="mr-3 md:hidden"><Menu size={20} /></button>
          <p className="text-sm font-semibold text-slate-500">Administración global de la plataforma</p>
        </header>
        <main className="p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
