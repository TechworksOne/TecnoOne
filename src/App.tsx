import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Sidebar from "./components/common/Sidebar";
import Topbar from "./components/common/Topbar";
import { ToastProvider } from "./components/ui/Toast";
import { useIdleLogout } from "./hooks/useIdleLogout";
import { applyTenantBranding } from "./lib/tenantBranding";
import LoginPage from "./pages/Login/LoginPage";
import routes from "./routes";
import { useAuth } from "./store/useAuth";
import { useEmpresa } from "./store/useEmpresa";
import { useSidebar } from "./store/useSidebar";
import SuperAdminRoutes from "./superAdminRoutes";

/** Activa el cierre por inactividad solo cuando hay sesión */
function IdleLogoutGuard() {
  useIdleLogout();
  return null;
}

function TenantBrandingGuard() {
  const user = useAuth((state) => state.user);
  const empresa = useEmpresa((state) => state.empresa);
  const loadEmpresa = useEmpresa((state) => state.loadEmpresa);
  const clearEmpresa = useEmpresa((state) => state.clearEmpresa);

  useEffect(() => {
    if (user) {
      loadEmpresa();
      return;
    }

    clearEmpresa();
    applyTenantBranding(null);
  }, [user, loadEmpresa, clearEmpresa]);

  useEffect(() => {
    applyTenantBranding(empresa?.color_principal || empresa?.color_primario);
  }, [empresa?.color_principal, empresa?.color_primario]);

  return null;
}

export default function App() {
  const role = useAuth((state) => state.role);
  const user = useAuth((state) => state.user);
  const initAuth = useAuth((state) => state.initAuth);
  const isOpen = useSidebar((state) => state.isOpen);
  const { pathname } = useLocation();

  // Inicializar autenticación al cargar la app
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (!role) applyTenantBranding(null);
  }, [role]);

  // El login siempre se muestra sin sidebar ni topbar
  if (pathname === "/login" || !role) {
    return (
      <ToastProvider>
        <div className="min-h-screen">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </ToastProvider>
    );
  }

  if (user?.es_super_admin && user.tipo_usuario === 'PLATAFORMA') {
    return (
      <ToastProvider>
        <IdleLogoutGuard />
        <SuperAdminRoutes />
      </ToastProvider>
    );
  }

  // Si hay usuario autenticado, mostrar la aplicación completa
  return (
    <ToastProvider>
      {/* Guard de inactividad — solo activo con sesión */}
      <IdleLogoutGuard />
      <TenantBrandingGuard />
      <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
        <Sidebar />
        <div
            className={`flex flex-col transition-[margin-left] duration-[280ms] ease-[cubic-bezier(.4,0,.2,1)] ${isOpen ? 'md:ml-[264px]' : 'md:ml-[72px]'}`}
          >
          <Topbar />
          <main className="min-h-[calc(100vh-52px)] p-4 sm:p-6">
            <Routes>
              {routes.filter(r => r.path !== "/login").map((r) => (
                <Route key={r.path} path={r.path} element={r.element} />
              ))}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/login" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
