import { useState, useEffect, useRef } from 'react';
import {
  User, Mail, Phone, MapPin, Shield, Clock, Calendar,
  Edit2, Save, X, Camera, CheckCircle, Key, Tag,
  Loader2, AlertTriangle, Pen,
} from 'lucide-react';
import { useAuth } from '../../store/useAuth';
import { useToast } from '../../components/ui/Toast';
import { canViewCosts, isAdmin } from '../../lib/permissions';
import { getInitialsFromName, getSafeImageUrl } from '../../lib/avatar';
import API_URL from '../../services/config';
import axios from 'axios';
import FirmaCanvas from '../../components/repairs/FirmaCanvas';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: number;
  username: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  ultimo_login: string | null;
  created_at: string;
  updated_at: string;
  perfil: {
    nombres: string | null;
    apellidos: string | null;
    telefono: string | null;
    dpi: string | null;
    direccion: string | null;
    foto_perfil: string | null;
    firma: string | null;
  } | null;
  roles: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dt: string | null): string {
  if (!dt) return 'No registrado';
  return new Date(dt).toLocaleString('es-GT', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function buildAvatarUrl(foto: string | null | undefined): string | null {
  return getSafeImageUrl(foto);
}

function getInitials(name: string): string {
  return getInitialsFromName(name, 'U');
}

// ─── Role badge config ────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  ADMINISTRADOR:
    'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-700/40',
  TECNICO:
    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700/40',
  VENTAS:
    'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/40',
};
const rolColor = (r: string) =>
  ROLE_COLORS[r] ??
  'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/40';

// ─── Design tokens ────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl px-3 py-2.5 text-sm border outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-colors';
const inputStyle = {
  background: 'var(--color-input-bg)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text)',
};
const cardStyle = {
  background: 'var(--color-surface)',
  borderColor: 'var(--color-border)',
};

// ─── Avatar component ─────────────────────────────────────────────────────────

function AvatarImage({
  src, name, className,
}: {
  src: string | null;
  name: string;
  className?: string;
}) {
  const [err, setErr] = useState(false);
  if (src && !err) {
    return (
      <img
        src={src}
        alt={name}
        className={className}
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <div
      className={`${className} bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white font-bold`}
    >
      {getInitials(name)}
    </div>
  );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

interface EditForm {
  nombres: string;
  apellidos: string;
  telefono: string;
  direccion: string;
  foto: File | null;
  fotoPreview: string | null;
  firma: string | null;
}

function ModalEditar({
  profile,
  token,
  onClose,
  onSaved,
}: {
  profile: UserProfile;
  token: string;
  onClose: () => void;
  onSaved: (updatedPerfil: UserProfile['perfil']) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<EditForm>({
    nombres: profile.perfil?.nombres ?? '',
    apellidos: profile.perfil?.apellidos ?? '',
    telefono: profile.perfil?.telefono ?? '',
    direccion: profile.perfil?.direccion ?? '',
    foto: null,
    fotoPreview: buildAvatarUrl(profile.perfil?.foto_perfil),
    firma: profile.perfil?.firma ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const displayName =
    form.nombres.trim() || profile.name || profile.username;

  const set = (k: keyof EditForm, v: unknown) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    set('foto', file);
    set('fotoPreview', URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const telefono = form.telefono.trim();

    if (telefono && !/^\d{8,15}$/.test(telefono)) {
      setError('El teléfono debe contener entre 8 y 15 dígitos.');
      return;
    }

    setSaving(true);

    try {
      const fd = new FormData();
      fd.append('nombres', form.nombres);
      fd.append('apellidos', form.apellidos);
      fd.append('telefono', telefono);
      fd.append('direccion', form.direccion);
      if (form.foto) fd.append('foto_perfil', form.foto);
      // Always send firma so it is not overwritten with NULL
      fd.append('firma', form.firma ?? '');

      const res = await axios.put(`${API_URL}/auth/me/perfil`, fd, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      onSaved(res.data?.data?.perfil ?? null);
    } catch {
      setError('Error al actualizar el perfil. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const labelCls = 'block text-xs font-semibold text-[var(--color-text-sec)] mb-1.5';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)', padding: '16px' }}
    >
      <div
        className="flex flex-col rounded-3xl border shadow-2xl overflow-hidden"
        style={{
          ...cardStyle,
          width: 'calc(100vw - 32px)',
          maxWidth: 760,
          maxHeight: 'calc(100vh - 32px)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0 border-b"
          style={{ background: 'var(--color-surface-soft)', borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: 'rgba(72,185,230,0.14)' }}>
              <Edit2 size={16} className="text-[var(--color-primary)]" />
            </div>
            <h2 className="text-base font-bold text-[var(--color-text)]">Editar perfil</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-row-hover)] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form
          id="edit-profile-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5"
        >
          {/* Photo */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3 flex items-center gap-2">
              <span className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
              Foto de perfil
              <span className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
            </p>
            <div className="flex items-center gap-5">
              <div className="relative group shrink-0">
                <AvatarImage
                  src={form.fotoPreview}
                  name={displayName}
                  className="w-20 h-20 rounded-2xl object-cover ring-2 ring-[var(--color-border)] text-2xl"
                />
                <label
                  className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Camera size={20} className="text-white" />
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFile}
                    className="hidden"
                  />
                </label>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">Foto de perfil</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">JPG, PNG. Max 5MB</p>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-2 text-xs font-semibold text-[var(--color-primary)] hover:underline cursor-pointer"
                >
                  Cambiar foto
                </button>
              </div>
            </div>
          </div>

          {/* Personal data */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3 flex items-center gap-2">
              <span className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
              Datos personales
              <span className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Nombres</label>
                <input
                  value={form.nombres}
                  onChange={e => set('nombres', e.target.value)}
                  placeholder="Ej: Juan Carlos"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className={labelCls}>Apellidos</label>
                <input
                  value={form.apellidos}
                  onChange={e => set('apellidos', e.target.value)}
                  placeholder="Ej: Perez Lopez"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className={labelCls}>Teléfono</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={15}
                  value={form.telefono}
                  onChange={e =>
                    set(
                      'telefono',
                      e.target.value.replace(/\D/g, '').slice(0, 15)
                    )
                  }
                  placeholder="Ej: 55551234"
                  className={inputCls}
                  style={inputStyle}
                />
                <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                  Solo números, entre 8 y 15 dígitos. {form.telefono.length}/15
                </p>
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input
                  value={profile.email}
                  disabled
                  className={inputCls + ' opacity-50 cursor-not-allowed'}
                  style={inputStyle}
                  title="El email se gestiona desde Administracion de Usuarios"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Direccion</label>
                <input
                  value={form.direccion}
                  onChange={e => set('direccion', e.target.value)}
                  placeholder="Ej: Zona 10, Ciudad de Guatemala"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Firma */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3 flex items-center gap-2">
              <span className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
              Firma digital
              <span className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mb-2">
              Firma directamente o pulsa “Firmar en grande” en el teléfono
            </p>
            <FirmaCanvas
              initialValue={form.firma}
              fullscreenTitle="Firma digital"
              onChange={v => set('firma', v)}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl">
              <AlertTriangle size={15} className="shrink-0" /> {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div
          className="flex gap-3 justify-end px-6 py-4 border-t shrink-0"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-soft)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold border text-[var(--color-text-sec)] hover:bg-[var(--color-row-hover)] transition-colors cursor-pointer"
            style={{ borderColor: 'var(--color-border)' }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="edit-profile-form"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white transition-colors disabled:opacity-60 shadow-sm cursor-pointer"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-[var(--color-primary)]">{icon}</span>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
        {label}
      </p>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-[var(--color-text-muted)] shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
          {label}
        </p>
        <div className="text-sm font-medium text-[var(--color-text)] mt-0.5 break-words">{value}</div>
      </div>
    </div>
  );
}

function PermissionRow({ label, granted }: { label: string; granted: boolean }) {
  return (
    <div
      className="flex items-center justify-between rounded-xl px-3 py-2.5"
      style={{ background: 'var(--color-surface-soft)', border: '1px solid var(--color-border)' }}
    >
      <span className="text-xs text-[var(--color-text-sec)]">{label}</span>
      <span
        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          granted
            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
            : 'bg-slate-100 dark:bg-slate-800/50 text-[var(--color-text-muted)]'
        }`}
      >
        {granted ? 'Si' : 'No'}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, token } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const showCost   = canViewCosts(user?.roles);
  const userIsAdmin = isAdmin(user?.roles);

  async function loadProfile() {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) setProfile(res.data.data);
    } catch {
      toast.add('Error al cargar perfil', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProfile(); }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div
          className="h-40 rounded-3xl animate-pulse"
          style={{ background: 'var(--color-surface)' }}
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-40 rounded-2xl animate-pulse"
              style={{ background: 'var(--color-surface)' }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const displayName =
    profile.perfil?.nombres
      ? `${profile.perfil.nombres} ${profile.perfil.apellidos ?? ''}`.trim()
      : profile.name || profile.username;

  const avatarSrc = buildAvatarUrl(profile.perfil?.foto_perfil);

  return (
    <div className="space-y-6">

      {/* ── Profile hero ──────────────────────────────────────────────────── */}
      <div
        className="rounded-3xl border overflow-hidden"
        style={cardStyle}
      >
        {/* Compact profile banner */}
        <div
          className="relative overflow-hidden bg-[linear-gradient(115deg,#EAF4FF_0%,#DCEBFF_48%,#F8FBFF_100%)] px-5 py-6 dark:bg-[linear-gradient(115deg,#111827_0%,#172554_48%,#0f172a_100%)] sm:px-7 sm:py-7"
        >
          <div
            className="pointer-events-none absolute inset-0 dark:hidden"
            style={{
              backgroundImage:
                'linear-gradient(rgba(37,99,235,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.035) 1px, transparent 1px), radial-gradient(circle at 18% 20%, rgba(56,189,248,0.09), transparent 32%)',
              backgroundSize: '32px 32px, 32px 32px, 100% 100%',
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 hidden dark:block"
            style={{
              backgroundImage:
                'linear-gradient(rgba(125,211,252,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(125,211,252,0.045) 1px, transparent 1px), radial-gradient(circle at 18% 20%, rgba(56,189,248,0.16), transparent 32%)',
              backgroundSize: '32px 32px, 32px 32px, 100% 100%',
            }}
          />

          {/* Avatar + info + edit button */}
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
            <div
              className="w-fit shrink-0 rounded-2xl bg-white/70 p-1 dark:bg-slate-900/70"
              style={{
                boxShadow: '0 0 28px rgba(56, 189, 248, 0.22)',
              }}
            >
              <AvatarImage
                src={avatarSrc}
                name={displayName}
                className="h-20 w-20 rounded-xl object-cover text-2xl ring-1 ring-sky-300/45 dark:ring-cyan-200/35 sm:h-24 sm:w-24"
              />
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-extrabold leading-tight text-slate-900 dark:text-white sm:text-2xl">
                {displayName}
              </h1>
              <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-300">
                @{profile.username}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {profile.roles.length > 0 ? (
                  profile.roles.map(r => (
                    <span
                      key={r}
                      className="rounded-full border border-sky-600/15 bg-white/55 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-sky-300/20 dark:bg-sky-300/10 dark:text-sky-100"
                    >
                      {r}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-400">Sin roles asignados</span>
                )}
              </div>
            </div>

            <div className="w-full shrink-0 sm:w-auto">
              <button
                onClick={() => setEditOpen(true)}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[var(--color-primary-dark)] sm:w-auto"
              >
                <Edit2 size={15} /> Editar perfil
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2-column grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column */}
        <div className="space-y-6 lg:col-span-1">

          {/* Informacion personal */}
          <div className="rounded-2xl border p-5" style={cardStyle}>
            <SectionTitle icon={<User size={14} />} label="Informacion personal" />
            <div className="space-y-4">
              <InfoRow
                icon={<Mail size={14} />}
                label="Correo electronico"
                value={profile.email || 'No registrado'}
              />
              <InfoRow
                icon={<Phone size={14} />}
                label="Telefono"
                value={profile.perfil?.telefono || 'No registrado'}
              />
              <InfoRow
                icon={<MapPin size={14} />}
                label="Direccion"
                value={profile.perfil?.direccion || 'No registrado'}
              />
              {profile.perfil?.dpi && (
                <InfoRow icon={<Shield size={14} />} label="DPI" value={profile.perfil.dpi} />
              )}
            </div>
          </div>

          {/* Roles */}
          <div className="rounded-2xl border p-5" style={cardStyle}>
            <SectionTitle icon={<Tag size={14} />} label="Roles asignados" />
            <div className="flex flex-wrap gap-2">
              {profile.roles.length > 0 ? (
                profile.roles.map(r => (
                  <span key={r} className={`text-xs font-semibold px-3 py-1.5 rounded-full ${rolColor(r)}`}>
                    {r}
                  </span>
                ))
              ) : (
                <span className="text-sm text-[var(--color-text-muted)]">Sin roles asignados</span>
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6 lg:col-span-2">

          {/* Acceso al sistema */}
          <div className="rounded-2xl border p-5" style={cardStyle}>
            <SectionTitle icon={<Key size={14} />} label="Acceso al sistema" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <InfoRow icon={<User size={14} />} label="Nombre de usuario" value={profile.username} />
              <InfoRow
                icon={<CheckCircle size={14} />}
                label="Estado de cuenta"
                value={
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      profile.active
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : 'bg-slate-100 dark:bg-slate-800/50 text-[var(--color-text-muted)]'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${profile.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {profile.active ? 'Activo' : 'Inactivo'}
                  </span>
                }
              />
              <InfoRow
                icon={<Clock size={14} />}
                label="Ultimo acceso"
                value={formatDate(profile.ultimo_login)}
              />
              <InfoRow
                icon={<Calendar size={14} />}
                label="Cuenta creada"
                value={formatDate(profile.created_at)}
              />
            </div>
          </div>

          {/* Permisos */}
          <div className="rounded-2xl border p-5" style={cardStyle}>
            <SectionTitle icon={<Shield size={14} />} label="Permisos del sistema" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <PermissionRow label="Acceso de administrador"  granted={userIsAdmin} />
              <PermissionRow label="Ver datos de costos"      granted={showCost} />
              <PermissionRow label="Gestion de compras"       granted={userIsAdmin} />
              <PermissionRow label="Gestion de proveedores"   granted={userIsAdmin} />
              <PermissionRow label="Stickers de garantia"     granted={userIsAdmin} />
              <PermissionRow label="Admin de usuarios"        granted={userIsAdmin} />
            </div>
          </div>

          {/* Account summary */}
          <div className="rounded-2xl border p-5" style={cardStyle}>
            <SectionTitle icon={<Calendar size={14} />} label="Resumen de cuenta" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Roles activos', value: String(profile.roles.length), color: 'text-blue-500 dark:text-blue-400' },
                { label: 'Estado', value: profile.active ? 'Activo' : 'Inactivo', color: profile.active ? 'text-emerald-500 dark:text-emerald-400' : 'text-[var(--color-text-muted)]' },
                { label: 'Ultimo login', value: profile.ultimo_login ? new Date(profile.ultimo_login).toLocaleDateString('es-GT') : 'Nunca', color: 'text-[var(--color-text-sec)]' },
              ].map(item => (
                <div
                  key={item.label}
                  className="rounded-xl p-3 text-center border"
                  style={{ background: 'var(--color-surface-soft)', borderColor: 'var(--color-border)' }}
                >
                  <p className={`text-lg font-extrabold ${item.color}`}>{item.value}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mt-0.5">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Firma */}
          <div className="rounded-2xl border p-5" style={cardStyle}>
            <SectionTitle icon={<Pen size={14} />} label="Firma digital" />
            {profile.perfil?.firma ? (
              <div
                className="rounded-xl overflow-hidden border"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <img
                  src={profile.perfil.firma}
                  alt="Firma"
                  className="w-full block"
                  style={{ background: '#ffffff', maxHeight: 120, objectFit: 'contain' }}
                />
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">
                Sin firma registrada. Haz clic en &quot;Editar perfil&quot; para agregar una.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editOpen && (
        <ModalEditar
          profile={profile}
          token={token ?? ''}
          onClose={() => setEditOpen(false)}
          onSaved={async (updatedPerfil) => {
            setEditOpen(false);
            // Update profile state immediately with the PUT response
            // (avoids a second GET that could return stale or missing firma)
            if (updatedPerfil) {
              setProfile(prev => prev ? { ...prev, perfil: updatedPerfil } : prev);
            }
            toast.add('Perfil actualizado exitosamente', 'success');
            // Full re-fetch to keep everything in sync
            await loadProfile();
          }}
        />
      )}
    </div>
  );
}
