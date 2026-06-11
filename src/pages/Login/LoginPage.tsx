import {
  Eye,
  EyeOff,
  Lock,
  ShoppingCart,
  User,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SESSION_EXPIRED_KEY } from "../../hooks/useIdleLogout";
import { useAuth } from "../../store/useAuth";
import { useBusiness } from "../../store/useBusiness";

// Color de acento principal del logo TecnoOne
const BRAND = "#48B9E6";

// ─── Beneficios principales ─────────────────────────────────────────────────
const BENEFITS = [
  { icon: Wrench,       text: "Órdenes de reparación con seguimiento por estado" },
  { icon: ShoppingCart, text: "Ventas, stock y movimientos al día" },
  { icon: Users,        text: "Clientes, caja diaria y reportes operativos" },
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

        {/* ── Copia principal ───────────────────────────── */}
        <div className="relative z-10 space-y-9">
          <div className="space-y-6">
            {/* Logo TecnoOne */}
            <img
              src="/branding/tecnoone-logo-dark.png"
              alt="TecnoOne"
              className="w-40 sm:w-48 lg:w-56 h-auto object-contain"
            />

            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
              style={{ background: "rgba(72,185,230,0.08)", border: "1px solid rgba(72,185,230,0.22)" }}>
              <Zap size={12} style={{ color: BRAND }} />
              <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: BRAND }}>
                Para talleres y tiendas de reparación
              </span>
            </div>

            <h1 className="text-4xl xl:text-[2.65rem] font-bold text-white leading-[1.15] tracking-tight">
              Tu operación diaria,<br />
              <span style={{
                background: "linear-gradient(90deg, #48B9E6 0%, #2EA7D8 60%, #48B9E6 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                en un solo panel
              </span>
            </h1>

            <p className="text-[0.9375rem] leading-relaxed max-w-[19rem]" style={{ color: "#8B96A8" }}>
              Reparaciones, ventas, inventario y clientes sin saltar entre hojas de cálculo ni sistemas sueltos.
            </p>
          </div>

          {/* Beneficios — lista limpia */}
          <div className="space-y-3">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(72,185,230,0.10)", border: "1px solid rgba(72,185,230,0.18)" }}>
                  <Icon size={15} style={{ color: BRAND }} />
                </div>
                <span className="text-sm font-medium leading-snug" style={{ color: "#C4CDD9" }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Pie de panel ──────────────────────────────── */}
        <div className="relative z-10">
          <p className="text-xs tracking-wide" style={{ color: "#3D4D5C" }}>
            TecnoOne · Operación unificada · v2.0
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          RIGHT — formulario de inicio de sesión
      ═══════════════════════════════════════════════ */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 overflow-y-auto" style={{ backgroundColor: "#060B14" }}>
        <div className="w-full max-w-[420px] space-y-7 sm:space-y-8">

          {/* Cabecera de marca — solo en móvil */}
          <div className="lg:hidden flex justify-center">
            <img
              src="/branding/tecnoone-logo-dark.png"
              alt="TecnoOne"
              className="w-36 sm:w-44 h-auto object-contain"
            />
          </div>

          {/* Tarjeta del formulario */}
          <div
            className="rounded-3xl shadow-2xl p-7 sm:p-9 space-y-6 sm:space-y-7"
            style={{
              background: "#0D1526",
              border: "1px solid rgba(72,185,230,0.13)",
              boxShadow: "0 32px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(72,185,230,0.06)",
            }}
          >
            {/* Encabezado del formulario */}
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-white tracking-tight">Iniciar sesión</h2>
              <p className="text-sm leading-relaxed" style={{ color: "#8B96A8" }}>
                {businessInfo
                  ? `Ingresa con tu usuario asignado en ${businessInfo.businessName}`
                  : "Ingresa con el usuario que te asignó tu administrador"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Banner: sesión expirada por inactividad */}
              {sessionExpired && (
                <div className="rounded-xl px-4 py-3 flex items-start gap-2.5"
                  style={{ background: "rgba(72,185,230,0.08)", border: "1px solid rgba(72,185,230,0.30)" }}>
                  <span className="text-lg leading-none mt-0.5" style={{ color: "#48B9E6" }}>⏱</span>
                  <p className="text-sm font-medium leading-snug" style={{ color: "#48B9E6" }}>
                    Sesión cerrada por inactividad. Vuelve a ingresar para continuar.
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
                <label htmlFor="username" className="block text-xs font-semibold uppercase tracking-wide" style={{ color: "#A8B3C7" }}>
                  Usuario
                </label>
                <div className="relative group">
                  <User
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors pointer-events-none"
                    style={{ color: "#64748B" }}
                  />
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Usuario de acceso"
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
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wide" style={{ color: "#A8B3C7" }}>
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
                    placeholder="Tu contraseña"
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
                    "Entrar"
                  )}
                </span>
              </button>
            </form>

            {/* Texto de ayuda */}
            <p className="text-center text-xs leading-relaxed" style={{ color: "#7F8A99" }}>
              ¿No puedes acceder?{" "}
              <a
                href="#"
                className="transition-colors font-medium"
                style={{ color: "#B8C2D1" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = BRAND; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#B8C2D1"; }}
              >
                Habla con el administrador de tu negocio
              </a>
            </p>
          </div>

          {/* Footer */}
          <div className="text-center space-y-0.5">
            <p className="text-xs" style={{ color: "#7F8A99" }}>
              Gestión para talleres y tiendas · TecnoOne
            </p>
            <p className="text-[0.6875rem]" style={{ color: "#4B5563" }}>
              Desarrollado por{" "}
              <span className="font-medium" style={{ color: "#6B7A8D" }}>TechWorksOne</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
