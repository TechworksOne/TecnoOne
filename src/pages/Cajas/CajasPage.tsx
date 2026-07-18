import { useMemo } from 'react';
import CajaManager from '../../components/cajas/CajaManager';
import { empresaCajaApi } from '../../services/cajaCatalogoService';
import { useSucursalContext } from '../../store/useSucursalContext';

export default function CajasPage() {
  const sucursalActiva = useSucursalContext(state => state.sucursalActiva);
  const api = useMemo(() => empresaCajaApi, []);
  return <div className="space-y-5"><div><h1 className="text-2xl font-extrabold">Catálogo de cajas</h1><p className="mt-1 text-sm text-slate-500">Sucursal activa: {sucursalActiva?.nombre || 'sin seleccionar'}</p></div><CajaManager api={api} sucursalActivaId={sucursalActiva?.id}/></div>;
}
