import { getImageUrl } from "../utils/getImageUrl";

const INVALID_IMAGE_VALUES = new Set(["", "undefined", "null", "nan"]);

export function getSafeImageUrl(value?: string | null): string | null {
  const text = String(value ?? "").trim();
  if (INVALID_IMAGE_VALUES.has(text.toLowerCase())) return null;

  const imageUrl = getImageUrl(text);
  const cleanUrl = String(imageUrl || "").trim();
  return INVALID_IMAGE_VALUES.has(cleanUrl.toLowerCase()) ? null : cleanUrl;
}

export function getInitialsFromName(name?: string | null, fallback = "U"): string {
  const text = String(name ?? "").trim();
  if (!text || INVALID_IMAGE_VALUES.has(text.toLowerCase())) return fallback;

  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return parts[0]?.slice(0, 2).toUpperCase() || fallback;
}

export function getUserInitials(user?: {
  name?: string | null;
  username?: string | null;
  email?: string | null;
  nombres?: string | null;
  apellidos?: string | null;
  perfil?: {
    nombres?: string | null;
    apellidos?: string | null;
  } | null;
} | null): string {
  const profileName = [user?.perfil?.nombres, user?.perfil?.apellidos].filter(Boolean).join(" ");
  const fullName = [user?.nombres, user?.apellidos].filter(Boolean).join(" ");

  return getInitialsFromName(
    profileName || fullName || user?.name || user?.username || user?.email,
    "U"
  );
}
