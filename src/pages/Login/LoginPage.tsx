import {
  BarChart3,
  Eye,
  EyeOff,
  Lock,
  PackageCheck,
  ShieldCheck,
  User,
  Wrench,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SESSION_EXPIRED_KEY } from "../../hooks/useIdleLogout";
import { useAuth } from "../../store/useAuth";
import { useBusiness } from "../../store/useBusiness";

const BRAND = "#48B9E6";

const BENEFITS = [
  { icon: Wrench, text: "Reparaciones" },
  { icon: PackageCheck, text: "Inventario" },
  { icon: BarChart3, text: "Reportes" },
];

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const { login, isLoading, error } = useAuth();
  const { businessInfo } = useBusiness();
  const navigate = useNavigate();

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
      const authenticatedUser = useAuth.getState().user;
      navigate(authenticatedUser?.es_super_admin ? "/superadmin" : "/dashboard");
    } catch (err) {
      console.error("Error al iniciar sesión:", err);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans">
      <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(440px,0.95fr)]">
        <section className="relative hidden overflow-hidden bg-[#0B72B9] lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-10 xl:px-16">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#0A6DAF_0%,#1EA7D8_54%,#48B9E6_100%)]" />
          <div className="absolute -right-28 top-12 h-80 w-80 rounded-full border border-white/20" />
          <div className="absolute -right-10 top-28 h-56 w-56 rounded-full border border-white/15" />
          <div className="absolute bottom-20 left-10 h-px w-72 bg-white/25" />
          <div className="absolute bottom-32 left-24 h-px w-56 rotate-[-12deg] bg-white/18" />
          <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-white/10" />

          <div className="relative z-10">
            <div className="inline-flex rounded-xl border border-white/25 bg-white px-5 py-4 shadow-lg shadow-blue-950/10">
              <img
                src="/branding/tecnoone-logo-light.png"
                alt="TecnoOne"
                className="h-auto w-32 object-contain"
              />
            </div>
          </div>

          <div className="relative z-10 max-w-xl pb-8">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur">
              <ShieldCheck size={14} />
              Gestión para talleres
            </div>

            <h1 className="text-[2.35rem] font-bold leading-tight tracking-normal text-white xl:text-[3rem]">
              Sistema de gestión para talleres y tiendas de celulares
            </h1>

            <p className="mt-5 max-w-lg text-base leading-7 text-blue-50">
              Controle reparaciones, ventas, inventario, clientes, caja y
              reportes desde una sola plataforma.
            </p>

            <div className="mt-9 grid max-w-lg grid-cols-3 gap-3">
              {BENEFITS.map(({ icon: Icon, text }) => (
                <div
                  key={text}
                  className="rounded-xl border border-white/20 bg-white/12 px-4 py-3 text-white shadow-sm backdrop-blur"
                >
                  <Icon size={18} />
                  <p className="mt-2 text-sm font-medium">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="relative z-10 text-xs font-medium text-blue-50/80">
            TecnoOne · Administración para talleres y tiendas
          </p>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8 lg:bg-slate-50 lg:px-12">
          <div className="w-full max-w-[420px]">
            <div className="mb-7 flex justify-center lg:hidden">
              <div className="inline-flex rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                <img
                  src="/branding/tecnoone-logo-light.png"
                  alt="TecnoOne"
                  className="h-auto w-28 object-contain"
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-7">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700 lg:hidden">
                  <ShieldCheck size={13} />
                  Gestión para talleres
                </div>
                <h2 className="text-2xl font-semibold tracking-normal text-slate-950">
                  Iniciar sesión
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {businessInfo
                    ? `Ingrese con su usuario asignado en ${businessInfo.businessName}.`
                    : "Ingrese con el usuario que le asignó su administrador."}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {sessionExpired && (
                  <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium leading-5 text-blue-800">
                    Sesión cerrada por inactividad. Vuelva a ingresar para
                    continuar.
                  </div>
                )}

                {error && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-5 text-red-700">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <label
                    htmlFor="username"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Usuario
                  </label>
                  <div className="relative">
                    <User
                      size={17}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
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
                      className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500 focus:border-[#1EA7D8] focus:ring-4 focus:ring-sky-100"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock
                      size={17}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Contraseña"
                      required
                      disabled={isLoading}
                      autoComplete="current-password"
                      className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-11 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500 focus:border-[#1EA7D8] focus:ring-4 focus:ring-sky-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={
                        showPassword
                          ? "Ocultar contraseña"
                          : "Mostrar contraseña"
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-4 focus:ring-sky-100"
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !username || !password}
                  className="flex w-full items-center justify-center rounded-lg bg-[#0B72B9] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#095F9B] disabled:cursor-not-allowed disabled:border disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none focus:outline-none focus:ring-4 focus:ring-sky-100"
                >
                  {isLoading ? (
                    <>
                      <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Ingresando...
                    </>
                  ) : (
                    "Entrar"
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-xs leading-5 text-slate-500">
                ¿No puede acceder?{" "}
                <a
                  href="#"
                  className="font-medium text-[#0B72B9] transition hover:text-[#095F9B]"
                >
                  Hable con el administrador de su negocio
                </a>
              </p>
            </div>

            <p className="mt-5 text-center text-xs text-slate-500 lg:hidden">
              TecnoOne · Administración para talleres y tiendas
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
