import React, { useState } from 'react';
import { X, Edit3 } from 'lucide-react';
import { Repair, RepairPriority, RepairStatus } from '../../types/repair';
import Button from '../ui/Button';
import Select from '../ui/Select';

interface EditRepairModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Repair>) => void;
  repair: Repair;
  isLoading?: boolean;
}

const PRIORITY_OPTIONS = [
  { value: 'BAJA', label: 'Baja', color: 'bg-gray-100 text-gray-800' },
  { value: 'MEDIA', label: 'Media', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'ALTA', label: 'Alta', color: 'bg-red-100 text-red-800' }
];

const STATUS_OPTIONS = [
  { value: 'RECIBIDA', label: 'Recibida', color: 'bg-blue-100 text-blue-800' },
  { value: 'EN_PROCESO', label: 'En Proceso', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'ESPERANDO_PIEZA', label: 'Esperando Pieza', color: 'bg-orange-100 text-orange-800' },
  { value: 'COMPLETADA', label: 'Completada', color: 'bg-green-100 text-green-800' },
  { value: 'ENTREGADA', label: 'Entregada', color: 'bg-purple-100 text-purple-800' },
  { value: 'STAND_BY', label: 'Stand By', color: 'bg-gray-100 text-gray-800' }
];

export function EditRepairModal({
  isOpen,
  onClose,
  onSave,
  repair,
  isLoading = false
}: EditRepairModalProps) {
  const [prioridad, setPrioridad] = useState<RepairPriority>(repair.prioridad);
  const [estado, setEstado] = useState<RepairStatus>(repair.estado);
  const [tecnicoAsignado, setTecnicoAsignado] = useState(repair.tecnicoAsignado || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const updates: Partial<Repair> = {
      prioridad,
      estado,
      tecnicoAsignado: tecnicoAsignado.trim() || undefined
    };

    onSave(updates);
  };

  const getPriorityOption = (priority: RepairPriority) => {
    return PRIORITY_OPTIONS.find(opt => opt.value === priority) || PRIORITY_OPTIONS[1];
  };

  const getStatusOption = (status: RepairStatus) => {
    return STATUS_OPTIONS.find(opt => opt.value === status) || STATUS_OPTIONS[0];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="flex items-center justify-between p-6 border-b dark:border-slate-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Edit3 size={20} />
            Editar Reparación {repair.id}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Vista previa de estados */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">Estados disponibles</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {STATUS_OPTIONS.map((option) => (
                <div
                  key={option.value}
                  className={`p-2 rounded-lg text-center text-xs font-medium ${option.color} 
                    ${estado === option.value ? 'ring-2 ring-blue-500' : ''}`}
                >
                  {option.label}
                </div>
              ))}
            </div>
          </div>

          {/* Información del cliente y equipo */}
          <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-2">Información de la reparación</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-slate-400">Cliente:</span>
                <p className="font-medium">{repair.clienteNombre}</p>
                {repair.clienteTelefono && (
                  <p className="text-gray-500 dark:text-slate-400">{repair.clienteTelefono}</p>
                )}
              </div>
              <div>
                <span className="text-gray-600 dark:text-slate-400">Equipo:</span>
                <p className="font-medium">
                  {repair.recepcion.marca} {repair.recepcion.modelo}
                </p>
                <p className="text-gray-500 dark:text-slate-400">{repair.recepcion.tipoEquipo}</p>
              </div>
            </div>
          </div>

          {/* Campos editables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Prioridad */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Prioridad *
              </label>
              <Select
                value={prioridad}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPrioridad(e.target.value as RepairPriority)}
                className="w-full"
              >
                {PRIORITY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <div className="mt-1">
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getPriorityOption(prioridad).color}`}>
                  {getPriorityOption(prioridad).label}
                </span>
              </div>
            </div>

            {/* Estado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Estado *
              </label>
              <Select
                value={estado}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEstado(e.target.value as RepairStatus)}
                className="w-full"
              >
                {STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <div className="mt-1">
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusOption(estado).color}`}>
                  {getStatusOption(estado).label}
                </span>
              </div>
            </div>
          </div>

          {/* Técnico asignado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Técnico asignado
            </label>
            <input
              type="text"
              value={tecnicoAsignado}
              onChange={(e) => setTecnicoAsignado(e.target.value)}
              placeholder="Nombre del técnico..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Información actual */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Estado actual</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-700">Prioridad:</span>
                <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${getPriorityOption(repair.prioridad).color}`}>
                  {getPriorityOption(repair.prioridad).label}
                </span>
              </div>
              <div>
                <span className="text-blue-700">Estado:</span>
                <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${getStatusOption(repair.estado).color}`}>
                  {getStatusOption(repair.estado).label}
                </span>
              </div>
            </div>
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
              disabled={isLoading}
              className="min-w-[120px]"
            >
              {isLoading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}