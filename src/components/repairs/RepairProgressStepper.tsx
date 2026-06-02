import React from 'react';
import { Check, Clock, Wrench, Package, Pause, CheckCircle2, Truck } from 'lucide-react';
import { RepairStatus } from '../../types/repair';

interface RepairProgressStepperProps {
  currentStatus: RepairStatus;
  className?: string;
}

const STEPS = [
  {
    status: 'RECIBIDA' as RepairStatus,
    label: 'Recibida',
    icon: Clock,
    color: 'blue'
  },
  {
    status: 'EN_PROCESO' as RepairStatus,
    label: 'En Proceso',
    icon: Wrench,
    color: 'yellow'
  },
  {
    status: 'ESPERANDO_PIEZA' as RepairStatus,
    label: 'Esperando Piezas',
    icon: Package,
    color: 'orange'
  },
  {
    status: 'STAND_BY' as RepairStatus,
    label: 'Stand By',
    icon: Pause,
    color: 'purple'
  },
  {
    status: 'COMPLETADA' as RepairStatus,
    label: 'Completada',
    icon: CheckCircle2,
    color: 'green'
  },
  {
    status: 'ENTREGADA' as RepairStatus,
    label: 'Entregada',
    icon: Truck,
    color: 'gray'
  }
];

export function RepairProgressStepper({ currentStatus, className = '' }: RepairProgressStepperProps) {
  const currentStepIndex = STEPS.findIndex(step => step.status === currentStatus);

  const getStepStatus = (stepIndex: number) => {
    if (stepIndex < currentStepIndex) return 'completed';
    if (stepIndex === currentStepIndex) return 'current';
    return 'pending';
  };

  const getStepStyles = (status: string, color: string) => {
    switch (status) {
      case 'completed':
        return {
          circle: 'bg-green-500 border-green-500 text-white',
          line: 'bg-green-500',
          text: 'text-green-600 font-medium'
        };
      case 'current':
        return {
          circle: `bg-${color}-500 border-${color}-500 text-white ring-4 ring-${color}-100`,
          line: 'bg-gray-200 dark:bg-slate-700',
          text: `text-${color}-600 font-semibold`
        };
      case 'pending':
        return {
          circle: 'bg-gray-100 dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-400 dark:text-slate-500',
          line: 'bg-gray-200 dark:bg-slate-700',
          text: 'text-gray-400 dark:text-slate-500'
        };
      default:
        return {
          circle: 'bg-gray-100 dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-400 dark:text-slate-500',
          line: 'bg-gray-200 dark:bg-slate-700',
          text: 'text-gray-400 dark:text-slate-500'
        };
    }
  };

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
        <Clock size={20} className="text-blue-500" />
        Progreso de la Reparación
      </h3>
      
      <div className="flex items-center justify-between relative">
        {/* Línea de conexión de fondo */}
        <div className="absolute top-8 left-0 right-0 h-0.5 bg-gray-200 z-0"></div>
        
        {STEPS.map((step, index) => {
          const stepStatus = getStepStatus(index);
          const styles = getStepStyles(stepStatus, step.color);
          const Icon = step.icon;
          
          return (
            <div key={step.status} className="flex flex-col items-center relative z-10">
              {/* Círculo del paso */}
              <div className={`
                w-16 h-16 rounded-full border-2 flex items-center justify-center
                transition-all duration-300 ease-in-out transform
                ${styles.circle}
                ${stepStatus === 'current' ? 'scale-110' : 'scale-100'}
              `}>
                {stepStatus === 'completed' ? (
                  <Check size={24} />
                ) : (
                  <Icon size={24} />
                )}
              </div>
              
              {/* Etiqueta del paso */}
              <span className={`mt-3 text-sm transition-all duration-300 ${styles.text}`}>
                {step.label}
              </span>
              
              {/* Línea de progreso hacia el siguiente paso */}
              {index < STEPS.length - 1 && (
                <div className={`
                  absolute top-8 left-full w-full h-0.5 transition-all duration-500
                  ${stepStatus === 'completed' ? styles.line : 'bg-gray-200 dark:bg-slate-700'}
                `} style={{ width: 'calc(100% - 2rem)' }}></div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Información adicional del estado actual */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
        <div className="text-sm text-gray-600">
          <span className="font-medium">Estado actual:</span> {STEPS[currentStepIndex]?.label || 'Desconocido'}
        </div>
        {currentStatus === 'COMPLETADA' && (
          <div className="text-sm text-amber-600 mt-1">
            ⚠️ Asignar sticker antes de marcar como entregada
          </div>
        )}
        {currentStatus === 'STAND_BY' && (
          <div className="text-sm text-purple-600 mt-1">
            ⏸️ Reparación en pausa temporal - Revisar historial para detalles
          </div>
        )}
      </div>
    </div>
  );
}