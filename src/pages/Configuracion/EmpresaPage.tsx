import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  Building2, Camera, CheckCircle2, Loader2, Mail, MapPin,
  FileText, Palette, Phone, Save, Upload, Wallet, DollarSign, AlignLeft,
} from "lucide-react";
import { useEmpresa } from "../../store/useEmpresa";
import { useToast } from "../../components/ui/Toast";
import { getImageUrl } from "../../utils/getImageUrl";
import { normalizeTenantColor } from "../../lib/tenantBranding";

const MONEDAS = [
  { codigo: "GTQ", simbolo: "Q", label: "GTQ - Quetzal" },
  { codigo: "USD", simbolo: "$", label: "USD - Dólar" },
  { codigo: "MXN", simbolo: "$", label: "MXN - Peso mexicano" },
  { codigo: "HNL", simbolo: "L", label: "HNL - Lempira" },
  { codigo: "CRC", simbolo: "₡", label: "CRC - Colón costarricense" },
  { codigo: "NIO", simbolo: "C$", label: "NIO - Córdoba" },
  { codigo: "PAB", simbolo: "B/.", label: "PAB - Balboa" },
];

interface FormState {
  nombre_comercial: string;
  razon_social: string;
  nit: string;
  telefono: string;
  correo: string;
  direccion: string;
  logo_url: string;
  color_principal: string;
  moneda_codigo: string;
  moneda_simbolo: string;
  precio_revision_default: string;
  condiciones_servicio_contrato: string;
}

const emptyForm: FormState = {
  nombre_comercial: "",
  razon_social: "",
  nit: "",
  telefono: "",
  correo: "",
  direccion: "",
  logo_url: "",
  color_principal: "#2563eb",
  moneda_codigo: "GTQ",
  moneda_simbolo: "Q",
  precio_revision_default: "",
  condiciones_servicio_contrato: "",
};

const inputStyle = {
  background: "var(--color-input-bg)",
  borderColor: "var(--color-border)",
  color: "var(--color-text)",
};

const inputCls =
  "w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-[var(--color-primary)]";

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (name || "TE").slice(0, 2).toUpperCase();
}

export default function EmpresaPage() {
  const { empresa, isLoading, loadEmpresa, updateEmpresa, uploadLogo } = useEmpresa();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadEmpresa();
  }, [loadEmpresa]);

  useEffect(() => {
    if (!empresa) return;

    setForm({
      nombre_comercial: empresa.nombre_comercial || empresa.nombre || "",
      razon_social: empresa.razon_social || "",
      nit: empresa.nit || "",
      telefono: empresa.telefono || "",
      correo: empresa.correo || empresa.email || "",
      direccion: empresa.direccion || "",
      logo_url: empresa.logo_url || "",
      color_principal: empresa.color_principal || empresa.color_primario || "#2563eb",
      moneda_codigo: empresa.moneda_codigo || "GTQ",
      moneda_simbolo: empresa.moneda_simbolo || "Q",
      precio_revision_default: empresa.precio_revision_default != null ? String(empresa.precio_revision_default) : "",
      condiciones_servicio_contrato: empresa.condiciones_servicio_contrato || "",
    });
    setLogoPreview(empresa.logo_url ? getImageUrl(empresa.logo_url) : "");
  }, [empresa]);

  const selectedCurrency = useMemo(
    () => MONEDAS.find((m) => m.codigo === form.moneda_codigo) || MONEDAS[0],
    [form.moneda_codigo]
  );

  const displayName = form.nombre_comercial || empresa?.nombre || "Empresa";
  const safePrimaryColor = normalizeTenantColor(form.color_principal);

  const setField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCurrencyChange = (codigo: string) => {
    const moneda = MONEDAS.find((m) => m.codigo === codigo) || MONEDAS[0];
    setForm((prev) => ({
      ...prev,
      moneda_codigo: moneda.codigo,
      moneda_simbolo: moneda.simbolo,
    }));
  };

  const handleLogoSelect = (file: File | undefined) => {
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      await updateEmpresa({
        nombre_comercial: form.nombre_comercial,
        razon_social: form.razon_social,
        nit: form.nit,
        telefono: form.telefono,
        correo: form.correo,
        direccion: form.direccion,
        color_principal: form.color_principal,
        moneda_codigo: form.moneda_codigo,
        moneda_simbolo: form.moneda_simbolo,
        precio_revision_default: form.precio_revision_default !== "" ? parseFloat(form.precio_revision_default) : null,
        condiciones_servicio_contrato: form.condiciones_servicio_contrato || null,
      });

      if (logoFile) {
        await uploadLogo(logoFile);
        setLogoFile(null);
      }

      toast.success("Configuración de empresa guardada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la empresa");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-sec)" }}>
            Configuración
          </p>
          <h1 className="text-2xl font-bold mt-1" style={{ color: "var(--color-text)" }}>
            Empresa
          </h1>
        </div>

        <div
          className="flex items-center gap-2 rounded-xl border px-3 py-2"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <CheckCircle2 size={16} style={{ color: form.color_principal }} />
          <span className="text-sm font-medium" style={{ color: "var(--color-text-sec)" }}>
            {empresa?.estado || "activa"}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
        <section
          className="rounded-2xl border p-5 h-fit"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <div className="flex flex-col items-center text-center">
            <div
              className="relative flex items-center justify-center rounded-2xl overflow-hidden border"
              style={{
                width: 144,
                height: 144,
                background: `${safePrimaryColor}14`,
                borderColor: "var(--color-border)",
              }}
            >
              {logoPreview ? (
                <img src={logoPreview} alt={displayName} className="w-full h-full object-contain p-3" />
              ) : (
                <span className="text-4xl font-extrabold" style={{ color: safePrimaryColor }}>
                  {getInitials(displayName)}
                </span>
              )}
            </div>

            <h2 className="mt-4 text-lg font-bold" style={{ color: "var(--color-text)" }}>
              {displayName}
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--color-text-sec)" }}>
              {selectedCurrency.label}
            </p>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => handleLogoSelect(event.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition"
              style={{
                background: "var(--color-surface-soft)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              <Camera size={16} />
              Cambiar logo
            </button>
          </div>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="flex items-center gap-2 text-sm font-semibold mb-1.5" style={{ color: "var(--color-text)" }}>
                <Palette size={15} /> Color principal
              </span>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.color_principal}
                  onChange={(event) => setField("color_principal", event.target.value)}
                  className="h-11 w-14 rounded-xl border p-1"
                  style={{ borderColor: "var(--color-border)", background: "var(--color-surface-soft)" }}
                />
                <input
                  value={form.color_principal}
                  onChange={(event) => setField("color_principal", event.target.value)}
                  className={inputCls}
                  style={inputStyle}
                  maxLength={20}
                />
              </div>
            </label>

            <label className="block">
              <span className="flex items-center gap-2 text-sm font-semibold mb-1.5" style={{ color: "var(--color-text)" }}>
                <Wallet size={15} /> Moneda
              </span>
              <select
                value={form.moneda_codigo}
                onChange={(event) => handleCurrencyChange(event.target.value)}
                className={inputCls}
                style={inputStyle}
              >
                {MONEDAS.map((moneda) => (
                  <option key={moneda.codigo} value={moneda.codigo}>
                    {moneda.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold mb-1.5 block" style={{ color: "var(--color-text)" }}>
                Símbolo
              </span>
              <input
                value={form.moneda_simbolo}
                onChange={(event) => setField("moneda_simbolo", event.target.value)}
                className={inputCls}
                style={inputStyle}
                maxLength={10}
              />
            </label>
          </div>
        </section>

        <section
          className="rounded-2xl border p-5"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block md:col-span-2">
              <span className="flex items-center gap-2 text-sm font-semibold mb-1.5" style={{ color: "var(--color-text)" }}>
                <Building2 size={15} /> Nombre comercial
              </span>
              <input
                value={form.nombre_comercial}
                onChange={(event) => setField("nombre_comercial", event.target.value)}
                className={inputCls}
                style={inputStyle}
                maxLength={150}
                required
              />
            </label>

            <label className="block">
              <span className="flex items-center gap-2 text-sm font-semibold mb-1.5" style={{ color: "var(--color-text)" }}>
                <FileText size={15} /> Razón social
              </span>
              <input
                value={form.razon_social}
                onChange={(event) => setField("razon_social", event.target.value)}
                className={inputCls}
                style={inputStyle}
                maxLength={180}
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold mb-1.5 block" style={{ color: "var(--color-text)" }}>
                NIT
              </span>
              <input
                value={form.nit}
                onChange={(event) => setField("nit", event.target.value)}
                className={inputCls}
                style={inputStyle}
                maxLength={50}
              />
            </label>

            <label className="block">
              <span className="flex items-center gap-2 text-sm font-semibold mb-1.5" style={{ color: "var(--color-text)" }}>
                <Phone size={15} /> Teléfono
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.telefono}
                onChange={(event) =>
                  setField(
                    "telefono",
                    event.target.value.replace(/\D/g, "").slice(0, 15),
                  )
                }
                className={inputCls}
                style={inputStyle}
                maxLength={15}
              />
            </label>

            <label className="block">
              <span className="flex items-center gap-2 text-sm font-semibold mb-1.5" style={{ color: "var(--color-text)" }}>
                <Mail size={15} /> Correo
              </span>
              <input
                type="email"
                value={form.correo}
                onChange={(event) => setField("correo", event.target.value)}
                className={inputCls}
                style={inputStyle}
                maxLength={150}
              />
            </label>

            <label className="block md:col-span-2">
              <span className="flex items-center gap-2 text-sm font-semibold mb-1.5" style={{ color: "var(--color-text)" }}>
                <MapPin size={15} /> Dirección
              </span>
              <textarea
                value={form.direccion}
                onChange={(event) => setField("direccion", event.target.value)}
                className={`${inputCls} min-h-[96px] resize-y`}
                style={inputStyle}
              />
            </label>

            <label className="block">
              <span className="flex items-center gap-2 text-sm font-semibold mb-1.5" style={{ color: "var(--color-text)" }}>
                <DollarSign size={15} /> Precio por revisión / diagnóstico
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.precio_revision_default}
                onChange={(event) => setField("precio_revision_default", event.target.value)}
                placeholder="Ej. 50.00"
                className={inputCls}
                style={inputStyle}
              />
            </label>

            <label className="block md:col-span-2">
              <span className="flex items-center gap-2 text-sm font-semibold mb-1.5" style={{ color: "var(--color-text)" }}>
                <AlignLeft size={15} /> Condiciones de servicio del contrato
              </span>
              <p className="text-xs mb-1.5" style={{ color: "var(--color-text-sec)" }}>
                Escribe una condición por línea. Si se dejan vacías se usarán las condiciones predeterminadas.
              </p>
              <textarea
                value={form.condiciones_servicio_contrato}
                onChange={(event) => setField("condiciones_servicio_contrato", event.target.value)}
                className={`${inputCls} min-h-[180px] resize-y`}
                style={inputStyle}
                placeholder={"El cliente declara que la información proporcionada es correcta.\nEl costo final será informado después del diagnóstico."}
              />
            </label>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-sec)" }}>
              <Upload size={15} />
              <span>{logoFile ? logoFile.name : "Logo actual"}</span>
            </div>

            <button
              type="submit"
              disabled={saving || isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60"
              style={{ background: safePrimaryColor }}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Guardar cambios
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}
