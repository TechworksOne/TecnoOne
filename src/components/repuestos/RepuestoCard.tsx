import { Eye, Edit, Copy, Plus, AlertTriangle, Monitor, Battery, Camera, Cpu, Smartphone, Speaker, Cable, ZoomIn } from "lucide-react";
import { useState } from "react";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import ImageModal from "../ui/ImageModal";
import { Repuesto } from "../../types/repuesto";
import { formatMoney } from "../../lib/format";
import { getImageUrl } from "../../utils/getImageUrl";

interface RepuestoCardProps {
  repuesto: Repuesto;
  onView: (repuesto: Repuesto) => void;
  onEdit: (repuesto: Repuesto) => void;
  onDuplicate: (repuesto: Repuesto) => void;
  onAddToQuote?: (repuesto: Repuesto) => void;
}

const getTipoIcon = (tipo: Repuesto['tipo']) => {
  switch (tipo) {
    case 'Pantalla': return <Monitor size={16} />;
    case 'Batería': return <Battery size={16} />;
    case 'Cámara': return <Camera size={16} />;
    case 'Flex': return <Cable size={16} />;
    case 'Placa': return <Cpu size={16} />;
    case 'Back Cover': return <Smartphone size={16} />;
    case 'Altavoz': return <Speaker size={16} />;
    case 'Conector': return <Cable size={16} />;
    default: return <Cpu size={16} />;
  }
};

const getCondicionColor = (condicion: Repuesto['condicion']) => {
  switch (condicion) {
    case 'Original': return 'bg-green-100 text-green-800';
    case 'OEM': return 'bg-blue-100 text-blue-800';
    case 'Genérico': return 'bg-yellow-100 text-yellow-800';
    case 'Usado': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export default function RepuestoCard({
  repuesto,
  onView,
  onEdit,
  onDuplicate,
  onAddToQuote
}: RepuestoCardProps) {
  const [showImageModal, setShowImageModal] = useState(false);
  
  const stockBajo = repuesto.stockMinimo && repuesto.stock <= repuesto.stockMinimo;
  const sinStock = repuesto.stock === 0;
  
  const imagenes = Array.isArray(repuesto.imagenes) ? repuesto.imagenes : [];
  const compatibilidadCorta = repuesto.compatibilidad?.slice(0, 2).join(' / ') || '';
  const masCompatibilidad = repuesto.compatibilidad && repuesto.compatibilidad.length > 2;

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 overflow-hidden">
      {/* Imagen mejorada */}
      <div className="relative h-48 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
        {imagenes.length > 0 ? (
          <div className="relative w-full h-full">
            <img
              src={getImageUrl(imagenes[0])}
              alt={repuesto.nombre}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
            
            {/* Overlay hover para zoom */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowImageModal(true);
                  }}
                  className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                  title="Ver imagen completa"
                >
                  <ZoomIn size={16} />
                </button>
              </div>
            </div>

            {/* Indicador de múltiples imágenes */}
            {imagenes.length > 1 && (
              <div className="absolute bottom-2 right-2">
                <span className="bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  <Camera size={12} />
                  {imagenes.length}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">
            <div className="text-center">
              {getTipoIcon(repuesto.tipo)}
              <p className="text-xs mt-2">Sin imagen</p>
            </div>
          </div>
        )}
        
        {/* Badge de estado de stock */}
        {sinStock && (
          <div className="absolute top-2 left-2">
            <Badge color="red">Sin Stock</Badge>
          </div>
        )}
        {stockBajo && !sinStock && (
          <div className="absolute top-2 left-2">
            <Badge color="yellow">Stock Bajo</Badge>
          </div>
        )}
        
        {/* Badge activo/inactivo */}
        {!repuesto.activo && (
          <div className="absolute top-2 right-2">
            <Badge color="gray">Descontinuado</Badge>
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="p-4 space-y-3">
        {/* SKU */}
        {repuesto.sku && (
          <div className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600">
            <span className="text-xs text-gray-500 font-medium">SKU:</span>
            <span className="text-xs font-mono text-gray-700 font-semibold">{repuesto.sku}</span>
          </div>
        )}

        {/* Nombre */}
        <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
          {repuesto.nombre}
        </h3>

        {/* Chips de tipo y condición */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-xs">
            {getTipoIcon(repuesto.tipo)}
            <span>{repuesto.tipo}</span>
          </div>
          <div className={`px-2 py-1 rounded-full text-xs ${getCondicionColor(repuesto.condicion)}`}>
            {repuesto.condicion}
          </div>
        </div>

        {/* Marca y línea */}
        <div className="text-sm text-gray-600">
          <span className="font-medium">{repuesto.marca}</span>
          {repuesto.linea && <span> • {repuesto.linea}</span>}
          {repuesto.proveedor && (
            <div className="text-xs text-gray-500 mt-1">
              📦 {repuesto.proveedor}
            </div>
          )}
        </div>

        {/* Compatibilidad */}
        {compatibilidadCorta && (
          <div className="text-xs text-gray-500" title={repuesto.compatibilidad?.join(', ')}>
            Compatible: {compatibilidadCorta}
            {masCompatibilidad && <span className="font-medium"> +{repuesto.compatibilidad!.length - 2} más</span>}
          </div>
        )}

        {/* Precio y stock */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-green-600">
              {formatMoney(repuesto.precio)}
            </div>
            <div className="text-sm text-gray-500">
              Costo: {formatMoney(repuesto.precioCosto)}
            </div>
            <div className={`text-sm ${stockBajo ? 'text-red-600' : 'text-gray-500'}`}>
              {repuesto.stock} {repuesto.stock === 1 ? 'unidad' : 'unidades'}
              {stockBajo && (
                <AlertTriangle size={14} className="inline ml-1" />
              )}
            </div>
          </div>
          
          {/* Indicador de margen */}
          <div className="text-right">
            <div className="text-xs text-emerald-600 font-medium">
              +{(((repuesto.precio - repuesto.precioCosto) / repuesto.precioCosto) * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-gray-500">
              margen
            </div>
          </div>
        </div>

        {/* Tags */}
        {repuesto.tags && repuesto.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {repuesto.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded"
              >
                {tag}
              </span>
            ))}
            {repuesto.tags.length > 3 && (
              <span className="text-xs text-gray-500">+{repuesto.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Botones */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onView(repuesto)}
            className="flex-1"
          >
            <Eye size={16} />
            Ver
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(repuesto)}
            className="flex-1"
          >
            <Edit size={16} />
            Editar
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDuplicate(repuesto)}
            title="Duplicar repuesto"
          >
            <Copy size={16} />
          </Button>
          
          {onAddToQuote && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddToQuote(repuesto)}
              className="text-blue-600 hover:text-blue-700"
              title="Agregar a cotización"
            >
              <Plus size={16} />
            </Button>
          )}
        </div>
      </div>

      {/* Modal de imagen */}
      <ImageModal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        images={imagenes.map(getImageUrl)}
        title={repuesto.nombre}
      />
    </Card>
  );
}