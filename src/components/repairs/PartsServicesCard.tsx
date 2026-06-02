import React, { useState } from 'react';
import { Plus, Wrench, Trash2, Search, Package } from 'lucide-react';
import { RepairItem } from '../../types/repair';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import Badge from '../ui/Badge';

interface PartsServicesCardProps {
  items: RepairItem[];
  onItemsChange: (items: RepairItem[]) => void;
  canEdit?: boolean;
}

export function PartsServicesCard({ items, onItemsChange, canEdit = true }: PartsServicesCardProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<RepairItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newItem, setNewItem] = useState<Partial<RepairItem>>({
    nombre: '',
    cantidad: 1,
    precioUnit: 0,
    subtotal: 0
  });

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addItem = () => {
    if (!newItem.nombre?.trim()) return;
    
    const subtotal = (newItem.cantidad || 1) * (newItem.precioUnit || 0);
    const item: RepairItem = {
      id: generateId(),
      nombre: newItem.nombre,
      cantidad: newItem.cantidad || 1,
      precioUnit: newItem.precioUnit || 0,
      subtotal
    };
    
    onItemsChange([...items, item]);
    setNewItem({ nombre: '', cantidad: 1, precioUnit: 0, subtotal: 0 });
    setShowAddModal(false);
  };

  const updateItem = (id: string, updatedItem: Partial<RepairItem>) => {
    const newItems = items.map(item => {
      if (item.id === id) {
        const updated = { ...item, ...updatedItem };
        updated.subtotal = updated.cantidad * updated.precioUnit;
        return updated;
      }
      return item;
    });
    onItemsChange(newItems);
  };

  const removeItem = (id: string) => {
    onItemsChange(items.filter(item => item.id !== id));
  };

  const calculateTotal = () => {
    return items.reduce((total, item) => total + item.subtotal, 0);
  };

  const filteredItems = items.filter(item =>
    item.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const ItemForm = ({ item, onSave, onCancel }: {
    item: Partial<RepairItem>;
    onSave: (item: RepairItem) => void;
    onCancel: () => void;
  }) => {
    const [formData, setFormData] = useState(item);

    const handleSave = () => {
      if (!formData.nombre?.trim()) return;
      
      const subtotal = (formData.cantidad || 1) * (formData.precioUnit || 0);
      onSave({
        ...formData,
        id: formData.id || generateId(),
        nombre: formData.nombre,
        cantidad: formData.cantidad || 1,
        precioUnit: formData.precioUnit || 0,
        subtotal
      } as RepairItem);
    };

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Descripción *
          </label>
          <Input
            value={formData.nombre || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
              setFormData({ ...formData, nombre: e.target.value })
            }
            placeholder="Ej: Pantalla LCD, Batería, Diagnóstico..."
            className="w-full"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Cantidad
            </label>
            <Input
              type="number"
              min="1"
              value={formData.cantidad || 1}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                setFormData({ ...formData, cantidad: parseInt(e.target.value) || 1 })
              }
              className="w-full"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Precio Unitario
            </label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={formData.precioUnit || 0}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                setFormData({ ...formData, precioUnit: parseFloat(e.target.value) || 0 })
              }
              className="w-full"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">Subtotal:</span>
            <span className="text-lg font-bold text-gray-900">
              Q{((formData.cantidad || 1) * (formData.precioUnit || 0)).toFixed(2)}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="ghost" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!formData.nombre?.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {formData.id ? 'Actualizar' : 'Agregar'}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
          <Package size={20} className="text-purple-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">Piezas y Servicios</h3>
          <p className="text-sm text-gray-500">
            Lista de componentes y servicios aplicados
          </p>
        </div>
        
        {canEdit && (
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Plus size={16} className="mr-2" />
            Agregar
          </Button>
        )}
      </div>

      {/* Búsqueda */}
      {items.length > 0 && (
        <div className="mb-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Buscar en la lista..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      )}

      {/* Lista de items */}
      {filteredItems.length > 0 ? (
        <div className="space-y-3 mb-6">
          {filteredItems.map((item) => (
            <div key={item.id} className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 hover:bg-gray-100 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Wrench size={14} className="text-purple-600" />
                    <span className="font-medium text-gray-900">{item.nombre}</span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>Cantidad: {item.cantidad}</span>
                    <span>Precio Unit: Q{item.precioUnit.toFixed(2)}</span>
                    <Badge color="purple" className="text-xs">
                      Subtotal: Q{item.subtotal.toFixed(2)}
                    </Badge>
                  </div>
                </div>
                
                {canEdit && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingItem(item)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          {searchTerm ? (
            <>
              <Search size={32} className="mx-auto mb-2 text-gray-300" />
              <p>No se encontraron resultados para "{searchTerm}"</p>
            </>
          ) : (
            <>
              <Package size={32} className="mx-auto mb-2 text-gray-300" />
              <p>No hay piezas o servicios agregados</p>
              {canEdit && (
                <p className="text-sm mt-1">Haz clic en "Agregar" para comenzar</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Total */}
      {items.length > 0 && (
        <div className="border-t pt-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium text-gray-700">Total General:</span>
            <span className="text-2xl font-bold text-purple-600">
              Q{calculateTotal().toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            * Los precios no incluyen IVA automáticamente
          </p>
        </div>
      )}

      {/* Modal Agregar */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md mx-4 w-full">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              Agregar Pieza o Servicio
            </h4>
            <ItemForm
              item={newItem}
              onSave={(item) => {
                onItemsChange([...items, item]);
                setNewItem({ nombre: '', cantidad: 1, precioUnit: 0, subtotal: 0 });
                setShowAddModal(false);
              }}
              onCancel={() => setShowAddModal(false)}
            />
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md mx-4 w-full">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              Editar Item
            </h4>
            <ItemForm
              item={editingItem}
              onSave={(updatedItem) => {
                updateItem(editingItem.id, updatedItem);
                setEditingItem(null);
              }}
              onCancel={() => setEditingItem(null)}
            />
          </div>
        </div>
      )}
    </Card>
  );
}