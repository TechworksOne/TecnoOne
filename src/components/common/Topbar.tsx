import { LogOut, Menu, Moon, Sun, User } from "lucide-react";
import { getSafeImageUrl, getUserInitials } from "../../lib/avatar";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../store/useAuth";
import { useSidebar } from "../../store/useSidebar";

export default function Topbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toggle } = useSidebar();
  const [avatarError, setAvatarError] = useState(false);
  const avatarUrl = getSafeImageUrl(user?.perfil?.foto_perfil);
  const userInitials = getUserInitials(user);

  useEffect(() => {
    setAvatarError(false);
  }, [user?.id, user?.perfil?.foto_perfil]);

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
        boxShadow:    "none",
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
          className="md:hidden flex items-center justify-center rounded-lg shrink-0"
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
        <img
          src={theme === "dark" ? "/branding/tecnoone-logo-dark.png" : "/branding/tecnoone-logo-light.png"}
          alt="TecnoOne"
          className="h-8 sm:h-9 w-auto object-contain shrink-0"
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
          className="rounded-lg transition-all flex items-center justify-center shrink-0"
          style={{
            width: 34,
            height: 34,
            background: "var(--color-surface-soft)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-sec)",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(var(--tenant-primary-rgb),0.10)";
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
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{
            background: "var(--color-surface-soft)",
            border:     "1px solid var(--color-border)",
          }}
        >
          {/* Avatar: foto de perfil o inicial como fallback */}
          {avatarUrl && !avatarError ? (
            <img
              src={avatarUrl}
              alt={user?.name || user?.username || "Usuario"}
              className="rounded-lg shrink-0 object-cover"
              style={{ width: 26, height: 26 }}
              onError={() => setAvatarError(true)}
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-lg text-white font-bold text-xs shrink-0"
              style={{
                width: 26,
                height: 26,
                background: "linear-gradient(135deg, var(--tenant-primary-color) 0%, var(--tenant-primary-dark) 100%)",
              }}
            >
              {userInitials || <User size={13} />}
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
          className="rounded-lg transition-all flex items-center gap-1.5 px-3 shrink-0"
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
