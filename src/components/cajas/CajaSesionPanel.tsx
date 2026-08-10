import { useCallback, useEffect, useState } from 'react';
import {
  Banknote,
  Clock,
  Lock,
  RefreshCw,
  Unlock,
  Wallet,
} from 'lucide-react';

import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';

import { useAuth } from '../../store/useAuth';
import { useSucursalContext } from '../../store/useSucursalContext';

import {
  empresaCajaApi,
  type CajaCatalogo,
} from '../../services/cajaCatalogoService';

import {
  cajaSesionApi,
  cajaSesionError,
  type CajaSesion,
  type CajaSesionResumen,
  type CajaSesionDetalle,
  type CajaSesionMovimientoDetalle,
  type CierreCajaSesion,
} from '../../services/cajaSesionService';

function qDesdeCentavos(value: number | null | undefined) {
  return (Number(value || 0) / 100).toLocaleString(
    'es-GT',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  );
}

function fechaHora(value?: string | null) {
  if (!value) return '—';

  return new Date(value).toLocaleString('es-GT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function horaMovimiento(
  value?: string | null,
) {
  if (!value) return '—';

  return new Date(value).toLocaleTimeString(
    'es-GT',
    {
      hour: '2-digit',
      minute: '2-digit',
    },
  );
}

function movimientoEsEntradaCaja(
  movimiento: CajaSesionMovimientoDetalle,
) {
  if (movimiento.fuente === 'COMPRA') {
    return movimiento.accion === 'REVERSA';
  }

  return String(movimiento.accion) === 'INGRESO';
}

function tituloMovimientoCaja(
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

  if (movimiento.fuente === 'COMPRA') {
    const documento =
      movimiento.documento ||
      `#${movimiento.entidad_id}`;

    return movimiento.accion === 'REVERSA'
      ? `Anulación compra ${documento}`
      : `Compra ${documento}`;
  }

  if (movimiento.accion === 'REVERSA') {
    return 'Devolución de reparación';
  }

  return Number(movimiento.pago_indice) === 0
    ? 'Anticipo de reparación'
    : 'Pago de reparación';
}

export default function CajaSesionPanel() {
  const { hasPermission } = useAuth();

  const branchMode =
    useSucursalContext(state => state.mode);

  const sucursalActiva =
    useSucursalContext(state => state.sucursalActiva);

  const contextVersion =
    useSucursalContext(state => state.contextVersion);

  const canOperate =
    hasPermission('cajas.sesion.operar');

  const canViewMovimientos =
    hasPermission('cajas.sesion.ver');

  const [sesion, setSesion] =
    useState<CajaSesion | null>(null);

  const [resumen, setResumen] =
    useState<CajaSesionResumen | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [cajas, setCajas] =
    useState<CajaCatalogo[]>([]);

  const [showAbrir, setShowAbrir] =
    useState(false);

  const [showCerrar, setShowCerrar] =
    useState(false);

  const [cajaId, setCajaId] =
    useState('');

  const [fondoInicial, setFondoInicial] =
    useState('0.00');

  const [
    fondoSugeridoCentavos,
    setFondoSugeridoCentavos,
  ] = useState<number | null>(null);

  const [
    fechaCierreAnterior,
    setFechaCierreAnterior,
  ] = useState<string | null>(null);

  const [
    loadingSugerencia,
    setLoadingSugerencia,
  ] = useState(false);

  const [efectivoContado, setEfectivoContado] =
    useState('');

  const [fondoSiguiente, setFondoSiguiente] =
    useState('0.00');

  const [notasCierre, setNotasCierre] =
    useState('');

  const [saving, setSaving] =
    useState(false);

  const [ultimoCierre, setUltimoCierre] =
    useState<CierreCajaSesion | null>(null);

  const [
    showMovimientos,
    setShowMovimientos,
  ] = useState(false);

  const [
    detalleSesion,
    setDetalleSesion,
  ] = useState<CajaSesionDetalle | null>(
    null,
  );

  const [
    loadingMovimientos,
    setLoadingMovimientos,
  ] = useState(false);

  const [
    errorMovimientos,
    setErrorMovimientos,
  ] = useState<string | null>(null);

  const loadActiva = useCallback(async () => {
    if (
      !canOperate ||
      branchMode !== 'specific'
    ) {
      setSesion(null);
      setResumen(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [activa, resumenActual] =
        await Promise.all([
          cajaSesionApi.getActiva(),
          cajaSesionApi.getResumenActiva(),
        ]);

      setSesion(activa);
      setResumen(resumenActual);
    } catch (e) {
      setSesion(null);
      setResumen(null);
      setError(
        cajaSesionError(
          e,
          'No fue posible consultar la sesión de caja.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [branchMode, canOperate]);

  const cargarMovimientosActuales =
    async () => {
      if (
        !sesion ||
        !canViewMovimientos
      ) {
        return;
      }

      setLoadingMovimientos(true);
      setErrorMovimientos(null);

      try {
        const data =
          await cajaSesionApi.getDetalle(
            sesion.id,
          );

        setDetalleSesion(data);
      } catch (e) {
        setDetalleSesion(null);

        setErrorMovimientos(
          cajaSesionError(
            e,
            'No fue posible consultar los movimientos de la sesión actual.',
          ),
        );
      } finally {
        setLoadingMovimientos(false);
      }
    };

  const abrirMovimientosActuales =
    () => {
      setShowMovimientos(true);
      void cargarMovimientosActuales();
    };

  useEffect(() => {
    void loadActiva();
  }, [loadActiva, contextVersion]);

  useEffect(() => {
    if (
      !showAbrir ||
      !cajaId ||
      branchMode !== 'specific'
    ) {
      setFondoSugeridoCentavos(null);
      setFechaCierreAnterior(null);
      setLoadingSugerencia(false);
      return;
    }

    let cancelled = false;

    const cargar = async () => {
      setLoadingSugerencia(true);
      setError(null);

      try {
        const sugerencia =
          await cajaSesionApi.getSugerenciaApertura(
            Number(cajaId),
          );

        if (cancelled) return;

        setFondoSugeridoCentavos(
          sugerencia.fondo_sugerido_centavos,
        );

        setFechaCierreAnterior(
          sugerencia.fecha_cierre_anterior,
        );

        if (
          sugerencia.fondo_sugerido_centavos !== null
        ) {
          setFondoInicial(
            (
              sugerencia.fondo_sugerido_centavos /
              100
            ).toFixed(2),
          );
        } else {
          setFondoInicial('0.00');
        }
      } catch (e) {
        if (cancelled) return;

        setFondoSugeridoCentavos(null);
        setFechaCierreAnterior(null);

        setError(
          cajaSesionError(
            e,
            'No fue posible consultar el último cierre de esta caja.',
          ),
        );
      } finally {
        if (!cancelled) {
          setLoadingSugerencia(false);
        }
      }
    };

    void cargar();

    return () => {
      cancelled = true;
    };
  }, [branchMode, cajaId, showAbrir]);

  if (!canOperate) {
    return null;
  }

  if (branchMode !== 'specific') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
        <div className="flex items-start gap-3">
          <Lock
            size={20}
            className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
          />

          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              Sesión operativa de caja
            </p>

            <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
              Selecciona una sucursal específica para abrir,
              consultar o cerrar una caja.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const abrirModal = async () => {
    setError(null);
    setUltimoCierre(null);
    setFondoSugeridoCentavos(null);
    setFechaCierreAnterior(null);

    try {
      const rows = await empresaCajaApi.listar();
      const activas = rows.filter(
        row => Boolean(row.activa),
      );

      setCajas(activas);

      if (activas.length === 1) {
        setCajaId(String(activas[0].id));
      } else {
        setCajaId('');
      }

      setFondoInicial('0.00');
      setShowAbrir(true);
    } catch (e) {
      setError(
        cajaSesionError(
          e,
          'No fue posible cargar las cajas de la sucursal.',
        ),
      );
    }
  };

  const abrirSesion = async () => {
    const selected = Number(cajaId);
    const fondoQ = Number(fondoInicial);

    if (
      !Number.isInteger(selected) ||
      selected <= 0
    ) {
      setError('Selecciona una caja.');
      return;
    }

    if (
      !Number.isFinite(fondoQ) ||
      fondoQ < 0
    ) {
      setError(
        'El fondo inicial debe ser un monto válido.',
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const nueva =
        await cajaSesionApi.abrir({
          cajaId: selected,
          fondoInicialCentavos:
            Math.round(fondoQ * 100),
        });

      setSesion(nueva);

      const resumenActual =
        await cajaSesionApi.getResumenActiva();

      setResumen(resumenActual);
      setShowAbrir(false);
      setUltimoCierre(null);

      window.dispatchEvent(
        new Event('caja-sesion-updated'),
      );
    } catch (e) {
      setError(
        cajaSesionError(
          e,
          'No fue posible abrir la caja.',
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const prepararCierre = () => {
    setError(null);
    setEfectivoContado('');

    setFondoSiguiente(
      sesion
        ? (
            Number(
              sesion.fondo_inicial_centavos || 0,
            ) / 100
          ).toFixed(2)
        : '0.00',
    );

    setNotasCierre('');
    setShowCerrar(true);
  };

  const cerrarSesion = async () => {
    if (!sesion) return;

    const contadoQ = Number(efectivoContado);
    const fondoSiguienteQ =
      Number(fondoSiguiente);

    if (
      !Number.isFinite(contadoQ) ||
      contadoQ < 0
    ) {
      setError(
        'Ingresa el efectivo físico contado.',
      );
      return;
    }

    if (
      !Number.isFinite(fondoSiguienteQ) ||
      fondoSiguienteQ < 0
    ) {
      setError(
        'Ingresa cuánto efectivo quedará en caja para el próximo turno.',
      );
      return;
    }

    if (fondoSiguienteQ > contadoQ) {
      setError(
        'El efectivo que quedará en caja no puede superar el efectivo contado.',
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const cierre =
        await cajaSesionApi.cerrar(
          sesion.id,
          {
            efectivoContadoCentavos:
              Math.round(contadoQ * 100),

            fondoSiguienteCentavos:
              Math.round(
                fondoSiguienteQ * 100,
              ),

            notasCierre:
              notasCierre.trim() || null,
          },
        );

      setUltimoCierre(cierre);
      setSesion(null);
      setResumen(null);
      setShowCerrar(false);

      window.dispatchEvent(
        new Event('caja-sesion-updated'),
      );
    } catch (e) {
      setError(
        cajaSesionError(
          e,
          'No fue posible cerrar la caja.',
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className={`rounded-2xl border p-4 md:p-5 shadow-sm ${
          sesion
            ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20'
            : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={`rounded-xl p-2.5 ${
                sesion
                  ? 'bg-emerald-100 dark:bg-emerald-950/50'
                  : 'bg-slate-100 dark:bg-slate-800'
              }`}
            >
              {sesion ? (
                <Unlock
                  size={21}
                  className="text-emerald-600 dark:text-emerald-400"
                />
              ) : (
                <Wallet
                  size={21}
                  className="text-slate-500 dark:text-slate-400"
                />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-slate-900 dark:text-slate-100">
                  Sesión operativa de caja
                </h2>

                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    sesion
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {sesion ? 'Abierta' : 'Sin abrir'}
                </span>
              </div>

              {loading ? (
                <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                  <RefreshCw
                    size={13}
                    className="animate-spin"
                  />
                  Verificando sesión…
                </p>
              ) : sesion ? (
                <div className="mt-1 space-y-0.5 text-sm text-slate-600 dark:text-slate-300">
                  <p>
                    <strong>
                      {sesion.caja_nombre}
                    </strong>{' '}
                    ({sesion.caja_codigo}) ·{' '}
                    {sesion.sucursal_nombre}
                  </p>

                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {fechaHora(
                        sesion.fecha_apertura,
                      )}
                    </span>

                    <span className="flex items-center gap-1">
                      <Banknote size={12} />
                      Fondo inicial:
                      Q
                      {qDesdeCentavos(
                        sesion.fondo_inicial_centavos,
                      )}
                    </span>

                    {sesion.diferencia_apertura_centavos !==
                      null &&
                      sesion.diferencia_apertura_centavos !==
                        undefined && (
                        <span
                          className={
                            sesion.diferencia_apertura_centavos ===
                            0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }
                        >
                          Diferencia apertura: Q
                          {qDesdeCentavos(
                            sesion.diferencia_apertura_centavos,
                          )}
                        </span>
                      )}
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  No tienes una caja abierta en{' '}
                  <strong>
                    {sucursalActiva?.nombre ||
                      'la sucursal activa'}
                  </strong>
                  . El efectivo de ventas y reparaciones
                  requiere una sesión abierta.
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {sesion && canViewMovimientos && (
              <Button
                variant="outline"
                onClick={abrirMovimientosActuales}
              >
                <Banknote size={14} />
                Ver movimientos actuales
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => void loadActiva()}
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

            {sesion ? (
              <Button
                onClick={prepararCierre}
                className="bg-red-600 hover:bg-red-700"
              >
                <Lock size={15} />
                Cerrar caja
              </Button>
            ) : (
              <Button
                onClick={() => void abrirModal()}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Unlock size={15} />
                Abrir caja
              </Button>
            )}
          </div>
        </div>

        {sesion && resumen && (
          <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Fondo inicial
              </p>

              <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
                Q
                {qDesdeCentavos(
                  resumen.fondo_inicial_centavos,
                )}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Movimientos en efectivo
              </p>

              <p
                className={`mt-1 text-xl font-bold ${
                  resumen.movimientos_efectivo_centavos < 0
                    ? 'text-red-600 dark:text-red-400'
                    : resumen.movimientos_efectivo_centavos > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {resumen.movimientos_efectivo_centavos > 0
                  ? '+'
                  : ''}
                Q
                {qDesdeCentavos(
                  resumen.movimientos_efectivo_centavos,
                )}
              </p>

              <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                <p>
                  Ventas +Q
                  {qDesdeCentavos(
                    Math.abs(
                      Number(
                        resumen.ventas_efectivo_centavos ||
                        0
                      )
                    ),
                  )}
                  {' · '}
                  Reparaciones +Q
                  {qDesdeCentavos(
                    Math.abs(
                      Number(
                        resumen.reparaciones_efectivo_centavos ||
                        0
                      )
                    ),
                  )}
                </p>

                <p>
                  Compras -Q
                  {qDesdeCentavos(
                    Math.abs(
                      Number(
                        resumen.compras_egresos_centavos ||
                        0
                      )
                    ),
                  )}
                  {' · '}
                  Anulaciones +Q
                  {qDesdeCentavos(
                    Math.abs(
                      Number(
                        resumen.compras_reversas_centavos ||
                        0
                      )
                    ),
                  )}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Efectivo esperado
              </p>

              <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
                Q
                {qDesdeCentavos(
                  resumen.efectivo_esperado_actual_centavos,
                )}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Efectivo que debería haber físicamente.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
            {error}
          </div>
        )}

        {ultimoCierre && (
          <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <p className="text-xs text-slate-500">
                Esperado
              </p>
              <p className="font-bold">
                Q
                {qDesdeCentavos(
                  ultimoCierre.efectivoEsperado,
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Contado
              </p>
              <p className="font-bold">
                Q
                {qDesdeCentavos(
                  ultimoCierre.efectivoContado,
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Diferencia
              </p>
              <p
                className={`font-bold ${
                  ultimoCierre.diferencia === 0
                    ? 'text-emerald-600'
                    : 'text-red-600'
                }`}
              >
                Q
                {qDesdeCentavos(
                  ultimoCierre.diferencia,
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Dejado en caja
              </p>

              <p className="font-bold">
                Q
                {qDesdeCentavos(
                  ultimoCierre.fondoSiguiente,
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Retirado
              </p>

              <p className="font-bold">
                Q
                {qDesdeCentavos(
                  ultimoCierre.retiroCierre,
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={showMovimientos}
        onClose={() => {
          setShowMovimientos(false);
          setErrorMovimientos(null);
        }}
        title="Movimientos de la sesión actual"
        size="3xl"
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {sesion
                  ? `${sesion.caja_nombre} · ${sesion.sucursal_nombre}`
                  : 'Caja operativa'}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Movimientos en efectivo vinculados
                a la sesión que actualmente está abierta.
              </p>
            </div>

            <Button
              variant="outline"
              disabled={loadingMovimientos}
              onClick={() =>
                void cargarMovimientosActuales()
              }
            >
              <RefreshCw
                size={14}
                className={
                  loadingMovimientos
                    ? 'animate-spin'
                    : ''
                }
              />
              Actualizar
            </Button>
          </div>

          {errorMovimientos && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
              {errorMovimientos}
            </div>
          )}

          {loadingMovimientos &&
          !detalleSesion ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Consultando movimientos…
            </div>
          ) : !detalleSesion ||
            detalleSesion.movimientos.length ===
              0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
              Esta sesión todavía no tiene
              movimientos en efectivo.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {detalleSesion.movimientos.map(
                movimiento => {
                  const reversa =
                    movimiento.accion ===
                    'REVERSA';

                  return (
                    <div
                      key={`${movimiento.fuente}-${movimiento.movimiento_id}`}
                      className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {tituloMovimientoCaja(
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

                          {horaMovimiento(
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
                        className={`text-lg font-bold tabular-nums ${
                          reversa
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {reversa ? '-' : '+'}Q
                        {qDesdeCentavos(
                          movimiento.monto_centavos,
                        )}
                      </p>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showAbrir}
        onClose={() => {
          if (!saving) setShowAbrir(false);
        }}
        title="Abrir caja"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Caja física
            </label>

            <select
              value={cajaId}
              onChange={e =>
                setCajaId(e.target.value)
              }
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">
                Selecciona una caja
              </option>

              {cajas.map(caja => (
                <option
                  key={caja.id}
                  value={caja.id}
                >
                  {caja.nombre} ({caja.codigo})
                </option>
              ))}
            </select>

            {cajas.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                No hay cajas activas disponibles en esta
                sucursal.
              </p>
            )}
          </div>

          {loadingSugerencia && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950">
              Consultando último cierre…
            </div>
          )}

          {!loadingSugerencia &&
            cajaId &&
            fondoSugeridoCentavos !== null && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900/60 dark:bg-blue-950/20">
                <p className="font-semibold text-blue-800 dark:text-blue-300">
                  Efectivo dejado en el último cierre
                </p>

                <p className="mt-1 text-lg font-bold text-blue-900 dark:text-blue-200">
                  Q
                  {qDesdeCentavos(
                    fondoSugeridoCentavos,
                  )}
                </p>

                {fechaCierreAnterior && (
                  <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
                    Último cierre:{' '}
                    {fechaHora(
                      fechaCierreAnterior,
                    )}
                  </p>
                )}

                <p className="mt-2 text-xs text-blue-700 dark:text-blue-400">
                  Cuenta físicamente la caja y confirma el
                  monto real de apertura.
                </p>
              </div>
            )}

          {!loadingSugerencia &&
            cajaId &&
            fondoSugeridoCentavos === null && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                Esta caja no tiene un fondo anterior
                registrado. Ingresa el efectivo físico con
                el que inicia el turno.
              </div>
            )}

          <div>
            <label className="mb-1 block text-sm font-medium">
              Fondo contado al abrir (Q)
            </label>

            <Input
              type="number"
              min="0"
              step="0.01"
              value={fondoInicial}
              onChange={e =>
                setFondoInicial(e.target.value)
              }
            />

            <p className="mt-1 text-xs text-slate-500">
              Efectivo físico realmente contado al iniciar
              el turno.
            </p>

            {fondoSugeridoCentavos !== null &&
              Number.isFinite(
                Number(fondoInicial),
              ) && (
                <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-950">
                  Diferencia de apertura:{' '}
                  <strong
                    className={
                      Math.round(
                        Number(fondoInicial) *
                          100,
                      ) -
                        fondoSugeridoCentavos ===
                      0
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    }
                  >
                    Q
                    {qDesdeCentavos(
                      Math.round(
                        Number(fondoInicial) *
                          100,
                      ) -
                        fondoSugeridoCentavos,
                    )}
                  </strong>
                </div>
              )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAbrir(false)}
              disabled={saving}
            >
              Cancelar
            </Button>

            <Button
              onClick={() => void abrirSesion()}
              disabled={
                saving ||
                !cajaId ||
                cajas.length === 0
              }
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving
                ? 'Abriendo…'
                : 'Abrir caja'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showCerrar}
        onClose={() => {
          if (!saving) setShowCerrar(false);
        }}
        title="Cerrar caja"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-950">
            <p className="font-semibold">
              {sesion?.caja_nombre}
            </p>
            <p className="text-xs text-slate-500">
              Cuenta físicamente el efectivo antes de
              confirmar el cierre.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Efectivo contado (Q)
            </label>

            <Input
              type="number"
              min="0"
              step="0.01"
              value={efectivoContado}
              onChange={e =>
                setEfectivoContado(e.target.value)
              }
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Dejar en caja para el próximo turno (Q)
            </label>

            <Input
              type="number"
              min="0"
              step="0.01"
              value={fondoSiguiente}
              onChange={e =>
                setFondoSiguiente(
                  e.target.value,
                )
              }
              placeholder="0.00"
            />

            <p className="mt-1 text-xs text-slate-500">
              Este efectivo permanecerá físicamente en la
              caja y se sugerirá en la próxima apertura.
            </p>

            {Number.isFinite(
              Number(efectivoContado),
            ) &&
              efectivoContado.trim() !== '' &&
              Number.isFinite(
                Number(fondoSiguiente),
              ) &&
              fondoSiguiente.trim() !== '' &&
              Number(fondoSiguiente) <=
                Number(efectivoContado) && (
                <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950">
                  Efectivo a retirar:{' '}
                  <strong>
                    Q
                    {(
                      Number(efectivoContado) -
                      Number(fondoSiguiente)
                    ).toLocaleString(
                      'es-GT',
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      },
                    )}
                  </strong>
                </div>
              )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Notas
            </label>

            <textarea
              value={notasCierre}
              onChange={e =>
                setNotasCierre(e.target.value)
              }
              className="min-h-24 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              placeholder="Observaciones del cierre…"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCerrar(false)}
              disabled={saving}
            >
              Cancelar
            </Button>

            <Button
              onClick={() => void cerrarSesion()}
              disabled={
                saving ||
                efectivoContado.trim() === '' ||
                fondoSiguiente.trim() === ''
              }
              className="bg-red-600 hover:bg-red-700"
            >
              {saving
                ? 'Cerrando…'
                : 'Confirmar cierre'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
