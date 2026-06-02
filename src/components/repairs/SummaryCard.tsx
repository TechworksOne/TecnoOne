import React from 'react';
import { Calculator, Clock, User, Shield, Calendar, MapPin } from 'lucide-react';
import { RepairFormData } from '../../types/repair';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

interface SummaryCardProps {
  repairData: RepairFormData;
  onDeliveryClick?: () => void;
  canDeliver?: boolean;
}

export function SummaryCard({ repairData, onDeliveryClick, canDeliver }: SummaryCardProps) {
  const calculateTotal = () => {
    return repairData.items.reduce((total, item) => total + item.subtotal, 0);
  };

  const calculateWarrantyEnd = () => {
    if (!repairData.fechaEntrega) return null;
    
    const deliveryDate = new Date(repairData.fechaEntrega);
    const warrantyEnd = new Date(deliveryDate);
    warrantyEnd.setMonth(warrantyEnd.getMonth() + 5); // 5 meses máximo
    
    return warrantyEnd;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeSinceCreation = () => {
    if (!repairData.recepcion?.fechaRecepcion) return '';
    
    const now = new Date();
    const created = new Date(repairData.recepcion.fechaRecepcion);
    const diffHours = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 24) {
      return `${diffHours} horas`;
    }
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} día${diffDays > 1 ? 's' : ''}`;
  };

  const warrantyEndDate = calculateWarrantyEnd();
  const total = calculateTotal();

  return (
    <Card className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
          <Calculator size={20} className="text-green-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Resumen General</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Información consolidada de la reparación
          </p>
        </div>
        <Badge color={repairData.estado === 'COMPLETADA' ? 'green' : 'blue'}>
          {repairData.estado}
        </Badge>
      </div>

      <div className="space-y-6">
        {/* Información del Cliente */}
        <div className="bg-blue-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <User size={16} className="text-blue-600" />
            <span className="font-medium text-blue-900">Cliente</span>
            {repairData.clienteFrecuente && (
              <Badge color="yellow" className="text-xs">
                Cliente Frecuente
              </Badge>
            )}
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-700">Nombre:</span>
              <span className="font-medium text-blue-900">{repairData.clienteNombre}</span>
            </div>
            {repairData.clienteTelefono && (
              <div className="flex justify-between">
                <span className="text-blue-700">Teléfono:</span>
                <span className="font-medium text-blue-900">{repairData.clienteTelefono}</span>
              </div>
            )}
            {repairData.clienteEmail && (
              <div className="flex justify-between">
                <span className="text-blue-700">Email:</span>
                <span className="font-medium text-blue-900">{repairData.clienteEmail}</span>
              </div>
            )}
          </div>
        </div>

        {/* Información del Equipo */}
        <div className="bg-purple-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={16} className="text-purple-600" />
            <span className="font-medium text-purple-900">Equipo</span>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-purple-700">Tipo:</span>
              <span className="font-medium text-purple-900">{repairData.recepcion.tipoEquipo}</span>
            </div>
            {repairData.recepcion.marca && (
              <div className="flex justify-between">
                <span className="text-purple-700">Marca/Modelo:</span>
                <span className="font-medium text-purple-900">
                  {repairData.recepcion.marca} {repairData.recepcion.modelo}
                </span>
              </div>
            )}
            {repairData.recepcion.color && (
              <div className="flex justify-between">
                <span className="text-purple-700">Color:</span>
                <span className="font-medium text-purple-900">{repairData.recepcion.color}</span>
              </div>
            )}
          </div>
        </div>

        {/* Costos */}
        <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calculator size={16} className="text-gray-600 dark:text-slate-400" />
            <span className="font-medium text-gray-900 dark:text-slate-100">Costos</span>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-700 dark:text-slate-300">Items ({repairData.items.length}):</span>
              <span className="font-medium text-gray-900 dark:text-slate-100">Q{total.toFixed(2)}</span>
            </div>
            
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between">
                <span className="font-medium text-gray-900 dark:text-slate-100">Total:</span>
                <span className="text-lg font-bold text-green-600">Q{total.toFixed(2)}</span>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
              * Los precios mostrados no incluyen IVA automáticamente
            </p>
          </div>
        </div>

        {/* Fechas Importantes */}
        <div className="bg-orange-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={16} className="text-orange-600" />
            <span className="font-medium text-orange-900">Fechas</span>
          </div>
          
          <div className="space-y-2 text-sm">
            {repairData.recepcion.fechaRecepcion && (
              <>
                <div className="flex justify-between">
                  <span className="text-orange-700">Recibida:</span>
                  <span className="font-medium text-orange-900">
                    {formatDateTime(repairData.recepcion.fechaRecepcion)}
                  </span>
                </div>
              </>
            )}
            
            {repairData.fechaEntrega && (
              <div className="flex justify-between">
                <span className="text-orange-700">Entregada:</span>
                <span className="font-medium text-orange-900">
                  {formatDateTime(repairData.fechaEntrega)}
                </span>
              </div>
            )}
            
            <div className="flex justify-between">
              <span className="text-orange-700">Tiempo activa:</span>
              <span className="font-medium text-orange-900">{getTimeSinceCreation()}</span>
            </div>
          </div>
        </div>

        {/* Garantía */}
        {repairData.fechaEntrega && warrantyEndDate && (
          <div className="bg-green-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={16} className="text-green-600" />
              <span className="font-medium text-green-900">Garantía</span>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-green-700">Inicia:</span>
                <span className="font-medium text-green-900">
                  {formatDate(repairData.fechaEntrega)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Vence:</span>
                <span className="font-medium text-green-900">
                  {formatDate(warrantyEndDate.toISOString())}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Duración:</span>
                <span className="font-medium text-green-900">5 meses</span>
              </div>
            </div>
            
            <div className="mt-3 p-2 bg-green-100 rounded-lg">
              <p className="text-xs text-green-800">
                La garantía inicia desde la fecha de entrega y tiene una duración máxima de 5 meses.
              </p>
            </div>
          </div>
        )}

        {/* Sticker asignado */}
        {repairData.stickerNumero && (
          <div className="bg-yellow-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge color="yellow" className="text-sm font-medium">
                Sticker #{repairData.stickerNumero}
              </Badge>
            </div>
            <p className="text-xs text-yellow-800">
              Sticker de identificación asignado automáticamente al completar la reparación.
            </p>
          </div>
        )}

        {/* Botón de entrega */}
        {canDeliver && repairData.estado === 'COMPLETADA' && !repairData.fechaEntrega && (
          <div className="pt-4 border-t">
            <Button
              onClick={onDeliveryClick}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
            >
              <Clock size={16} className="mr-2" />
              Marcar como Entregada
            </Button>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 text-center">
              Al entregar se iniciará el período de garantía de 5 meses
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
