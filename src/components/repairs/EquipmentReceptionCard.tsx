import React, { useState, useRef } from 'react';
import { Smartphone, Camera, Check, Lock, Palette, Shield, CreditCard, DollarSign, FileText, Upload } from 'lucide-react';
import { EquipmentType } from '../../types/repair';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { useToast } from '../ui/Toast';

interface EquipmentReceptionCardProps {
  reception: any;
  onReceptionChange: (data: any) => void;
  isConfirmed?: boolean;
}

const equipmentTypes = [
  { value: 'Telefono', label: 'Teléfono', icon: '📱' },
  { value: 'Tablet', label: 'Tablet', icon: '📱' },
  { value: 'Laptop', label: 'Laptop', icon: '💻' },
  { value: 'Computadora', label: 'Computadora', icon: '🖥️' },
  { value: 'Impresora', label: 'Impresora', icon: '🖨️' },
  { value: 'Otro', label: 'Otro', icon: '🔧' }
];

const phoneModels = {
  Apple: ['iPhone 11', 'iPhone 12', 'iPhone 13', 'iPhone 14', 'iPhone 15'],
  Samsung: ['Galaxy A54', 'Galaxy S23', 'Galaxy S24', 'Galaxy Z Flip', 'Galaxy Note'],
  Huawei: ['P40', 'P50', 'Mate 40', 'Y9', 'Nova'],
  Xiaomi: ['Redmi Note 12', 'Mi 11', 'Pocophone', 'Redmi 9'],
  Motorola: ['Moto G', 'Edge 30', 'One Fusion']
};

export function EquipmentReceptionCard({ reception, onReceptionChange, isConfirmed }: EquipmentReceptionCardProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const handleInputChange = (field: string, value: any) => {
    if (isConfirmed) return; // Bloquear si ya está confirmado
    
    onReceptionChange({ [field]: value });
  };

  const handleAccessoryChange = (accessory: string, checked: boolean | string) => {
    if (isConfirmed) return;
    
    onReceptionChange({
      accesoriosRecibidos: {
        ...reception.accesoriosRecibidos,
        [accessory]: checked
      }
    });
  };

  const handlePhotoUpload = (files: FileList | null) => {
    if (!files || isConfirmed) return;
    
    // Simular upload de fotos
    const newPhotos = Array.from(files).map(file => URL.createObjectURL(file));
    onReceptionChange({
      fotosRecepcion: [...reception.fotosRecepcion, ...newPhotos]
    });
  };

  const removePhoto = (index: number) => {
    if (isConfirmed) return;
    
    const newPhotos = reception.fotosRecepcion.filter((_: any, i: number) => i !== index);
    onReceptionChange({ fotosRecepcion: newPhotos });
  };

  const confirmReception = () => {
    // Validaciones
    if (!reception.tipoEquipo) {
      toast.error('Debe seleccionar el tipo de equipo');
      return;
    }
    
    if (reception.fotosRecepcion.length < 2) {
      toast.error('Debe cargar al menos 2 fotos del equipo');
      return;
    }
    
    if (!reception.diagnosticoInicial?.trim()) {
      toast.error('Debe escribir un diagnóstico inicial');
      return;
    }
    
    onReceptionChange({
      recepcionConfirmada: true,
      fechaRecepcion: new Date().toISOString(),
      userRecepcion: 'Usuario Actual'
    });
    
    setShowConfirmDialog(false);
  };

  const canConfirm = reception.tipoEquipo && 
                    reception.fotosRecepcion.length >= 2 && 
                    reception.diagnosticoInicial?.trim();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          isConfirmed ? 'bg-green-100' : 'bg-blue-100'
        }`}>
          {isConfirmed ? (
            <Check size={20} className="text-green-600" />
          ) : (
            <Smartphone size={20} className="text-blue-600" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">Recepción del Equipo</h3>
            {isConfirmed && (
              <Badge color="green" className="text-xs flex items-center">
                <Lock size={12} className="mr-1" />
                Confirmada
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {isConfirmed ? 
              'Datos de recepción confirmados (no modificables)' : 
              'Registra los datos del equipo recibido'
            }
          </p>
        </div>
        
        {!isConfirmed && (
          <Button
            onClick={() => setShowConfirmDialog(true)}
            disabled={!canConfirm}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Confirmar Recepción
          </Button>
        )}
      </div>

      {/* Información Básica del Equipo */}
      <Card className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <Smartphone size={16} className="text-blue-600" />
          </div>
          <h4 className="text-lg font-semibold text-gray-900">Información Básica</h4>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Columna izquierda - Tipo y especificaciones */}
          <div className="space-y-4">
            {/* Tipo de equipo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Tipo de Equipo *
              </label>
              <Select
                value={reception.tipoEquipo || ''}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                  handleInputChange('tipoEquipo', e.target.value as EquipmentType)
                }
                disabled={isConfirmed}
                className={`h-12 rounded-xl border-2 ${
                  isConfirmed ? 'bg-gray-50 dark:bg-slate-800 border-gray-200' : 'border-gray-200 focus:border-blue-500'
                }`}
              >
                <option value="">Seleccionar tipo</option>
                {equipmentTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Campos específicos para teléfonos */}
            {reception.tipoEquipo === 'Telefono' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Marca</label>
                  <Select
                    value={reception.marca || ''}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      handleInputChange('marca', e.target.value);
                      handleInputChange('modelo', ''); // Reset modelo
                    }}
                    disabled={isConfirmed}
                    className={`h-11 rounded-lg ${
                      isConfirmed ? 'bg-gray-50' : 'border-gray-200 focus:border-blue-500'
                    }`}
                  >
                    <option value="">Marca</option>
                    {Object.keys(phoneModels).map(marca => (
                      <option key={marca} value={marca}>{marca}</option>
                    ))}
                  </Select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Modelo</label>
                  <Select
                    value={reception.modelo || ''}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                      handleInputChange('modelo', e.target.value)
                    }
                    disabled={isConfirmed || !reception.marca}
                    className={`h-11 rounded-lg ${
                      isConfirmed ? 'bg-gray-50' : 'border-gray-200 focus:border-blue-500'
                    }`}
                  >
                    <option value="">Modelo</option>
                    {reception.marca && phoneModels[reception.marca as keyof typeof phoneModels]?.map(modelo => (
                      <option key={modelo} value={modelo}>{modelo}</option>
                    ))}
                  </Select>
                </div>
              </div>
            )}

            {/* Color y contraseña */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  <Palette size={16} className="inline mr-1" />
                  Color
                </label>
                <Input
                  value={reception.color || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    handleInputChange('color', e.target.value)
                  }
                  placeholder="Ej: Negro, Azul..."
                  disabled={isConfirmed}
                  className={`rounded-lg ${isConfirmed ? 'bg-gray-50' : ''}`}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  <Shield size={16} className="inline mr-1" />
                  Patrón/Contraseña
                </label>
                <Input
                  type="password"
                  value={reception.patronContraseña || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    handleInputChange('patronContraseña', e.target.value)
                  }
                  placeholder="Para desbloqueo"
                  disabled={isConfirmed}
                  className={`rounded-lg ${isConfirmed ? 'bg-gray-50' : ''}`}
                />
              </div>
            </div>

            {/* Estado físico */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Estado Físico del Equipo
              </label>
              <textarea
                value={reception.estadoFisico || ''}
                onChange={(e) => handleInputChange('estadoFisico', e.target.value)}
                placeholder="Describe el estado físico del equipo (rayones, golpes, etc.)"
                rows={3}
                disabled={isConfirmed}
                className={`w-full px-3 py-2 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  isConfirmed ? 'bg-gray-50 dark:bg-slate-800 border-gray-200' : 'border-gray-300'
                }`}
              />
            </div>
          </div>

          {/* Columna derecha - Accesorios */}
          <div className="space-y-4">
            {/* Accesorios recibidos */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Accesorios Recibidos
              </label>
              <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'chip', label: 'Chip/SIM' },
                    { key: 'estuche', label: 'Estuche' },
                    { key: 'memoriaSD', label: 'Memoria SD' },
                    { key: 'cargador', label: 'Cargador' }
                  ].map(accessory => (
                    <label key={accessory.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reception.accesoriosRecibidos?.[accessory.key] || false}
                        onChange={(e) => handleAccessoryChange(accessory.key, e.target.checked)}
                        disabled={isConfirmed}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{accessory.label}</span>
                    </label>
                  ))}
                </div>
                
                <div>
                  <Input
                    placeholder="Otros accesorios..."
                    value={reception.accesoriosRecibidos?.otros || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                      handleAccessoryChange('otros', e.target.value)
                    }
                    disabled={isConfirmed}
                    className={`text-sm rounded-lg ${isConfirmed ? 'bg-gray-100' : 'bg-white'}`}
                  />
                </div>
              </div>
            </div>

            {/* Diagnóstico inicial */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Diagnóstico Inicial *
              </label>
              <textarea
                value={reception.diagnosticoInicial || ''}
                onChange={(e) => handleInputChange('diagnosticoInicial', e.target.value)}
                placeholder="Describe el problema reportado por el cliente..."
                rows={4}
                disabled={isConfirmed}
                className={`w-full px-3 py-2 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  isConfirmed ? 'bg-gray-50 dark:bg-slate-800 border-gray-200' : 'border-gray-300'
                }`}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Sección de Anticipo */}
      <Card className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
            <DollarSign size={16} className="text-emerald-600" />
          </div>
          <h4 className="text-lg font-semibold text-gray-900">Anticipo</h4>
          <span className="text-sm text-gray-500">(Opcional)</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monto del anticipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Monto del Anticipo
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">Q</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={reception.montoAnticipo || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  handleInputChange('montoAnticipo', parseFloat(e.target.value) || 0)
                }
                placeholder="0.00"
                disabled={isConfirmed}
                className={`pl-8 rounded-lg ${isConfirmed ? 'bg-gray-50' : ''}`}
              />
            </div>
          </div>

          {/* Método de anticipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Método de Anticipo
            </label>
            <div className="space-y-3">
              {/* Efectivo */}
              <div 
                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  reception.metodoAnticipo === 'efectivo' 
                    ? 'border-emerald-500 bg-emerald-50' 
                    : 'border-gray-200 hover:border-gray-300'
                } ${isConfirmed ? 'cursor-not-allowed opacity-50' : ''}`}
                onClick={() => !isConfirmed && handleInputChange('metodoAnticipo', 'efectivo')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <DollarSign size={16} className="text-emerald-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Efectivo</div>
                      <div className="text-sm text-gray-500">Pago inmediato en efectivo</div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    reception.metodoAnticipo === 'efectivo' 
                      ? 'border-emerald-500 bg-emerald-500' 
                      : 'border-gray-300'
                  }`}>
                    {reception.metodoAnticipo === 'efectivo' && (
                      <Check size={12} className="text-white" />
                    )}
                  </div>
                </div>
              </div>

              {/* Transferencia */}
              <div 
                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  reception.metodoAnticipo === 'transferencia' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                } ${isConfirmed ? 'cursor-not-allowed opacity-50' : ''}`}
                onClick={() => !isConfirmed && handleInputChange('metodoAnticipo', 'transferencia')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <CreditCard size={16} className="text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Transferencia Bancaria</div>
                      <div className="text-sm text-gray-500">Requiere comprobante de transferencia</div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    reception.metodoAnticipo === 'transferencia' 
                      ? 'border-blue-500 bg-blue-500' 
                      : 'border-gray-300'
                  }`}>
                    {reception.metodoAnticipo === 'transferencia' && (
                      <Check size={12} className="text-white" />
                    )}
                  </div>
                </div>
              </div>

              {/* Campo de comprobante para transferencia */}
              {reception.metodoAnticipo === 'transferencia' && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    <FileText size={16} className="inline mr-1" />
                    Comprobante de Transferencia
                  </label>
                  <Input
                    value={reception.comprobanteTransferencia || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                      handleInputChange('comprobanteTransferencia', e.target.value)
                    }
                    placeholder="Número de referencia o código de operación"
                    disabled={isConfirmed}
                    className={`rounded-lg ${isConfirmed ? 'bg-gray-50' : ''}`}
                  />
                </div>
              )}

              {/* Tarjeta BAC */}
              <div 
                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  reception.metodoAnticipo === 'tarjeta_bac' 
                    ? 'border-blue-600 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                } ${isConfirmed ? 'cursor-not-allowed opacity-50' : ''}`}
                onClick={() => !isConfirmed && handleInputChange('metodoAnticipo', 'tarjeta_bac')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <CreditCard size={16} className="text-blue-700" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Tarjeta BAC</div>
                      <div className="text-sm text-gray-500">POS BAC · Banco BAC</div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    reception.metodoAnticipo === 'tarjeta_bac' 
                      ? 'border-blue-600 bg-blue-600' 
                      : 'border-gray-300'
                  }`}>
                    {reception.metodoAnticipo === 'tarjeta_bac' && (
                      <Check size={12} className="text-white" />
                    )}
                  </div>
                </div>
              </div>

              {/* Tarjeta Neonet */}
              <div 
                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  reception.metodoAnticipo === 'tarjeta_neonet' 
                    ? 'border-cyan-600 bg-cyan-50' 
                    : 'border-gray-200 hover:border-gray-300'
                } ${isConfirmed ? 'cursor-not-allowed opacity-50' : ''}`}
                onClick={() => !isConfirmed && handleInputChange('metodoAnticipo', 'tarjeta_neonet')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center">
                      <CreditCard size={16} className="text-cyan-700" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Tarjeta Neonet</div>
                      <div className="text-sm text-gray-500">POS NEONET · Banco Industrial</div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    reception.metodoAnticipo === 'tarjeta_neonet' 
                      ? 'border-cyan-600 bg-cyan-600' 
                      : 'border-gray-300'
                  }`}>
                    {reception.metodoAnticipo === 'tarjeta_neonet' && (
                      <Check size={12} className="text-white" />
                    )}
                  </div>
                </div>
              </div>

              {/* Campo de referencia para tarjetas */}
              {(reception.metodoAnticipo === 'tarjeta_bac' || reception.metodoAnticipo === 'tarjeta_neonet') && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    <FileText size={16} className="inline mr-1" />
                    Últimos 4 dígitos / No. Autorización
                  </label>
                  <Input
                    value={reception.comprobanteTransferencia || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                      handleInputChange('comprobanteTransferencia', e.target.value)
                    }
                    placeholder="Ej: 1234"
                    disabled={isConfirmed}
                    className={`rounded-lg ${isConfirmed ? 'bg-gray-50' : ''}`}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Fotos de Recepción */}
      <Card className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
            <Camera size={16} className="text-purple-600" />
          </div>
          <h4 className="text-lg font-semibold text-gray-900">Fotos de Recepción</h4>
          <Badge color="red" className="text-xs">* Requerido (mínimo 2)</Badge>
        </div>

        {!isConfirmed && (
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 transition-colors mb-4">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => { handlePhotoUpload(e.target.files); e.currentTarget.value = ''; }}
              className="sr-only"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => { handlePhotoUpload(e.target.files); e.currentTarget.value = ''; }}
              className="sr-only"
            />
            <Camera size={40} className="mx-auto text-gray-400 mb-3" />
            <p className="text-sm text-gray-400 mb-3">JPG, PNG hasta 5MB cada una</p>
            <div className="flex gap-2 justify-center flex-wrap">
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
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                <Upload size={16} />
                Elegir galería
              </button>
            </div>
          </div>
        )}
        
        {reception.fotosRecepcion.length > 0 && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
              {reception.fotosRecepcion.map((foto: string, index: number) => (
                <div key={index} className="relative group">
                  <img
                    src={foto}
                    alt={`Foto ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg border shadow-sm"
                  />
                  {!isConfirmed && (
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600 dark:text-slate-400">Fotos subidas: {reception.fotosRecepcion.length}</span>
              <span className={`font-medium ${reception.fotosRecepcion.length >= 2 ? 'text-green-600' : 'text-red-500'}`}>
                {reception.fotosRecepcion.length >= 2 ? '✓ Mínimo cumplido' : '⚠ Faltan fotos'}
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Dialog de confirmación */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md mx-4">
            <div className="text-center">
              <Shield size={48} className="text-orange-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                ¿Confirmar Recepción?
              </h3>
              <p className="text-gray-600 dark:text-slate-400 mb-4">
                Una vez confirmada, los datos de recepción no podrán modificarse.
                Asegúrate de que toda la información esté correcta.
              </p>
              
              <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-3 mb-4 text-left text-sm">
                <div className="font-medium text-gray-700 dark:text-slate-300 mb-1">Resumen:</div>
                <div>• {equipmentTypes.find(t => t.value === reception.tipoEquipo)?.label}</div>
                {reception.marca && <div>• {reception.marca} {reception.modelo}</div>}
                <div>• {reception.fotosRecepcion.length} fotos</div>
                <div>• Diagnóstico: {reception.diagnosticoInicial?.substring(0, 50)}...</div>
                {reception.montoAnticipo && (
                  <div>• Anticipo: Q{reception.montoAnticipo.toFixed(2)} ({reception.metodoAnticipo})</div>
                )}
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmReception}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}