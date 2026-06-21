import {
  X, Clock, FileText, Image as ImageIcon, CheckCircle, XCircle,
  Calendar, Plus, DollarSign, ClipboardCheck, ArrowRightLeft,
  AlertCircle, User, Banknote, CheckSquare, Wrench, Package
} from 'lucide-react';
import { useState, useEffect } from 'react';
import API_URL from '../../services/config';
import { getImageUrl } from '../../utils/getImageUrl';
import axios from 'axios';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

interface ModalHistorialReparacionProps {
  isOpen: boolean;
  onClose: () => void;
  reparacionId: string;
}

interface Evento {
  id: number | string;
  tipo_evento: string;
  titulo: string;
  descripcion: string | null;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  nota: string | null;
  usuario: string;
  fecha: string;
  monto?: number | null;
  metodo_pago?: string | null;
  banco?: string | null;
  pieza_necesaria?: string | null;
  proveedor?: string | null;
  costo_repuesto?: number | null;
  sticker_numero?: string | null;
  sticker_ubicacion?: string | null;
  imagenes: string[];
}

interface ReparacionResumen {
  id: string;
  cliente_nombre: string;
  cliente_telefono: string;
  equipo: string;
  estado_actual: string;
  prioridad: string;
  fecha_ingreso: string;
  tecnico_asignado: string | null;
  diagnostico_inicial: string | null;
}

export default function ModalHistorialReparacion({
  isOpen,
  onClose,
  reparacionId
}: ModalHistorialReparacionProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [reparacion, setReparacion] = useState<ReparacionResumen | null>(null);
  const [imagenAmpliada, setImagenAmpliada] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadHistorialCompleto();
    }
  }, [isOpen, reparacionId]);

  const loadHistorialCompleto = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/reparaciones/${reparacionId}/historial-completo`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setReparacion(response.data.data.reparacion);
        setEventos(response.data.data.eventos || []);
      } else {
        setError('No se pudo cargar el historial.');
      }
    } catch (err: any) {
      console.error('Error loading historial-completo:', err);
      setError('Error al conectar con el servidor. Verifica que el backend esté activo.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleString('es-GT', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getEventoConfig = (tipo: string): {
    icon: React.ReactNode;
    color: string;
    dotColor: string;
    badgeColor: string;
  } => {
    const configs: Record<string, { icon: React.ReactNode; color: string; dotColor: string; badgeColor: string }> = {
      REPARACION_CREADA:    { icon: <Plus size={14} />,            color: 'bg-blue-50 border-blue-200 dark:bg-blue-500/[0.08] dark:border-blue-400/20',    dotColor: 'bg-blue-500',    badgeColor: 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-500/15' },
      CHECKLIST_COMPLETADO: { icon: <ClipboardCheck size={14} />,  color: 'bg-violet-50 border-violet-200 dark:bg-violet-500/[0.08] dark:border-violet-400/20', dotColor: 'bg-violet-500',  badgeColor: 'text-violet-700 bg-violet-100 dark:text-violet-300 dark:bg-violet-500/15' },
      ANTICIPO_REGISTRADO:  { icon: <DollarSign size={14} />,      color: 'bg-amber-50 border-amber-200 dark:bg-amber-500/[0.08] dark:border-amber-400/20',  dotColor: 'bg-amber-400',   badgeColor: 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15' },
      ANTICIPO_PENDIENTE:   { icon: <DollarSign size={14} />,      color: 'bg-amber-50 border-amber-200 dark:bg-amber-500/[0.08] dark:border-amber-400/20',  dotColor: 'bg-amber-400',   badgeColor: 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15' },
      ANTICIPO_CONFIRMADO:  { icon: <Banknote size={14} />,        color: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/[0.08] dark:border-emerald-400/20', dotColor: 'bg-emerald-500', badgeColor: 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/15' },
      CAMBIO_ESTADO:        { icon: <ArrowRightLeft size={14} />,  color: 'bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700',  dotColor: 'bg-slate-500',   badgeColor: 'text-slate-700 bg-slate-100 dark:text-slate-300 dark:bg-slate-700/60' },
    };
    return configs[tipo] || { icon: <AlertCircle size={14} />, color: 'bg-gray-50 border-gray-200 dark:bg-slate-800/50 dark:border-slate-700', dotColor: 'bg-gray-400', badgeColor: 'text-gray-700 bg-gray-100 dark:text-slate-300 dark:bg-slate-700/60' };
  };

  const getEstadoBadgeColor = (estado: string): string => {
    const map: Record<string, string> = {
      RECIBIDA: 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-500/15',
      EN_DIAGNOSTICO: 'text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-500/15',
      ESPERANDO_AUTORIZACION: 'text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-500/15',
      AUTORIZADA: 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-500/15',
      EN_REPARACION: 'text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-500/15',
      ESPERANDO_PIEZA: 'text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-500/15',
      COMPLETADA: 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-500/15',
      ENTREGADA: 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/15',
      CANCELADA: 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-500/15',
      STAND_BY: 'text-slate-700 bg-slate-100 dark:text-slate-300 dark:bg-slate-700/60',
      ANTICIPO_REGISTRADO: 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15',
    };
    return map[estado] || 'text-gray-700 bg-gray-100 dark:text-slate-300 dark:bg-slate-700/60';
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-4">
        <div className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700/80 dark:bg-slate-950 sm:rounded-3xl">
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/95 sm:px-6 sm:py-5">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-xl">Historial Completo</h2>
              {reparacion && (
                <p className="mt-1 flex flex-wrap items-center gap-x-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300 sm:text-xs">{reparacion.id}</span>
                  {' · '}{reparacion.cliente_nombre}
                  {' · '}{reparacion.equipo}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X size={22} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto bg-slate-50/70 px-4 py-5 dark:bg-slate-950 sm:px-6 sm:py-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500 dark:text-slate-400">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent mb-3" />
                <p>Cargando historial...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <AlertCircle size={40} className="text-red-400 mb-3" />
                <p className="mb-1 font-medium text-slate-700 dark:text-slate-200">No se pudo cargar el historial</p>
                <p className="text-slate-500 text-sm max-w-md">{error}</p>
                <p className="text-slate-400 text-xs mt-2">
                  Verifica que el backend esté devolviendo <code>/reparaciones/:id/historial-completo</code>
                </p>
                <button
                  onClick={loadHistorialCompleto}
                  className="mt-4 text-sm text-blue-600 underline"
                >
                  Reintentar
                </button>
              </div>
            ) : eventos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText size={40} className="text-slate-300 mb-3" />
                <p className="mb-1 font-medium text-slate-600 dark:text-slate-300">
                  No se encontraron movimientos registrados para esta reparación.
                </p>
                <p className="text-slate-400 text-sm max-w-sm">
                  Verifica que el backend esté devolviendo <code>reparaciones_historial</code> o que
                  se esté guardando el historial al actualizar estados.
                </p>
              </div>
            ) : (
              <div className="relative">
                {/* Línea vertical del timeline */}
                <div className="absolute bottom-2 left-4 top-2 w-px bg-slate-200 dark:bg-slate-700 sm:left-5" />

                <div className="space-y-3 sm:space-y-4">
                  {eventos.map((ev, idx) => {
                    const cfg = getEventoConfig(ev.tipo_evento);
                    return (
                      <div key={`${ev.id}-${idx}`} className="relative flex min-w-0 gap-3 sm:gap-4">
                        {/* Dot del timeline */}
                        <div className={`relative z-10 mt-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm ring-4 ring-slate-50 dark:ring-slate-950 sm:h-10 sm:w-10 ${cfg.dotColor}`}>
                          {cfg.icon}
                        </div>

                        {/* Card del evento */}
                        <div className={`min-w-0 flex-1 rounded-2xl border p-3.5 shadow-sm sm:p-4 ${cfg.color}`}>
                          {/* Header del evento */}
                          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badgeColor}`}>
                                {ev.titulo}
                              </span>
                              {ev.estado_anterior && ev.estado_nuevo && (
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getEstadoBadgeColor(ev.estado_anterior)}`}>
                                    {ev.estado_anterior.replace(/_/g, ' ')}
                                  </span>
                                  <ArrowRightLeft size={11} className="text-slate-400" />
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getEstadoBadgeColor(ev.estado_nuevo)}`}>
                                    {ev.estado_nuevo.replace(/_/g, ' ')}
                                  </span>
                                </span>
                              )}
                              {!ev.estado_anterior && ev.estado_nuevo && (
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getEstadoBadgeColor(ev.estado_nuevo)}`}>
                                  {ev.estado_nuevo.replace(/_/g, ' ')}
                                </span>
                              )}
                            </div>
                            <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-left sm:block sm:w-auto sm:shrink-0 sm:text-right">
                              <p className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 sm:justify-end">
                                <Calendar size={11} />
                                {formatDate(ev.fecha)}
                              </p>
                              <p className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 sm:mt-1 sm:justify-end">
                                <User size={11} />
                                {ev.usuario}
                              </p>
                            </div>
                          </div>

                          {/* Cuerpo del evento */}
                          <div className="space-y-1.5 text-sm">
                            {ev.descripcion && ev.descripcion !== ev.nota && (
                              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{ev.descripcion}</p>
                            )}
                            {ev.nota && (
                              <p className="border-l-2 border-slate-300 pl-3 text-xs italic leading-relaxed text-slate-600 dark:border-slate-600 dark:text-slate-400">
                                {ev.nota}
                              </p>
                            )}

                            {/* Monto anticipo */}
                            {ev.monto != null && (
                              <div className="flex items-center gap-3 mt-2 flex-wrap">
                                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                  Q{ev.monto.toFixed(2)}
                                </span>
                                {ev.metodo_pago && (
                                  <span className="text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                                    {ev.metodo_pago}
                                  </span>
                                )}
                                {ev.banco && (
                                  <span className="text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                                    {ev.banco}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Pieza necesaria */}
                            {ev.pieza_necesaria && (
                              <div className="mt-2 flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                                <Package size={12} className="mt-0.5 shrink-0" />
                                <span>
                                  <strong>Pieza:</strong> {ev.pieza_necesaria}
                                  {ev.proveedor && ` · Proveedor: ${ev.proveedor}`}
                                  {ev.costo_repuesto != null && ` · Q${ev.costo_repuesto.toFixed(2)}`}
                                </span>
                              </div>
                            )}

                            {/* Sticker */}
                            {ev.sticker_numero && (
                              <div className="mt-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                <CheckSquare size={12} />
                                <span>
                                  <strong>Sticker:</strong> {ev.sticker_numero}
                                  {ev.sticker_ubicacion && ` · ${ev.sticker_ubicacion}`}
                                </span>
                              </div>
                            )}

                            {/* Imágenes adjuntas */}
                            {ev.imagenes.length > 0 && (
                              <div className="mt-3 grid grid-cols-3 gap-2">
                                {ev.imagenes.map((img, i) => (
                                  <img
                                    key={i}
                                    src={getImageUrl(img)}
                                    alt={`Evidencia ${i + 1}`}
                                    loading="lazy"
                                    decoding="async"
                                    className="h-20 w-full cursor-pointer rounded-xl border border-slate-200 object-cover shadow-sm transition hover:opacity-80 dark:border-slate-700"
                                    onClick={() => setImagenAmpliada(getImageUrl(img))}
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 sm:px-6 sm:py-4">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {eventos.length > 0 ? `${eventos.length} evento${eventos.length !== 1 ? 's' : ''} registrados` : ''}
            </span>
            <Button variant="ghost" onClick={onClose} className="rounded-xl border border-slate-200 px-4 text-sm font-semibold dark:border-slate-700">
              Cerrar
            </Button>
          </div>
        </div>
      </div>

      {/* Imagen ampliada */}
      {imagenAmpliada && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4"
          onClick={() => setImagenAmpliada(null)}
        >
          <button
            onClick={() => setImagenAmpliada(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white"
          >
            <X size={32} />
          </button>
          <img
            src={imagenAmpliada}
            alt="Imagen ampliada"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}
    </>
  );
}

