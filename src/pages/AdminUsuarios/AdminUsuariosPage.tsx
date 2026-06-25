import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, UserPlus, Search, Edit2, Power, Key, X, Check, Trash2,
  Users, UserCheck, Wrench, ShoppingCart, ChevronDown, Eye, EyeOff,
  AlertTriangle, Camera, Tag, Loader2, RefreshCw,
} from 'lucide-react';
import {
  adminUsuarioService,
  fotoUrl,
  type UsuarioListItem,
  type RolItem,
  type CreateUsuarioPayload,
  type UpdateUsuarioPayload,
} from '../../services/adminUsuarioService';
import { getInitialsFromName } from '../../lib/avatar';
import { useAuth } from '../../store/useAuth';

// ─── Design tokens ────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl px-3 py-2.5 text-sm border outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-colors';
const inputStyle = {
  background: 'var(--color-input-bg)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text)',
};
const labelCls = 'block text-xs font-semibold text-[var(--color-text-sec)] mb-1.5';
const surfaceStyle = {
  background: 'var(--color-surface)',
  borderColor: 'var(--color-border)',
};

// ─── Role badge colours ───────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  ADMINISTRADOR:
    'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-700/40',
  TECNICO:
    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700/40',
  VENTAS:
    'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700/40',
};
const rolColor = (r: string) =>
  ROLE_COLORS[r] ??
  'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700/40';

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({
  foto,
  nombres,
  apellidos,
  size = 'md',
}: {
  foto?: string | null;
  nombres: string;
  apellidos?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [imgError, setImgError] = useState(false);
  const initials = getInitialsFromName(`${nombres || ''} ${apellidos || ''}`, 'U');
  const sizeClass = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-16 h-16 text-xl' }[size];
  if (foto && !imgError)
    return (
      <img
        src={foto}
        alt={nombres}
        className={`${sizeClass} rounded-full object-cover ring-2 ring-[var(--color-border)] shadow`}
        onError={() => setImgError(true)}
      />
    );
  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold shadow shrink-0`}
    >
      {initials}
    </div>
  );
}

// ─── Role badge ───────────────────────────────────────────────────────────────

function RolBadge({ rol }: { rol: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${rolColor(rol)}`}
    >
      {rol}
    </span>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)' }}
    >
      <div className="rounded-2xl border shadow-2xl w-full max-w-sm p-6" style={surfaceStyle}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-amber-500" />
          </div>
          <h3 className="font-semibold text-[var(--color-text)]">Confirmar accion</h3>
        </div>
        <p className="text-sm text-[var(--color-text-sec)] mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border text-[var(--color-text-sec)] hover:bg-[var(--color-row-hover)] transition-colors cursor-pointer"
            style={{ borderColor: 'var(--color-border)' }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors cursor-pointer"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Section separator ────────────────────────────────────────────────────────

function SectionSep({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mt-2 mb-4">
      <span className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] whitespace-nowrap">
        {label}
      </span>
      <span className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
    </div>
  );
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  nombres: string;
  apellidos: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  telefono: string;
  dpi: string;
  direccion: string;
  roles: string[];
  active: boolean;
  foto: File | null;
  fotoPreview: string | null;
}

const emptyForm = (): FormState => ({
  nombres: '',
  apellidos: '',
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  telefono: '',
  dpi: '',
  direccion: '',
  roles: [],
  active: true,
  foto: null,
  fotoPreview: null,
});

// ─── Modal: Nuevo / Editar usuario ────────────────────────────────────────────

function ModalUsuario({
  usuario,
  roles,
  onClose,
  onSaved,
}: {
  usuario: UsuarioListItem | null;
  roles: RolItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(usuario);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (usuario) {
      setForm({
        nombres: usuario.nombres ?? '',
        apellidos: usuario.apellidos ?? '',
        username: usuario.username ?? '',
        email: usuario.email ?? '',
        password: '',
        confirmPassword: '',
        telefono: usuario.telefono ?? '',
        dpi: usuario.dpi ?? '',
        direccion: usuario.direccion ?? '',
        roles: usuario.roles ?? [],
        active: usuario.active,
        foto: null,
        fotoPreview: fotoUrl(usuario.foto_perfil),
      });
    }
  }, [usuario]);

  const set = (k: keyof FormState, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    set('foto', file);
    set('fotoPreview', URL.createObjectURL(file));
  };

  const toggleRol = (rol: string) =>
    setForm(f => ({
      ...f,
      roles: f.roles.includes(rol) ? f.roles.filter(r => r !== rol) : [...f.roles, rol],
    }));

  const validate = () => {
    if (!form.nombres.trim()) return 'El nombre es requerido';
    if (!form.username.trim() && !form.email.trim()) return 'Se requiere usuario o email';
    if (!isEdit && !form.password) return 'La contrasena es requerida';
    if (form.password && form.password.length < 6) return 'La contrasena debe tener minimo 6 caracteres';
    if (form.password && form.password !== form.confirmPassword) return 'Las contrasenas no coinciden';
    if (!form.roles.length) return 'Selecciona al menos un rol';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError('');
    try {
      if (isEdit && usuario) {
        const payload: UpdateUsuarioPayload = {
          nombres: form.nombres,
          apellidos: form.apellidos || undefined,
          username: form.username || undefined,
          email: form.email || undefined,
          telefono: form.telefono || undefined,
          dpi: form.dpi || undefined,
          direccion: form.direccion || undefined,
          roles: form.roles,
          active: form.active,
          foto: form.foto,
        };
        await adminUsuarioService.updateUsuario(usuario.id, payload);
      } else {
        const payload: CreateUsuarioPayload = {
          nombres: form.nombres,
          apellidos: form.apellidos || undefined,
          username: form.username || undefined,
          email: form.email || undefined,
          password: form.password,
          telefono: form.telefono || undefined,
          dpi: form.dpi || undefined,
          direccion: form.direccion || undefined,
          roles: form.roles,
          foto: form.foto,
        };
        await adminUsuarioService.createUsuario(payload);
      }
      onSaved();
    } catch (e: unknown) {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Error al guardar',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)', padding: '16px' }}
    >
      <div
        className="flex flex-col rounded-3xl border shadow-2xl overflow-hidden"
        style={{
          ...surfaceStyle,
          width: 'calc(100vw - 32px)',
          maxWidth: 900,
          maxHeight: 'calc(100vh - 32px)',
        }}
      >
        {/* Sticky header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0 border-b"
          style={{ background: 'var(--color-surface-soft)', borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: 'rgba(72,185,230,0.14)' }}>
              <UserPlus size={18} className="text-[var(--color-primary)]" />
            </div>
            <h2 className="text-base font-bold text-[var(--color-text)]">
              {isEdit ? 'Editar usuario' : 'Nuevo usuario'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-row-hover)] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body — form is here, submit button references it by id */}
        <form
          id="modal-user-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5"
        >
          {/* Foto de perfil */}
          <SectionSep label="Foto de perfil" />
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar foto={form.fotoPreview} nombres={form.nombres || 'U'} apellidos={form.apellidos} size="lg" />
              <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-colors">
                <Camera size={13} className="text-white" />
                <input type="file" accept="image/*" capture="environment" onChange={handleFoto} className="hidden" />
              </label>
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-text)]">Foto de perfil</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">JPG, PNG. Max 5MB</p>
            </div>
          </div>

          {/* Datos personales */}
          <SectionSep label="Datos personales" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                Nombres <span className="text-red-400 normal-case font-normal">*</span>
              </label>
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
              <label className={labelCls}>Telefono</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={15}
                value={form.telefono}
                onChange={e =>
                  set('telefono', e.target.value.replace(/\D/g, '').slice(0, 15))
                }
                placeholder="Ej: 55551234"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelCls}>DPI</label>
              <input
                value={form.dpi}
                onChange={e => set('dpi', e.target.value)}
                placeholder="Numero de DPI"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div className="md:col-span-2">
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

          {/* Credenciales */}
          <SectionSep label="Credenciales de acceso" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Usuario</label>
              <input
                value={form.username}
                onChange={e => set('username', e.target.value)}
                placeholder="ej: admin01"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="correo@empresa.com"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            {!isEdit && (
              <>
                <div>
                  <label className={labelCls}>
                    Contrasena <span className="text-red-400 normal-case font-normal">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => set('password', e.target.value)}
                      placeholder="Minimo 6 caracteres"
                      className={inputCls + ' pr-10'}
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
                    >
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>
                    Confirmar contrasena <span className="text-red-400 normal-case font-normal">*</span>
                  </label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={e => set('confirmPassword', e.target.value)}
                    placeholder="Repite la contrasena"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
              </>
            )}
          </div>

          {/* Roles */}
          <SectionSep label="Roles" />
          <div className="flex flex-wrap gap-2">
            {roles.filter(r => r.activo).map(r => {
              const active = form.roles.includes(r.nombre);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggleRol(r.nombre)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all cursor-pointer ${
                    active
                      ? rolColor(r.nombre) + ' shadow-sm scale-105'
                      : 'text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
                  }`}
                  style={active ? {} : { borderColor: 'var(--color-border)' }}
                >
                  {active && <Check size={13} />}
                  {r.nombre}
                </button>
              );
            })}
          </div>

          {/* Estado (solo edicion) */}
          {isEdit && (
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => set('active', !form.active)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                  form.active ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-slate-200 shadow transition-transform ${
                    form.active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm text-[var(--color-text-sec)]">
                {form.active ? 'Usuario activo' : 'Usuario inactivo'}
              </span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl">
              <AlertTriangle size={15} className="shrink-0" /> {error}
            </div>
          )}
        </form>

        {/* Sticky footer */}
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
            form="modal-user-form"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white transition-colors disabled:opacity-60 shadow-sm cursor-pointer"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {isEdit ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Cambiar contrasena ────────────────────────────────────────────────

function ModalPassword({
  usuarioId,
  nombre,
  onClose,
  onSaved,
}: {
  usuarioId: number;
  nombre: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pass || pass.length < 6) { setError('Minimo 6 caracteres'); return; }
    if (pass !== confirm) { setError('Las contrasenas no coinciden'); return; }
    setSaving(true);
    setError('');
    try {
      await adminUsuarioService.changePassword(usuarioId, pass);
      onSaved();
    } catch {
      setError('Error al cambiar la contrasena');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)' }}
    >
      <div
        className="flex flex-col rounded-2xl border shadow-2xl w-full max-w-md overflow-hidden"
        style={surfaceStyle}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ background: 'var(--color-surface-soft)', borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: 'rgba(245,158,11,0.14)' }}>
              <Key size={16} className="text-amber-500" />
            </div>
            <h2 className="text-base font-bold text-[var(--color-text)]">Cambiar contrasena</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-row-hover)] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-[var(--color-text-sec)]">
            Cambiando contrasena de{' '}
            <strong className="text-[var(--color-text)]">{nombre}</strong>
          </p>
          <div>
            <label className={labelCls}>Nueva contrasena</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="Minimo 6 caracteres"
                className={inputCls + ' pr-10'}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
              >
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className={labelCls}>Confirmar contrasena</label>
            <input
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repite la contrasena"
              className={inputCls}
              style={inputStyle}
            />
          </div>
          {error && (
            <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl">
              {error}
            </p>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-xl border text-[var(--color-text-sec)] hover:bg-[var(--color-row-hover)] transition-colors cursor-pointer"
              style={{ borderColor: 'var(--color-border)' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-60 cursor-pointer"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />} Cambiar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Gestionar roles ───────────────────────────────────────────────────

function ModalRoles({
  roles,
  onClose,
  onSaved,
}: {
  roles: RolItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [newNombre, setNewNombre] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNombre.trim()) { setError('El nombre es requerido'); return; }
    setSaving(true);
    setError('');
    try {
      await adminUsuarioService.createRol(newNombre, newDesc);
      setNewNombre('');
      setNewDesc('');
      onSaved();
    } catch (e: unknown) {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rol: RolItem) => {
    try {
      await adminUsuarioService.updateRol(rol.id, { activo: !rol.activo });
      onSaved();
    } catch {}
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)' }}
    >
      <div
        className="flex flex-col rounded-2xl border shadow-2xl w-full max-w-lg overflow-hidden"
        style={surfaceStyle}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ background: 'var(--color-surface-soft)', borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: 'rgba(72,185,230,0.14)' }}>
              <Shield size={16} className="text-[var(--color-primary)]" />
            </div>
            <h2 className="text-base font-bold text-[var(--color-text)]">Gestionar roles</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-row-hover)] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <div className="space-y-2">
            {roles.map(r => (
              <div
                key={r.id}
                className="flex items-center justify-between p-3 rounded-xl border"
                style={{ background: 'var(--color-surface-soft)', borderColor: 'var(--color-border)' }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <RolBadge rol={r.nombre} />
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {r.total_usuarios} usuarios
                    </span>
                  </div>
                  {r.descripcion && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{r.descripcion}</p>
                  )}
                </div>
                <button
                  onClick={() => handleToggle(r)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors cursor-pointer ${
                    r.activo
                      ? 'border-emerald-200 dark:border-emerald-700/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                      : 'border-red-200 dark:border-red-700/40 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                  }`}
                >
                  {r.activo ? 'Activo' : 'Inactivo'}
                </button>
              </div>
            ))}
          </div>

          <SectionSep label="Crear nuevo rol" />
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <div>
              <label className={labelCls}>Nombre del rol</label>
              <input
                value={newNombre}
                onChange={e => setNewNombre(e.target.value.toUpperCase())}
                placeholder="NOMBRE_ROL"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelCls}>Descripcion (opcional)</label>
              <input
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Descripcion del rol"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            {error && (
              <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white transition-colors disabled:opacity-60 cursor-pointer"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Tag size={14} />} Crear
              rol
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminUsuariosPage() {
  const currentUser = useAuth(state => state.user);
  const plan = useAuth(state => state.plan);
  const planConsumption = useAuth(state => state.planConsumption);
  const loadPermissions = useAuth(state => state.loadPermissions);
  const currentUserId = currentUser?.id ?? null;

  const [usuarios, setUsuarios] = useState<UsuarioListItem[]>([]);
  const [roles, setRoles] = useState<RolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [buscar, setBuscar] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [modalUsuario, setModalUsuario] = useState<{
    open: boolean;
    usuario: UsuarioListItem | null;
  }>({ open: false, usuario: null });
  const [modalPassword, setModalPassword] = useState<{
    open: boolean;
    usuario: UsuarioListItem | null;
  }>({ open: false, usuario: null });
  const [modalRoles, setModalRoles] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<UsuarioListItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UsuarioListItem | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [us, rs] = await Promise.all([
        adminUsuarioService.getUsuarios({
          buscar: buscar || undefined,
          rol: filtroRol || undefined,
          estado: filtroEstado,
        }),
        adminUsuarioService.getRoles(),
      ]);
      setUsuarios(us);
      setRoles(rs);
      void loadPermissions();
    } catch {
      setError('Error al cargar los datos. Verifica la conexion con el servidor.');
    } finally {
      setLoading(false);
    }
  }, [buscar, filtroRol, filtroEstado, loadPermissions]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggleEstado = async (u: UsuarioListItem) => {
    try {
      await adminUsuarioService.toggleEstado(u.id);
      showToast(u.active ? u.nombres + ' desactivado' : u.nombres + ' activado');
      loadData();
    } catch (e: unknown) {
      showToast(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Error al cambiar estado',
      );
    }
    setConfirmToggle(null);
  };

  const handleDeleteUsuario = async (u: UsuarioListItem) => {
    try {
      await adminUsuarioService.deleteUsuario(u.id);
      showToast(`${u.nombres} eliminado`);
      await loadData();
    } catch (e: unknown) {
      showToast(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Error al eliminar usuario',
      );
    } finally {
      setConfirmDelete(null);
    }
  };

  const total    = usuarios.length;
  const activos  = usuarios.filter(u => u.active).length;
  const tecnicos = usuarios.filter(u => u.roles.includes('TECNICO')).length;
  const admins   = usuarios.filter(u => u.roles.includes('ADMINISTRADOR')).length;
  const ventas   = usuarios.filter(u => u.roles.includes('VENTAS')).length;
  const limiteUsuarios = planConsumption?.usuarios_limite ?? null;
  const activosPlan = planConsumption?.usuarios_activos ?? activos;
  const usuariosSobreLimite =
    limiteUsuarios !== null &&
    activosPlan > limiteUsuarios;
  const limiteAlcanzado =
    limiteUsuarios !== null &&
    activosPlan >= limiteUsuarios;
  const puedeCrearUsuario = !limiteAlcanzado;
  const textoConsumoUsuarios =
    limiteUsuarios === null
      ? `${activosPlan} activos / ilimitado`
      : `${activosPlan} activos / ${limiteUsuarios} permitidos`;

  return (
    <div className="space-y-6">

      {/* Toast notification */}
      {toastMsg && (
        <div
          className="fixed top-6 right-6 z-[70] flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white"
          style={{ background: 'rgba(15,25,45,0.96)', border: '1px solid rgba(72,185,230,0.25)' }}
        >
          <Check size={15} className="text-emerald-400 shrink-0" />
          {toastMsg}
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)] flex items-center gap-2.5">
            <Shield size={24} className="text-[var(--color-primary)]" />
            Administracion de Usuarios
          </h1>
          <p className="text-sm text-[var(--color-text-sec)] mt-0.5">
            Gestion de accesos, perfiles y roles del sistema
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setModalRoles(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl border font-semibold text-[var(--color-text-sec)] hover:text-[var(--color-text)] hover:bg-[var(--color-row-hover)] transition-colors cursor-pointer"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <Tag size={15} /> Gestionar roles
          </button>
          <button
            onClick={() => {
              if (puedeCrearUsuario) {
                setModalUsuario({ open: true, usuario: null });
              }
            }}
            disabled={!puedeCrearUsuario}
            title={
              puedeCrearUsuario
                ? 'Crear nuevo usuario'
                : 'La empresa alcanzó el límite de usuarios activos permitido por su plan'
            }
            className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl font-bold text-white transition-colors shadow-sm ${
              puedeCrearUsuario
                ? 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] cursor-pointer'
                : 'bg-slate-400 cursor-not-allowed opacity-70'
            }`}
          >
            <UserPlus size={15} /> Nuevo usuario
          </button>
        </div>
      </div>

      {planConsumption && (
        <div
          className={`rounded-2xl border p-4 ${
            usuariosSobreLimite
              ? 'bg-amber-50 dark:bg-amber-900/20'
              : limiteAlcanzado
                ? 'bg-red-50 dark:bg-red-900/20'
                : 'bg-emerald-50 dark:bg-emerald-900/20'
          }`}
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-[var(--color-text)]">
                Consumo del plan: usuarios activos
              </p>
              <p className="text-xs text-[var(--color-text-sec)]">
                Plan {plan?.nombre ?? 'vigente'} · {textoConsumoUsuarios}
              </p>
            </div>
            <p className="text-xs font-semibold text-[var(--color-text-sec)]">
              {usuariosSobreLimite
                ? 'La empresa está por encima del límite; desactiva usuarios antes de crear o reactivar.'
                : limiteAlcanzado
                  ? 'Límite alcanzado. Cambia de plan para agregar más usuarios.'
                  : 'Aún hay cupo para usuarios activos.'}
            </p>
          </div>
        </div>
      )}

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total',           value: total,    icon: <Users size={20} />,        color: 'from-blue-500 to-blue-600',       accent: 'dark:text-[#2563EB]' },
          { label: 'Activos',         value: activos,  icon: <UserCheck size={20} />,    color: 'from-emerald-500 to-emerald-600', accent: 'dark:text-[#10B981]' },
          { label: 'Tecnicos',        value: tecnicos, icon: <Wrench size={20} />,       color: 'from-cyan-500 to-cyan-600',       accent: 'dark:text-teal-300' },
          { label: 'Administradores', value: admins,   icon: <Shield size={20} />,       color: 'from-purple-500 to-purple-600',   accent: 'dark:text-[#9AA0A6]' },
          { label: 'Ventas',          value: ventas,   icon: <ShoppingCart size={20} />, color: 'from-amber-500 to-amber-600',     accent: 'dark:text-[#F59E0B]' },
        ].map(s => (
          <div
            key={s.label}
            className={`bg-gradient-to-br ${s.color} text-white rounded-2xl p-4 flex items-center justify-between shadow-sm dark:bg-none dark:bg-[#1B1C1F] dark:border dark:border-[#303134] dark:shadow-none`}
          >
            <div>
              <p className="text-white/75 dark:text-[#9AA0A6] text-xs font-medium">{s.label}</p>
              <p className={`text-2xl font-extrabold mt-0.5 dark:text-[#E8EAED] ${s.accent}`}>{s.value}</p>
            </div>
            <div className={`opacity-50 dark:opacity-100 dark:bg-[#202124] dark:border dark:border-[#303134] dark:rounded-xl dark:p-2 ${s.accent}`}>
              {s.icon}
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border p-4"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
            />
            <input
              value={buscar}
              onChange={e => setBuscar(e.target.value)}
              placeholder="Buscar por nombre, usuario, telefono..."
              className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-colors"
              style={inputStyle}
            />
          </div>
          <div className="relative">
            <select
              value={filtroRol}
              onChange={e => setFiltroRol(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-colors cursor-pointer"
              style={inputStyle}
            >
              <option value="">Todos los roles</option>
              {roles.map(r => (
                <option key={r.id} value={r.nombre}>
                  {r.nombre}
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
            />
          </div>
          <div className="relative">
            <select
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-colors cursor-pointer"
              style={inputStyle}
            >
              <option value="">Todos los estados</option>
              <option value="1">Activos</option>
              <option value="0">Inactivos</option>
            </select>
            <ChevronDown
              size={13}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
            />
          </div>
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl border text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-row-hover)] transition-colors shrink-0 cursor-pointer"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Users table ───────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={32} className="text-[var(--color-primary)] animate-spin" />
            <p className="text-sm text-[var(--color-text-muted)]">Cargando usuarios...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <AlertTriangle size={32} className="text-red-400" />
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={loadData}
              className="text-xs px-4 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        ) : usuarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-[var(--color-text-muted)]">
            <Users size={40} className="opacity-25" />
            <p className="font-medium text-sm">No se encontraron usuarios</p>
            <p className="text-xs">Intenta cambiar los filtros o crea un nuevo usuario</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead
                  style={{
                    background: 'var(--color-surface-soft)',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <tr>
                    {['Usuario', 'Credenciales', 'Telefono', 'Roles', 'Estado', 'Ultimo acceso', 'Acciones'].map(
                      h => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map(u => (
                    <tr
                      key={u.id}
                      className="border-t transition-colors hover:bg-[var(--color-row-hover)]"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            foto={fotoUrl(u.foto_perfil)}
                            nombres={u.nombres}
                            apellidos={u.apellidos}
                            size="sm"
                          />
                          <span className="text-sm font-semibold text-[var(--color-text)]">
                            {u.nombres} {u.apellidos}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-[var(--color-text-sec)]">
                          {u.username ?? '-'}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">{u.email ?? '-'}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--color-text-sec)]">
                        {u.telefono ?? '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length ? (
                            u.roles.map(r => <RolBadge key={r} rol={r} />)
                          ) : (
                            <span className="text-xs text-[var(--color-text-muted)]">Sin roles</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            u.active
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700/40'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-700/40'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${u.active ? 'bg-emerald-500' : 'bg-red-400'}`}
                          />
                          {u.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                        {u.ultimo_login
                          ? new Date(u.ultimo_login).toLocaleDateString('es-GT', {
                              day: '2-digit',
                              month: 'short',
                              year: '2-digit',
                            })
                          : 'Nunca'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setModalUsuario({ open: true, usuario: u })}
                            title="Editar"
                            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-active-bg)] transition-colors cursor-pointer"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => setModalPassword({ open: true, usuario: u })}
                            title="Cambiar contrasena"
                            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer"
                          >
                            <Key size={15} />
                          </button>
                          {u.id !== currentUserId && (
                            <>
                              <button
                                onClick={() => setConfirmToggle(u)}
                                title={u.active ? 'Desactivar' : 'Activar'}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  u.active
                                    ? 'text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10'
                                    : 'text-[var(--color-text-muted)] hover:text-emerald-500 hover:bg-emerald-500/10'
                                }`}
                              >
                                <Power size={15} />
                              </button>

                              <button
                                onClick={() => setConfirmDelete(u)}
                                title="Eliminar usuario"
                                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-600 hover:bg-red-500/10 transition-colors cursor-pointer"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden">
              {usuarios.map((u, idx) => (
                <div
                  key={u.id}
                  className={`p-4 ${idx > 0 ? 'border-t' : ''}`}
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        foto={fotoUrl(u.foto_perfil)}
                        nombres={u.nombres}
                        apellidos={u.apellidos}
                      />
                      <div>
                        <p className="font-semibold text-[var(--color-text)] text-sm">
                          {u.nombres} {u.apellidos}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {u.username ?? u.email ?? '-'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        u.active
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700/40'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-700/40'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${u.active ? 'bg-emerald-500' : 'bg-red-400'}`}
                      />
                      {u.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {u.roles.map(r => (
                      <RolBadge key={r} rol={r} />
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setModalUsuario({ open: true, usuario: u })}
                      className="flex-1 py-2 text-xs rounded-lg border font-semibold text-[var(--color-primary)] hover:bg-[var(--color-active-bg)] transition-colors cursor-pointer"
                      style={{ borderColor: 'var(--color-primary)' }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setModalPassword({ open: true, usuario: u })}
                      className="flex-1 py-2 text-xs rounded-lg border font-semibold text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer border-amber-300 dark:border-amber-700/40"
                    >
                      Contrasena
                    </button>
                    {u.id !== currentUserId && (
                      <>
                        <button
                          onClick={() => setConfirmToggle(u)}
                          className={`flex-1 py-2 text-xs rounded-lg border font-semibold transition-colors cursor-pointer ${
                            u.active
                              ? 'text-red-500 hover:bg-red-500/10 border-red-300 dark:border-red-700/40'
                              : 'text-emerald-500 hover:bg-emerald-500/10 border-emerald-300 dark:border-emerald-700/40'
                          }`}
                        >
                          {u.active ? 'Desactivar' : 'Activar'}
                        </button>

                        <button
                          onClick={() => setConfirmDelete(u)}
                          className="flex-1 py-2 text-xs rounded-lg border font-semibold text-red-600 hover:bg-red-500/10 border-red-300 dark:border-red-700/40 transition-colors cursor-pointer"
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {modalUsuario.open && (
        <ModalUsuario
          usuario={modalUsuario.usuario}
          roles={roles}
          onClose={() => setModalUsuario({ open: false, usuario: null })}
          onSaved={() => {
            setModalUsuario({ open: false, usuario: null });
            showToast('Usuario guardado correctamente');
            loadData();
          }}
        />
      )}

      {modalPassword.open && modalPassword.usuario && (
        <ModalPassword
          usuarioId={modalPassword.usuario.id}
          nombre={modalPassword.usuario.nombres}
          onClose={() => setModalPassword({ open: false, usuario: null })}
          onSaved={() => {
            setModalPassword({ open: false, usuario: null });
            showToast('Contrasena actualizada');
          }}
        />
      )}

      {modalRoles && (
        <ModalRoles
          roles={roles}
          onClose={() => setModalRoles(false)}
          onSaved={() => { loadData(); }}
        />
      )}

      {confirmToggle && (
        <ConfirmDialog
          message={
            confirmToggle.active
              ? `Desactivar a ${confirmToggle.nombres}? El usuario no podra iniciar sesion.`
              : `Activar a ${confirmToggle.nombres}?`
          }
          onConfirm={() => handleToggleEstado(confirmToggle)}
          onCancel={() => setConfirmToggle(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`Eliminar permanentemente a ${confirmDelete.nombres}? Esta accion no se puede deshacer.`}
          onConfirm={() => handleDeleteUsuario(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
