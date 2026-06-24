import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  superAdminService,
  type EmpresaGlobal,
  type HistorialSuscripcion,
  type PlanCatalogo,
  type Suscripcion,
} from '../../services/superAdminService';

const badgeStyles: Record<string, string> = {
  prueba: 'bg-violet-100 text-violet-700',
  vigente: 'bg-emerald-100 text-emerald-700',
  gracia: 'bg-amber-100 text-amber-800',
  vencida: 'bg-red-100 text-red-700',
};

type PlanAction =
  | 'immediate'
  | 'schedule'
  | 'cancel'
  | null;

function displayDate(
  value: string | null | undefined
) {
  if (!value) return 'Sin vencimiento';

  return new Date(
    `${value.slice(0, 10)}T12:00:00`
  ).toLocaleDateString('es-GT');
}

function tomorrowString() {
  const date = new Date();

  date.setDate(
    date.getDate() + 1
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function formatMoney(
  value: number | null | undefined,
  currency = 'GTQ'
) {
  if (
    value === null ||
    value === undefined
  ) {
    return '—';
  }

  return new Intl.NumberFormat(
    'es-GT',
    {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }
  ).format(value);
}

function errorMessage(
  error: any,
  fallback: string
) {
  const response =
    error?.response?.data;

  if (!response) {
    return fallback;
  }

  const limitInformation =
    response.used !== undefined &&
    response.limit !== undefined
      ? ` Uso actual: ${response.used}. Límite: ${response.limit}.`
      : '';

  return `${
    response.message || fallback
  }${limitInformation}`;
}

export default function SuperAdminEmpresaDetailPage() {
  const { id = '' } =
    useParams();

  const [searchParams] =
    useSearchParams();

  const [empresa, setEmpresa] =
    useState<EmpresaGlobal | null>(
      null
    );

  const [
    suscripcion,
    setSuscripcion,
  ] = useState<Suscripcion | null>(
    null
  );

  const [
    historial,
    setHistorial,
  ] = useState<
    HistorialSuscripcion[]
  >([]);

  const [planes, setPlanes] =
    useState<PlanCatalogo[]>([]);

  const [edit, setEdit] =
    useState(
      searchParams.get('editar') ===
        '1'
    );

  const [admin, setAdmin] =
    useState({
      username: '',
      email: '',
      password: '',
      nombres: '',
      apellidos: '',
    });

  const [
    renewalReason,
    setRenewalReason,
  ] = useState('');

  const [
    planReason,
    setPlanReason,
  ] = useState('');

  const [
    selectedPlanId,
    setSelectedPlanId,
  ] = useState<number | ''>('');

  const [
    effectiveDate,
    setEffectiveDate,
  ] = useState(tomorrowString());

  const [
    renewing,
    setRenewing,
  ] = useState<number | null>(
    null
  );

  const [
    planAction,
    setPlanAction,
  ] = useState<PlanAction>(null);

  const [message, setMessage] =
    useState('');

  const [error, setError] =
    useState('');

  const assignablePlans =
    useMemo(
      () =>
        planes.filter(
          plan =>
            plan.activo &&
            plan.asignable
        ),
      [planes]
    );

  const selectedPlan =
    useMemo(
      () =>
        assignablePlans.find(
          plan =>
            plan.id ===
            selectedPlanId
        ) || null,
      [
        assignablePlans,
        selectedPlanId,
      ]
    );

  async function load() {
    const [
      empresaData,
      suscripcionData,
      historialData,
      planesData,
    ] = await Promise.all([
      superAdminService.getEmpresa(
        id
      ),
      superAdminService.getSuscripcion(
        id
      ),
      superAdminService
        .getHistorialSuscripcion(
          id
        ),
      superAdminService.getPlanes(),
    ]);

    setEmpresa(empresaData);
    setSuscripcion(
      suscripcionData
    );
    setHistorial(historialData);
    setPlanes(planesData);

    const available =
      planesData.filter(
        plan =>
          plan.activo &&
          plan.asignable
      );

    const nextPlan =
      available.find(
        plan =>
          plan.id !==
          suscripcionData.plan_id
      ) ||
      available[0];

    setSelectedPlanId(
      nextPlan?.id || ''
    );

    const minimumDate =
      tomorrowString();

    const programmedDate =
      suscripcionData
        .cambio_plan_efectivo_en ||
      suscripcionData
        .plan_programado
        ?.cambio_efectivo_en;

    const expirationDate =
      suscripcionData
        .fecha_vencimiento;

    setEffectiveDate(
      programmedDate ||
        (
          expirationDate &&
          expirationDate >
            minimumDate
            ? expirationDate
            : minimumDate
        )
    );
  }

  useEffect(() => {
    load().catch(() => {
      setError(
        'Empresa o suscripción no encontrada.'
      );
    });
  }, [id]);

  function clearAlerts() {
    setError('');
    setMessage('');
  }

  async function save() {
    if (!empresa) return;

    clearAlerts();

    try {
      await superAdminService
        .updateEmpresa(
          id,
          empresa as unknown as Record<
            string,
            unknown
          >
        );

      await load();

      setEdit(false);
      setMessage(
        'Empresa actualizada.'
      );
    } catch (requestError: any) {
      setError(
        errorMessage(
          requestError,
          'No fue posible actualizar la empresa.'
        )
      );
    }
  }

  async function createAdmin(
    event: React.FormEvent
  ) {
    event.preventDefault();
    clearAlerts();

    try {
      await superAdminService
        .createAdministrador(
          id,
          admin
        );

      setEmpresa(
        await superAdminService
          .getEmpresa(id)
      );

      setMessage(
        'Administrador principal creado.'
      );
    } catch (requestError: any) {
      setError(
        errorMessage(
          requestError,
          'No fue posible crear el administrador.'
        )
      );
    }
  }

  async function renew(
    months: 1 | 3 | 6 | 12
  ) {
    if (!suscripcion) return;

    setRenewing(months);
    clearAlerts();

    try {
      const updated =
        await superAdminService
          .renovarSuscripcion(
            id,
            {
              meses: months,
              dias_gracia:
                suscripcion
                  .dias_gracia,
              motivo:
                renewalReason ||
                `Renovación por ${months} mes${
                  months === 1
                    ? ''
                    : 'es'
                }`,
            }
          );

      setSuscripcion(updated);

      await load();

      setRenewalReason('');

      setMessage(
        updated
          .requiere_reactivacion_explicita
          ? 'Suscripción renovada. La empresa cancelada requiere reactivación explícita.'
          : 'Suscripción renovada correctamente.'
      );
    } catch (requestError: any) {
      setError(
        errorMessage(
          requestError,
          'No fue posible renovar la suscripción.'
        )
      );
    } finally {
      setRenewing(null);
    }
  }

  async function changePlanImmediately() {
    if (
      !selectedPlan ||
      !suscripcion
    ) {
      return;
    }

    if (
      selectedPlan.id ===
      suscripcion.plan_id
    ) {
      setError(
        'El plan seleccionado ya está activo.'
      );

      return;
    }

    const confirmed =
      window.confirm(
        `¿Cambiar inmediatamente a ${selectedPlan.nombre}? Los módulos y límites cambiarán en este momento.`
      );

    if (!confirmed) return;

    setPlanAction('immediate');
    clearAlerts();

    try {
      await superAdminService
        .cambiarPlanInmediato(
          id,
          {
            plan_id:
              selectedPlan.id,
            motivo:
              planReason ||
              `Cambio inmediato a ${selectedPlan.nombre}`,
          }
        );

      await load();

      setPlanReason('');

      setMessage(
        `Plan cambiado inmediatamente a ${selectedPlan.nombre}.`
      );
    } catch (requestError: any) {
      setError(
        errorMessage(
          requestError,
          'No fue posible cambiar el plan.'
        )
      );
    } finally {
      setPlanAction(null);
    }
  }

  async function schedulePlanChange() {
    if (
      !selectedPlan ||
      !suscripcion
    ) {
      return;
    }

    if (
      selectedPlan.id ===
      suscripcion.plan_id
    ) {
      setError(
        'El plan seleccionado ya está activo.'
      );

      return;
    }

    if (
      !effectiveDate ||
      effectiveDate <
        tomorrowString()
    ) {
      setError(
        'La fecha efectiva debe ser posterior a hoy.'
      );

      return;
    }

    setPlanAction('schedule');
    clearAlerts();

    try {
      await superAdminService
        .programarCambioPlan(
          id,
          {
            plan_id:
              selectedPlan.id,
            fecha_efectiva:
              effectiveDate,
            motivo:
              planReason ||
              `Cambio programado a ${selectedPlan.nombre}`,
          }
        );

      await load();

      setPlanReason('');

      setMessage(
        `Cambio a ${selectedPlan.nombre} programado para ${displayDate(
          effectiveDate
        )}.`
      );
    } catch (requestError: any) {
      setError(
        errorMessage(
          requestError,
          'No fue posible programar el cambio.'
        )
      );
    } finally {
      setPlanAction(null);
    }
  }

  async function cancelScheduledPlan() {
    const confirmed =
      window.confirm(
        '¿Cancelar el cambio de plan programado?'
      );

    if (!confirmed) return;

    setPlanAction('cancel');
    clearAlerts();

    try {
      await superAdminService
        .cancelarCambioPlanProgramado(
          id,
          planReason ||
            'Cancelación desde Super Admin'
        );

      await load();

      setPlanReason('');

      setMessage(
        'Cambio de plan programado cancelado.'
      );
    } catch (requestError: any) {
      setError(
        errorMessage(
          requestError,
          'No fue posible cancelar el cambio programado.'
        )
      );
    } finally {
      setPlanAction(null);
    }
  }

  if (
    !empresa ||
    !suscripcion
  ) {
    return (
      <div className="rounded-2xl bg-white p-8 dark:bg-[#191a1d]">
        {error || 'Cargando…'}
      </div>
    );
  }

  const currentPlan =
    suscripcion.plan_detalle;

  const usersUsed =
    suscripcion.consumo
      ?.usuarios_activos;

  const usersLimit =
    suscripcion.consumo
      ?.usuarios_limite;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">
            {empresa.nombre_comercial ||
              empresa.nombre}
          </h1>

          <p className="text-sm text-slate-500">
            {empresa.slug} ·{' '}
            {empresa.estado}
          </p>
        </div>

        <button
          onClick={() =>
            setEdit(!edit)
          }
          className="rounded-xl border px-4 py-2 text-sm font-semibold dark:border-slate-700"
        >
          {edit
            ? 'Cancelar edición'
            : 'Editar'}
        </button>
      </div>

      {message && (
        <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#191a1d] sm:grid-cols-2">
        {([
          'nombre',
          'nombre_comercial',
          'razon_social',
          'nit',
          'telefono',
          'email',
          'direccion',
        ] as const).map(key => (
          <label
            key={key}
            className="text-xs font-bold uppercase text-slate-500"
          >
            {key.replaceAll(
              '_',
              ' '
            )}

            <input
              disabled={!edit}
              value={
                empresa[key] || ''
              }
              onChange={event =>
                setEmpresa({
                  ...empresa,
                  [key]:
                    event.target
                      .value,
                })
              }
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-transparent px-3 text-sm font-normal text-slate-900 disabled:opacity-70 dark:border-slate-700 dark:text-slate-100"
            />
          </label>
        ))}

        {edit && (
          <div className="text-right sm:col-span-2">
            <button
              onClick={save}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white"
            >
              Guardar cambios
            </button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#191a1d]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">
              Suscripción
            </h2>

            <p className="text-sm text-slate-500">
              Plan, vigencia y renovación.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                badgeStyles[
                  suscripcion.estado
                ] ||
                'bg-slate-100 text-slate-700'
              }`}
            >
              {suscripcion.estado}
            </span>

            {suscripcion
              .proxima_a_vencer && (
              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold uppercase text-orange-700">
                Próxima a vencer
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <p className="text-xs uppercase text-slate-500">
              Tipo
            </p>
            <p className="font-bold">
              {suscripcion.tipo}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-slate-500">
              Plan
            </p>
            <p className="font-bold">
              {currentPlan?.nombre ||
                suscripcion.plan}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-slate-500">
              Inicio
            </p>
            <p className="font-bold">
              {displayDate(
                suscripcion
                  .fecha_inicio
              )}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-slate-500">
              Vencimiento
            </p>
            <p className="font-bold">
              {displayDate(
                suscripcion
                  .fecha_vencimiento
              )}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-slate-500">
              Fin de gracia
            </p>
            <p className="font-bold">
              {displayDate(
                suscripcion
                  .fecha_fin_gracia
              )}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-slate-500">
              Días de gracia
            </p>
            <p className="font-bold">
              {suscripcion.dias_gracia}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-slate-500">
              Días restantes
            </p>
            <p className="font-bold">
              {suscripcion
                .dias_restantes ??
                'Sin límite'}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-slate-500">
              Empresa
            </p>
            <p className="font-bold">
              {
                suscripcion
                  .estado_empresa
              }
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-900 md:grid-cols-4">
          <div>
            <p className="text-xs uppercase text-slate-500">
              Precio mensual
            </p>
            <p className="font-bold">
              {formatMoney(
                currentPlan
                  ?.precio_mensual,
                currentPlan?.moneda ||
                  'GTQ'
              )}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-slate-500">
              Usuarios
            </p>
            <p className="font-bold">
              {usersUsed ?? '—'} /{' '}
              {usersLimit === null
                ? 'Ilimitados'
                : usersLimit ?? '—'}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-slate-500">
              Sucursales
            </p>
            <p className="font-bold">
              {currentPlan
                ?.max_sucursales ===
              null
                ? 'Ilimitadas'
                : currentPlan
                    ?.max_sucursales ??
                  '—'}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-slate-500">
              Módulos
            </p>
            <p className="font-bold">
              {suscripcion
                .modulos_habilitados
                ?.length ?? '—'}
            </p>
          </div>
        </div>

        {suscripcion
          .plan_programado && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-bold">
              Cambio programado
            </p>

            <p className="mt-1">
              Nuevo plan:{' '}
              <strong>
                {
                  suscripcion
                    .plan_programado
                    .nombre
                }
              </strong>
              . Fecha efectiva:{' '}
              <strong>
                {displayDate(
                  suscripcion
                    .cambio_plan_efectivo_en ||
                    suscripcion
                      .plan_programado
                      .cambio_efectivo_en
                )}
              </strong>
              .
            </p>

            <button
              onClick={
                cancelScheduledPlan
              }
              disabled={
                planAction !== null
              }
              className="mt-3 rounded-xl border border-amber-400 px-4 py-2 text-xs font-bold disabled:opacity-50"
            >
              {planAction ===
              'cancel'
                ? 'Cancelando…'
                : 'Cancelar cambio programado'}
            </button>
          </div>
        )}

        <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
          <h3 className="font-bold">
            Cambiar plan
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            El cambio inmediato modifica módulos y límites ahora. El cambio programado conserva el plan actual hasta la fecha efectiva.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold">
              Nuevo plan

              <select
                value={
                  selectedPlanId
                }
                onChange={event =>
                  setSelectedPlanId(
                    event.target.value
                      ? Number(
                          event
                            .target
                            .value
                        )
                      : ''
                  )
                }
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 dark:border-slate-700"
              >
                {assignablePlans.map(
                  plan => (
                    <option
                      key={plan.id}
                      value={plan.id}
                    >
                      {plan.nombre} ·{' '}
                      {formatMoney(
                        plan
                          .precio_mensual,
                        plan.moneda
                      )}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="text-sm font-semibold">
              Fecha efectiva

              <input
                type="date"
                min={tomorrowString()}
                value={
                  effectiveDate
                }
                onChange={event =>
                  setEffectiveDate(
                    event.target.value
                  )
                }
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 dark:border-slate-700"
              />
            </label>

            <label className="text-sm font-semibold md:col-span-2">
              Motivo

              <input
                value={planReason}
                onChange={event =>
                  setPlanReason(
                    event.target.value
                  )
                }
                placeholder="Ej. Cliente solicita cambio al plan Taller"
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 font-normal dark:border-slate-700"
              />
            </label>
          </div>

          {selectedPlan && (
            <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 p-4 text-sm dark:border-slate-800 sm:grid-cols-4">
              <div>
                <p className="text-xs uppercase text-slate-500">
                  Plan
                </p>
                <p className="font-bold">
                  {
                    selectedPlan
                      .nombre
                  }
                </p>
              </div>

              <div>
                <p className="text-xs uppercase text-slate-500">
                  Usuarios
                </p>
                <p className="font-bold">
                  {selectedPlan
                    .max_usuarios ===
                  null
                    ? 'Ilimitados'
                    : selectedPlan
                        .max_usuarios}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase text-slate-500">
                  Sucursales
                </p>
                <p className="font-bold">
                  {selectedPlan
                    .max_sucursales ===
                  null
                    ? 'Ilimitadas'
                    : selectedPlan
                        .max_sucursales}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase text-slate-500">
                  Módulos
                </p>
                <p className="font-bold">
                  {selectedPlan
                    .total_modulos ??
                    '—'}
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={
                changePlanImmediately
              }
              disabled={
                !selectedPlan ||
                planAction !== null ||
                selectedPlan.id ===
                  suscripcion.plan_id
              }
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {planAction ===
              'immediate'
                ? 'Cambiando…'
                : 'Cambiar inmediatamente'}
            </button>

            <button
              onClick={
                schedulePlanChange
              }
              disabled={
                !selectedPlan ||
                !effectiveDate ||
                planAction !== null ||
                selectedPlan.id ===
                  suscripcion.plan_id
              }
              className="rounded-xl border border-blue-600 px-4 py-2.5 text-sm font-bold text-blue-600 disabled:opacity-50"
            >
              {planAction ===
              'schedule'
                ? 'Programando…'
                : 'Programar cambio'}
            </button>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
          <label className="text-sm font-semibold">
            Motivo de renovación

            <input
              value={
                renewalReason
              }
              onChange={event =>
                setRenewalReason(
                  event.target.value
                )
              }
              placeholder="Ej. Renovación trimestral"
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-transparent px-3 font-normal dark:border-slate-700"
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [1, 3, 6, 12] as const
            ).map(months => (
              <button
                key={months}
                onClick={() =>
                  renew(months)
                }
                disabled={
                  renewing !== null
                }
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {renewing === months
                  ? 'Renovando…'
                  : `Renovar ${months} ${
                      months === 1
                        ? 'mes'
                        : 'meses'
                    }`}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
          <h3 className="font-bold">
            Historial reciente
          </h3>

          <div className="mt-3 space-y-2">
            {historial.length ===
            0 ? (
              <p className="text-sm text-slate-500">
                Sin movimientos registrados.
              </p>
            ) : (
              historial.map(item => (
                <div
                  key={item.id}
                  className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="font-bold">
                      {item.tipo_evento.replaceAll(
                        '_',
                        ' '
                      )}
                    </p>

                    <p className="text-xs text-slate-500">
                      {new Date(
                        item.created_at
                      ).toLocaleString(
                        'es-GT'
                      )}
                    </p>
                  </div>

                  <p className="mt-1 text-slate-500">
                    {item
                      .estado_suscripcion_anterior ||
                      '—'}{' '}
                    →{' '}
                    {item
                      .estado_suscripcion_nuevo ||
                      '—'}

                    {item
                      .meses_renovados
                      ? ` · ${item.meses_renovados} meses`
                      : ''}
                  </p>

                  {item.motivo && (
                    <p className="mt-1">
                      {item.motivo}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#191a1d]">
        <h2 className="font-bold">
          Administrador principal
        </h2>

        {empresa
          .administrador_principal ? (
          <div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-900">
            <p className="font-bold">
              {
                empresa
                  .administrador_principal
                  .name
              }
            </p>

            <p className="text-slate-500">
              {
                empresa
                  .administrador_principal
                  .username
              }{' '}
              ·{' '}
              {
                empresa
                  .administrador_principal
                  .email
              }
            </p>
          </div>
        ) : (
          <form
            onSubmit={createAdmin}
            className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {Object.entries({
              username:
                'Usuario',
              email:
                'Correo',
              password:
                'Contraseña',
              nombres:
                'Nombres',
              apellidos:
                'Apellidos',
            }).map(
              ([key, label]) => (
                <label
                  key={key}
                  className="text-sm font-semibold"
                >
                  {label}

                  <input
                    type={
                      key ===
                      'password'
                        ? 'password'
                        : 'text'
                    }
                    required={
                      key !==
                      'apellidos'
                    }
                    value={
                      admin[
                        key as keyof typeof admin
                      ]
                    }
                    onChange={event =>
                      setAdmin({
                        ...admin,
                        [key]:
                          event.target
                            .value,
                      })
                    }
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-transparent px-3 font-normal dark:border-slate-700"
                  />
                </label>
              )
            )}

            <div className="sm:col-span-2">
              <button className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white">
                Crear administrador
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
