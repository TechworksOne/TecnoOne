import React, { useState } from 'react';
import { Smartphone, Laptop, Monitor, Printer, Palette, Lock } from 'lucide-react';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { EquipmentType } from '../../types/repair';

interface EquipmentData {
  tipoEquipo: EquipmentType;
  marca?: string;
  modelo?: string;
  color?: string;
  patronContraseña?: string;
  estadoFisico?: string;
  diagnosticoInicial?: string;
}

interface EquipmentSelectorProps {
  equipment: EquipmentData;
  onEquipmentChange: (equipment: EquipmentData) => void;
  className?: string;
}

// Configuración de tipos de equipo
const EQUIPMENT_TYPES = [
  { value: 'Telefono', label: 'Teléfono', icon: Smartphone },
  { value: 'Tablet', label: 'Tablet', icon: Monitor },
  { value: 'Laptop', label: 'Laptop', icon: Laptop },
  { value: 'Computadora', label: 'Computadora', icon: Monitor },
  { value: 'Impresora', label: 'Impresora', icon: Printer },
  { value: 'Otro', label: 'Otro', icon: Monitor }
];

// Marcas por tipo de equipo
const BRANDS_BY_TYPE = {
  Telefono: [
    { value: 'Apple', label: 'Apple' },
    { value: 'Samsung', label: 'Samsung' },
    { value: 'Huawei', label: 'Huawei' },
    { value: 'Xiaomi', label: 'Xiaomi' },
    { value: 'Motorola', label: 'Motorola' },
    { value: 'LG', label: 'LG' },
    { value: 'OnePlus', label: 'OnePlus' },
    { value: 'Otro', label: 'Otro' }
  ],
  Tablet: [
    { value: 'Apple', label: 'Apple (iPad)' },
    { value: 'Samsung', label: 'Samsung Galaxy Tab' },
    { value: 'Huawei', label: 'Huawei MatePad' },
    { value: 'Lenovo', label: 'Lenovo Tab' },
    { value: 'Otro', label: 'Otro' }
  ],
  Laptop: [
    { value: 'Apple', label: 'Apple MacBook' },
    { value: 'Dell', label: 'Dell' },
    { value: 'HP', label: 'HP' },
    { value: 'Lenovo', label: 'Lenovo' },
    { value: 'Asus', label: 'Asus' },
    { value: 'Acer', label: 'Acer' },
    { value: 'MSI', label: 'MSI' },
    { value: 'Otro', label: 'Otro' }
  ]
};

// Modelos específicos por marca
const MODELS_BY_BRAND = {
  Apple: {
    Telefono: [
      'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15',
      'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14',
      'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13', 'iPhone 13 mini',
      'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12', 'iPhone 12 mini',
      'iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11',
      'iPhone XS Max', 'iPhone XS', 'iPhone XR', 'iPhone X',
      'iPhone 8 Plus', 'iPhone 8', 'iPhone 7 Plus', 'iPhone 7',
      'iPhone SE (3ra gen)', 'iPhone SE (2da gen)'
    ],
    Tablet: [
      'iPad Pro 12.9" (6ta gen)', 'iPad Pro 11" (4ta gen)',
      'iPad Air (5ta gen)', 'iPad (10ma gen)', 'iPad mini (6ta gen)'
    ]
  },
  Samsung: {
    Telefono: [
      'Galaxy S24 Ultra', 'Galaxy S24+', 'Galaxy S24',
      'Galaxy S23 Ultra', 'Galaxy S23+', 'Galaxy S23',
      'Galaxy Note 20 Ultra', 'Galaxy Note 20',
      'Galaxy A54', 'Galaxy A34', 'Galaxy A24', 'Galaxy A14',
      'Galaxy Z Fold 5', 'Galaxy Z Flip 5'
    ],
    Tablet: [
      'Galaxy Tab S9 Ultra', 'Galaxy Tab S9+', 'Galaxy Tab S9',
      'Galaxy Tab A9+', 'Galaxy Tab A9'
    ]
  }
};

export function EquipmentSelector({ equipment, onEquipmentChange, className = '' }: EquipmentSelectorProps) {
  const [customBrand, setCustomBrand] = useState('');
  const [customModel, setCustomModel] = useState('');

  const getCurrentIcon = () => {
    const equipmentType = EQUIPMENT_TYPES.find(type => type.value === equipment.tipoEquipo);
    return equipmentType?.icon || Monitor;
  };

  const handleFieldChange = (field: keyof EquipmentData, value: string) => {
    const updatedEquipment = { ...equipment, [field]: value };
    
    // Reset dependent fields when changing type or brand
    if (field === 'tipoEquipo') {
      updatedEquipment.marca = '';
      updatedEquipment.modelo = '';
    } else if (field === 'marca') {
      updatedEquipment.modelo = '';
    }
    
    onEquipmentChange(updatedEquipment);
  };

  const getCurrentBrands = () => {
    if (equipment.tipoEquipo === 'Otro') return [];
    return BRANDS_BY_TYPE[equipment.tipoEquipo as keyof typeof BRANDS_BY_TYPE] || [];
  };

  const getCurrentModels = () => {
    if (!equipment.marca || equipment.marca === 'Otro') return [];
    
    const brandModels = MODELS_BY_BRAND[equipment.marca as keyof typeof MODELS_BY_BRAND];
    if (!brandModels) return [];
    
    return brandModels[equipment.tipoEquipo as keyof typeof brandModels] || [];
  };

  const CurrentIcon = getCurrentIcon();

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 ${className}`}>
      {/* Encabezado de la sección */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
          <CurrentIcon size={20} className="text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Datos del Equipo</h3>
          <p className="text-sm text-gray-500">Especifica el tipo y características del equipo</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Tipo de equipo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Tipo de Equipo *
          </label>
          <Select
            value={equipment.tipoEquipo}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
              handleFieldChange('tipoEquipo', e.target.value as EquipmentType)
            }
            className="h-12 rounded-xl border-2 border-gray-200 focus:border-green-500"
          >
            {EQUIPMENT_TYPES.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Marca (dinámico según tipo) */}
        {equipment.tipoEquipo !== 'Otro' && getCurrentBrands().length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Marca *
            </label>
            <Select
              value={equipment.marca || ''}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                handleFieldChange('marca', e.target.value)
              }
              className="h-12 rounded-xl border-2 border-gray-200 focus:border-green-500"
            >
              <option value="">Seleccionar marca...</option>
              {getCurrentBrands().map(brand => (
                <option key={brand.value} value={brand.value}>
                  {brand.label}
                </option>
              ))}
            </Select>
          </div>
        )}

        {/* Campo personalizado de marca si selecciona "Otro" */}
        {(equipment.marca === 'Otro' || equipment.tipoEquipo === 'Otro') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              {equipment.tipoEquipo === 'Otro' ? 'Tipo personalizado' : 'Marca personalizada'} *
            </label>
            <Input
              value={customBrand}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setCustomBrand(e.target.value);
                handleFieldChange('marca', e.target.value);
              }}
              placeholder={equipment.tipoEquipo === 'Otro' ? 'Especifica el tipo de equipo' : 'Especifica la marca'}
              className="h-12 rounded-xl border-2 border-gray-200 focus:border-green-500"
            />
          </div>
        )}

        {/* Modelo (dinámico según marca) */}
        {equipment.marca && equipment.marca !== 'Otro' && getCurrentModels().length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Modelo *
            </label>
            <Select
              value={equipment.modelo || ''}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                handleFieldChange('modelo', e.target.value)
              }
              className="h-12 rounded-xl border-2 border-gray-200 focus:border-green-500"
            >
              <option value="">Seleccionar modelo...</option>
              {getCurrentModels().map(model => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </Select>
          </div>
        )}

        {/* Campo personalizado de modelo */}
        {equipment.marca && (!getCurrentModels().length || equipment.marca === 'Otro') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Modelo *
            </label>
            <Input
              value={customModel || equipment.modelo || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setCustomModel(e.target.value);
                handleFieldChange('modelo', e.target.value);
              }}
              placeholder="Especifica el modelo exacto"
              className="h-12 rounded-xl border-2 border-gray-200 focus:border-green-500"
            />
          </div>
        )}

        {/* Color y Patrón en la misma fila */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              <Palette size={16} className="inline mr-1" />
              Color
            </label>
            <Input
              value={equipment.color || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                handleFieldChange('color', e.target.value)
              }
              placeholder="Color del equipo"
              className="h-12 rounded-xl border-2 border-gray-200 focus:border-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              <Lock size={16} className="inline mr-1" />
              Patrón/Contraseña
            </label>
            <Input
              value={equipment.patronContraseña || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                handleFieldChange('patronContraseña', e.target.value)
              }
              placeholder="PIN, patrón o contraseña"
              className="h-12 rounded-xl border-2 border-gray-200 focus:border-green-500"
            />
          </div>
        </div>

        {/* Estado físico */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Estado Físico del Equipo
          </label>
          <textarea
            value={equipment.estadoFisico || ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
              handleFieldChange('estadoFisico', e.target.value)
            }
            placeholder="Describe el estado físico del equipo (rayones, golpes, etc.)"
            rows={3}
            className="w-full px-4 py-3 border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-green-500 focus:ring-0 resize-none"
          />
        </div>

        {/* Diagnóstico inicial */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Diagnóstico Inicial
          </label>
          <textarea
            value={equipment.diagnosticoInicial || ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
              handleFieldChange('diagnosticoInicial', e.target.value)
            }
            placeholder="Problema reportado por el cliente o diagnóstico inicial"
            rows={3}
            className="w-full px-4 py-3 border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-green-500 focus:ring-0 resize-none"
          />
        </div>
      </div>
    </div>
  );
}