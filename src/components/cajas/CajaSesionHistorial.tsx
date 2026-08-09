import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ChevronDown,
  ChevronUp,
  History,
  RefreshCw,
} from 'lucide-react';

import Button from '../ui/Button';
import Modal from '../ui/Modal';

import { useAuth } from '../../store/useAuth';
import { useSucursalContext } from '../../store/useSucursalContext';

import {
  cajaSesionApi,
  cajaSesionError,
  type CajaSesion,
  type CajaSesionDetalle,
  type CajaSesionMovimientoDetalle,
} from '../../services/cajaSesionService';

function money(value?: number | null) {
  if (
    value === null ||
    value === undefined
  ) {
    return '—';
  }

  const amount = Number(value) / 100;

  return `${amount < 0 ? '-' : ''}Q${Math.abs(
    amount,
  ).toLocaleString('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function signedMoney(
  value: number,
  negative = false,
) {
  return `${negative ? '-' : '+'}${money(
    Math.abs(Number(value)),
  )}`;
}

function fechaHora(value?: string | null) {
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

function hora(value?: string | null) {
  if (!value) return '—';

  return new Date(value).toLocaleTimeString(
    'es-GT',
    {
      hour: '2-digit',
      minute: '2-digit',
    },
  );
}

function movimientoTitulo(
  movimiento: CajaSesionMovimientoDetalle,
) {
  if (movimiento.fuente === 'VENTA') {
    const documento =
      movimiento.documento ||
      `#${movimiento.entidad_id}`;

    return movimiento.accion === 'REVERSA'
      ? `Reversa venta ${documento}`
      : `Venta ${documento}`;
  }

  if (movimiento.accion === 'REVERSA') {
    return 'Devolución de reparación';
  }

  return Number(movimiento.pago_indice) === 0
    ? 'Anticipo de reparación'
    : 'Pago de reparación';
}

export default function CajaSesionHistorial() {
  const { hasPermission } = useAuth();

  const contextVersion =
    useSucursalContext(
      state => state.contextVersion,
    );

  const branchMode =
    useSucursalContext(
      state => state.mode,
    );

  const canView =
    hasPermission('cajas.sesion.ver');

  const [open, setOpen] =
    useState(false);

  const [rows, setRows] =
    useState<CajaSesion[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [selectedId, setSelectedId] =
    useState<number | null>(null);

  const [detalle, setDetalle] =
    useState<CajaSesionDetalle | null>(
      null,
    );

  const [
    detalleLoading,
    setDetalleLoading,
  ] = useState(false);

  const [
    detalleError,
    setDetalleError,
  ] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canView) {
      setRows([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data =
        await cajaSesionApi.getHistorial(
          50,
        );

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
    if (open) {
      void load();
    }
  }, [
    open,
    load,
    contextVersion,
    branchMode,
  ]);

  useEffect(() => {
    const refresh = () => {
      if (open) {
        void load();
      }
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
  }, [load, open]);

  async function toggleDetalle(
    sesionId: number,
  ) {
    if (selectedId === sesionId) {
      setSelectedId(null);
      setDetalle(null);
      setDetalleError(null);
      return;
    }

    setSelectedId(sesionId);
    setDetalle(null);
    setDetalleError(null);
    setDetalleLoading(true);

    try {
      const data =
        await cajaSesionApi.getDetalle(
          sesionId,
        );

      setDetalle(data);
    } catch (e) {
      setDetalleError(
        cajaSesionError(
          e,
          'No fue posible consultar los movimientos de esta sesión.',
        ),
      );
    } finally {
      setDetalleLoading(false);
    }
  }

  if (!canView) {
    return null;
  }

  return (
    <>
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
        >
          <History size={15} />
          Historial de cierres
        </Button>
      </div>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setSelectedId(null);
          setDetalle(null);
          setDetalleError(null);
        }}
        title="Historial de Caja Operativa"
        size="5xl"
      >
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {branchMode === 'consolidated'
                  ? 'Cierres de todas las sucursales autorizadas.'
                  : 'Cierres de la sucursal seleccionada.'}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Consulta qué entró, qué se devolvió
                y cómo terminó cada sesión de caja.
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
                  loading
                    ? 'animate-spin'
                    : ''
                }
              />
              Actualizar
            </Button>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
              {error}
            </div>
          )}

          {loading &&
          rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Consultando cierres…
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
              Aún no hay cierres de caja registrados.
            </div>
          ) : (
            <div className="space-y-4">
              {rows.map(row => {
                const ventasIngresos =
                  Number(
                    row.ventas_ingresos_centavos ||
                      0,
                  );

                const ventasReversas =
                  Number(
                    row.ventas_reversas_centavos ||
                      0,
                  );

                const reparacionesIngresos =
                  Number(
                    row.reparaciones_ingresos_centavos ||
                      0,
                  );

                const reparacionesReversas =
                  Number(
                    row.reparaciones_reversas_centavos ||
                      0,
                  );

                const reversas =
                  ventasReversas +
                  reparacionesReversas;

                const neto =
                  Number(
                    row.movimientos_efectivo_centavos ??
                      (
                        ventasIngresos -
                        ventasReversas +
                        reparacionesIngresos -
                        reparacionesReversas
                      ),
                  );

                const expanded =
                  selectedId === row.id;

                return (
                  <article
                    key={row.id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="p-4 md:p-5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-slate-900 dark:text-slate-100">
                              {row.caja_nombre}
                            </h3>

                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              Cerrada
                            </span>
                          </div>

                          <p className="mt-1 text-sm text-slate-500">
                            {row.sucursal_nombre}
                            {' · '}
                            {row.caja_codigo}
                          </p>

                          <p className="mt-2 text-xs text-slate-500">
                            Apertura:{' '}
                            {fechaHora(
                              row.fecha_apertura,
                            )}
                            {' · '}
                            Cierre:{' '}
                            {fechaHora(
                              row.fecha_cierre,
                            )}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Abrió:{' '}
                            {row.usuario_apertura_username ||
                              `Usuario #${row.usuario_apertura_id}`}

                            {row.cerrado_por_username
                              ? ` · Cerró: ${row.cerrado_por_username}`
                              : ''}
                          </p>
                        </div>

                        <Button
                          variant="outline"
                          onClick={() =>
                            void toggleDetalle(
                              row.id,
                            )
                          }
                        >
                          {expanded ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}

                          {expanded
                            ? 'Ocultar movimientos'
                            : 'Ver movimientos'}
                        </Button>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/40">
                          <p className="text-xs text-slate-500">
                            Fondo inicial
                          </p>

                          <p className="mt-1 font-bold">
                            {money(
                              row.fondo_inicial_centavos,
                            )}
                          </p>
                        </div>

                        <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/20">
                          <p className="text-xs text-slate-500">
                            Ventas efectivo
                          </p>

                          <p className="mt-1 font-bold text-emerald-600 dark:text-emerald-400">
                            {signedMoney(
                              ventasIngresos,
                            )}
                          </p>
                        </div>

                        <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/20">
                          <p className="text-xs text-slate-500">
                            Reparaciones efectivo
                          </p>

                          <p className="mt-1 font-bold text-emerald-600 dark:text-emerald-400">
                            {signedMoney(
                              reparacionesIngresos,
                            )}
                          </p>
                        </div>

                        <div className="rounded-xl bg-red-50 p-3 dark:bg-red-950/20">
                          <p className="text-xs text-slate-500">
                            Reversas / devoluciones
                          </p>

                          <p className="mt-1 font-bold text-red-600 dark:text-red-400">
                            {signedMoney(
                              reversas,
                              true,
                            )}
                          </p>

                          <p className="mt-1 text-[11px] text-slate-500">
                            Ventas{' '}
                            {money(
                              ventasReversas,
                            )}
                            {' · '}
                            Reparaciones{' '}
                            {money(
                              reparacionesReversas,
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                          <p className="text-xs text-slate-500">
                            Movimiento neto
                          </p>

                          <p
                            className={`mt-1 font-bold ${
                              neto < 0
                                ? 'text-red-600'
                                : neto > 0
                                  ? 'text-emerald-600'
                                  : ''
                            }`}
                          >
                            {neto > 0 ? '+' : ''}
                            {money(neto)}
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                          <p className="text-xs text-slate-500">
                            Efectivo esperado
                          </p>

                          <p className="mt-1 font-bold">
                            {money(
                              row.efectivo_esperado_centavos,
                            )}
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                          <p className="text-xs text-slate-500">
                            Efectivo contado
                          </p>

                          <p className="mt-1 font-bold">
                            {money(
                              row.efectivo_contado_centavos,
                            )}
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                          <p className="text-xs text-slate-500">
                            Diferencia
                          </p>

                          <p
                            className={`mt-1 font-bold ${
                              Number(
                                row.diferencia_centavos ||
                                  0,
                              ) === 0
                                ? 'text-emerald-600'
                                : 'text-red-600'
                            }`}
                          >
                            {money(
                              row.diferencia_centavos,
                            )}
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                          <p className="text-xs text-slate-500">
                            Dejado en caja
                          </p>

                          <p className="mt-1 font-bold">
                            {money(
                              row.fondo_siguiente_centavos,
                            )}
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                          <p className="text-xs text-slate-500">
                            Retirado al cierre
                          </p>

                          <p className="mt-1 font-bold">
                            {money(
                              row.retiro_cierre_centavos,
                            )}
                          </p>
                        </div>
                      </div>

                      {row.notas_cierre && (
                        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-950/40 dark:text-slate-300">
                          <strong>
                            Nota de cierre:
                          </strong>{' '}
                          {row.notas_cierre}
                        </div>
                      )}
                    </div>

                    {expanded && (
                      <div className="border-t border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/30 md:p-5">
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                          Movimientos de la sesión
                        </h4>

                        {detalleLoading ? (
                          <div className="py-6 text-sm text-slate-500">
                            Consultando movimientos…
                          </div>
                        ) : detalleError ? (
                          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
                            {detalleError}
                          </div>
                        ) : detalle &&
                          detalle.sesion.id ===
                            row.id ? (
                          detalle.movimientos.length ===
                          0 ? (
                            <div className="mt-3 rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700">
                              No hay movimientos
                              vinculados a esta sesión.
                            </div>
                          ) : (
                            <div className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                              {detalle.movimientos.map(
                                movimiento => {
                                  const reversa =
                                    movimiento.accion ===
                                    'REVERSA';

                                  return (
                                    <div
                                      key={`${movimiento.fuente}-${movimiento.movimiento_id}`}
                                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                      <div>
                                        <p className="font-medium text-slate-900 dark:text-slate-100">
                                          {movimientoTitulo(
                                            movimiento,
                                          )}
                                        </p>

                                        {movimiento.cliente_nombre && (
                                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                            {movimiento.cliente_nombre}
                                          </p>
                                        )}

                                        {movimiento.detalle_principal && (
                                          <p className="text-xs text-slate-500">
                                            {movimiento.detalle_principal}
                                          </p>
                                        )}

                                        <p className="mt-1 text-xs text-slate-500">
                                          {movimiento.fuente ===
                                          'REPARACION'
                                            ? `${movimiento.documento || movimiento.entidad_id} · `
                                            : ''}

                                          {hora(
                                            movimiento.created_at,
                                          )}
                                          {' · '}
                                          {movimiento.usuario_username ||
                                            (
                                              movimiento.usuario_id
                                                ? `Usuario #${movimiento.usuario_id}`
                                                : 'Sistema'
                                            )}

                                          {movimiento.referencia
                                            ? ` · ${movimiento.referencia}`
                                            : ''}
                                        </p>
                                      </div>

                                      <p
                                        className={`font-bold tabular-nums ${
                                          reversa
                                            ? 'text-red-600 dark:text-red-400'
                                            : 'text-emerald-600 dark:text-emerald-400'
                                        }`}
                                      >
                                        {signedMoney(
                                          movimiento.monto_centavos,
                                          reversa,
                                        )}
                                      </p>
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          )
                        ) : null}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
