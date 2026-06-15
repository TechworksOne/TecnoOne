import React, { useState, useMemo, useEffect } from 'react';
import { Search, Package, ChevronDown } from 'lucide-react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { useCatalog } from '../../store/useCatalog';
import { Product } from '../../types/product';
import { formatMoney } from '../../lib/format';

interface ProductoPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (items: Array<{
    refId: string;
    nombre: string;
    cantidad: number;
    precioUnit: number;
    subtotal: number;
    source: 'PRODUCTO';
    aplicarImpuestos?: boolean;
  }>) => void;
}

export default function ProductoPicker({ open, onClose, onSelect }: ProductoPickerProps) {
  const { products, getAllCategories, loadProducts, isLoadingProducts } = useCatalog();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [soloConStock, setSoloConStock] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Map<string, { product: Product; cantidad: number; precioUnit: number; aplicarImpuestos: boolean }>>(new Map());

  const categories = getAllCategories();

  // Cargar productos cuando se abre el modal o cambian filtros remotos
  useEffect(() => {
    if (!open) return;

    const query = searchTerm.trim();
    const categoria = categoryFilter === 'all' ? undefined : categoryFilter;
    const hasRemoteFilters = query !== '' || Boolean(categoria);
    const limit = hasRemoteFilters ? 20 : 5;

    loadProducts(1, limit, query || undefined, categoria, {
      activo: true,
      conStock: soloConStock ? true : undefined,
    });
  }, [open, searchTerm, categoryFilter, soloConStock, loadProducts]);

  // Filtrar productos
  const filteredProducts = useMemo(() => {
    return products.filter((product: any) => {
      const active = product.active ?? product.activo ?? true;
      if (!active) return false;

      const name = String(product.name ?? product.nombre ?? '').toLowerCase();
      const sku = String(product.sku ?? '').toLowerCase();
      const category = String(product.category ?? product.categoria ?? '');
      const stock = Number(product.stock ?? 0);
      const search = searchTerm.toLowerCase();
      
      const matchesSearch = searchTerm === '' || 
        name.includes(search) ||
        sku.includes(search);
      
      const matchesCategory = categoryFilter === 'all' || category === categoryFilter;
      
      const matchesStock = !soloConStock || stock > 0;
      
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, searchTerm, categoryFilter, soloConStock]);

  const displayedProducts = useMemo(() => {
    const hasUserFilters =
      searchTerm.trim() !== '' ||
      categoryFilter !== 'all';

    return hasUserFilters ? filteredProducts : filteredProducts.slice(0, 5);
  }, [filteredProducts, searchTerm, categoryFilter]);

  const handleToggleProduct = (product: Product) => {
    const newSelected = new Map(selectedProducts);
    
    if (newSelected.has(product.id)) {
      newSelected.delete(product.id);
    } else {
      newSelected.set(product.id, {
        product,
        cantidad: 1,
        precioUnit: product.price,
        aplicarImpuestos: false,
      });
    }
    
    setSelectedProducts(newSelected);
  };

  const handleUpdateCantidad = (productId: string, cantidad: number) => {
    const newSelected = new Map(selectedProducts);
    const item = newSelected.get(productId);
    if (item && cantidad > 0) {
      newSelected.set(productId, { ...item, cantidad });
      setSelectedProducts(newSelected);
    }
  };

  const handleUpdatePrecio = (productId: string, precio: number) => {
    const newSelected = new Map(selectedProducts);
    const item = newSelected.get(productId);
    if (item && precio >= 0) {
      newSelected.set(productId, { ...item, precioUnit: precio });
      setSelectedProducts(newSelected);
    }
  };

  const handleToggleImpuestos = (productId: string) => {
    const newSelected = new Map(selectedProducts);
    const item = newSelected.get(productId);
    if (item) {
      newSelected.set(productId, { ...item, aplicarImpuestos: !item.aplicarImpuestos });
      setSelectedProducts(newSelected);
    }
  };

  const handleConfirm = () => {
    const items = Array.from(selectedProducts.values()).map(({ product, cantidad, precioUnit, aplicarImpuestos }) => ({
      refId: product.id,
      nombre: product.name,
      cantidad,
      precioUnit,
      subtotal: cantidad * precioUnit,
      source: 'PRODUCTO' as const,
      aplicarImpuestos,
    }));
    
    onSelect(items);
    handleClose();
  };

  const handleClose = () => {
    setSelectedProducts(new Map());
    setSearchTerm('');
    setCategoryFilter('all');
    onClose();
  };

  const totalSeleccionados = selectedProducts.size;

  return (
    <Modal open={open} onClose={handleClose} title="Seleccionar Productos">
      <div className="space-y-6">
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px_auto] gap-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="relative">
            <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">Todas las categorías</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </Select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={soloConStock}
              onChange={(e) => setSoloConStock(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-slate-300">Solo con stock</span>
          </label>
        </div>

        {/* Lista de productos */}
        <div className="border rounded-lg max-h-96 overflow-y-auto">
          {isLoadingProducts ? (
            <div className="p-8 text-center text-gray-500">
              <Package size={48} className="mx-auto mb-2 text-gray-400 animate-pulse" />
              <p>Cargando productos...</p>
            </div>
          ) : displayedProducts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Package size={48} className="mx-auto mb-2 text-gray-400" />
              <p>No se encontraron productos</p>
            </div>
          ) : (
            <div className="divide-y">
              {displayedProducts.map(product => {
                const isSelected = selectedProducts.has(product.id);
                const selection = selectedProducts.get(product.id);
                const stockReal = Number(product.stock ?? 0);
                const stockDisplay = Math.max(stockReal, 0);
                const stockLabel = stockReal <= 0 ? 'Sin stock' : `Stock: ${stockDisplay}`;
                const stockColor = stockReal > Number(product.stockMin ?? 0) ? 'green' : 'red';
                
                return (
                  <div
                    key={product.id}
                    className={`p-4 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleProduct(product)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 dark:text-slate-100 truncate">{product.name}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm text-gray-500 dark:text-slate-400">SKU: {product.sku}</span>
                          <Badge color={stockColor}>{stockLabel}</Badge>
                          <Badge>{product.category}</Badge>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatMoney(product.price)}</p>
                      </div>
                    </div>

                    {/* Controles de cantidad y precio si está seleccionado */}
                    {isSelected && selection && (
                      <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Cantidad</label>
                          <Input
                            type="number"
                            min="1"
                            value={selection.cantidad}
                            onChange={(e) => handleUpdateCantidad(product.id, Number(e.target.value))}
                            className="w-full"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Precio Unitario</label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={selection.precioUnit}
                            onChange={(e) => handleUpdatePrecio(product.id, Number(e.target.value))}
                            className="w-full"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Subtotal</label>
                          <div className="px-3 py-2 bg-gray-100 dark:bg-slate-800 rounded-lg font-bold text-green-600 dark:text-green-400">
                            {formatMoney(selection.cantidad * selection.precioUnit)}
                          </div>
                        </div>

                        <div className="md:col-span-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selection.aplicarImpuestos}
                              onChange={() => handleToggleImpuestos(product.id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-slate-300">Aplicar impuestos (IVA 12%)</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer con acciones */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-gray-600 dark:text-slate-400">
            {totalSeleccionados > 0 ? (
              <span className="font-medium text-blue-600 dark:text-blue-400">
                {totalSeleccionados} producto{totalSeleccionados !== 1 ? 's' : ''} seleccionado{totalSeleccionados !== 1 ? 's' : ''}
              </span>
            ) : (
              <span>Selecciona productos para agregar</span>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={handleClose}>
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={totalSeleccionados === 0}
              className="min-w-32"
            >
              Agregar {totalSeleccionados > 0 && `(${totalSeleccionados})`}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
