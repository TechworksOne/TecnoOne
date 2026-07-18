import { useMemo } from 'react';
import SucursalManager from '../../components/sucursales/SucursalManager';
import { adminSucursalApi } from '../../services/sucursalService';

export default function SucursalesPage() {
  const api = useMemo(() => adminSucursalApi, []);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Sucursales</h1>
        <p className="mt-1 text-sm text-slate-500">Administra las sedes de la empresa. La selección de sucursal activa se habilitará en una fase posterior.</p>
      </div>
      <SucursalManager api={api} />
    </div>
  );
}
