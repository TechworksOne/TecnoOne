import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { RefreshCw } from 'lucide-react';

import Button from '../ui/Button';

import { useAuth } from '../../store/useAuth';
import { useSucursalContext } from '../../store/useSucursalContext';

import {
  cajaSesionApi,
  cajaSesionError,
  type CajaSesion,
} from '../../services/cajaSesionService';

function q(value?: number | null) {
  if (
    value === null ||
    value === undefined
  ) {
    return '—';
  }

  return `Q${(
    Number(value) / 100
  ).toLocaleString('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fecha(value?: string | null) {
  if (!value) return '—';

  return new Date(value).toLocaleString(
    'es-GT',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  );
}

export default function CajaSesionHistorial() {
  const { hasPermission } = useAuth();

  const contextVersion =
    useSucursalContext(
      state => state.contextVersion,
    );

  const branchMode =
    useSucursalContext(state => state.mode);

  const canView =
    hasPermission('cajas.sesion.ver');

  const [rows, setRows] =
    useState<CajaSesion[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canView) {
      setRows([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data =
        await cajaSesionApi.getHistorial(25);

      setRows(
        data.filter(
          row => row.estado === 'CERRADA',
        ),
      );
    } catch (e) {
      setRows([]);

      setError(
        cajaSesionError(
          e,
          'No fue posible consultar el historial de cierres.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    void load();
  }, [load, contextVersion, branchMode]);

  useEffect(() => {
    const refresh = () => {
      void load();
    };

    window.addEventListener(
      'caja-sesion-updated',
      refresh,
    );

    return () => {
      window.removeEventListener(
        'caja-sesion-updated',
        refresh,
      );
    };
  }, [load]);

  if (!canView) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold text-slate-900 dark:text-slate-100">
            Historial de cierres
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {branchMode === 'consolidated'
              ? 'Cierres de todas las sucursales a las que tienes acceso.'
              : 'Cierres de la sucursal seleccionada.'}
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw
            size={14}
            className={
              loading ? 'animate-spin' : ''
            }
          />
          Actualizar
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">
          Consultando cierres…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
          Aún no hay cierres de caja registrados.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
                <th className="px-3 py-3">Cierre</th>
                <th className="px-3 py-3">Sucursal</th>
                <th className="px-3 py-3">Caja</th>
                <th className="px-3 py-3">Usuario</th>
                <th className="px-3 py-3 text-right">
                  Fondo inicial
                </th>
                <th className="px-3 py-3 text-right">
                  Esperado
                </th>
                <th className="px-3 py-3 text-right">
                  Contado
                </th>
                <th className="px-3 py-3 text-right">
                  Diferencia
                </th>
                <th className="px-3 py-3 text-right">
                  Dejado
                </th>
                <th className="px-3 py-3 text-right">
                  Retirado
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map(row => (
                <tr
                  key={row.id}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-800/70"
                >
                  <td className="whitespace-nowrap px-3 py-3">
                    {fecha(row.fecha_cierre)}
                  </td>

                  <td className="px-3 py-3">
                    {row.sucursal_nombre}
                  </td>

                  <td className="px-3 py-3">
                    <p className="font-medium">
                      {row.caja_nombre}
                    </p>

                    <p className="text-xs text-slate-500">
                      {row.caja_codigo}
                    </p>
                  </td>

                  <td className="px-3 py-3">
                    {row.usuario_apertura_username ||
                      `#${row.usuario_apertura_id}`}
                  </td>

                  <td className="px-3 py-3 text-right tabular-nums">
                    {q(row.fondo_inicial_centavos)}
                  </td>

                  <td className="px-3 py-3 text-right tabular-nums">
                    {q(
                      row.efectivo_esperado_centavos,
                    )}
                  </td>

                  <td className="px-3 py-3 text-right tabular-nums">
                    {q(
                      row.efectivo_contado_centavos,
                    )}
                  </td>

                  <td
                    className={`px-3 py-3 text-right font-medium tabular-nums ${
                      row.diferencia_centavos === 0
                        ? 'text-emerald-600'
                        : 'text-red-600'
                    }`}
                  >
                    {q(row.diferencia_centavos)}
                  </td>

                  <td className="px-3 py-3 text-right tabular-nums">
                    {q(
                      row.fondo_siguiente_centavos,
                    )}
                  </td>

                  <td className="px-3 py-3 text-right font-medium tabular-nums">
                    {q(
                      row.retiro_cierre_centavos,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
