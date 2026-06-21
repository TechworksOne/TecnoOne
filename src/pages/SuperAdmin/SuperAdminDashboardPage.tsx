import { Ban, Building2, FlaskConical, ShieldCheck, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { superAdminService, type SuperAdminSummary } from '../../services/superAdminService';

export default function SuperAdminDashboardPage() {
  const [summary, setSummary] = useState<SuperAdminSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    superAdminService.getMe()
      .then(data => setSummary(data.resumen))
      .catch(() => setError('No fue posible cargar el resumen de plataforma.'));
  }, []);

  const cards = summary ? [
    ['Empresas totales', summary.empresas_totales, Building2],
    ['Empresas activas', summary.empresas_activas, ShieldCheck],
    ['Empresas demo', summary.empresas_demo, FlaskConical],
    ['Empresas suspendidas', summary.empresas_suspendidas, Building2],
    ['Empresas canceladas', summary.empresas_canceladas, Ban],
    ['Usuarios empresariales', summary.usuarios_totales, Users],
  ] as const : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Dashboard de plataforma</h1>
        <p className="mt-1 text-sm text-slate-500">Vista global de TecnoOne SaaS.</p>
      </div>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {!summary && !error ? (
        <div className="h-40 animate-pulse rounded-2xl bg-white dark:bg-[#191a1d]" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {cards.map(([label, value, Icon]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#191a1d]">
              <Icon size={19} className="text-blue-500" />
              <p className="mt-4 text-3xl font-extrabold">{value}</p>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
