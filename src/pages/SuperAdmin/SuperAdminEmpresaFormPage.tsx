import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  superAdminService,
  type PlanCatalogo,
} from '../../services/superAdminService';

const today =
  new Date().toISOString().slice(0, 10);

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

export default function SuperAdminEmpresaFormPage() {
  const navigate = useNavigate();

  const [planes, setPlanes] =
    useState<PlanCatalogo[]>([]);

  const [
    loadingPlans,
    setLoadingPlans,
  ] = useState(true);

  const [form, setForm] =
    useState({
      nombre: '',
      nombre_comercial: '',
      razon_social: '',
      nit: '',
      slug: '',
      tipo_suscripcion:
        'prueba',
      plan: '',
      fecha_inicio: today,
      fecha_vencimiento: '',
      dias_gracia: 0,
      telefono: '',
      email: '',
      direccion: '',
    });

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  const selectedPlan =
    useMemo(
      () =>
        planes.find(
          plan =>
            plan.codigo ===
            form.plan
        ) || null,
      [planes, form.plan]
    );

  useEffect(() => {
    superAdminService
      .getPlanes()
      .then(catalog => {
        const available =
          catalog.filter(
            plan =>
              plan.activo &&
              plan.asignable
          );

        setPlanes(available);

        const defaultPlan =
          available.find(
            plan =>
              plan.codigo ===
              'taller'
          ) ||
          available[0];

        if (defaultPlan) {
          setForm(current => ({
            ...current,
            plan:
              current.plan ||
              defaultPlan.codigo,
          }));
        } else {
          setError(
            'No existen planes disponibles para asignar.'
          );
        }
      })
      .catch(() => {
        setError(
          'No fue posible cargar el catálogo de planes.'
        );
      })
      .finally(() => {
        setLoadingPlans(false);
      });
  }, []);

  async function submit(
    event: React.FormEvent
  ) {
    event.preventDefault();
    setError('');

    if (!form.plan) {
      setError(
        'Debe seleccionar un plan.'
      );

      return;
    }

    if (
      form.fecha_vencimiento &&
      form.fecha_inicio >
        form.fecha_vencimiento
    ) {
      setError(
        'La fecha de inicio no puede ser posterior al vencimiento.'
      );

      return;
    }

    if (
      Number(form.dias_gracia) <
      0
    ) {
      setError(
        'Los días de gracia no pueden ser negativos.'
      );

      return;
    }

    setSaving(true);

    try {
      const result =
        await superAdminService
          .createEmpresa({
            ...form,
            fecha_vencimiento:
              form.fecha_vencimiento ||
              null,
            dias_gracia:
              Number(
                form.dias_gracia
              ),
          });

      navigate(
        `/superadmin/empresas/${result.id}`
      );
    } catch (requestError: any) {
      const response =
        requestError?.response?.data;

      setError(
        response?.message ||
        'No fue posible crear la empresa.'
      );
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 font-normal dark:border-slate-700';

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">
          Crear empresa
        </h1>

        <p className="text-sm text-slate-500">
          Registra el tenant y su suscripción inicial en una sola operación.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#191a1d] sm:grid-cols-2"
      >
        {error && (
          <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">
            {error}
          </div>
        )}

        <label className="text-sm font-semibold">
          Nombre legal

          <input
            required
            value={form.nombre}
            onChange={event =>
              setForm({
                ...form,
                nombre:
                  event.target.value,
              })
            }
            className={inputClass}
          />
        </label>

        <label className="text-sm font-semibold">
          Nombre comercial

          <input
            value={
              form.nombre_comercial
            }
            onChange={event =>
              setForm({
                ...form,
                nombre_comercial:
                  event.target.value,
              })
            }
            className={inputClass}
          />
        </label>

        <label className="text-sm font-semibold">
          Razón social

          <input
            value={
              form.razon_social
            }
            onChange={event =>
              setForm({
                ...form,
                razon_social:
                  event.target.value,
              })
            }
            className={inputClass}
          />
        </label>

        <label className="text-sm font-semibold">
          NIT

          <input
            value={form.nit}
            onChange={event =>
              setForm({
                ...form,
                nit:
                  event.target.value,
              })
            }
            className={inputClass}
          />
        </label>

        <label className="text-sm font-semibold">
          Slug

          <input
            value={form.slug}
            onChange={event =>
              setForm({
                ...form,
                slug:
                  event.target.value,
              })
            }
            placeholder="ejemplo-taller"
            className={inputClass}
          />
        </label>

        <label className="text-sm font-semibold">
          Teléfono

          <input
            value={form.telefono}
            onChange={event =>
              setForm({
                ...form,
                telefono:
                  event.target.value,
              })
            }
            className={inputClass}
          />
        </label>

        <label className="text-sm font-semibold">
          Correo

          <input
            type="email"
            value={form.email}
            onChange={event =>
              setForm({
                ...form,
                email:
                  event.target.value,
              })
            }
            className={inputClass}
          />
        </label>

        <label className="text-sm font-semibold sm:col-span-2">
          Dirección

          <input
            value={form.direccion}
            onChange={event =>
              setForm({
                ...form,
                direccion:
                  event.target.value,
              })
            }
            className={inputClass}
          />
        </label>

        <div className="mt-2 border-t border-slate-200 pt-4 dark:border-slate-800 sm:col-span-2">
          <h2 className="font-bold">
            Suscripción inicial
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            El plan define los módulos, usuarios y sucursales disponibles.
          </p>
        </div>

        <label className="text-sm font-semibold">
          Plan

          <select
            required
            disabled={
              loadingPlans ||
              planes.length === 0
            }
            value={form.plan}
            onChange={event =>
              setForm({
                ...form,
                plan:
                  event.target.value,
              })
            }
            className={inputClass}
          >
            <option value="">
              {loadingPlans
                ? 'Cargando planes…'
                : 'Seleccione un plan'}
            </option>

            {planes.map(plan => (
              <option
                key={plan.id}
                value={plan.codigo}
              >
                {plan.nombre} ·{' '}
                {formatMoney(
                  plan.precio_mensual,
                  plan.moneda
                )}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold">
          Tipo

          <select
            value={
              form.tipo_suscripcion
            }
            onChange={event =>
              setForm({
                ...form,
                tipo_suscripcion:
                  event.target.value,
              })
            }
            className={inputClass}
          >
            <option value="prueba">
              Prueba
            </option>

            <option value="comercial">
              Comercial
            </option>
          </select>
        </label>

        {selectedPlan && (
          <div className="grid gap-3 rounded-2xl border border-slate-200 p-4 text-sm dark:border-slate-800 sm:col-span-2 sm:grid-cols-4">
            <div>
              <p className="text-xs uppercase text-slate-500">
                Precio mensual
              </p>

              <p className="font-bold">
                {formatMoney(
                  selectedPlan
                    .precio_mensual,
                  selectedPlan.moneda
                )}
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

            {selectedPlan.description && (
              <p className="text-slate-500 sm:col-span-4">
                {
                  selectedPlan.description
                }
              </p>
            )}
          </div>
        )}

        <label className="text-sm font-semibold">
          Fecha de inicio

          <input
            type="date"
            required
            value={
              form.fecha_inicio
            }
            onChange={event =>
              setForm({
                ...form,
                fecha_inicio:
                  event.target.value,
              })
            }
            className={inputClass}
          />
        </label>

        <label className="text-sm font-semibold">
          Fecha de vencimiento

          <input
            type="date"
            min={form.fecha_inicio}
            value={
              form.fecha_vencimiento
            }
            onChange={event =>
              setForm({
                ...form,
                fecha_vencimiento:
                  event.target.value,
              })
            }
            className={inputClass}
          />
        </label>

        <label className="text-sm font-semibold">
          Días de gracia

          <input
            type="number"
            min={0}
            value={
              form.dias_gracia
            }
            onChange={event =>
              setForm({
                ...form,
                dias_gracia:
                  Number(
                    event.target.value
                  ),
              })
            }
            className={inputClass}
          />
        </label>

        <div className="flex justify-end gap-2 pt-4 sm:col-span-2">
          <button
            type="button"
            onClick={() =>
              navigate(-1)
            }
            className="rounded-xl border px-4 py-2.5 text-sm font-semibold dark:border-slate-700"
          >
            Cancelar
          </button>

          <button
            disabled={
              saving ||
              loadingPlans ||
              !form.plan
            }
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving
              ? 'Creando…'
              : 'Crear empresa'}
          </button>
        </div>
      </form>
    </div>
  );
}
