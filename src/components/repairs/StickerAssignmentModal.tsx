import React, { useState, useEffect } from 'react';
import { X, Tag, AlertTriangle, Check, Search } from 'lucide-react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Select from '../ui/Select';
import { StickerLocation } from '../../types/repair';

interface StickerAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStickerAssign: (sticker: string, location: StickerLocation) => void;
  currentSticker?: string;
  currentLocation?: StickerLocation;
  isLoading?: boolean;
}

const STICKER_LOCATIONS = [
  { value: 'chasis', label: 'Chasis/Carcasa' },
  { value: 'bandeja_sim', label: 'Bandeja SIM' },
  { value: 'bateria', label: 'Batería' },
  { value: 'otro', label: 'Otro lugar' }
];

// Mock de stickers usados - en producción vendría de la base de datos
const USED_STICKERS = ['EMR001', 'EMR002', 'EMR003', 'EMR005', 'EMR010'];

export function StickerAssignmentModal({
  isOpen,
  onClose,
  onStickerAssign,
  currentSticker = '',
  currentLocation = 'chasis',
  isLoading = false
}: StickerAssignmentModalProps) {
  const [stickerNumber, setStickerNumber] = useState(currentSticker);
  const [location, setLocation] = useState<StickerLocation>(currentLocation);
  const [customLocation, setCustomLocation] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    setStickerNumber(currentSticker);
    setLocation(currentLocation);
  }, [currentSticker, currentLocation]);

  useEffect(() => {
    validateSticker(stickerNumber);
  }, [stickerNumber]);

  const validateSticker = (sticker: string) => {
    setValidationError('');
    setIsValid(false);

    if (!sticker.trim()) {
      setValidationError('El número de sticker es obligatorio');
      return;
    }

    if (sticker.length < 3) {
      setValidationError('El número debe tener al menos 3 caracteres');
      return;
    }

    if (USED_STICKERS.includes(sticker.toUpperCase()) && sticker !== currentSticker) {
      setValidationError('Este número de sticker ya está en uso');
      return;
    }

    // Validar formato (ejemplo: EMR001, EMR002, etc.)
    const stickerRegex = /^[A-Z]{3}\d{3,}$/;
    if (!stickerRegex.test(sticker.toUpperCase())) {
      setValidationError('Formato recomendado: 3 letras + 3+ números (ej: EMR001)');
      return;
    }

    setIsValid(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValid || !stickerNumber.trim()) return;

    const finalLocation = location === 'otro' ? 
      (customLocation.trim() || 'otro') as StickerLocation : 
      location;

    onStickerAssign(stickerNumber.toUpperCase(), finalLocation);
  };

  const generateSuggestedSticker = () => {
    const base = 'EMR';
    let counter = 1;
    let suggested = '';
    
    do {
      suggested = `${base}${counter.toString().padStart(3, '0')}`;
      counter++;
    } while (USED_STICKERS.includes(suggested) && counter < 1000);
    
    setStickerNumber(suggested);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Tag size={20} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Asignar Sticker</h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">Identificación única para el equipo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Información importante */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800">Importante</h4>
                <p className="text-sm text-amber-700 mt-1">
                  El sticker debe ser colocado en el equipo antes de marcarlo como entregado. 
                  Asegúrate de que el número sea único y legible.
                </p>
              </div>
            </div>
          </div>

          {/* Número de sticker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Número de Sticker *
            </label>
            <div className="space-y-2">
              <div className="relative">
                <Input
                  value={stickerNumber}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    setStickerNumber(e.target.value.toUpperCase())
                  }
                  placeholder="EMR001"
                  className={`h-12 rounded-xl border-2 font-mono text-lg ${
                    stickerNumber ? 
                      (isValid ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50') : 
                      'border-gray-200 dark:border-slate-600'
                  }`}
                />
                {isValid && (
                  <Check size={20} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-500" />
                )}
              </div>
              
              {validationError && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertTriangle size={14} />
                  {validationError}
                </p>
              )}
              
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={generateSuggestedSticker}
                className="text-blue-600 text-xs"
              >
                <Search size={14} className="mr-1" />
                Generar número sugerido
              </Button>
            </div>
          </div>

          {/* Ubicación del sticker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Ubicación del Sticker *
            </label>
            <Select
              value={location}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                setLocation(e.target.value as StickerLocation)
              }
              className="h-12 rounded-xl border-2 border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 focus:border-purple-500"
            >
              {STICKER_LOCATIONS.map(loc => (
                <option key={loc.value} value={loc.value}>
                  {loc.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Campo personalizado para "otro" */}
          {location === 'otro' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Especificar ubicación
              </label>
              <Input
                value={customLocation}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  setCustomLocation(e.target.value)
                }
                placeholder="Describe dónde se colocó el sticker"
                className="h-12 rounded-xl border-2 border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 focus:border-purple-500"
              />
            </div>
          )}

          {/* Vista previa */}
          {stickerNumber && isValid && (
            <div className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl p-4">
              <h4 className="font-medium text-gray-900 dark:text-slate-100 mb-2">Vista previa</h4>
              <div className="flex items-center gap-3">
                <div className="bg-white dark:bg-slate-900 border-2 border-purple-500 rounded-lg px-3 py-2 font-mono text-sm font-bold text-purple-700 dark:text-purple-400">
                  {stickerNumber}
                </div>
                <div className="text-sm text-gray-600 dark:text-slate-400">
                  Ubicación: {location === 'otro' ? customLocation || 'Otro lugar' : 
                    STICKER_LOCATIONS.find(l => l.value === location)?.label}
                </div>
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isLoading}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isLoading ? 'Asignando...' : 'Asignar Sticker'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
