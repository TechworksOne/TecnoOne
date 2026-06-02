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
      REPARACION_CREADA:    { icon: <Plus size={14} />,            color: 'bg-blue-50 border-blue-200',    dotColor: 'bg-blue-500',    badgeColor: 'text-blue-700 bg-blue-100' },
      CHECKLIST_COMPLETADO: { icon: <ClipboardCheck size={14} />,  color: 'bg-violet-50 border-violet-200', dotColor: 'bg-violet-500',  badgeColor: 'text-violet-700 bg-violet-100' },
      ANTICIPO_REGISTRADO:  { icon: <DollarSign size={14} />,      color: 'bg-amber-50 border-amber-200',  dotColor: 'bg-amber-400',   badgeColor: 'text-amber-700 bg-amber-100' },
      ANTICIPO_PENDIENTE:   { icon: <DollarSign size={14} />,      color: 'bg-amber-50 border-amber-200',  dotColor: 'bg-amber-400',   badgeColor: 'text-amber-700 bg-amber-100' },
      ANTICIPO_CONFIRMADO:  { icon: <Banknote size={14} />,        color: 'bg-emerald-50 border-emerald-200', dotColor: 'bg-emerald-500', badgeColor: 'text-emerald-700 bg-emerald-100' },
      CAMBIO_ESTADO:        { icon: <ArrowRightLeft size={14} />,  color: 'bg-slate-50 border-slate-200',  dotColor: 'bg-slate-500',   badgeColor: 'text-slate-700 bg-slate-100' },
    };
    return configs[tipo] || { icon: <AlertCircle size={14} />, color: 'bg-gray-50 border-gray-200', dotColor: 'bg-gray-400', badgeColor: 'text-gray-700 bg-gray-100' };
  };

  const getEstadoBadgeColor = (estado: string): string => {
    const map: Record<string, string> = {
      RECIBIDA: 'text-blue-700 bg-blue-100',
      EN_DIAGNOSTICO: 'text-yellow-700 bg-yellow-100',
      ESPERANDO_AUTORIZACION: 'text-orange-700 bg-orange-100',
      AUTORIZADA: 'text-blue-700 bg-blue-100',
      EN_REPARACION: 'text-yellow-700 bg-yellow-100',
      ESPERANDO_PIEZA: 'text-orange-700 bg-orange-100',
      COMPLETADA: 'text-green-700 bg-green-100',
      ENTREGADA: 'text-emerald-700 bg-emerald-100',
      CANCELADA: 'text-red-700 bg-red-100',
      STAND_BY: 'text-slate-700 bg-slate-100',
      ANTICIPO_REGISTRADO: 'text-amber-700 bg-amber-100',
    };
    return map[estado] || 'text-gray-700 bg-gray-100';
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Historial Completo</h2>
              {reparacion && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{reparacion.id}</span>
                  {' · '}{reparacion.cliente_nombre}
                  {' · '}{reparacion.equipo}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={22} />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-6 py-5">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent mb-3" />
                <p>Cargando historial...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <AlertCircle size={40} className="text-red-400 mb-3" />
                <p className="text-slate-700 font-medium mb-1">No se pudo cargar el historial</p>
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
                <p className="text-slate-600 font-medium mb-1">
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
                <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-slate-200" />

                <div className="space-y-4">
                  {eventos.map((ev, idx) => {
                    const cfg = getEventoConfig(ev.tipo_evento);
                    return (
                      <div key={`${ev.id}-${idx}`} className="relative flex gap-4">
                        {/* Dot del timeline */}
                        <div className={`relative z-10 mt-3 w-10 h-10 rounded-full ${cfg.dotColor} flex items-center justify-center text-white shrink-0 shadow-sm`}>
                          {cfg.icon}
                        </div>

                        {/* Card del evento */}
                        <div className={`flex-1 border rounded-xl p-4 ${cfg.color}`}>
                          {/* Header del evento */}
                          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
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
                            <div className="text-right shrink-0">
                              <p className="text-xs text-slate-500 flex items-center gap-1 justify-end">
                                <Calendar size={11} />
                                {formatDate(ev.fecha)}
                              </p>
                              <p className="text-xs text-slate-500 flex items-center gap-1 justify-end mt-0.5">
                                <User size={11} />
                                {ev.usuario}
                              </p>
                            </div>
                          </div>

                          {/* Cuerpo del evento */}
                          <div className="space-y-1.5 text-sm">
                            {ev.descripcion && ev.descripcion !== ev.nota && (
                              <p className="text-slate-700">{ev.descripcion}</p>
                            )}
                            {ev.nota && (
                              <p className="text-slate-600 italic text-xs border-l-2 border-slate-300 pl-2">
                                {ev.nota}
                              </p>
                            )}

                            {/* Monto anticipo */}
                            {ev.monto != null && (
                              <div className="flex items-center gap-3 mt-2 flex-wrap">
                                <span className="text-emerald-700 font-semibold">
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
                              <div className="flex items-start gap-2 mt-1 text-xs text-slate-600">
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
                              <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
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
                                    className="w-full h-20 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity shadow-sm"
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
          <div className="shrink-0 px-6 py-3 border-t border-slate-200 flex justify-between items-center bg-slate-50 rounded-b-2xl">
            <span className="text-xs text-slate-400">
              {eventos.length > 0 ? `${eventos.length} evento${eventos.length !== 1 ? 's' : ''} registrados` : ''}
            </span>
            <Button variant="ghost" onClick={onClose} className="text-sm">
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

