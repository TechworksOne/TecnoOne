import { useState } from "react";
import { Search, Plus, Minus, X } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Select from "../ui/Select";
import RepuestoCard from "./RepuestoCard";
import { useRepuestosStore } from "../../store/useRepuestosStore";
import { Repuesto, RepuestoSeleccionado, MARCAS_LINEAS } from "../../types/repuesto";
import { formatMoney } from "../../lib/format";
import { getImageUrl } from "../../utils/getImageUrl";

interface RepuestoPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (repuestos: RepuestoSeleccionado[]) => void;
}

interface RepuestoEnCarrito extends Repuesto {
  cantidadSeleccionada: number;
  precioUnitario: number;
}

const TIPOS_REPUESTO = [
  'Pantalla', 'Batería', 'Cámara', 'Flex', 'Placa', 'Back Cover', 'Altavoz', 'Conector', 'Otro'
];

export default function RepuestoPicker({ isOpen, onClose, onConfirm }: RepuestoPickerProps) {
  const { filteredRepuestos, setFilters, clearFilters } = useRepuestosStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [marcaFiltro, setMarcaFiltro] = useState('');
  const [carrito, setCarrito] = useState<RepuestoEnCarrito[]>([]);

  const handleAddToCarrito = (repuesto: Repuesto) => {
    const existente = carrito.find(item => item.id === repuesto.id);
    
    if (existente) {
      setCarrito(prev => prev.map(item =>
        item.id === repuesto.id
          ? { ...item, cantidadSeleccionada: item.cantidadSeleccionada + 1 }
          : item
      ));
    } else {
      setCarrito(prev => [...prev, {
        ...repuesto,
        cantidadSeleccionada: 1,
        precioUnitario: repuesto.precio
      }]);
    }
  };

  const handleUpdateCantidad = (id: string, cantidad: number) => {
    if (cantidad <= 0) {
      setCarrito(prev => prev.filter(item => item.id !== id));
    } else {
      setCarrito(prev => prev.map(item =>
        item.id === id ? { ...item, cantidadSeleccionada: cantidad } : item
      ));
    }
  };

  const handleUpdatePrecio = (id: string, precio: number) => {
    setCarrito(prev => prev.map(item =>
      item.id === id ? { ...item, precioUnitario: precio } : item
    ));
  };

  const handleConfirmar = () => {
    const repuestosSeleccionados: RepuestoSeleccionado[] = carrito.map(item => ({
      id: item.id,
      nombre: item.nombre,
      cantidad: item.cantidadSeleccionada,
      precioUnit: item.precioUnitario,
      subtotal: item.cantidadSeleccionada * item.precioUnitario
    }));

    onConfirm(repuestosSeleccionados);
    handleCerrar();
  };

  const handleCerrar = () => {
    setCarrito([]);
    setSearchTerm('');
    setTipoFiltro('');
    setMarcaFiltro('');
    clearFilters();
    onClose();
  };

  // Aplicar filtros locales
  const repuestosFiltrados = filteredRepuestos.filter(rep => {
    const matchesSearch = !searchTerm || 
      rep.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rep.compatibilidad?.some(comp => comp.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesTipo = !tipoFiltro || rep.tipo === tipoFiltro;
    const matchesMarca = !marcaFiltro || rep.marca === marcaFiltro;
    
    return matchesSearch && matchesTipo && matchesMarca && rep.stock > 0;
  });

  const totalCarrito = carrito.reduce((sum, item) => 
    sum + (item.cantidadSeleccionada * item.precioUnitario), 0
  );

  return (
    <Modal
      open={isOpen}
      onClose={handleCerrar}
      title="Seleccionar Repuestos"
    >
      <div className="space-y-6">
        {/* Filtros compactos */}
        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              type="text"
              placeholder="Buscar repuestos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
            className="min-w-[140px]"
          >
            <option value="">Todos los tipos</option>
            {TIPOS_REPUESTO.map(tipo => (
              <option key={tipo} value={tipo}>{tipo}</option>
            ))}
          </Select>

          <Select
            value={marcaFiltro}
            onChange={(e) => setMarcaFiltro(e.target.value)}
            className="min-w-[120px]"
          >
            <option value="">Todas las marcas</option>
            {Object.keys(MARCAS_LINEAS).map(marca => (
              <option key={marca} value={marca}>{marca}</option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de repuestos */}
          <div className="lg:col-span-2">
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {repuestosFiltrados.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Search size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No se encontraron repuestos disponibles</p>
                </div>
              ) : (
                repuestosFiltrados.map(repuesto => (
                  <div key={repuesto.id} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                      {repuesto.imagenes[0] ? (
                        <img src={getImageUrl(repuesto.imagenes[0])} alt={repuesto.nombre} className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="text-gray-400 dark:text-slate-500">📱</div>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{repuesto.nombre}</h4>
                      <p className="text-sm text-gray-500">{repuesto.marca} • {repuesto.tipo}</p>
                      <p className="text-sm font-medium text-green-600">{formatMoney(repuesto.precio)}</p>
                      <p className="text-xs text-gray-500">{repuesto.stock} disponibles</p>
                    </div>
                    
                    <Button
                      size="sm"
                      onClick={() => handleAddToCarrito(repuesto)}
                      disabled={carrito.find(item => item.id === repuesto.id)?.cantidadSeleccionada >= repuesto.stock}
                    >
                      <Plus size={16} />
                      Agregar
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Carrito */}
          <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-4">
              Repuestos Seleccionados ({carrito.length})
            </h3>
            
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {carrito.length === 0 ? (
                <p className="text-gray-500 dark:text-slate-400 text-center py-4">
                  No hay repuestos seleccionados
                </p>
              ) : (
                carrito.map(item => (
                  <div key={item.id} className="bg-white dark:bg-slate-800 p-3 rounded border dark:border-slate-600">
                    <h4 className="font-medium text-sm">{item.nombre}</h4>
                    
                    <div className="mt-2 space-y-2">
                      {/* Cantidad */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Cantidad:</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleUpdateCantidad(item.id, item.cantidadSeleccionada - 1)}
                            className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded text-xs hover:bg-gray-300"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-8 text-center text-sm">{item.cantidadSeleccionada}</span>
                          <button
                            onClick={() => handleUpdateCantidad(item.id, item.cantidadSeleccionada + 1)}
                            disabled={item.cantidadSeleccionada >= item.stock}
                            className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded text-xs hover:bg-gray-300 disabled:opacity-50"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Precio unitario editable */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Precio:</span>
                        <Input
                          type="number"
                          value={item.precioUnitario}
                          onChange={(e) => handleUpdatePrecio(item.id, Number(e.target.value))}
                          className="w-20 h-6 text-xs"
                          step="0.01"
                          min="0"
                        />
                      </div>

                      {/* Subtotal */}
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-900">
                          Subtotal: {formatMoney(item.cantidadSeleccionada * item.precioUnitario)}
                        </span>
                        <button
                          onClick={() => handleUpdateCantidad(item.id, 0)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Total */}
            {carrito.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between items-center font-medium">
                  <span>Total:</span>
                  <span className="text-lg text-green-600">{formatMoney(totalCarrito)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="ghost" onClick={handleCerrar}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirmar}
            disabled={carrito.length === 0}
          >
            Confirmar Selección ({carrito.length})
          </Button>
        </div>
      </div>
    </Modal>
  );
}