import { Building2, Info, Loader2 } from 'lucide-react';
import { useAuth } from '../../store/useAuth';
import { useSucursalContext } from '../../store/useSucursalContext';

export default function SucursalSelector() {
  const user = useAuth(state => state.user);
  const { sucursales, sucursalActiva, loading, error, seleccionar } = useSucursalContext();
  if (!user || user.es_super_admin || user.role === 'superadmin') return null;

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center gap-2 rounded-lg px-2.5 h-[34px]"
        style={{ background: 'var(--color-surface-soft)', border: '1px solid var(--color-border)' }}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Building2 size={14} />}
        <select
          aria-label="Sucursal activa"
          value={sucursalActiva?.id ?? ''}
          disabled={loading || sucursales.length === 0}
          onChange={event => seleccionar(user.id, Number(event.target.value))}
          className="max-w-[170px] bg-transparent text-xs font-semibold outline-none disabled:opacity-60"
          style={{ color: 'var(--color-text)' }}
        >
          {sucursales.length === 0 && <option value="">Sin sucursales</option>}
          {sucursales.map(sucursal => (
            <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>
          ))}
        </select>
      </div>
      <span
        title="La selección de sucursal prepara el contexto; los módulos operativos se filtrarán en una fase posterior."
        className="hidden 2xl:inline-flex items-center gap-1 max-w-[230px] text-[10px] leading-tight"
        style={{ color: error ? '#ef4444' : 'var(--color-text-muted)' }}
      >
        <Info size={14} className="shrink-0" />
        {error || 'La selección prepara el contexto; el filtrado operativo llegará en una fase posterior.'}
      </span>
    </div>
  );
}
