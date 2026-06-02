import { useState, useEffect, useCallback } from 'react';
import {
  Calendar, ChevronLeft, ChevronRight, RefreshCw,
  Wrench, Phone, User, Smartphone, Eye, X, Clock,
  CheckCircle2, AlertCircle, Ban, List, Search, Plus, FileText, Pencil, Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getEntregas, patchFechaEntrega, deleteFechaEntrega, searchReparacionesPendientes, type ReparacionPendiente, getEventos, createEvento, updateEvento, deleteEvento, getUsuariosParaAgenda, type UsuarioSimple } from '../../services/agendaService';
import type { EntregaAgenda, FiltroAgenda, AgendaEvento, TipoEvento } from '../../types/agenda';
import { useAuth } from '../../store/useAuth';
import PageHeader from '../../components/common/PageHeader';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtDate = (v?: string | null): string => {
  if (!v) return '—';
  const d = new Date(String(v).replace(' ', 'T'));
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtTime = (v?: string | null): string => {
  if (!v) return '';
  const d = new Date(String(v).replace(' ', 'T'));
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const fmtDatetime = (v?: string | null): string => {
  const date = fmtDate(v);
  const time = fmtTime(v);
  return time ? `${date} ${time}` : date;
};

/** Devuelve YYYY-MM-DD de un Date local */
const toLocalDateStr = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Primer día del mes */
const firstOfMonth = (year: number, month: number) => new Date(year, month, 1);

/** Último día del mes */
const lastOfMonth = (year: number, month: number) => new Date(year, month + 1, 0);

// ─── Estado → badge ───────────────────────────────────────────────────────────
const ESTADO_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  RECIBIDA:               { bg: 'bg-slate-100 dark:bg-slate-800',    text: 'text-slate-600 dark:text-slate-300',   label: 'Recibida' },
  EN_DIAGNOSTICO:         { bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300',   label: 'En diagnóstico' },
  EN_PROCESO:             { bg: 'bg-blue-100 dark:bg-blue-950/40',   text: 'text-blue-700 dark:text-blue-300',     label: 'En proceso' },
  EN_REPARACION:          { bg: 'bg-blue-100 dark:bg-blue-950/40',   text: 'text-blue-700 dark:text-blue-300',     label: 'En reparación' },
  ESPERANDO_PIEZA:        { bg: 'bg-orange-100 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-300', label: 'Esp. pieza' },
  ESPERANDO_AUTORIZACION: { bg: 'bg-yellow-100 dark:bg-yellow-950/40', text: 'text-yellow-700 dark:text-yellow-300', label: 'Esp. autorización' },
  COMPLETADA:             { bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', label: 'Completada' },
  ENTREGADA:              { bg: 'bg-green-100 dark:bg-green-950/40', text: 'text-green-700 dark:text-green-300',   label: 'Entregada' },
  CANCELADA:              { bg: 'bg-red-100 dark:bg-red-950/40',     text: 'text-red-700 dark:text-red-300',       label: 'Cancelada' },
  STAND_BY:               { bg: 'bg-slate-100 dark:bg-slate-800',    text: 'text-slate-500 dark:text-slate-400',   label: 'Stand by' },
};

const estadoBadge = (estado: string) => {
  const s = ESTADO_STYLES[estado] ?? { bg: 'bg-slate-100', text: 'text-slate-600', label: estado };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
};

/** ¿Entrega ya pasada (vencida) y no entregada? */
const isVencida = (entrega: EntregaAgenda): boolean => {
  if (entrega.estado === 'ENTREGADA' || entrega.estado === 'CANCELADA') return false;
  const d = new Date(String(entrega.fecha_entrega_programada).replace(' ', 'T'));
  return d < new Date();
};

// ─── Colores y emojis por tipo de evento ────────────────────────────────────────────
const EVENTO_COLORES: Record<string, string> = {
  nota:         '#F59E0B',
  cita:         '#8B5CF6',
  recordatorio: '#F97316',
  otro:         '#6B7280',
};
const EVENTO_EMOJI: Record<string, string> = {
  nota:         '📝',
  cita:         '📅',
  recordatorio: '⏰',
  otro:         '📌',
};

// ─── Modal de confirmación genérico ─────────────────────────────────────────────────
interface ModalConfirmProps {
  mensaje: string;
  labelConfirm?: string;
  onConfirm: () => void;
  onCancel: () => void;
}
function ModalConfirm({ mensaje, labelConfirm = 'Eliminar', onConfirm, onCancel }: ModalConfirmProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-xs rounded-2xl shadow-2xl p-6 space-y-4"
           style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center">
            <Trash2 size={18} className="text-red-500" />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{mensaje}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm rounded-xl border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-sec)' }}>Cancelar</button>
          <button onClick={onConfirm}
            className="flex-1 px-4 py-2 text-sm rounded-xl font-medium text-white bg-red-500 hover:bg-red-600 transition-colors">
            {labelConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Evento (notas, citas, recordatorios) ───────────────────────────────
interface ModalEventoProps {
  evento?: AgendaEvento;
  fechaInicial?: string;
  onClose: () => void;
  onSaved: () => void;
}
function ModalEvento({ evento, fechaInicial, onClose, onSaved }: ModalEventoProps) {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ADMINISTRADOR') ?? false;

  const [titulo, setTitulo] = useState(evento?.titulo ?? '');
  const [fecha, setFecha] = useState(evento?.fecha ?? fechaInicial ?? toLocalDateStr(new Date()));
  const [hora, setHora] = useState(evento?.hora ? String(evento.hora).substring(0, 5) : '');
  const [descripcion, setDescripcion] = useState(evento?.descripcion ?? '');
  const [tipo, setTipo] = useState<TipoEvento>(evento?.tipo ?? 'nota');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ── Visibilidad ──
  const [visibilidad, setVisibilidad] = useState<'todos' | 'solo_yo' | 'rol' | 'usuario'>(() => {
    if (!evento) return 'todos';
    if (evento.para_usuario_id) return evento.para_usuario_id === user?.id ? 'solo_yo' : 'usuario';
    if (evento.para_rol) return 'rol';
    return 'todos';
  });
  const [paraRol, setParaRol] = useState(evento?.para_rol ?? '');
  const [paraUsuarioId, setParaUsuarioId] = useState<number | null>(evento?.para_usuario_id ?? null);
  const [usuariosLista, setUsuariosLista] = useState<UsuarioSimple[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);

  useEffect(() => {
    if (visibilidad === 'usuario' && isAdmin && usuariosLista.length === 0) {
      setLoadingUsuarios(true);
      getUsuariosParaAgenda()
        .then(data => setUsuariosLista(data))
        .catch(() => {})
        .finally(() => setLoadingUsuarios(false));
    }
  }, [visibilidad, isAdmin]);

  const TIPOS: { value: TipoEvento; label: string; emoji: string; color: string }[] = [
    { value: 'nota',         label: 'Nota',         emoji: '📝', color: '#F59E0B' },
    { value: 'cita',         label: 'Cita',         emoji: '📅', color: '#8B5CF6' },
    { value: 'recordatorio', label: 'Recordatorio', emoji: '⏰', color: '#F97316' },
    { value: 'otro',         label: 'Otro',         emoji: '📌', color: '#6B7280' },
  ];
  const colorActual = TIPOS.find(t => t.value === tipo)?.color ?? '#F59E0B';

  const buildVisibilityPayload = () => {
    if (visibilidad === 'solo_yo') {
      const nombre = [user?.perfil?.nombres, user?.perfil?.apellidos].filter(Boolean).join(' ') || user?.name || user?.username || '';
      return { para_usuario_id: user!.id, para_usuario_nombre: nombre, para_rol: undefined };
    }
    if (visibilidad === 'rol' && paraRol) {
      return { para_rol: paraRol, para_usuario_id: undefined, para_usuario_nombre: undefined };
    }
    if (visibilidad === 'usuario' && paraUsuarioId) {
      const nombre = usuariosLista.find(u => u.id === paraUsuarioId)?.nombre ?? '';
      return { para_usuario_id: paraUsuarioId, para_usuario_nombre: nombre, para_rol: undefined };
    }
    return { para_rol: undefined, para_usuario_id: undefined, para_usuario_nombre: undefined };
  };

  const handleSave = async () => {
    if (!titulo.trim()) { setError('El título es obligatorio'); return; }
    if (!fecha) { setError('La fecha es obligatoria'); return; }
    if (visibilidad === 'rol' && !paraRol) { setError('Selecciona un rol'); return; }
    if (visibilidad === 'usuario' && !paraUsuarioId) { setError('Selecciona un usuario'); return; }
    setError(''); setSaving(true);
    try {
      const payload = {
        titulo: titulo.trim(), fecha,
        hora: hora || undefined,
        descripcion: descripcion.trim() || undefined,
        tipo,
        ...buildVisibilityPayload(),
      };
      if (evento) await updateEvento(evento.id, payload);
      else await createEvento(payload);
      onSaved(); onClose();
    } catch { setError('Error al guardar. Intenta de nuevo.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!evento) return;
    setSaving(true);
    try { await deleteEvento(evento.id); onSaved(); onClose(); }
    catch { setError('Error al eliminar.'); }
    finally { setSaving(false); }
  };

  const VISIBILIDAD_OPTS: { value: 'todos' | 'solo_yo' | 'rol' | 'usuario'; label: string; emoji: string }[] = [
    { value: 'todos',    label: 'Todos',      emoji: '🌐' },
    { value: 'solo_yo',  label: 'Solo yo',    emoji: '🔒' },
    ...(isAdmin ? [
      { value: 'rol'     as const, label: 'Por rol',      emoji: '👥' },
      { value: 'usuario' as const, label: 'Un usuario',   emoji: '👤' },
    ] : []),
  ];

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
           style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: colorActual }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
              {evento ? 'Editar evento' : 'Nuevo evento'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 rounded-lg p-1"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-sec)' }}>Tipo</label>
            <div className="flex gap-2 flex-wrap">
              {TIPOS.map(t => (
                <button key={t.value} onClick={() => setTipo(t.value)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-all"
                  style={{
                    background: tipo === t.value ? `${t.color}20` : 'var(--color-bg)',
                    borderColor: tipo === t.value ? t.color : 'var(--color-border)',
                    color: tipo === t.value ? t.color : 'var(--color-text-sec)',
                  }}>{t.emoji} {t.label}</button>
              ))}
            </div>
          </div>
          {/* Título */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-sec)' }}>Título *</label>
            <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} autoFocus
              placeholder="Ej: Reunión con proveedor, recordatorio de pago..."
              className="w-full rounded-xl px-3 py-2 text-sm border outline-none focus:ring-2 focus:ring-sky-400"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
          </div>
          {/* Fecha y hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-sec)' }}>Fecha *</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm border outline-none focus:ring-2 focus:ring-sky-400"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-sec)' }}>Hora (opcional)</label>
              <input type="time" value={hora} onChange={e => setHora(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm border outline-none focus:ring-2 focus:ring-sky-400"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
            </div>
          </div>
          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-sec)' }}>Descripción (opcional)</label>
            <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={3}
              placeholder="Detalles adicionales..."
              className="w-full rounded-xl px-3 py-2 text-sm border outline-none focus:ring-2 focus:ring-sky-400 resize-none"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
          </div>
          {/* Visible para */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-sec)' }}>Visible para</label>
            <div className="flex gap-2 flex-wrap">
              {VISIBILIDAD_OPTS.map(opt => (
                <button key={opt.value} onClick={() => setVisibilidad(opt.value)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-all"
                  style={{
                    background: visibilidad === opt.value ? '#48B9E620' : 'var(--color-bg)',
                    borderColor: visibilidad === opt.value ? '#48B9E6' : 'var(--color-border)',
                    color: visibilidad === opt.value ? '#48B9E6' : 'var(--color-text-sec)',
                  }}>{opt.emoji} {opt.label}</button>
              ))}
            </div>
            {visibilidad === 'rol' && isAdmin && (
              <select value={paraRol} onChange={e => setParaRol(e.target.value)}
                className="mt-2 w-full rounded-xl px-3 py-2 text-sm border outline-none focus:ring-2 focus:ring-sky-400"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                <option value="">— Seleccionar rol —</option>
                <option value="ADMINISTRADOR">Administrador</option>
                <option value="TECNICO">Técnico</option>
                <option value="VENTAS">Ventas</option>
              </select>
            )}
            {visibilidad === 'usuario' && isAdmin && (
              loadingUsuarios
                ? <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>Cargando usuarios…</p>
                : <select value={paraUsuarioId ?? ''} onChange={e => setParaUsuarioId(Number(e.target.value) || null)}
                    className="mt-2 w-full rounded-xl px-3 py-2 text-sm border outline-none focus:ring-2 focus:ring-sky-400"
                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                    <option value="">— Seleccionar usuario —</option>
                    {usuariosLista.map(u => (
                      <option key={u.id} value={u.id}>{u.nombre}</option>
                    ))}
                  </select>
            )}
          </div>
          {error && <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle size={14} /> {error}</p>}
        </div>
        <div className="flex items-center justify-between p-5 border-t gap-2 shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          {evento ? (
            <button onClick={() => setConfirmDelete(true)} disabled={saving}
              className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20">
              <Trash2 size={14} /> Eliminar
            </button>
          ) : <div />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl border"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-sec)' }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving || !titulo.trim() || !fecha}
              className="px-4 py-2 text-sm rounded-xl font-medium text-white disabled:opacity-50"
              style={{ background: colorActual }}>
              {saving ? 'Guardando...' : (evento ? 'Guardar cambios' : 'Crear evento')}
            </button>
          </div>
        </div>
      </div>
    </div>
    {confirmDelete && (
      <ModalConfirm
        mensaje="¿Eliminar este evento?"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    )}
    </>
  );
}

// ─── Modal selección de tipo al hacer clic en un día ────────────────────────────────
interface ModalDayChoiceProps {
  fecha: string;
  onProgramarEntrega: () => void;
  onNuevoEvento: () => void;
  onClose: () => void;
}
function ModalDayChoice({ fecha, onProgramarEntrega, onNuevoEvento, onClose }: ModalDayChoiceProps) {
  const d = new Date(fecha + 'T12:00:00');
  const label = d.toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xs rounded-2xl shadow-2xl overflow-hidden"
           style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <Calendar size={16} style={{ color: '#48B9E6' }} />
            <span className="text-sm font-semibold capitalize" style={{ color: 'var(--color-text)' }}>{label}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 p-1 rounded-lg"><X size={16} /></button>
        </div>
        <div className="p-2 space-y-1">
          <p className="text-xs px-3 py-1" style={{ color: 'var(--color-text-muted)' }}>¿Qué quieres agendar?</p>
          <button onClick={onProgramarEntrega}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[rgba(72,185,230,0.08)] transition-colors text-left">
            <span className="text-xl">🔧</span>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Entrega de reparación</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Programar fecha de entrega al cliente</p>
            </div>
          </button>
          <button onClick={onNuevoEvento}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[rgba(245,158,11,0.08)] transition-colors text-left">
            <span className="text-xl">📝</span>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Nota o evento libre</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Cita, recordatorio, nota personal...</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Programar Entrega ──────────────────────────────────────────────────
interface ModalProgramarProps {
  entrega?: EntregaAgenda;   // si se abre para editar
  onClose: () => void;
  onSaved: () => void;
}

function ModalProgramar({ entrega, onClose, onSaved }: ModalProgramarProps) {
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (entrega?.fecha_entrega_programada) {
      const d = new Date(String(entrega.fecha_entrega_programada).replace(' ', 'T'));
      setFecha(toLocalDateStr(d));
      setHora(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    }
    setNota(entrega?.nota_entrega_programada ?? '');
  }, [entrega]);

  const handleSave = async () => {
    if (!entrega || !fecha) { setError('La fecha es obligatoria'); return; }
    setError('');
    setSaving(true);
    try {
      const datetime = hora ? `${fecha}T${hora}:00` : `${fecha}T00:00:00`;
      await patchFechaEntrega(entrega.id, {
        fecha_entrega_programada: datetime,
        nota_entrega_programada: nota || undefined,
      });
      onSaved();
      onClose();
    } catch {
      setError('Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!entrega) return;
    setSaving(true);
    try {
      await deleteFechaEntrega(entrega.id);
      onSaved();
      onClose();
    } catch {
      setError('Error al eliminar.');
    } finally {
      setSaving(false);
    }
  };

  if (!entrega) return null;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <Calendar size={18} style={{ color: '#48B9E6' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
              Programar entrega
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 rounded-lg p-1">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
          {/* Info reparación */}
          <div className="rounded-xl p-3 text-sm space-y-1" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{entrega.id}</p>
            <p style={{ color: 'var(--color-text-sec)' }}>{entrega.cliente_nombre}</p>
            <p style={{ color: 'var(--color-text-muted)' }}>{entrega.tipo_equipo} {entrega.marca} {entrega.modelo}</p>
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-sec)' }}>
              Fecha de entrega *
            </label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm border outline-none focus:ring-2 focus:ring-sky-400"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>

          {/* Hora */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-sec)' }}>
              Hora (opcional)
            </label>
            <input
              type="time"
              value={hora}
              onChange={e => setHora(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm border outline-none focus:ring-2 focus:ring-sky-400"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>

          {/* Nota */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-sec)' }}>
              Nota (opcional)
            </label>
            <textarea
              value={nota}
              onChange={e => setNota(e.target.value)}
              rows={3}
              placeholder="Ej: El cliente viene por la tarde, llamar antes..."
              className="w-full rounded-xl px-3 py-2 text-sm border outline-none focus:ring-2 focus:ring-sky-400 resize-none"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertCircle size={14} /> {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t gap-2 shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          {entrega.fecha_entrega_programada && (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={saving}
              className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              <X size={14} /> Quitar fecha
            </button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-xl border"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-sec)' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !fecha}
              className="px-4 py-2 text-sm rounded-xl font-medium text-white disabled:opacity-50"
              style={{ background: '#48B9E6' }}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
    {confirmDelete && (
      <ModalConfirm
        mensaje="¿Quitar la fecha de entrega programada?"
        labelConfirm="Quitar fecha"
        onConfirm={handleRemove}
        onCancel={() => setConfirmDelete(false)}
      />
    )}
    </>
  );
}

// ─── Modal Programar Nueva Entrega (clic en día vacío del calendario) ──────────
interface ModalProgramarNuevaProps {
  fechaInicial: string; // YYYY-MM-DD
  onClose: () => void;
  onSaved: () => void;
}

function ModalProgramarNueva({ fechaInicial, onClose, onSaved }: ModalProgramarNuevaProps) {
  const [fecha, setFecha] = useState(fechaInicial);
  const [hora, setHora] = useState('');
  const [nota, setNota] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [reparaciones, setReparaciones] = useState<ReparacionPendiente[]>([]);
  const [repSeleccionada, setRepSeleccionada] = useState<ReparacionPendiente | null>(null);
  const [loadingReps, setLoadingReps] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Carga inicial y búsqueda debounced
  useEffect(() => {
    setLoadingReps(true);
    const timer = setTimeout(() => {
      searchReparacionesPendientes(busqueda || undefined)
        .then(setReparaciones)
        .catch(() => setError('Error al cargar reparaciones.'))
        .finally(() => setLoadingReps(false));
    }, busqueda ? 300 : 0);
    return () => clearTimeout(timer);
  }, [busqueda]);

  const handleSave = async () => {
    if (!repSeleccionada) { setError('Selecciona una reparación'); return; }
    if (!fecha) { setError('La fecha es obligatoria'); return; }
    setError('');
    setSaving(true);
    try {
      const datetime = hora ? `${fecha}T${hora}:00` : `${fecha}T00:00:00`;
      await patchFechaEntrega(repSeleccionada.id, {
        fecha_entrega_programada: datetime,
        nota_entrega_programada: nota || undefined,
      });
      onSaved();
      onClose();
    } catch {
      setError('Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <Calendar size={18} style={{ color: '#48B9E6' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
              Programar entrega
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 rounded-lg p-1">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
          {/* Buscador de reparación */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-sec)' }}>
              Reparación pendiente *
            </label>
            {repSeleccionada ? (
              <div
                className="rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(72,185,230,0.1)', border: '1.5px solid #48B9E6' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold" style={{ color: '#48B9E6' }}>{repSeleccionada.id}</span>
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{repSeleccionada.cliente_nombre}</span>
                    </div>
                    {(repSeleccionada.tipo_equipo || repSeleccionada.marca || repSeleccionada.modelo) && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {[repSeleccionada.tipo_equipo, repSeleccionada.marca, repSeleccionada.modelo].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => { setRepSeleccionada(null); setBusqueda(''); }}
                    className="text-gray-400 dark:text-slate-500 hover:text-red-400 shrink-0 p-1 rounded-lg transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                  <input
                    type="text"
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    placeholder="Buscar por ID, cliente, equipo..."
                    autoFocus
                    className="w-full rounded-xl pl-8 pr-3 py-2 text-sm border outline-none focus:ring-2 focus:ring-sky-400"
                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  />
                </div>
                <div
                  className="mt-2 rounded-xl overflow-hidden border overflow-y-auto max-h-64 custom-scrollbar"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  {loadingReps ? (
                    <div className="flex items-center justify-center py-4 gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      <RefreshCw size={14} className="animate-spin" /> Cargando...
                    </div>
                  ) : reparaciones.length === 0 ? (
                    <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                      {busqueda ? 'Sin resultados.' : 'No hay reparaciones pendientes.'}
                    </p>
                  ) : (
                    reparaciones.map(r => (
                      <button
                        key={r.id}
                        onClick={() => setRepSeleccionada(r)}
                        className="w-full text-left px-3 py-2.5 transition-colors border-b last:border-0 hover:bg-[rgba(72,185,230,0.07)]"
                        style={{ borderColor: 'var(--color-border)' }}
                      >
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-xs font-bold" style={{ color: '#48B9E6' }}>{r.id}</span>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                            style={{ background: 'rgba(72,185,230,0.12)', color: '#48B9E6' }}
                          >
                            {r.estado.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-sm font-medium leading-tight" style={{ color: 'var(--color-text)' }}>{r.cliente_nombre}</p>
                        {(r.tipo_equipo || r.marca || r.modelo) && (
                          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
                            {[r.tipo_equipo, r.marca, r.modelo].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-sec)' }}>
              Fecha de entrega *
            </label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm border outline-none focus:ring-2 focus:ring-sky-400"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>

          {/* Hora */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-sec)' }}>
              Hora (opcional)
            </label>
            <input
              type="time"
              value={hora}
              onChange={e => setHora(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm border outline-none focus:ring-2 focus:ring-sky-400"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>

          {/* Nota */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-sec)' }}>
              Nota (opcional)
            </label>
            <textarea
              value={nota}
              onChange={e => setNota(e.target.value)}
              rows={3}
              placeholder="Ej: El cliente viene por la tarde, llamar antes..."
              className="w-full rounded-xl px-3 py-2 text-sm border outline-none focus:ring-2 focus:ring-sky-400 resize-none"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertCircle size={14} /> {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-5 border-t gap-2 shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-sec)' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !repSeleccionada || !fecha}
            className="px-4 py-2 text-sm rounded-xl font-medium text-white disabled:opacity-50"
            style={{ background: '#48B9E6' }}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tarjeta de entrega (para lista y calendario) ─────────────────────────────
interface TarjetaEntregaProps {
  entrega: EntregaAgenda;
  compact?: boolean;
  onVerReparacion: (id: string) => void;
  onEditar: (e: EntregaAgenda) => void;
}

function TarjetaEntrega({ entrega, compact, onVerReparacion, onEditar }: TarjetaEntregaProps) {
  const vencida = isVencida(entrega);
  const entregada = entrega.estado === 'ENTREGADA';
  const hora = fmtTime(entrega.fecha_entrega_programada);

  const borderColor = entregada
    ? '#22c55e'
    : vencida
    ? '#ef4444'
    : '#48B9E6';

  return (
    <div
      className="rounded-xl p-3 text-sm space-y-1.5 transition-all hover:shadow-md cursor-pointer group"
      style={{
        background: 'var(--color-bg-card)',
        border: `1px solid var(--color-border)`,
        borderLeft: `3px solid ${borderColor}`,
      }}
      onClick={() => onVerReparacion(entrega.id)}
    >
      {/* Header fila */}
      <div className="flex items-center justify-between gap-1">
        <span className="font-bold text-xs" style={{ color: '#48B9E6' }}>
          {entrega.id}
        </span>
        <div className="flex items-center gap-1">
          {hora && (
            <span className="text-xs flex items-center gap-0.5" style={{ color: 'var(--color-text-muted)' }}>
              <Clock size={10} /> {hora}
            </span>
          )}
          {estadoBadge(entrega.estado)}
        </div>
      </div>

      {/* Cliente */}
      <div className="flex items-center gap-1" style={{ color: 'var(--color-text)' }}>
        <User size={12} />
        <span className="font-medium truncate">{entrega.cliente_nombre}</span>
      </div>

      {!compact && (
        <>
          {entrega.cliente_telefono && (
            <div className="flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
              <Phone size={11} /> <span>{entrega.cliente_telefono}</span>
            </div>
          )}
          <div className="flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
            <Smartphone size={11} />
            <span className="truncate">{[entrega.tipo_equipo, entrega.marca, entrega.modelo].filter(Boolean).join(' ')}</span>
          </div>
          {entrega.nota_entrega_programada && (
            <p className="text-xs italic truncate" style={{ color: 'var(--color-text-muted)' }}>
              {entrega.nota_entrega_programada}
            </p>
          )}
        </>
      )}

      {/* Acciones */}
      <div className="flex items-center gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity"
           onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onVerReparacion(entrega.id)}
          className="text-xs flex items-center gap-1 px-2 py-0.5 rounded-lg"
          style={{ background: 'rgba(72,185,230,0.12)', color: '#48B9E6' }}
        >
          <Eye size={11} /> Ver
        </button>
        <button
          onClick={() => onEditar(entrega)}
          className="text-xs flex items-center gap-1 px-2 py-0.5 rounded-lg"
          style={{ background: 'rgba(100,100,120,0.1)', color: 'var(--color-text-sec)' }}
        >
          <Calendar size={11} /> Fecha
        </button>
      </div>
    </div>
  );
}

// ─── Vista de lista (agrupada por día) ────────────────────────────────────────
interface VistaListaProps {
  entregas: EntregaAgenda[];
  eventos: AgendaEvento[];
  onVerReparacion: (id: string) => void;
  onEditar: (e: EntregaAgenda) => void;
  onEditarEvento: (e: AgendaEvento) => void;
}

function VistaLista({ entregas, eventos, onVerReparacion, onEditar, onEditarEvento }: VistaListaProps) {
  // Agrupar entregas y eventos por fecha local (YYYY-MM-DD)
  const grupos: Record<string, { entregas: EntregaAgenda[]; eventos: AgendaEvento[] }> = {};
  for (const e of entregas) {
    const key = toLocalDateStr(new Date(String(e.fecha_entrega_programada).replace(' ', 'T')));
    if (!grupos[key]) grupos[key] = { entregas: [], eventos: [] };
    grupos[key].entregas.push(e);
  }
  for (const ev of eventos) {
    const evKey = String(ev.fecha).substring(0, 10);
    if (!grupos[evKey]) grupos[evKey] = { entregas: [], eventos: [] };
    grupos[evKey].eventos.push(ev);
  }

  const keys = Object.keys(grupos).sort();

  if (keys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: 'var(--color-text-muted)' }}>
        <Calendar size={40} style={{ opacity: 0.3 }} />
        <p className="text-sm">No hay entregas ni eventos para este período.</p>
      </div>
    );
  }

  const today = toLocalDateStr(new Date());

  return (
    <div className="space-y-6">
      {keys.map(key => {
        const d = new Date(key + 'T12:00:00');
        const esHoy = key === today;
        const esPasado = key < today;
        const totalItems = grupos[key].entregas.length + grupos[key].eventos.length;

        return (
          <div key={key}>
            {/* Encabezado de día */}
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`flex flex-col items-center justify-center rounded-xl w-12 h-12 shrink-0 ${
                  esHoy ? 'text-white' : ''
                }`}
                style={{
                  background: esHoy ? '#48B9E6' : esPasado ? 'var(--color-bg)' : 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <span className="text-xl font-bold leading-none">{d.getDate()}</span>
                <span className="text-xs uppercase">
                  {d.toLocaleDateString('es-GT', { month: 'short' })}
                </span>
              </div>
              <div>
                <p className="font-semibold" style={{ color: esHoy ? '#48B9E6' : 'var(--color-text)' }}>
                  {esHoy ? 'Hoy — ' : ''}{d.toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {totalItems} {totalItems === 1 ? 'elemento' : 'elementos'}
                </p>
              </div>
              {esPasado && !esHoy && (
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                  Pasado
                </span>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {grupos[key].entregas.map(e => (
                <TarjetaEntrega key={e.id} entrega={e} onVerReparacion={onVerReparacion} onEditar={onEditar} />
              ))}
              {grupos[key].eventos.map(ev => (
                <EventoCard key={`ev-${ev.id}`} evento={ev} onEditar={onEditarEvento} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Vista mensual (calendario) ───────────────────────────────────────────────
interface VistaMensualProps {
  year: number;
  month: number; // 0-based
  entregas: EntregaAgenda[];
  eventos: AgendaEvento[];
  onVerReparacion: (id: string) => void;
  onEditar: (e: EntregaAgenda) => void;
  onEditarEvento: (e: AgendaEvento) => void;
  onDayClick?: (dateStr: string) => void;
}

function VistaMensual({ year, month, entregas, eventos, onVerReparacion, onEditar, onEditarEvento, onDayClick }: VistaMensualProps) {
  // Mapa de reparaciones por día
  const mapa: Record<number, EntregaAgenda[]> = {};
  for (const e of entregas) {
    const d = new Date(String(e.fecha_entrega_programada).replace(' ', 'T'));
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!mapa[day]) mapa[day] = [];
      mapa[day].push(e);
    }
  }
  // Mapa de eventos por día (YYYY-MM-DD)
  const mapaEv: Record<string, AgendaEvento[]> = {};
  for (const ev of eventos) {
    const evKey = String(ev.fecha).substring(0, 10);
    if (!mapaEv[evKey]) mapaEv[evKey] = [];
    mapaEv[evKey].push(ev);
  }

  const firstDay = firstOfMonth(year, month);
  const lastDay = lastOfMonth(year, month);
  const startDow = firstDay.getDay(); // 0=Dom
  const totalDays = lastDay.getDate();

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  // Celdas: blancos previos + días del mes
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  return (
    <div>
      {/* Cabecera días semana */}
      <div className="grid grid-cols-7 mb-1">
        {DIAS.map(d => (
          <div key={d} className="text-center text-xs font-semibold py-2"
               style={{ color: 'var(--color-text-muted)' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Cuadrícula de días */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const items = mapa[day] ?? [];
          const isToday = isCurrentMonth && today.getDate() === day;

          return (
            <div
              key={day}
              className="rounded-xl min-h-[80px] p-1.5 cursor-pointer hover:ring-2 hover:ring-sky-300/50 transition-all"
              style={{
                background: isToday ? 'rgba(72,185,230,0.08)' : 'var(--color-bg-card)',
                border: isToday ? '1.5px solid #48B9E6' : '1px solid var(--color-border)',
              }}
              onClick={() => onDayClick?.(toLocalDateStr(new Date(year, month, day)))}
            >
              {/* Número del día */}
              <div
                className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday ? 'text-white' : ''
                }`}
                style={{ background: isToday ? '#48B9E6' : 'transparent', color: isToday ? 'white' : 'var(--color-text)' }}
              >
                {day}
              </div>

              {/* Eventos del día */}
              {(() => {
                const dateStr = toLocalDateStr(new Date(year, month, day));
                const repItems = mapa[day] ?? [];
                const evItems  = mapaEv[dateStr] ?? [];
                const maxSlots = 3;
                const repSlots = Math.min(repItems.length, maxSlots);
                const evSlots  = Math.min(evItems.length, maxSlots - repSlots);
                const remaining = repItems.length + evItems.length - repSlots - evSlots;
                return (
                  <div className="space-y-0.5">
                    {repItems.slice(0, repSlots).map(e => {
                      const vencida = isVencida(e);
                      const entregada = e.estado === 'ENTREGADA';
                      const color = entregada ? '#22c55e' : vencida ? '#ef4444' : '#48B9E6';
                      return (
                        <button key={e.id}
                          onClick={(ev) => { ev.stopPropagation(); onEditar(e); }}
                          className="w-full text-left text-xs px-1.5 py-0.5 rounded truncate leading-tight"
                          style={{ background: `${color}22`, color, fontWeight: 600, fontSize: '10px' }}
                          title={`${e.id} — ${e.cliente_nombre}`}>
                          {e.id.replace('REP', '')} {e.cliente_nombre.split(' ')[0]}
                        </button>
                      );
                    })}
                    {evItems.slice(0, evSlots).map(ev => {
                      const color = EVENTO_COLORES[ev.tipo] ?? '#6B7280';
                      const emoji = EVENTO_EMOJI[ev.tipo] ?? '📌';
                      return (
                        <button key={`ev-${ev.id}`}
                          onClick={(e) => { e.stopPropagation(); onEditarEvento(ev); }}
                          className="w-full text-left text-xs px-1.5 py-0.5 rounded truncate leading-tight"
                          style={{ background: `${color}22`, color, fontWeight: 600, fontSize: '10px' }}
                          title={ev.titulo}>
                          {emoji} {ev.titulo}
                        </button>
                      );
                    })}
                    {remaining > 0 && (
                      <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                        +{remaining} más
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function AgendaPage() {
  const navigate = useNavigate();
  const today = new Date();

  const [entregas, setEntregas] = useState<EntregaAgenda[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState<FiltroAgenda>('mes');
  const [vistaCalendario, setVistaCalendario] = useState(true);
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth()); // 0-based
  const [modalEntrega, setModalEntrega] = useState<EntregaAgenda | null>(null);
  const [modalNueva, setModalNueva] = useState<string | null>(null); // YYYY-MM-DD del día clickeado
  const [eventos, setEventos] = useState<AgendaEvento[]>([]);
  const [modalEvento, setModalEvento] = useState<{ evento?: AgendaEvento; fechaInicial?: string } | null>(null);
  const [modalDayChoice, setModalDayChoice] = useState<string | null>(null);

  // ─── Calcular rango de fechas según filtro ──────────────────────────────────
  const getRango = useCallback((): { inicio: string; fin: string } => {
    const now = new Date();
    if (filtro === 'hoy') {
      const s = toLocalDateStr(now);
      return { inicio: s, fin: s };
    }
    if (filtro === 'semana') {
      const dow = now.getDay();
      const lunes = new Date(now); lunes.setDate(now.getDate() - dow + (dow === 0 ? -6 : 1));
      const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
      return { inicio: toLocalDateStr(lunes), fin: toLocalDateStr(domingo) };
    }
    if (filtro === 'mes') {
      return {
        inicio: toLocalDateStr(firstOfMonth(calYear, calMonth)),
        fin: toLocalDateStr(lastOfMonth(calYear, calMonth)),
      };
    }
    if (filtro === 'pendientes') {
      return { inicio: toLocalDateStr(now), fin: toLocalDateStr(new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())) };
    }
    // 'todas' — sin filtro de fecha
    return { inicio: '', fin: '' };
  }, [filtro, calYear, calMonth]);

  // ─── Cargar entregas ─────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { inicio, fin } = getRango();
      const [data, evs] = await Promise.all([
        getEntregas({
          fecha_inicio: inicio || undefined,
          fecha_fin: fin || undefined,
          estado: filtro === 'pendientes'
            ? 'RECIBIDA,EN_DIAGNOSTICO,EN_PROCESO,EN_REPARACION,ESPERANDO_PIEZA,ESPERANDO_AUTORIZACION,COMPLETADA,STAND_BY,AUTORIZADA'
            : undefined,
        }),
        getEventos({ fecha_inicio: inicio || undefined, fecha_fin: fin || undefined }),
      ]);
      setEntregas(data);
      setEventos(evs);
    } catch (err) {
      console.error('[AgendaPage] cargar error', err);
    } finally {
      setLoading(false);
    }
  }, [getRango, filtro]);

  useEffect(() => { cargar(); }, [cargar]);

  // ─── Navegar mes ─────────────────────────────────────────────────────────────
  const prevMes = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextMes = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };
  const irHoy = () => { setCalYear(today.getFullYear()); setCalMonth(today.getMonth()); };

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  // ─── Estadísticas rápidas ────────────────────────────────────────────────────
  const totalPendientes = entregas.filter(e => e.estado !== 'ENTREGADA' && e.estado !== 'CANCELADA').length;
  const totalEntregadas = entregas.filter(e => e.estado === 'ENTREGADA').length;
  const totalVencidas   = entregas.filter(isVencida).length;
  const totalEventos    = eventos.length;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader title="Agenda de entregas" subtitle="Reparaciones con fecha de entrega programada">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalEvento({})}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: '#F59E0B' }}
          >
            <Plus size={15} /> Nuevo evento
          </button>
          <button
            onClick={cargar}
            disabled={loading}
            className="p-2 rounded-xl border hover:bg-slate-50 dark:hover:bg-slate-800"
            style={{ borderColor: 'var(--color-border)' }}
            title="Actualizar"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </div>
      </PageHeader>

      {/* ── Estadísticas rápidas ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pendientes', value: totalPendientes, icon: <Clock size={18} />,        color: '#48B9E6' },
          { label: 'Entregadas', value: totalEntregadas, icon: <CheckCircle2 size={18} />, color: '#22c55e' },
          { label: 'Vencidas',   value: totalVencidas,   icon: <AlertCircle size={18} />,  color: '#ef4444' },
          { label: 'Eventos',    value: totalEventos,    icon: <FileText size={18} />,      color: '#F59E0B' },
        ].map(stat => (
          <div
            key={stat.label}
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <span style={{ color: stat.color }}>{stat.icon}</span>
            <div>
              <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Controles ──────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-4 flex flex-wrap items-center gap-3"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        {/* Filtro período */}
        <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'var(--color-bg)' }}>
          {(['hoy', 'semana', 'mes', 'pendientes', 'todas'] as FiltroAgenda[]).map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all"
              style={{
                background: filtro === f ? '#48B9E6' : 'transparent',
                color: filtro === f ? 'white' : 'var(--color-text-sec)',
              }}
            >
              {f === 'pendientes' ? 'Pendientes' : f === 'todas' ? 'Todas' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Navegación mes (solo en filtro=mes) */}
        {filtro === 'mes' && (
          <div className="flex items-center gap-2 ml-2">
            <button onClick={prevMes} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <ChevronLeft size={16} style={{ color: 'var(--color-text-sec)' }} />
            </button>
            <span className="text-sm font-semibold min-w-[140px] text-center" style={{ color: 'var(--color-text)' }}>
              {MESES[calMonth]} {calYear}
            </span>
            <button onClick={nextMes} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <ChevronRight size={16} style={{ color: 'var(--color-text-sec)' }} />
            </button>
            <button onClick={irHoy} className="text-xs px-2 py-1 rounded-lg border"
                    style={{ borderColor: '#48B9E6', color: '#48B9E6' }}>
              Hoy
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1 rounded-xl p-1" style={{ background: 'var(--color-bg)' }}>
          <button
            onClick={() => setVistaCalendario(true)}
            className="p-2 rounded-lg"
            style={{ background: vistaCalendario ? '#48B9E6' : 'transparent', color: vistaCalendario ? 'white' : 'var(--color-text-sec)' }}
            title="Vista calendario"
          >
            <Calendar size={15} />
          </button>
          <button
            onClick={() => setVistaCalendario(false)}
            className="p-2 rounded-lg"
            style={{ background: !vistaCalendario ? '#48B9E6' : 'transparent', color: !vistaCalendario ? 'white' : 'var(--color-text-sec)' }}
            title="Vista lista"
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {/* ── Contenido ──────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-4"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2" style={{ color: 'var(--color-text-muted)' }}>
            <RefreshCw size={20} className="animate-spin" />
            <span>Cargando...</span>
          </div>
        ) : vistaCalendario && filtro === 'mes' ? (
          <VistaMensual
            year={calYear}
            month={calMonth}
            entregas={entregas}
            eventos={eventos}
            onVerReparacion={id => navigate(`/flujo-reparaciones/${id}`)}
            onEditar={setModalEntrega}
            onEditarEvento={ev => setModalEvento({ evento: ev })}
            onDayClick={setModalDayChoice}
          />
        ) : (
          <VistaLista
            entregas={entregas}
            eventos={eventos}
            onVerReparacion={id => navigate(`/flujo-reparaciones/${id}`)}
            onEditar={setModalEntrega}
            onEditarEvento={ev => setModalEvento({ evento: ev })}
          />
        )}
      </div>

      {/* ── Leyenda ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {[
          { color: '#48B9E6', label: 'Pendiente de entrega' },
          { color: '#22c55e', label: 'Entregada' },
          { color: '#ef4444', label: 'Vencida (fecha pasada)' },
          { color: '#F59E0B', label: 'Nota/evento' },
          { color: '#8B5CF6', label: 'Cita' },
          { color: '#F97316', label: 'Recordatorio' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: l.color }} />
            {l.label}
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <Ban size={12} />
          Las reparaciones canceladas no se muestran en filtro "Pendientes"
        </div>
      </div>

      {/* ── Modal programar/editar fecha ───────────────────────────────────── */}
      {modalEntrega && (
        <ModalProgramar
          entrega={modalEntrega}
          onClose={() => setModalEntrega(null)}
          onSaved={cargar}
        />
      )}
      {modalNueva && (
        <ModalProgramarNueva
          fechaInicial={modalNueva}
          onClose={() => setModalNueva(null)}
          onSaved={cargar}
        />
      )}
      {modalEvento !== null && (
        <ModalEvento
          evento={modalEvento.evento}
          fechaInicial={modalEvento.fechaInicial}
          onClose={() => setModalEvento(null)}
          onSaved={cargar}
        />
      )}
      {modalDayChoice && (
        <ModalDayChoice
          fecha={modalDayChoice}
          onProgramarEntrega={() => { setModalNueva(modalDayChoice); setModalDayChoice(null); }}
          onNuevoEvento={() => { setModalEvento({ fechaInicial: modalDayChoice }); setModalDayChoice(null); }}
          onClose={() => setModalDayChoice(null)}
        />
      )}
    </div>
  );
}
