import { Navigate, useLocation } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '../../store/useAuth';
import { canAccessRoute } from '../../lib/permissions';

interface Props {
  children: React.ReactNode;
  /** Roles requeridos para acceder (si está vacío: sólo autenticación) */
  roles?: string[];
}

/** Normaliza roles RBAC + campo role legado para compatibilidad hacia atrás */
function getEffectiveRoles(user: { roles?: string[]; role?: string } | null): string[] {
  const rbac    = Array.isArray(user?.roles) ? user!.roles : [];
  const legacy  = (user?.role ?? '').toLowerCase();
  const set     = new Set(rbac);
  if (legacy === 'admin' || legacy === 'administrador') set.add('ADMINISTRADOR');
  if (legacy === 'tecnico')                             set.add('TECNICO');
  if (legacy === 'ventas' || legacy === 'employee')     set.add('VENTAS');
  return [...set];
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { user, role } = useAuth();
  const location = useLocation();

  // No autenticado → login
  if (!role) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Verificar acceso por ruta/roles
  const userRoles = getEffectiveRoles(user);
  const canAccess = roles
    ? roles.some(r => userRoles.includes(r))
    : canAccessRoute(userRoles, location.pathname);

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4 px-6">
        <div className="bg-red-50 rounded-2xl p-5">
          <ShieldOff size={40} className="text-red-400 mx-auto" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Acceso no autorizado</h2>
          <p className="text-sm text-slate-500 mt-1">
            No tienes permisos para acceder a esta sección.
          </p>
        </div>
        <a
          href="/dashboard"
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-colors"
        >
          Volver al Dashboard
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
