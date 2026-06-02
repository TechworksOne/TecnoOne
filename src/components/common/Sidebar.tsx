import {
  Box, ChevronLeft, ChevronRight, FileText, Home, User, Users,
  CreditCard, Wrench, Settings, ShoppingBag, Building2, GitBranch,
  Tag, Shield, Wallet, BarChart3, Receipt, CalendarDays, ClipboardList,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import tecnocellLogo from "../../assets/tecnocell-logo.png";
import { useSidebar } from "../../store/useSidebar";
import { useAuth } from "../../store/useAuth";

// ─── Grupos de navegación ──────────────────────────────────────────────────
// roles: null = visible para todos los roles autenticados
// roles: [...] = visible solo para los roles indicados
const GROUPS = [
  {
    label: "Principal",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: <Home size={17} />, roles: null },
      { to: "/perfil",    label: "Perfil",    icon: <User size={17} />, roles: null },
    ],
  },
  {
    label: "Operación",
    items: [
      { to: "/productos",    label: "Productos",    icon: <Box size={17} />,         roles: ["ADMINISTRADOR", "VENTAS"]                },
      { to: "/repuestos",    label: "Repuestos",    icon: <Settings size={17} />,    roles: null },
      // null = todos los roles autenticados
      { to: "/compras",      label: "Compras",      icon: <ShoppingBag size={17} />, roles: ["ADMINISTRADOR"]                          },
      { to: "/cotizaciones", label: "Cotizaciones", icon: <FileText size={17} />,    roles: ["ADMINISTRADOR", "VENTAS"]                },
      { to: "/ventas",       label: "Ventas",       icon: <CreditCard size={17} />,  roles: ["ADMINISTRADOR", "VENTAS"]                },
    ],
  },
  {
    label: "Servicio técnico",
    items: [
      { to: "/reparaciones",       label: "Reparaciones",       icon: <Wrench size={17} />,        roles: ["ADMINISTRADOR", "TECNICO", "VENTAS"] },
      { to: "/flujo-reparaciones", label: "Flujo Rep.",         icon: <GitBranch size={17} />,     roles: null },
      { to: "/ordenes-trabajo",    label: "Órdenes de Trabajo", icon: <ClipboardList size={17} />, roles: ["ADMINISTRADOR", "TECNICO"]           },
      { to: "/agenda",             label: "Agenda entregas",    icon: <CalendarDays size={17} />,  roles: null },
      { to: "/stickers-garantia",  label: "Stickers garantía",  icon: <Tag size={17} />,           roles: ["ADMINISTRADOR"]                      },
    ],
  },
  {
    label: "Administración",
    items: [
      { to: "/caja-bancos",    label: "Caja y Bancos",   icon: <Wallet size={17} />,    roles: null },
      { to: "/deudores",       label: "Deudores",        icon: <Receipt size={17} />,   roles: ["ADMINISTRADOR"]               },
      { to: "/reportes",       label: "Reportes",        icon: <BarChart3 size={17} />, roles: ["ADMINISTRADOR"]               },
      { to: "/clientes",       label: "Clientes",        icon: <Users size={17} />,     roles: ["ADMINISTRADOR", "VENTAS"]     },
      { to: "/proveedores",    label: "Proveedores",     icon: <Building2 size={17} />, roles: ["ADMINISTRADOR"]               },
      { to: "/admin-usuarios", label: "Admin. usuarios", icon: <Shield size={17} />,    roles: ["ADMINISTRADOR"]               },
    ],
  },
];

export default function Sidebar() {
  const { isOpen, toggle } = useSidebar();
  const { user } = useAuth();
  const location = useLocation();

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-cierre en navegación (solo mobile)
  useEffect(() => {
    if (isMobile && isOpen) toggle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Calcular roles efectivos (RBAC + campo legado para compatibilidad)
  const userRoles: string[] = user?.roles ?? [];
  const legacyRole = (user?.role ?? '').toLowerCase();
  const effectiveRoles = new Set(userRoles);
  if (legacyRole === 'admin' || legacyRole === 'administrador') effectiveRoles.add('ADMINISTRADOR');
  if (legacyRole === 'tecnico')                                  effectiveRoles.add('TECNICO');
  if (legacyRole === 'ventas' || legacyRole === 'employee')      effectiveRoles.add('VENTAS');

  const sidebarWidth = isMobile ? 264 : (isOpen ? 264 : 72);
  const sidebarTransform = isMobile && !isOpen ? 'translateX(-100%)' : 'translateX(0)';
  // En mobile, el contenido siempre se muestra expandido (isOpen determina visibilidad)
  const showExpanded = isMobile ? true : isOpen;

  return (
    <>
      {/* Backdrop — solo mobile, solo cuando está abierto */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30"
          onClick={toggle}
          aria-hidden="true"
        />
      )}
      <aside
        className="sidebar-bg flex flex-col h-screen fixed left-0 top-0 z-40 overflow-hidden"
        style={{
          width: sidebarWidth,
          borderRight: "1px solid var(--color-border)",
          transition: "width 280ms cubic-bezier(.4,0,.2,1), transform 280ms cubic-bezier(.4,0,.2,1)",
          transform: sidebarTransform,
        }}
      >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center"
        style={{
          height: 64,
          padding: isOpen ? "0 14px" : "0",
          justifyContent: isOpen ? "flex-start" : "center",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {isOpen ? (
          <div className="flex items-center gap-3 overflow-hidden w-full">
            <img
              src={tecnocellLogo}
              alt="TECNOCELL"
              style={{ height: 36, width: "auto", objectFit: "contain", flexShrink: 0 }}
            />
            <div className="leading-tight overflow-hidden">
              <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", color: "var(--color-text)", whiteSpace: "nowrap" }}>
                TECNOCELL
              </p>
              <p style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.12em", color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                Sistema comercial
              </p>
            </div>
          </div>
        ) : (
          <img
            src={tecnocellLogo}
            alt="TC"
            style={{ height: 32, width: 32, objectFit: "contain" }}
          />
        )}
      </div>

      {/* ── Navegación ─────────────────────────────────────────────────── */}
      <nav
        className={isOpen ? "sidebar-nav" : "sidebar-nav-collapsed"}
        style={{ padding: isOpen ? "8px 10px 20px" : "8px 7px 20px" }}
      >
        {GROUPS.map((group, gi) => {
          const visible = group.items.filter(item => !item.roles || item.roles.some(r => effectiveRoles.has(r)));
          if (visible.length === 0) return null;

          return (
            <div key={gi} style={{ marginBottom: 2 }}>
              {/* Grupo label — solo expandido */}
              {isOpen ? (
                <div className="flex items-center gap-1.5" style={{ padding: "12px 6px 4px" }}>
                  <div style={{ height: 1, width: 10, background: "#48B9E6", borderRadius: 999, opacity: 0.7 }} />
                  <p style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: "0.13em",
                    textTransform: "uppercase",
                    color: "var(--color-text-muted)",
                  }}>
                    {group.label}
                  </p>
                </div>
              ) : (
                gi > 0 && (
                  <div style={{ height: 1, background: "var(--color-border)", margin: "8px 8px" }} />
                )
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {visible.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={!isOpen ? item.label : undefined}
                  >
                    {({ isActive }) => (
                      <div
                        className="flex items-center transition-all duration-150"
                        style={{
                          gap: isOpen ? 10 : 0,
                          justifyContent: isOpen ? "flex-start" : "center",
                          padding: isOpen ? "0 10px" : "0",
                          height: 42,
                          borderRadius: 10,
                          position: "relative",
                          cursor: "pointer",
                          background: isActive
                            ? "linear-gradient(90deg, rgba(72,185,230,0.18) 0%, rgba(72,185,230,0.07) 100%)"
                            : "transparent",
                          boxShadow: isActive ? "inset 0 0 0 1px rgba(72,185,230,0.22)" : "none",
                          color: isActive ? "var(--color-text)" : "var(--color-text-sec)",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.background = "rgba(72,185,230,0.08)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.background = "transparent";
                        }}
                      >
                        {/* Left accent bar for active */}
                        {isActive && isOpen && (
                          <div style={{
                            position: "absolute",
                            left: 0,
                            top: "20%",
                            height: "60%",
                            width: 3,
                            borderRadius: "0 3px 3px 0",
                            background: "linear-gradient(180deg, #48B9E6, #2563EB)",
                          }} />
                        )}

                        {/* Icon */}
                        <span style={{
                          color: isActive ? "#48B9E6" : "var(--color-text-muted)",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: isOpen ? "auto" : 24,
                          transition: "color 150ms",
                        }}>
                          {item.icon}
                        </span>

                        {/* Label */}
                        {isOpen && (
                          <span style={{
                            fontSize: 13.5,
                            fontWeight: isActive ? 600 : 400,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            letterSpacing: "-0.01em",
                          }}>
                            {item.label}
                          </span>
                        )}
                      </div>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── Footer toggle ───────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center"
        style={{
          height: 52,
          borderTop: "1px solid var(--color-border)",
          padding: isOpen ? "0 12px 0 14px" : "0",
          justifyContent: isOpen ? "space-between" : "center",
        }}
      >
        {isOpen && (
          <p style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.05em", color: "var(--color-text-muted)" }}>
            v2.0 · TECNOCELL
          </p>
        )}
        <button
          onClick={toggle}
          aria-label={isOpen ? "Colapsar menú" : "Expandir menú"}
          style={{
            width: 32, height: 32,
            borderRadius: 8,
            border: "1px solid var(--color-border)",
            background: "var(--color-surface-soft)",
            color: "var(--color-text-sec)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 150ms",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(72,185,230,0.15)";
            (e.currentTarget as HTMLElement).style.color = "#48B9E6";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(72,185,230,0.4)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--color-surface-soft)";
            (e.currentTarget as HTMLElement).style.color = "var(--color-text-sec)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
          }}
        >
          {showExpanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>
    </aside>
    </>
  );
}

