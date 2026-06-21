import { Navigate, Route, Routes } from 'react-router-dom';
import SuperAdminLayout from './components/superadmin/SuperAdminLayout';
import SuperAdminRoute from './components/superadmin/SuperAdminRoute';
import SuperAdminDashboardPage from './pages/SuperAdmin/SuperAdminDashboardPage';
import SuperAdminEmpresaDetailPage from './pages/SuperAdmin/SuperAdminEmpresaDetailPage';
import SuperAdminEmpresaFormPage from './pages/SuperAdmin/SuperAdminEmpresaFormPage';
import SuperAdminEmpresasPage from './pages/SuperAdmin/SuperAdminEmpresasPage';
import SuperAdminPlaceholderPage from './pages/SuperAdmin/SuperAdminPlaceholderPage';

export default function SuperAdminRoutes() {
  return (
    <Routes>
      <Route path="/superadmin" element={<SuperAdminRoute><SuperAdminLayout /></SuperAdminRoute>}>
        <Route index element={<SuperAdminDashboardPage />} />
        <Route path="empresas" element={<SuperAdminEmpresasPage />} />
        <Route path="empresas/nueva" element={<SuperAdminEmpresaFormPage />} />
        <Route path="empresas/:id" element={<SuperAdminEmpresaDetailPage />} />
        <Route path="auditoria" element={<SuperAdminPlaceholderPage title="Auditoría global" />} />
        <Route path="configuracion" element={<SuperAdminPlaceholderPage title="Configuración de plataforma" />} />
      </Route>
      <Route path="*" element={<Navigate to="/superadmin" replace />} />
    </Routes>
  );
}
