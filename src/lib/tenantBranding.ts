const FALLBACK_TENANT_COLOR = "#2563eb";

export function normalizeTenantColor(value?: string | null): string {
  const text = String(value || "").trim();
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(text) ? text : FALLBACK_TENANT_COLOR;
}

function expandHex(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length === 3) {
    return clean.split("").map((char) => char + char).join("");
  }
  return clean;
}

export function hexToRgb(hex: string): string {
  const clean = expandHex(normalizeTenantColor(hex));
  const value = Number.parseInt(clean, 16);
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}

export function darkenHex(hex: string, amount = 0.16): string {
  const clean = expandHex(normalizeTenantColor(hex));
  const value = Number.parseInt(clean, 16);
  const r = Math.max(0, Math.round(((value >> 16) & 255) * (1 - amount)));
  const g = Math.max(0, Math.round(((value >> 8) & 255) * (1 - amount)));
  const b = Math.max(0, Math.round((value & 255) * (1 - amount)));

  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function applyTenantBranding(color?: string | null) {
  const primary = normalizeTenantColor(color);
  const primaryDark = darkenHex(primary);
  const rgb = hexToRgb(primary);
  const root = document.documentElement;

  root.style.setProperty("--tenant-primary-color", primary);
  root.style.setProperty("--tenant-primary-dark", primaryDark);
  root.style.setProperty("--tenant-primary-rgb", rgb);
  root.style.setProperty("--color-primary", primary);
  root.style.setProperty("--color-primary-dark", primaryDark);
  root.style.setProperty("--color-active-bg", `rgba(${rgb}, 0.16)`);
  root.style.setProperty("--color-active-border", `rgba(${rgb}, 0.30)`);
}

export { FALLBACK_TENANT_COLOR };
