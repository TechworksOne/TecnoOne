import React from "react";
import DashboardPage from "./pages/Dashboard/DashboardPage";
import FelPage from "./pages/InvoicesFel/FelPage";
import LoginPage from "./pages/Login/LoginPage";
import CustomersPage from "./pages/Customers/CustomersPage";
import SuppliersPage from "./pages/Suppliers/SuppliersPage";
import ProductsPage from "./pages/Products/ProductsPage";
import ProfilePage from "./pages/Profile/ProfilePage";
import PurchasesPage from "./pages/Purchases/PurchasesPage";
import PurchaseFormPage from "./pages/Purchases/PurchaseFormPage";
import QuotesPage from "./pages/Quotes/QuotesPage";
import QuoteDetailPage from "./pages/Quotes/QuoteDetailPage";
import QuoteFormPage from "./pages/Quotes/QuoteFormPage";
import ReportesPage from "./pages/Reports/ReportesPage";
import SalesPageNew from "./pages/Sales/SalesPageNew";
import SaleNewPage from "./pages/Sales/SaleNewPage";
import SaleDetailPage from "./pages/Sales/SaleDetailPage";
import UsersPage from "./pages/Users/UsersPage";
import CardPaymentPage from "./pages/CardPayment/CardPaymentPage";
import RepairsPage from "./pages/Repairs/RepairsPage";
import RepairFormSimple from "./pages/Repairs/RepairFormSimple";
import FlujoReparacionesPage from "./pages/FlujoReparaciones/FlujoReparacionesPage";
import FlujoReparacionDetailPage from "./pages/FlujoReparaciones/FlujoReparacionDetailPage";
import AgendaPage from "./pages/Agenda/AgendaPage";
import { RepuestosPage } from "./pages/Repuestos/RepuestosPage";
import RepuestoForm from "./pages/Repuestos/RepuestoForm";
import StickersGarantiaPage from "./pages/StickersGarantia/StickersGarantiaPage";
import AdminUsuariosPage from "./pages/AdminUsuarios/AdminUsuariosPage";
import CajaBancosPage from "./pages/CajaBancos/CajaBancosPage";
import DeudoresPage from "./pages/Deudores/DeudoresPage";
import OrdenesTrabajoPage from "./pages/OrdenesTrabajo/OrdenesTrabajoPage";
import EmpresaPage from "./pages/Configuracion/EmpresaPage";
import AuditoriaPage from "./pages/Auditoria/AuditoriaPage";
import PermisosPage from "./pages/Permisos/PermisosPage";
import SucursalesPage from "./pages/Sucursales/SucursalesPage";
import ProtectedRoute from "./components/common/ProtectedRoute";
import { PERMISSIONS, ROLES } from "./lib/permissions";

const ADMIN         = [ROLES.ADMINISTRADOR];
const ADMIN_CONFIG  = [ROLES.ADMINISTRADOR, 'SUPERADMIN'];
const ADMIN_TECNICO = [ROLES.ADMINISTRADOR, ROLES.TECNICO];
const ADMIN_VENTAS  = [ROLES.ADMINISTRADOR, ROLES.VENTAS];
const ALL_ROLES     = [ROLES.ADMINISTRADOR, ROLES.TECNICO, ROLES.VENTAS];

const PR = (roles: string[], child: React.ReactElement) => (
  <ProtectedRoute roles={roles}>{child}</ProtectedRoute>
);
const PP = (
  permission: string,
  child: React.ReactElement,
  moduleCode?: string
) => (
  <ProtectedRoute
    permission={permission}
    moduleCode={moduleCode}
  >
    {child}
  </ProtectedRoute>
);

const PPM = (
  permission: string,
  moduleCode: string,
  child: React.ReactElement
) => (
  <ProtectedRoute
    permission={permission}
    moduleCode={moduleCode}
  >
    {child}
  </ProtectedRoute>
);
const APR = (
  permission: string,
  child: React.ReactElement,
  moduleCode?: string
) => (
  <ProtectedRoute roles={ADMIN_CONFIG}>
    <ProtectedRoute
      permission={permission}
      moduleCode={moduleCode}
    >
      {child}
    </ProtectedRoute>
  </ProtectedRoute>
);

const routes = [
  { path: "/login",     element: <LoginPage /> },
  { path: "/dashboard", element: PP('dashboard.ver', <DashboardPage />, 'dashboard') },

  // ── Operación ──────────────────────────────────────────────────────────────
  { path: "/productos",            element: PP('productos.ver', <ProductsPage />, 'productos') },
  { path: "/repuestos",            element: PPM('repuestos.ver', 'taller_operativo', <RepuestosPage />) },
  { path: "/repuestos/nuevo",      element: PPM('repuestos.ver', 'taller_operativo', <RepuestoForm />) },
  { path: "/repuestos/editar/:id", element: PPM('repuestos.ver', 'taller_operativo', <RepuestoForm />) },
  { path: "/compras",              element: PP(PERMISSIONS.COMPRAS_VER, <PurchasesPage />, 'compras') },
  { path: "/compras/nueva",        element: PP('compras.crear', <PurchaseFormPage />, 'compras') },
  { path: "/cotizaciones",                element: PP('cotizaciones.ver', <QuotesPage />, 'cotizaciones') },
  { path: "/cotizaciones/nueva",          element: PP('cotizaciones.editar', <QuoteFormPage />, 'cotizaciones') },
  { path: "/cotizaciones/:id/editar",     element: PP('cotizaciones.editar', <QuoteFormPage />, 'cotizaciones') },
  { path: "/cotizaciones/:id",            element: PP('cotizaciones.ver', <QuoteDetailPage />, 'cotizaciones') },
  { path: "/ventas",       element: PP(PERMISSIONS.VENTAS_VER, <SalesPageNew />, 'ventas') },
  { path: "/ventas/nueva", element: PP(PERMISSIONS.VENTAS_CREAR, <SaleNewPage />, 'ventas') },
  { path: "/ventas/:id",   element: PP(PERMISSIONS.VENTAS_VER, <SaleDetailPage />, 'ventas') },

  // ── Servicio técnico ───────────────────────────────────────────────────────
  { path: "/reparaciones",            element: PPM(PERMISSIONS.REPARACIONES_VER, 'reparaciones', <RepairsPage />) },
  { path: "/reparaciones/nueva",      element: PPM('reparaciones.crear', 'reparaciones', <RepairFormSimple />) },
  { path: "/reparaciones/:id/editar", element: PPM('reparaciones.editar', 'reparaciones', <RepairFormSimple />) },
  { path: "/flujo-reparaciones",      element: PPM('flujo_reparaciones.ver', 'taller_operativo', <FlujoReparacionesPage />) },
  { path: "/flujo-reparaciones/:id",  element: PPM('flujo_reparaciones.ver', 'taller_operativo', <FlujoReparacionDetailPage />) },
  { path: "/ordenes-trabajo",         element: PPM('ordenes_trabajo.ver', 'taller_operativo', <OrdenesTrabajoPage />) },
  { path: "/agenda",                  element: PPM('agenda.ver', 'taller_operativo', <AgendaPage />) },
  { path: "/pago-tarjeta",            element: PR(ADMIN_VENTAS, PPM('ventas.crear', 'ventas', <CardPaymentPage />)) },

  // ── Administración ─────────────────────────────────────────────────────────
  { path: "/clientes",       element: PP('clientes.ver', <CustomersPage />, 'clientes') },
  { path: "/caja-bancos",    element: PP(PERMISSIONS.CAJA_VER, <CajaBancosPage />, 'caja_bancos') },
  { path: "/deudores",       element: PP('deudores.ver', <DeudoresPage />, 'deudores_pagos') },
  { path: "/proveedores",    element: PP('proveedores.ver', <SuppliersPage />, 'proveedores') },
  { path: "/stickers-garantia", element: PPM('stickers.ver', 'taller_operativo', <StickersGarantiaPage />) },
  { path: "/admin-usuarios", element: PP(PERMISSIONS.USUARIOS_ADMINISTRAR, <AdminUsuariosPage />, 'usuarios') },
  { path: "/sucursales", element: PP(PERMISSIONS.USUARIOS_ADMINISTRAR, <SucursalesPage />, 'usuarios') },
  { path: "/configuracion/empresa", element: PP(PERMISSIONS.EMPRESA_EDITAR, <EmpresaPage />, 'configuracion') },
  { path: "/reportes",       element: PP(PERMISSIONS.REPORTES_VER, <ReportesPage />, 'reportes_comerciales') },
  { path: "/auditoria",      element: PP(PERMISSIONS.AUDITORIA_VER, <AuditoriaPage />, 'auditoria') },
  { path: "/permisos",       element: APR(PERMISSIONS.PERMISOS_ADMINISTRAR, <PermisosPage />, 'roles_permisos') },
  { path: "/usuarios",       element: PP(PERMISSIONS.USUARIOS_ADMINISTRAR, <UsersPage />, 'usuarios') },

  // ── Sin restricción de rol (solo autenticación) ────────────────────────────
  { path: "/fel",    element: <FelPage /> },
  { path: "/perfil", element: <ProfilePage /> },
];

export default routes;
