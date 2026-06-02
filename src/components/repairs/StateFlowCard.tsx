import React, { useState } from 'react';
import { Clock, MessageSquare, User, Calendar, CheckCircle, Pause, AlertCircle, Play } from 'lucide-react';
import { RepairStatus, StateHistoryEntry } from '../../types/repair';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Badge from '../ui/Badge';

interface StateFlowCardProps {
  currentState: RepairStatus;
  historialEstados: StateHistoryEntry[];
  onStateChange: (newState: RepairStatus, notas?: string) => void;
  canProgress?: boolean;
}

const ESTADOS: { [key in RepairStatus]: { label: string; color: string; icon: typeof CheckCircle; bgColor: string; description: string } } = {
  RECIBIDA: { 
    label: 'Recibida', 
    color: 'blue', 
    icon: CheckCircle, 
    bgColor: 'bg-blue-50',
    description: 'Equipo recibido y registrado'
  },
  EN_DIAGNOSTICO: { 
    label: 'En Diagnóstico', 
    color: 'yellow', 
    icon: AlertCircle, 
    bgColor: 'bg-yellow-50',
    description: 'Analizando el problema'
  },
  ESPERANDO_AUTORIZACION: { 
    label: 'Esperando Autorización', 
    color: 'purple', 
    icon: Clock, 
    bgColor: 'bg-purple-50',
    description: 'Pendiente de aprobación del cliente'
  },
  AUTORIZADA: { 
    label: 'Autorizada', 
    color: 'green', 
    icon: CheckCircle, 
    bgColor: 'bg-green-50',
    description: 'Reparación aprobada'
  },
  EN_REPARACION: { 
    label: 'En Reparación', 
    color: 'blue', 
    icon: Play, 
    bgColor: 'bg-blue-50',
    description: 'Trabajando en la reparación'
  },
  EN_PROCESO: { 
    label: 'En Proceso', 
    color: 'blue', 
    icon: Play, 
    bgColor: 'bg-blue-50',
    description: 'Trabajando en la reparación'
  },
  ESPERANDO_PIEZA: { 
    label: 'Esperando Pieza', 
    color: 'orange', 
    icon: Clock, 
    bgColor: 'bg-orange-50',
    description: 'Esperando componentes'
  },
  STAND_BY: { 
    label: 'Stand By / Espera', 
    color: 'gray', 
    icon: Pause, 
    bgColor: 'bg-gray-50',
    description: 'Pausada temporalmente'
  },
  COMPLETADA: { 
    label: 'Completada', 
    color: 'green', 
    icon: CheckCircle, 
    bgColor: 'bg-green-50',
    description: 'Reparación finalizada'
  },
  ENTREGADA: { 
    label: 'Entregada', 
    color: 'green', 
    icon: CheckCircle, 
    bgColor: 'bg-green-50',
    description: 'Equipo entregado al cliente'
  },
  CANCELADA: { 
    label: 'Cancelada', 
    color: 'red', 
    icon: AlertCircle, 
    bgColor: 'bg-red-50',
    description: 'Reparación cancelada'
  }
};

const FLUJO_ESTADOS: { [key in RepairStatus]: RepairStatus[] } = {
  RECIBIDA: ['EN_DIAGNOSTICO'],
  EN_DIAGNOSTICO: ['ESPERANDO_AUTORIZACION', 'STAND_BY'],
  ESPERANDO_AUTORIZACION: ['AUTORIZADA', 'STAND_BY'],
  AUTORIZADA: ['EN_REPARACION'],
  EN_REPARACION: ['COMPLETADA', 'STAND_BY'],
  EN_PROCESO: ['COMPLETADA', 'STAND_BY'],
  ESPERANDO_PIEZA: ['EN_REPARACION', 'STAND_BY'],
  STAND_BY: ['EN_DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_AUTORIZACION'],
  COMPLETADA: ['ENTREGADA'],
  ENTREGADA: [],
  CANCELADA: []
};

export function StateFlowCard({ currentState, historialEstados, onStateChange, canProgress = true }: StateFlowCardProps) {
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedNextState, setSelectedNextState] = useState<RepairStatus | null>(null);
  const [nota, setNota] = useState('');

  const possibleNextStates = FLUJO_ESTADOS[currentState] || [];
  const currentStateInfo = ESTADOS[currentState];

  const handleStateChangeClick = (newState: RepairStatus) => {
    setSelectedNextState(newState);
    setNota('');
    setShowNoteModal(true);
  };

  const confirmStateChange = () => {
    if (selectedNextState) {
      onStateChange(selectedNextState, nota.trim() || undefined);
      setShowNoteModal(false);
      setSelectedNextState(null);
      setNota('');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTiempoEnEstado = () => {
    const ultimoCambio = historialEstados[historialEstados.length - 1];
    if (!ultimoCambio) return '';
    
    const ahora = new Date();
    const fechaCambio = new Date(ultimoCambio.timestamp);
    const diffHoras = Math.floor((ahora.getTime() - fechaCambio.getTime()) / (1000 * 60 * 60));
    
    if (diffHoras < 1) return 'Hace menos de 1 hora';
    if (diffHoras < 24) return `Hace ${diffHoras} horas`;
    
    const diffDias = Math.floor(diffHoras / 24);
    return `Hace ${diffDias} día${diffDias > 1 ? 's' : ''}`;
  };

  return (
    <Card className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${currentStateInfo.bgColor}`}>
          <currentStateInfo.icon size={20} className={`text-${currentStateInfo.color}-600`} />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">Estado del Proceso</h3>
          <p className="text-sm text-gray-500">Seguimiento del flujo de reparación</p>
        </div>
        <Badge color={currentStateInfo.color} className="text-sm font-medium">
          {currentStateInfo.label}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Estado actual */}
        <div className="space-y-4">
          <div className={`${currentStateInfo.bgColor} rounded-xl p-4 border-2 border-${currentStateInfo.color}-200`}>
            <div className="flex items-center gap-3 mb-2">
              <currentStateInfo.icon size={24} className={`text-${currentStateInfo.color}-600`} />
              <div>
                <h4 className="font-semibold text-gray-900">{currentStateInfo.label}</h4>
                <p className="text-sm text-gray-600">{currentStateInfo.description}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-3">
              <Clock size={14} />
              <span>{getTiempoEnEstado()}</span>
            </div>
          </div>

          {/* Acciones disponibles */}
          {canProgress && possibleNextStates.length > 0 && (
            <div>
              <h5 className="font-medium text-gray-700 mb-3">Acciones Disponibles</h5>
              <div className="space-y-2">
                {possibleNextStates.map(nextState => {
                  const nextStateInfo = ESTADOS[nextState];
                  return (
                    <Button
                      key={nextState}
                      onClick={() => handleStateChangeClick(nextState)}
                      variant="ghost"
                      className="w-full justify-start p-3 h-auto border border-gray-200 hover:border-gray-300 dark:border-slate-600"
                    >
                      <nextStateInfo.icon size={18} className={`text-${nextStateInfo.color}-600 mr-3`} />
                      <div className="text-left">
                        <div className="font-medium text-gray-900">{nextStateInfo.label}</div>
                        <div className="text-sm text-gray-500">{nextStateInfo.description}</div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Historial de estados */}
        <div>
          <h5 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Calendar size={16} />
            Historial de Estados
          </h5>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {historialEstados.map((entry, index) => {
              const stateInfo = ESTADOS[entry.estado];
              const isLast = index === historialEstados.length - 1;
              
              return (
                <div key={index} className="relative">
                  {index < historialEstados.length - 1 && (
                    <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-200" />
                  )}
                  
                  <div className="flex gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isLast ? stateInfo.bgColor : 'bg-gray-100'
                    }`}>
                      <stateInfo.icon 
                        size={14} 
                        className={`${isLast ? `text-${stateInfo.color}-600` : 'text-gray-400 dark:text-slate-500'}`} 
                      />
                    </div>
                    
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-medium ${isLast ? 'text-gray-900' : 'text-gray-600'}`}>
                          {stateInfo.label}
                        </span>
                        {isLast && (
                          <Badge color={stateInfo.color} className="text-xs">Actual</Badge>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-500 space-y-1">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(entry.timestamp)}
                        </div>
                        <div className="flex items-center gap-1">
                          <User size={12} />
                          {entry.user}
                        </div>
                        {entry.nota && (
                          <div className="flex items-start gap-1 mt-2">
                            <MessageSquare size={12} className="mt-0.5 flex-shrink-0" />
                            <span className="text-gray-600 dark:text-slate-400 italic">{entry.nota}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal para cambio de estado */}
      {showNoteModal && selectedNextState && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md mx-4 w-full">
            <div className="text-center mb-4">
              {selectedNextState && (() => {
                const StateIcon = ESTADOS[selectedNextState].icon;
                return (
                  <div className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center ${ESTADOS[selectedNextState].bgColor}`}>
                    <StateIcon size={32} className={`text-${ESTADOS[selectedNextState].color}-600`} />
                  </div>
                );
              })()}
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {selectedNextState && `Cambiar a ${ESTADOS[selectedNextState].label}`}
              </h3>
              <p className="text-gray-600 dark:text-slate-400 text-sm">
                {selectedNextState && ESTADOS[selectedNextState].description}
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Notas del cambio (opcional)
              </label>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Añade comentarios sobre este cambio de estado..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => setShowNoteModal(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmStateChange}
                className={`flex-1 ${selectedNextState ? `bg-${ESTADOS[selectedNextState].color}-600 hover:bg-${ESTADOS[selectedNextState].color}-700` : 'bg-blue-600 hover:bg-blue-700'} text-white`}
              >
                Confirmar Cambio
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}