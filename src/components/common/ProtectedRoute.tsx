import { Navigate, useLocation } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '../../store/useAuth';

interface Props {
  children: React.ReactNode;
  permission?: string;
  moduleCode?: string;
}

export default function ProtectedRoute({
  children,
  permission,
  moduleCode,
}: Props) {
  const {
    role,
    permissionsLoaded,
    modulesLoaded,
    hasPermission,
    hasModule,
  } = useAuth();

  const location = useLocation();

  if (!role) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  if (
    (permission && !permissionsLoaded) ||
    (moduleCode && !modulesLoaded)
  ) {
    return (
      <div className="min-h-[40vh] animate-pulse rounded-2xl bg-[var(--color-surface)]" />
    );
  }

  const permissionAccess = permission
    ? hasPermission(permission)
    : true;

  const moduleAccess = moduleCode
    ? hasModule(moduleCode)
    : true;

  if (!permissionAccess || !moduleAccess) {
    const moduleDenied =
      Boolean(moduleCode) &&
      !moduleAccess;

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="rounded-2xl bg-red-50 p-5">
          <ShieldOff
            size={40}
            className="mx-auto text-red-400"
          />
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {moduleDenied
              ? 'Módulo no incluido'
              : 'Acceso no autorizado'}
          </h2>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {moduleDenied
              ? 'Este módulo no está incluido en el plan contratado.'
              : 'No tienes permisos para acceder a esta sección.'}
          </p>
        </div>

        <a
          href="/dashboard"
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Volver al Dashboard
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
