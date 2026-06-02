import React from 'react';
import { StateHistoryEntry, RepairStatus, SubStage } from '../../types/repair';
import { Calendar, User, Camera, Package, FileText } from 'lucide-react';

interface StateHistoryProps {
  history: StateHistoryEntry[];
  className?: string;
}

const STATE_COLORS: Record<RepairStatus, string> = {
  RECIBIDA: 'bg-blue-100 text-blue-800 border-blue-200',
  EN_PROCESO: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  ESPERANDO_PIEZA: 'bg-orange-100 text-orange-800 border-orange-200',
  COMPLETADA: 'bg-green-100 text-green-800 border-green-200',
  ENTREGADA: 'bg-gray-100 text-gray-800 border-gray-200',
  CANCELADA: 'bg-red-100 text-red-800 border-red-200'
};

const STATE_LABELS: Record<RepairStatus, string> = {
  RECIBIDA: 'Recibida',
  EN_PROCESO: 'En Proceso',
  ESPERANDO_PIEZA: 'Esperando Pieza',
  COMPLETADA: 'Completada',
  ENTREGADA: 'Entregada',
  CANCELADA: 'Cancelada'
};

const SUBSTAGE_LABELS: Record<SubStage, string> = {
  DIAGNOSTICO: 'Diagnóstico',
  DESARMADO: 'Desarmado',
  REPARACION: 'Reparación',
  ARMADO: 'Armado',
  PRUEBAS: 'Pruebas',
  CALIBRACION: 'Calibración'
};

export function StateHistory({ history, className = '' }: StateHistoryProps) {
  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    if (isToday) {
      return `Hoy ${date.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`;
    }
    
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!history || history.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        <FileText size={48} className="mx-auto mb-2 opacity-50" />
        <p>No hay historial de cambios disponible</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Historial de Estados
      </h3>
      
      <div className="relative">
        {/* Línea vertical del timeline */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        
        {history.map((entry, index) => (
          <div key={entry.id} className="relative flex items-start space-x-4 pb-6">
            {/* Punto del timeline */}
            <div className={`
              relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-4 border-white shadow-lg
              ${STATE_COLORS[entry.estado].replace('text-', 'bg-').replace('border-', 'bg-')}
            `}>
              <div className="w-4 h-4 bg-white dark:bg-slate-800 rounded-full"></div>
            </div>
            
            {/* Contenido del evento */}
            <div className="flex-1 min-w-0 bg-white border border-gray-200 dark:border-slate-600 rounded-lg shadow-sm p-4">
              {/* Header con estado y fecha */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className={`
                    px-3 py-1 rounded-full text-sm font-medium border
                    ${STATE_COLORS[entry.estado]}
                  `}>
                    {STATE_LABELS[entry.estado]}
                  </span>
                  
                  {entry.subEtapa && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full border">
                      {SUBSTAGE_LABELS[entry.subEtapa]}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center text-sm text-gray-500">
                  <Calendar size={14} className="mr-1" />
                  {formatDate(entry.timestamp)}
                </div>
              </div>
              
              {/* Usuario */}
              <div className="flex items-center text-sm text-gray-600 mb-2">
                <User size={14} className="mr-1" />
                {entry.user}
              </div>
              
              {/* Nota */}
              <p className="text-gray-900 dark:text-slate-100 mb-3">{entry.nota}</p>
              
              {/* Información adicional para esperando pieza */}
              {entry.piezaNecesaria && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-2 text-orange-800 mb-1">
                    <Package size={14} />
                    <span className="font-medium text-sm">Pieza necesaria</span>
                  </div>
                  <p className="text-sm text-orange-700">{entry.piezaNecesaria}</p>
                  {entry.proveedor && (
                    <p className="text-xs text-orange-600 mt-1">
                      Proveedor: {entry.proveedor}
                    </p>
                  )}
                </div>
              )}
              
              {/* Fotos */}
              {entry.fotos && entry.fotos.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-gray-700 dark:text-slate-300 mb-2">
                    <Camera size={14} />
                    <span className="text-sm font-medium">
                      Fotos ({entry.fotos.length})
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {entry.fotos.map((foto, fotoIndex) => (
                      <div key={fotoIndex} className="group relative">
                        <img
                          src={foto}
                          alt={`Foto ${fotoIndex + 1}`}
                          className="w-full h-20 object-cover rounded-lg border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => {
                            // En una implementación real, abrir modal de imagen
                            window.open(foto, '_blank');
                          }}
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded-lg transition-all"></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}