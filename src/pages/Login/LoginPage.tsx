import {
  Eye,
  EyeOff,
  Lock,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import tecnocellLogo from "../../assets/tecnocell-logo.png";
import { SESSION_EXPIRED_KEY } from "../../hooks/useIdleLogout";
import { useAuth } from "../../store/useAuth";
import { useBusiness } from "../../store/useBusiness";

// Color de acento principal del logo TECNOCELL
const BRAND = "#48B9E6";

// ─── Módulos principales de la tienda ────────────────────────────────────────
const FEATURES = [
  { icon: ShoppingCart, label: "Ventas",       sub: "Facturación y control de caja"      },
  { icon: Wrench,       label: "Reparaciones", sub: "Seguimiento de equipos técnicos"    },
  { icon: Users,        label: "Clientes",     sub: "Historial de compras y servicios"   },
  { icon: Package,      label: "Inventario",   sub: "Stock de repuestos y accesorios"    },
];

// ─── Métricas del resumen diario ─────────────────────────────────────────────
const MOCK_STATS = [
  { label: "Ventas hoy",   value: "Q 4,320", delta: "+12%", up: true  },
  { label: "Reparaciones", value: "18",       delta: "+3",   up: true  },
  { label: "Stock bajo",   value: "5",        delta: "-2",   up: false },
];

export default function LoginPage() {
  const [username, setUsername]         = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const { login, isLoading, error }     = useAuth();
  const { businessInfo }                = useBusiness();
  const navigate                        = useNavigate();

  // Detectar si la sesión fue cerrada por inactividad
  useEffect(() => {
    if (localStorage.getItem(SESSION_EXPIRED_KEY)) {
      setSessionExpired(true);
      localStorage.removeItem(SESSION_EXPIRED_KEY);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login({ username, password });
      navigate("/dashboard");
    } catch (err) {
      console.error("Error al iniciar sesión:", err);
    }
  }

  return (
    <div className="h-screen overflow-hidden flex font-sans" style={{ backgroundColor: "#060B14" }}>

      {/* ═══════════════════════════════════════════════
          LEFT — panel de marca (oculto en móvil)
      ═══════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col justify-between p-10 xl:p-14">

        {/* Fondo con degradado oscuro tecnológico */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #060B14 0%, #0A1220 50%, #0D1526 100%)" }} />

        {/* Orbes de luz celeste — paleta del logo */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl pointer-events-none" style={{ background: "rgba(72,185,230,0.10)" }} />
        <div className="absolute top-1/2 -right-20 w-80 h-80 rounded-full blur-3xl pointer-events-none" style={{ background: "rgba(46,167,216,0.08)" }} />
        <div className="absolute -bottom-24 left-1/3 w-72 h-72 rounded-full blur-3xl pointer-events-none" style={{ background: "rgba(72,185,230,0.06)" }} />

        {/* Grid tecnológico sutil */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(72,185,230,0.9) 1px,transparent 1px),linear-gradient(90deg,rgba(72,185,230,0.9) 1px,transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        {/* Patrón radial central para profundidad */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(72,185,230,0.05) 0%, transparent 70%)" }}
        />

        {/* ── Logo + nombre ──────────────────────────────── */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            {/* Logo TECNOCELL */}
            <div className="w-24 h-24 rounded-2xl overflow-hidden flex items-center justify-center bg-white p-1"
              style={{ boxShadow: "0 6px 28px rgba(72,185,230,0.32)" }}>
              <img
                src={tecnocellLogo}
                alt="TECNOCELL"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove("hidden");
                }}
              />
              <span className="hidden font-black text-lg tracking-tight" style={{ color: "#48B9E6" }}>TC</span>
            </div>
            <span className="font-bold text-sm tracking-widest uppercase" style={{ color: "#A8B3C7" }}>
              TECNOCELL
            </span>
          </div>
        </div>

        {/* ── Copia principal ───────────────────────────── */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
              style={{ background: "rgba(72,185,230,0.08)", border: "1px solid rgba(72,185,230,0.22)" }}>
              <Zap size={12} style={{ color: BRAND }} />
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: BRAND }}>
                Sistema comercial y técnico
              </span>
            </div>

            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
              Control inteligente<br />
              <span style={{
                background: "linear-gradient(90deg, #48B9E6 0%, #2EA7D8 60%, #48B9E6 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                para TECNOCELL
              </span>
            </h1>

            <p className="text-lg leading-relaxed max-w-sm" style={{ color: "#A8B3C7" }}>
              Administra ventas, reparaciones, clientes, inventario y caja desde un solo sistema.
            </p>
          </div>

          {/* Tarjetas de módulos con glassmorphism */}
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, label, sub }) => (
              <div
                key={label}
                className="group rounded-2xl p-4 transition-all duration-300 cursor-default"
                style={{
                  background: "rgba(13,21,38,0.70)",
                  border: "1px solid rgba(72,185,230,0.10)",
                  backdropFilter: "blur(8px)",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(72,185,230,0.06)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(72,185,230,0.22)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(13,21,38,0.70)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(72,185,230,0.10)"; }}
              >
                <Icon size={20} className="mb-2.5 transition-transform duration-300 group-hover:scale-110" style={{ color: BRAND }} />
                <p className="text-white font-semibold text-sm">{label}</p>
                <p className="text-xs mt-0.5" style={{ color: "#7F8A99" }}>{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tarjeta resumen del día ────────────────────── */}
        <div className="relative z-10">
          <div className="rounded-2xl p-5" style={{ background: "rgba(13,21,38,0.75)", border: "1px solid rgba(72,185,230,0.10)", backdropFilter: "blur(8px)" }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.50)" }}>
                Resumen del día
              </span>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-red-400/70" />
                <div className="w-2 h-2 rounded-full bg-yellow-400/70" />
                <div className="w-2 h-2 rounded-full bg-emerald-400/70" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {MOCK_STATS.map(({ label, value, delta, up }) => (
                <div key={label} className="rounded-xl p-3" style={{ background: "rgba(6,11,20,0.60)" }}>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: "#7F8A99" }}>{label}</p>
                  <p className="text-white font-bold text-base mt-1">{value}</p>
                  <p className={`text-[11px] font-medium mt-0.5 flex items-center gap-0.5 ${up ? "text-emerald-400" : "text-rose-400"}`}>
                    <TrendingUp size={10} className={up ? "" : "rotate-180"} />
                    {delta}
                  </p>
                </div>
              ))}
            </div>
            {/* Sparkline en azul/cyan */}
            <div className="mt-4 flex items-end gap-1 h-10">
              {[30, 55, 40, 70, 50, 80, 65, 90, 75, 95, 80, 100].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{ height: `${h}%`, background: "linear-gradient(to top, rgba(46,167,216,0.40), rgba(72,185,230,0.50))" }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          RIGHT — formulario de inicio de sesión
      ═══════════════════════════════════════════════ */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 overflow-y-auto" style={{ backgroundColor: "#060B14" }}>
        <div className="w-full max-w-[420px] space-y-8">

          {/* Cabecera de marca — solo en móvil */}
          <div className="lg:hidden text-center space-y-3">
            <div className="w-28 h-28 mx-auto rounded-2xl overflow-hidden flex items-center justify-center bg-white p-1"
              style={{ boxShadow: "0 6px 28px rgba(72,185,230,0.32)" }}>
              <img
                src={tecnocellLogo}
                alt="TECNOCELL"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove("hidden");
                }}
              />
              <span className="hidden text-white font-black text-base tracking-tight">TC</span>
            </div>
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "#A8B3C7" }}>TECNOCELL</p>
          </div>

          {/* Tarjeta del formulario */}
          <div
            className="rounded-3xl shadow-2xl p-8 space-y-7"
            style={{
              background: "#0D1526",
              border: "1px solid rgba(72,185,230,0.10)",
              boxShadow: "0 25px 60px rgba(0,0,0,0.60), 0 0 0 1px rgba(72,185,230,0.06)",
            }}
          >
            {/* Encabezado del formulario */}
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold text-white tracking-tight">Iniciar sesión</h2>
              <p className="text-sm" style={{ color: "#A8B3C7" }}>
                {businessInfo
                  ? `Accede al panel administrativo de ${businessInfo.businessName}`
                  : "Accede al panel administrativo de TECNOCELL"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Banner: sesión expirada por inactividad */}
              {sessionExpired && (
                <div className="rounded-xl px-4 py-3 flex items-start gap-2.5"
                  style={{ background: "rgba(72,185,230,0.08)", border: "1px solid rgba(72,185,230,0.30)" }}>
                  <span className="text-lg leading-none mt-0.5" style={{ color: "#48B9E6" }}>⏱</span>
                  <p className="text-sm font-medium" style={{ color: "#48B9E6" }}>
                    Tu sesión expiró por inactividad. Inicia sesión nuevamente.
                  </p>
                </div>
              )}

              {/* Alerta de error */}
              {error && (
                <div className="rounded-xl px-4 py-3 flex items-start gap-2.5"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.28)" }}>
                  <span className="text-red-400 text-lg leading-none mt-0.5">⚠</span>
                  <p className="text-red-300 text-sm font-medium">{error}</p>
                </div>
              )}

              {/* Campo: Usuario */}
              <div className="space-y-2">
                <label htmlFor="username" className="block text-xs font-semibold uppercase tracking-widest" style={{ color: "#A8B3C7" }}>
                  Usuario
                </label>
                <div className="relative group">
                  <Wrench
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors pointer-events-none"
                    style={{ color: "#64748B" }}
                  />
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ingresa tu usuario"
                    required
                    disabled={isLoading}
                    autoComplete="username"
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl text-white text-sm transition-all duration-200 disabled:opacity-50 focus:outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "#fff",
                    }}
                    onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(72,185,230,0.60)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(72,185,230,0.12)"; }}
                    onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.10)"; e.currentTarget.style.boxShadow = "none"; }}
                  />
                </div>
              </div>

              {/* Campo: Contraseña */}
              <div className="space-y-2">
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-widest" style={{ color: "#A8B3C7" }}>
                  Contraseña
                </label>
                <div className="relative group">
                  <Lock
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: "#64748B" }}
                  />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingresa tu contraseña"
                    required
                    disabled={isLoading}
                    autoComplete="current-password"
                    className="w-full pl-11 pr-12 py-3.5 rounded-xl text-white text-sm transition-all duration-200 disabled:opacity-50 focus:outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "#fff",
                    }}
                    onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(72,185,230,0.60)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(72,185,230,0.12)"; }}
                    onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.10)"; e.currentTarget.style.boxShadow = "none"; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors"
                    style={{ color: "#64748B" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#A8B3C7"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#64748B"; }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Botón de ingreso */}
              <button
                type="submit"
                disabled={isLoading || !username || !password}
                className="relative w-full py-3.5 rounded-xl font-semibold text-sm text-white overflow-hidden group transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none"
                style={{ boxShadow: "0 4px 18px rgba(72,185,230,0.28)" }}
                onFocus={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px rgba(72,185,230,0.28), 0 4px 18px rgba(72,185,230,0.22)"; }}
                onBlur={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 18px rgba(72,185,230,0.28)"; }}
              >
                {/* Gradiente del botón — celeste del logo */}
                <span
                  className="absolute inset-0 transition-opacity duration-300"
                  style={{ background: "linear-gradient(90deg, #2EA7D8 0%, #48B9E6 100%)" }}
                />
                {/* Glow hover */}
                <span
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-lg"
                  style={{ background: "linear-gradient(90deg, #2EA7D8, #48B9E6)" }}
                />
                <span className="relative flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Ingresando...
                    </>
                  ) : (
                    "Ingresar al sistema"
                  )}
                </span>
              </button>
            </form>

            {/* Texto de ayuda */}
            <p className="text-center text-xs" style={{ color: "#7F8A99" }}>
              ¿Problemas para ingresar?{" "}
              <a
                href="#"
                className="transition-colors font-medium"
                style={{ color: "#B8C2D1" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = BRAND; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#B8C2D1"; }}
              >
                Contacta al administrador
              </a>
            </p>
          </div>

          {/* Footer */}
          <div className="text-center space-y-1">
            <p className="text-xs" style={{ color: "#7F8A99" }}>
              Sistema de gestión comercial · TECNOCELL
            </p>
            <p className="text-xs" style={{ color: "#4B5563" }}>
              Desarrollado por{" "}
              <span className="font-medium" style={{ color: "#6B7A8D" }}>TechWorksOne</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
