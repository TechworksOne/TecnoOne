import { LogOut, Menu, Moon, Sun, User } from "lucide-react";
import BrandMark from "./BrandMark";
import { getImageUrl } from "../../utils/getImageUrl";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../store/useAuth";
import { useSidebar } from "../../store/useSidebar";

export default function Topbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toggle } = useSidebar();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-5 py-2.5"
      style={{
        background:   "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        boxShadow:    "0 1px 8px rgba(0,0,0,0.07)",
        transition:   "background 250ms ease, border-color 250ms ease",
        minHeight:    52,
      }}
    >
      {/* Izquierda: botón hamburguesa (mobile) + branding TecnoOne */}
      <div className="flex items-center gap-3">
        {/* Hamburguesa — solo visible en mobile */}
        <button
          onClick={toggle}
          aria-label="Abrir menú"
          className="md:hidden flex items-center justify-center rounded-xl shrink-0"
          style={{
            width: 34,
            height: 34,
            background: "var(--color-surface-soft)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-sec)",
          }}
        >
          <Menu size={18} />
        </button>
        <BrandMark size="sm" />

        <div className="flex flex-col leading-tight">
          <span
            className="text-sm font-extrabold tracking-widest"
            style={{ color: "var(--color-text)", letterSpacing: "0.1em" }}
          >
            TecnoOne
          </span>
          <span
            className="text-[9px] font-medium uppercase tracking-widest hidden sm:block"
            style={{ color: "var(--color-text-sec)" }}
          >
            Sistema comercial
          </span>
        </div>

        {/* Separador vertical */}
        <div
          className="hidden sm:block self-stretch w-px mx-1"
          style={{ background: "var(--color-border)" }}
        />

        {/* Hora actual */}
        <span className="hidden sm:block text-xs font-mono" style={{ color: "var(--color-text-sec)" }}>
          {new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Toggle de tema */}
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          className="rounded-xl transition-all flex items-center justify-center shrink-0"
          style={{
            width: 34,
            height: 34,
            background: "var(--color-surface-soft)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-sec)",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(72,185,230,0.12)";
            (e.currentTarget as HTMLElement).style.color      = "var(--color-primary)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "var(--color-surface-soft)";
            (e.currentTarget as HTMLElement).style.color      = "var(--color-text-sec)";
          }}
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Información del usuario */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
          style={{
            background: "var(--color-surface-soft)",
            border:     "1px solid var(--color-border)",
          }}
        >
          {/* Avatar: foto de perfil o inicial como fallback */}
          {user?.perfil?.foto_perfil ? (
            <img
              src={getImageUrl(user.perfil.foto_perfil)}
              alt={user.name}
              className="rounded-lg shrink-0 object-cover"
              style={{ width: 26, height: 26 }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-lg text-white font-bold text-xs shrink-0"
              style={{
                width: 26,
                height: 26,
                background: "linear-gradient(135deg, #48B9E6 0%, #2563EB 100%)",
              }}
            >
              {user?.name?.[0]?.toUpperCase() ?? <User size={13} />}
            </div>
          )}
          <div className="text-sm hidden sm:block">
            <p className="font-semibold leading-none" style={{ color: "var(--color-text)", fontSize: 12.5 }}>
              {user?.name}
            </p>
            <p className="text-xs mt-0.5 capitalize" style={{ color: "var(--color-text-sec)", fontSize: 10 }}>
              {(() => {
                const roles = user?.roles ?? [];
                if (roles.includes('ADMINISTRADOR') || user?.role === 'admin') return 'Administrador';
                if (roles.includes('TECNICO')       || user?.role === 'tecnico') return 'T\u00e9cnico';
                if (roles.includes('VENTAS')        || user?.role === 'ventas') return 'Ventas';
                return 'Empleado';
              })()}
            </p>
          </div>
        </div>

        {/* Cerrar sesión */}
        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          className="rounded-xl transition-all flex items-center gap-1.5 px-3 shrink-0"
          style={{
            height: 34,
            background: "var(--color-surface-soft)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-sec)",
            fontSize: 13,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.4)";
            (e.currentTarget as HTMLElement).style.color = "#ef4444";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "var(--color-surface-soft)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
            (e.currentTarget as HTMLElement).style.color = "var(--color-text-sec)";
          }}
        >
          <LogOut size={14} />
          <span className="hidden sm:inline font-medium">Salir</span>
        </button>
      </div>
    </header>
  );
}
