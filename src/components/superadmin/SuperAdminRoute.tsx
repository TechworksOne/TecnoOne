import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/useAuth';

export default function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuth(state => state.user);
  const location = useLocation();
  const authorized =
    user?.role === 'superadmin' &&
    user?.tipo_usuario === 'PLATAFORMA' &&
    user?.es_super_admin === true &&
    user?.empresa_id === null;

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!authorized) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
