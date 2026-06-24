import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Eraser, Save, ShieldCheck } from 'lucide-react';
import {
  permisoService,
  type Permiso,
  type RolConfigurable,
} from '../../services/permisoService';
import { useAuth, type AuthState } from '../../store/useAuth';

export default function PermisosPage() {
  const [catalogo, setCatalogo] = useState<Permiso[]>([]);
  const [roles, setRoles] = useState<RolConfigurable[]>([]);
  const [rolId, setRolId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingRole, setLoadingRole] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const loadPermissions = useAuth((state: AuthState) => state.loadPermissions);

  const grouped = useMemo(() => {
    return catalogo.reduce<Record<string, Permiso[]>>((acc, permiso) => {
      (acc[permiso.modulo] ||= []).push(permiso);
      return acc;
    }, {});
  }, [catalogo]);

  const selectedRole = roles.find(role => role.id === rolId);
  const isAdministrator = selectedRole?.nombre.toUpperCase() === 'ADMINISTRADOR';

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [permissions, roleRows] = await Promise.all([
          permisoService.getCatalogo(),
          permisoService.getRoles(),
        ]);
        setCatalogo(permissions);
        setRoles(roleRows);
        if (roleRows.length) setRolId(roleRows[0].id);
      } catch {
        setError('No fue posible cargar la configuración de permisos.');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  useEffect(() => {
    if (!rolId) return;
    async function loadRole() {
      setLoadingRole(true);
      setError('');
      setMessage('');
      try {
        const result = await permisoService.getRolPermisos(rolId!);
        setSelected(new Set(result.permisos));
      } catch {
        setError('No fue posible cargar los permisos del rol.');
      } finally {
        setLoadingRole(false);
      }
    }
    void loadRole();
  }, [rolId]);

  function toggle(code: string) {
    if (isAdministrator && ['usuarios.administrar', 'permisos.administrar'].includes(code)) return;
    setSelected(current => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(catalogo.map(item => item.codigo)));
  }

  function clearAll() {
    const required = isAdministrator
      ? ['usuarios.administrar', 'permisos.administrar']
      : [];
    setSelected(new Set(required));
  }

  async function save() {
    if (!rolId) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await permisoService.updateRolPermisos(rolId, [...selected]);
      await loadPermissions();
      setMessage('Permisos guardados correctamente.');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'No fue posible guardar los permisos.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="min-h-[50vh] animate-pulse rounded-2xl bg-[var(--color-surface)]" />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Permisos</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Configura los módulos y acciones disponibles para cada rol de tu empresa.
        </p>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">{message}</div>}

      {roles.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center text-sm text-[var(--color-text-muted)]">
          No hay roles asignados a usuarios de esta empresa.
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:flex-row sm:items-end sm:justify-between">
            <label className="w-full text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] sm:max-w-sm">
              Rol
              <select
                value={rolId || ''}
                onChange={event => setRolId(Number(event.target.value))}
                className="mt-2 h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 text-sm text-[var(--color-text)]"
              >
                {roles.map(role => (
                  <option key={role.id} value={role.id}>
                    {role.nombre} · {role.total_usuarios} usuario{role.total_usuarios === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap gap-2">
              <button onClick={selectAll} disabled={loadingRole} className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-sec)] hover:bg-[var(--color-row-hover)] disabled:opacity-50">
                <CheckSquare size={16} /> Seleccionar todo
              </button>
              <button onClick={clearAll} disabled={loadingRole} className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-sec)] hover:bg-[var(--color-row-hover)] disabled:opacity-50">
                <Eraser size={16} /> Limpiar
              </button>
              <button onClick={save} disabled={saving || loadingRole} className="flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50">
                <Save size={16} /> {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </section>

          {isAdministrator && (
            <div className="flex items-start gap-3 rounded-xl border border-[var(--color-active-border)] bg-[var(--color-active-bg)] px-4 py-3 text-sm text-[var(--color-text-sec)]">
              <ShieldCheck className="mt-0.5 shrink-0 text-[var(--color-primary)]" size={18} />
              El rol ADMINISTRADOR debe conservar la administración de usuarios y permisos para evitar bloquear la empresa.
            </div>
          )}

          {loadingRole ? (
            <div className="min-h-72 animate-pulse rounded-2xl bg-[var(--color-surface)]" />
          ) : catalogo.length === 0 ? (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center text-sm text-[var(--color-text-muted)]">
              El catálogo de permisos está vacío.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {Object.entries(grouped).map(([module, permissions]) => (
                <section key={module} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <div className="border-b border-[var(--color-border)] px-5 py-4">
                    <h2 className="font-bold text-[var(--color-text)]">{module}</h2>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      {permissions.filter(permission => selected.has(permission.codigo)).length} de {permissions.length} habilitados
                    </p>
                  </div>
                  <div className="divide-y divide-[var(--color-border)]">
                    {permissions.map(permission => {
                      const locked = isAdministrator && ['usuarios.administrar', 'permisos.administrar'].includes(permission.codigo);
                      return (
                        <label key={permission.codigo} className={`flex items-start gap-3 px-5 py-4 ${locked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-[var(--color-row-hover)]'}`}>
                          <input
                            type="checkbox"
                            checked={selected.has(permission.codigo)}
                            disabled={locked}
                            onChange={() => toggle(permission.codigo)}
                            className="mt-1 h-4 w-4 accent-[var(--color-primary)]"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-[var(--color-text)]">{permission.nombre}</span>
                            <span className="mt-0.5 block text-xs text-[var(--color-text-muted)]">{permission.descripcion}</span>
                            <code className="mt-1.5 block text-[11px] text-[var(--color-primary)]">{permission.codigo}</code>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
