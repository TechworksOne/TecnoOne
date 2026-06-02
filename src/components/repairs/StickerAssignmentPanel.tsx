import React, { useState, useEffect } from 'react';
import { Tag, Search, MapPin, AlertCircle, CheckCircle, X } from 'lucide-react';
import { StickerLocation } from '../../types/repair';
import { useStickers, Sticker } from '../../hooks/useStickers';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { useToast } from '../ui/Toast';

interface StickerAssignmentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onStickerAssigned: (stickerNumero: string, ubicacion: StickerLocation) => void;
  repairId: string;
  clienteNombre: string;
  equipoInfo: string;
}

const ubicaciones: { value: StickerLocation; label: string; description: string }[] = [
  { value: 'chasis', label: 'Chasis Principal', description: 'En la carcasa principal del equipo' },
  { value: 'bandeja_sim', label: 'Bandeja SIM', description: 'En la bandeja de la tarjeta SIM' },
  { value: 'bateria', label: 'Batería', description: 'En la batería del dispositivo' },
  { value: 'otro', label: 'Otra Ubicación', description: 'Ubicación personalizada' }
];

export function StickerAssignmentPanel({ 
  isOpen, 
  onClose, 
  onStickerAssigned, 
  repairId, 
  clienteNombre, 
  equipoInfo 
}: StickerAssignmentPanelProps) {
  const { verificarSticker, asignarSticker, buscarStickers } = useStickers();
  const toast = useToast();
  const [stickerNumero, setStickerNumero] = useState('');
  const [ubicacion, setUbicacion] = useState<StickerLocation>('chasis');
  const [ubicacionCustom, setUbicacionCustom] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [asignando, setAsignando] = useState(false);
  const [stickerValido, setStickerValido] = useState<boolean | null>(null);
  const [mensajeVerificacion, setMensajeVerificacion] = useState('');
  const [sugerencias, setSugerencias] = useState<Sticker[]>([]);

  useEffect(() => {
    if (!isOpen) {
      // Reset al cerrar
      setStickerNumero('');
      setUbicacion('chasis');
      setUbicacionCustom('');
      setStickerValido(null);
      setMensajeVerificacion('');
      setSugerencias([]);
    }
  }, [isOpen]);

  const handleStickerChange = async (numero: string) => {
    setStickerNumero(numero);
    
    if (numero.length < 3) {
      setStickerValido(null);
      setMensajeVerificacion('');
      setSugerencias([]);
      return;
    }

    // Buscar sugerencias
    const sugerenciasResult = await buscarStickers(numero);
    setSugerencias(sugerenciasResult);

    // Verificar si es exacto
    if (numero.length >= 4) {
      setVerificando(true);
      try {
        const disponible = await verificarSticker(numero);
        setStickerValido(disponible);
        setMensajeVerificacion(disponible ? 'Sticker disponible' : 'Sticker ya está en uso');
      } catch (error) {
        setStickerValido(false);
        setMensajeVerificacion('Error al verificar el sticker');
      } finally {
        setVerificando(false);
      }
    }
  };

  const handleAsignar = async () => {
    if (!stickerValido || !stickerNumero) return;

    setAsignando(true);
    try {
      const ubicacionFinal = ubicacion === 'otro' ? ubicacionCustom : ubicacion;
      
      await asignarSticker(stickerNumero, ubicacionFinal);

      onStickerAssigned(stickerNumero, ubicacion);
      onClose();
    } catch (error) {
      toast.error('Error al asignar el sticker. Inténtalo de nuevo.');
    } finally {
      setAsignando(false);
    }
  };

  const seleccionarSugerencia = (sticker: Sticker) => {
    handleStickerChange(sticker.numero);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg mx-4 w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
                <Tag size={20} className="text-yellow-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Asignar Sticker</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">Reparación completada</p>
              </div>
            </div>
            <Button variant="ghost" onClick={onClose} className="p-2">
              <X size={20} />
            </Button>
          </div>

          {/* Información de la reparación */}
          <div className="bg-blue-50 rounded-xl p-4 mb-6">
            <h4 className="font-medium text-blue-900 mb-2">Información de la Reparación</h4>
            <div className="space-y-1 text-sm text-blue-800">
              <div><strong>Cliente:</strong> {clienteNombre}</div>
              <div><strong>Equipo:</strong> {equipoInfo}</div>
              <div><strong>ID:</strong> {repairId}</div>
            </div>
          </div>

          {/* Búsqueda de sticker */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Número de Sticker *
              </label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  value={stickerNumero}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleStickerChange(e.target.value)}
                  placeholder="Ej: ST001, STK-2024-001..."
                  className={`pl-10 ${
                    stickerValido === true ? 'border-green-500 bg-green-50' :
                    stickerValido === false ? 'border-red-500 bg-red-50' : ''
                  }`}
                  autoFocus
                />
                
                {verificando && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  </div>
                )}
                
                {stickerValido === true && (
                  <CheckCircle size={16} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600" />
                )}
                
                {stickerValido === false && (
                  <AlertCircle size={16} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-red-600" />
                )}
              </div>
              
              {mensajeVerificacion && (
                <p className={`text-sm mt-2 ${stickerValido ? 'text-green-600' : 'text-red-600'}`}>
                  {mensajeVerificacion}
                </p>
              )}
            </div>

            {/* Sugerencias */}
            {sugerencias.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Sugerencias Disponibles
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {sugerencias.map((sugerencia, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      onClick={() => seleccionarSugerencia(sugerencia)}
                      className={`w-full justify-start text-left p-2 border border-gray-200 dark:border-slate-600 hover:border-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-950/30 ${
                        sugerencia.usado ? 'opacity-50' : ''
                      }`}
                      disabled={sugerencia.usado}
                    >
                      <Tag size={14} className={`mr-2 ${sugerencia.usado ? 'text-gray-400' : 'text-yellow-600'}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span>{sugerencia.numero}</span>
                          {sugerencia.usado && (
                            <Badge color="red" className="text-xs">Usado</Badge>
                          )}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Ubicación del sticker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                <MapPin size={16} className="inline mr-1" />
                Ubicación del Sticker *
              </label>
              <Select
                value={ubicacion}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setUbicacion(e.target.value as StickerLocation)}
                className="w-full"
              >
                {ubicaciones.map(ub => (
                  <option key={ub.value} value={ub.value}>
                    {ub.label} - {ub.description}
                  </option>
                ))}
              </Select>
            </div>

            {/* Ubicación personalizada */}
            {ubicacion === 'otro' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Ubicación Personalizada *
                </label>
                <Input
                  value={ubicacionCustom}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUbicacionCustom(e.target.value)}
                  placeholder="Describe dónde se colocó el sticker..."
                  className="w-full"
                />
              </div>
            )}

            {/* Información adicional */}
            <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-gray-600 dark:text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-gray-700 dark:text-slate-300">
                  <p className="font-medium mb-1">Información Importante:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• El sticker se asigna automáticamente al completar la reparación</li>
                    <li>• Una vez asignado, no podrá modificarse</li>
                    <li>• Asegúrate de colocar el sticker físico en la ubicación indicada</li>
                    <li>• El número será visible en el resumen de la reparación</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-3 mt-6">
            <Button 
              variant="ghost" 
              onClick={onClose} 
              className="flex-1"
              disabled={asignando}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAsignar}
              disabled={!stickerValido || asignando || (ubicacion === 'otro' && !ubicacionCustom.trim())}
              className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              {asignando ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Asignando...
                </div>
              ) : (
                <>
                  <Tag size={16} className="mr-2" />
                  Asignar Sticker
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
