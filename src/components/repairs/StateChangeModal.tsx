import React, { useState, useRef } from 'react';
import { X, Upload, Camera, AlertTriangle, Package } from 'lucide-react';
import { RepairStatus, SubStage, StateChangeRequest } from '../../types/repair';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';

interface StateChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (stateChange: StateChangeRequest) => void;
  currentState: RepairStatus;
  currentSubStage?: SubStage;
  isLoading?: boolean;
  anticipoOriginal?: number; // Anticipo original para mostrar cálculos
  saldoAnticipo?: number; // Saldo actual del anticipo
  validateStickerUniqueness?: (sticker: string) => boolean; // Función para validar unicidad del sticker
}

const STATE_OPTIONS = [
  { value: 'RECIBIDA', label: 'Recibida' },
  { value: 'EN_PROCESO', label: 'En Proceso' },
  { value: 'ESPERANDO_PIEZA', label: 'Esperando Pieza' },
  { value: 'COMPLETADA', label: 'Completada' },
  { value: 'ENTREGADA', label: 'Entregada' },
  { value: 'CANCELADA', label: 'Cancelada' }
];

const SUBSTAGE_OPTIONS = [
  { value: 'DIAGNOSTICO', label: 'Diagnóstico' },
  { value: 'DESARMADO', label: 'Desarmado' },
  { value: 'REPARACION', label: 'Reparación' },
  { value: 'ARMADO', label: 'Armado' },
  { value: 'PRUEBAS', label: 'Pruebas' },
  { value: 'CALIBRACION', label: 'Calibración' }
];

export function StateChangeModal({
  isOpen,
  onClose,
  onConfirm,
  currentState,
  currentSubStage,
  isLoading = false,
  anticipoOriginal = 0,
  saldoAnticipo = 0,
  validateStickerUniqueness
}: StateChangeModalProps) {
  const [newState, setNewState] = useState<RepairStatus>(currentState);
  const [newSubStage, setNewSubStage] = useState<SubStage | undefined>(currentSubStage);
  const [nota, setNota] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  const [piezaNecesaria, setPiezaNecesaria] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [costoRepuesto, setCostoRepuesto] = useState<number>(0);
  const [stickerNumero, setStickerNumero] = useState('');
  const [stickerUbicacion, setStickerUbicacion] = useState<'chasis' | 'bandeja_sim' | 'bateria' | 'otro'>('chasis');
  const [diferenciaReparacion, setDiferenciaReparacion] = useState<number>(0);
  const [showUpload, setShowUpload] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const isWaitingForPart = newState === 'ESPERANDO_PIEZA';
  const isCompleted = newState === 'COMPLETADA';
  const isDelivered = newState === 'ENTREGADA';

  // Calcular el nuevo saldo del anticipo si hay costo de repuesto
  const nuevoSaldoAnticipo = isWaitingForPart ? saldoAnticipo - costoRepuesto : saldoAnticipo;

  // Calcular el saldo final para entrega: Saldo actual + Diferencia de reparación
  const costoTotalRepuestos = anticipoOriginal - (saldoAnticipo || anticipoOriginal); // Total gastado en repuestos
  const saldoFinalConDiferencia = isDelivered ? (saldoAnticipo || 0) + diferenciaReparacion : 0;
  const montoACobrarEntregar = isDelivered ? Math.max(0, -saldoFinalConDiferencia) : 0; // Solo cobramos si el saldo final es negativo
  const saldoAFavorCliente = isDelivered && saldoFinalConDiferencia > 0 ? saldoFinalConDiferencia : 0;

  // Validar unicidad del sticker
  const isStickerValid = !isCompleted || !stickerNumero || !validateStickerUniqueness || validateStickerUniqueness(stickerNumero);

  const canChangeState = nota.trim() !== '' && 
    (!isWaitingForPart || piezaNecesaria.trim() !== '') &&
    (!isDelivered || (fotos.length > 0 && diferenciaReparacion >= 0)) &&
    (!isCompleted || (stickerNumero.trim() !== '' && isStickerValid));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canChangeState) return;

    const stateChange: StateChangeRequest = {
      estado: newState,
      subEtapa: newSubStage,
      nota: nota.trim(),
      fotos,
      piezaNecesaria: piezaNecesaria.trim() || undefined,
      proveedor: proveedor.trim() || undefined,
      costoRepuesto: isWaitingForPart && costoRepuesto > 0 ? costoRepuesto : undefined,
      stickerNumero: isCompleted && stickerNumero.trim() ? stickerNumero.trim() : undefined,
      stickerUbicacion: isCompleted && stickerNumero.trim() ? stickerUbicacion : undefined,
      diferenciaReparacion: isDelivered ? diferenciaReparacion : undefined
    };

    onConfirm(stateChange);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
    e.target.value = '';
    if (files.length === 0) return;
    const fileUrls = files.map(file => URL.createObjectURL(file));
    setFotos(prev => [...prev, ...fileUrls]);
  };

  const removePhoto = (index: number) => {
    setFotos(prev => prev.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
            Cambiar Estado de Reparación
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Estado y Sub-etapa */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Nuevo Estado *
              </label>
              <Select
                value={newState}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewState(e.target.value as RepairStatus)}
                className="w-full"
              >
                {STATE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            {newState === 'EN_PROCESO' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Sub-etapa
                </label>
                <Select
                  value={newSubStage || ''}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewSubStage(e.target.value as SubStage)}
                  className="w-full"
                >
                  <option value="">Seleccionar sub-etapa...</option>
                  {SUBSTAGE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          {/* Nota obligatoria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Nota del cambio *
            </label>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              rows={3}
              placeholder="Describe el motivo del cambio de estado..."
              required
            />
          </div>

          {/* Campos específicos para "Esperando Pieza" */}
          {isWaitingForPart && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 text-yellow-800">
                <Package size={16} />
                <span className="font-medium">Información de la pieza</span>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Pieza necesaria *
                </label>
                <Input
                  value={piezaNecesaria}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPiezaNecesaria(e.target.value)}
                  placeholder="Ej: Pantalla iPhone 12, Batería Samsung S21..."
                  required={isWaitingForPart}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Proveedor sugerido
                </label>
                <Input
                  value={proveedor}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProveedor(e.target.value)}
                  placeholder="Nombre del proveedor o distribuidor..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Costo del repuesto
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={costoRepuesto}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCostoRepuesto(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
                
                {/* Información del anticipo y cálculo */}
                <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Anticipo original:</span>
                      <span className="font-medium text-blue-900">Q{anticipoOriginal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Saldo actual:</span>
                      <span className="font-medium text-blue-900">Q{saldoAnticipo.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Costo repuesto:</span>
                      <span className="font-medium text-blue-900">-Q{costoRepuesto.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-blue-200 pt-1 mt-2">
                      <div className="flex justify-between">
                        <span className="text-blue-800 font-medium">Nuevo saldo:</span>
                        <span className={`font-bold ${nuevoSaldoAnticipo >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          Q{nuevoSaldoAnticipo.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {nuevoSaldoAnticipo < 0 && (
                    <div className="mt-2 p-2 bg-orange-100 border border-orange-200 rounded text-orange-800">
                      <p className="text-xs">
                        ⚠️ El costo excede el anticipo. Se cobrará la diferencia al entregar.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Campos específicos para "Completada" - Sticker */}
          {isCompleted && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 text-green-800">
                <Package size={16} />
                <span className="font-medium">Sticker de identificación</span>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Número de serie del sticker *
                </label>
                <Input
                  value={stickerNumero}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStickerNumero(e.target.value)}
                  placeholder="Ej: EMR001, STK-2024-001..."
                  required={isCompleted}
                  className={`font-mono ${!isStickerValid ? 'border-red-500 focus:ring-red-500' : ''}`}
                />
                {!isStickerValid && stickerNumero && (
                  <p className="text-xs text-red-600 mt-1">
                    ⚠️ Este número de sticker ya está en uso
                  </p>
                )}
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  Este número debe ser único para cada equipo
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Ubicación del sticker
                </label>
                <Select
                  value={stickerUbicacion}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStickerUbicacion(e.target.value as any)}
                  className="w-full"
                >
                  <option value="chasis">Chasis/Carcasa</option>
                  <option value="bandeja_sim">Bandeja SIM</option>
                  <option value="bateria">Batería</option>
                  <option value="otro">Otro lugar</option>
                </Select>
              </div>

              <div className="bg-green-100 rounded p-3">
                <p className="text-sm text-green-800">
                  <strong>Resumen del sticker:</strong><br />
                  Número: <span className="font-mono">{stickerNumero || 'Pendiente'}</span><br />
                  Ubicación: {stickerUbicacion === 'chasis' ? 'Chasis/Carcasa' : 
                            stickerUbicacion === 'bandeja_sim' ? 'Bandeja SIM' :
                            stickerUbicacion === 'bateria' ? 'Batería' : 'Otro lugar'}
                </p>
              </div>
            </div>
          )}

          {/* Campos específicos para "Entregada" - Cálculo de diferencia */}
          {isDelivered && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 text-blue-800">
                <AlertTriangle size={16} />
                <span className="font-medium">Cálculo final de la reparación</span>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Diferencia de la reparación
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={diferenciaReparacion}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDiferenciaReparacion(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  Monto adicional por servicios o repuestos no cubiertos por el anticipo
                </p>
              </div>

              {/* Resumen de cálculos */}
              <div className="bg-blue-100 rounded p-3">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Anticipo original:</span>
                    <span className="font-medium text-blue-900">Q{anticipoOriginal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Gastos en repuestos:</span>
                    <span className="font-medium text-blue-900">-Q{costoTotalRepuestos.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-blue-200 pt-1">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Saldo actual:</span>
                      <span className={`font-medium ${(saldoAnticipo || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        Q{(saldoAnticipo || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Diferencia reparación:</span>
                    <span className="font-medium text-blue-900">+Q{diferenciaReparacion.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-blue-200 pt-1 mt-2">
                    <div className="flex justify-between">
                      <span className="text-blue-800 font-bold">Saldo final:</span>
                      <span className={`font-bold ${saldoFinalConDiferencia >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        Q{saldoFinalConDiferencia.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {saldoAFavorCliente > 0 && (
                  <div className="mt-2 p-2 bg-green-100 border border-green-200 rounded text-green-800">
                    <p className="text-xs">
                      ✅ Saldo a favor del cliente: Q{saldoAFavorCliente.toFixed(2)}
                    </p>
                  </div>
                )}
                
                {montoACobrarEntregar > 0 && (
                  <div className="mt-2 p-2 bg-orange-100 border border-orange-200 rounded text-orange-800">
                    <p className="text-xs">
                      💰 Cobrar adicional al cliente: Q{montoACobrarEntregar.toFixed(2)}
                    </p>
                  </div>
                )}

                {saldoFinalConDiferencia === 0 && (
                  <div className="mt-2 p-2 bg-blue-100 border border-blue-200 rounded text-blue-800">
                    <p className="text-xs">
                      ⚖️ Cuenta saldada - Sin montos pendientes
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-red-50 border border-red-200 rounded p-3">
                <div className="flex items-center gap-2 text-red-800 mb-2">
                  <AlertTriangle size={16} />
                  <span className="font-medium text-sm">Requisito para entrega</span>
                </div>
                <p className="text-xs text-red-700">
                  Es obligatorio adjuntar fotos finales del equipo y calcular la diferencia final.
                </p>
              </div>
            </div>
          )}

          {/* Fotos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                Fotos {isDelivered && '*'}
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowUpload(!showUpload)}
                className="text-blue-600"
              >
                <Camera size={16} className="mr-1" />
                Agregar fotos
              </Button>
            </div>

            {showUpload && (
              <div className="mb-4">
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Camera size={16} />
                    Tomar foto
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Upload size={16} />
                    Elegir galería
                  </button>
                </div>
              </div>
            )}

            {fotos.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {fotos.map((foto, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={foto}
                      alt={`Foto ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!canChangeState || isLoading}
              className="min-w-[120px]"
            >
              {isLoading ? 'Guardando...' : 'Confirmar Cambio'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
