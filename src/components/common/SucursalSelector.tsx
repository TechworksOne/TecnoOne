import { Building2, Info, Loader2 } from 'lucide-react';
import { useAuth } from '../../store/useAuth';
import { useSucursalContext } from '../../store/useSucursalContext';
export default function SucursalSelector() {
  const user = useAuth(state => state.user);
  const {
    sucursales,
    sucursalActiva,
    mode,
    canUseConsolidated,
    loading,
    error,
    seleccionar,
  } = useSucursalContext();
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
          value={mode === 'consolidated' ? 'ALL' : (sucursalActiva?.id ?? '')}
          disabled={loading || sucursales.length === 0}
          onChange={event => seleccionar(
            user.id,
            event.target.value === 'ALL' ? 'ALL' : Number(event.target.value),
          )}
          className="max-w-[170px] bg-transparent text-xs font-semibold outline-none disabled:opacity-60"
          style={{ color: 'var(--color-text)' }}
        >
          {sucursales.length === 0 && <option value="">Sin sucursales</option>}
          {canUseConsolidated && <option value="ALL">Todas las sucursales</option>}
          {sucursales.map(sucursal => (
            <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>
          ))}
        </select>
      </div>
      {error && (
        <span
          className="hidden 2xl:inline-flex items-center gap-1 max-w-[230px] text-[10px] leading-tight"
          style={{ color: '#ef4444' }}
        >
          <Info size={14} className="shrink-0" />
          {error}
        </span>
      )}
    </div>
  );
}
