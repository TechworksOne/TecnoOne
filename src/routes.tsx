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
import ProtectedRoute from "./components/common/ProtectedRoute";
import { ROLES } from "./lib/permissions";

const ADMIN         = [ROLES.ADMINISTRADOR];
const ADMIN_TECNICO = [ROLES.ADMINISTRADOR, ROLES.TECNICO];
const ADMIN_VENTAS  = [ROLES.ADMINISTRADOR, ROLES.VENTAS];
const ALL_ROLES     = [ROLES.ADMINISTRADOR, ROLES.TECNICO, ROLES.VENTAS];

const PR = (roles: string[], child: React.ReactElement) => (
  <ProtectedRoute roles={roles}>{child}</ProtectedRoute>
);

const routes = [
  { path: "/login",     element: <LoginPage /> },
  { path: "/dashboard", element: <DashboardPage /> },

  // ── Operación ──────────────────────────────────────────────────────────────
  { path: "/productos",            element: PR(ADMIN_VENTAS,  <ProductsPage />) },
  { path: "/repuestos",            element: PR(ALL_ROLES, <RepuestosPage />) },
  { path: "/repuestos/nuevo",      element: PR(ALL_ROLES, <RepuestoForm />) },
  { path: "/repuestos/editar/:id", element: PR(ALL_ROLES, <RepuestoForm />) },
  { path: "/compras",              element: PR(ADMIN,         <PurchasesPage />) },
  { path: "/compras/nueva",        element: PR(ADMIN,         <PurchaseFormPage />) },
  { path: "/cotizaciones",                element: PR(ADMIN_VENTAS, <QuotesPage />) },
  { path: "/cotizaciones/nueva",          element: PR(ADMIN_VENTAS, <QuoteFormPage />) },
  { path: "/cotizaciones/:id/editar",     element: PR(ADMIN_VENTAS, <QuoteFormPage />) },
  { path: "/cotizaciones/:id",            element: PR(ADMIN_VENTAS, <QuoteDetailPage />) },
  { path: "/ventas",       element: PR(ADMIN_VENTAS, <SalesPageNew />) },
  { path: "/ventas/nueva", element: PR(ADMIN_VENTAS, <SaleNewPage />) },
  { path: "/ventas/:id",   element: PR(ADMIN_VENTAS, <SaleDetailPage />) },

  // ── Servicio técnico ───────────────────────────────────────────────────────
  { path: "/reparaciones",            element: PR(ALL_ROLES,     <RepairsPage />) },
  { path: "/reparaciones/nueva",      element: PR(ALL_ROLES,     <RepairFormSimple />) },
  { path: "/reparaciones/:id/editar", element: PR(ALL_ROLES,     <RepairFormSimple />) },
  { path: "/flujo-reparaciones",      element: PR(ALL_ROLES, <FlujoReparacionesPage />) },
  { path: "/flujo-reparaciones/:id",  element: PR(ALL_ROLES, <FlujoReparacionDetailPage />) },
  { path: "/ordenes-trabajo",         element: PR(ADMIN_TECNICO, <OrdenesTrabajoPage />) },
  { path: "/agenda",                  element: PR(ALL_ROLES, <AgendaPage />) },
  { path: "/pago-tarjeta",            element: PR(ADMIN_VENTAS,  <CardPaymentPage />) },

  // ── Administración ─────────────────────────────────────────────────────────
  { path: "/clientes",       element: PR(ADMIN_VENTAS, <CustomersPage />) },
  { path: "/caja-bancos",    element: PR(ALL_ROLES,    <CajaBancosPage />) },
  { path: "/deudores",       element: PR(ADMIN,        <DeudoresPage />) },
  { path: "/proveedores",    element: PR(ADMIN,        <SuppliersPage />) },
  { path: "/stickers-garantia", element: PR(ADMIN,     <StickersGarantiaPage />) },
  { path: "/admin-usuarios", element: PR(ADMIN,        <AdminUsuariosPage />) },
  { path: "/reportes",       element: PR(ADMIN,        <ReportesPage />) },
  { path: "/usuarios",       element: PR(ADMIN,        <UsersPage />) },

  // ── Sin restricción de rol (solo autenticación) ────────────────────────────
  { path: "/fel",    element: <FelPage /> },
  { path: "/perfil", element: <ProfilePage /> },
];

export default routes;
