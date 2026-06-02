import { Search, Filter, X } from "lucide-react";
import { useState, useEffect } from "react";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Select from "../ui/Select";
import { RepuestoFilters as FiltersType } from "../../types/repuesto";
import { MARCAS_LINEAS } from "../../types/repuesto";

interface RepuestoFiltersProps {
  filters: FiltersType;
  onFiltersChange: (filters: Partial<FiltersType>) => void;
  onClearFilters: () => void;
  totalResults: number;
}

const TIPOS_REPUESTO = [
  'Pantalla', 'Batería', 'Cámara', 'Flex', 'Placa', 'Back Cover', 'Altavoz', 'Conector', 'Otro'
];

export default function RepuestoFilters({
  filters,
  onFiltersChange,
  onClearFilters,
  totalResults
}: RepuestoFiltersProps) {
  const [searchTerm, setSearchTerm] = useState(filters.searchTerm || '');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      onFiltersChange({ searchTerm: searchTerm || undefined });
    }, 200);

    return () => clearTimeout(timer);
  }, [searchTerm, onFiltersChange]);

  // Opciones de línea según marca seleccionada
  const lineasDisponibles = filters.marca && filters.marca !== 'Otra' 
    ? MARCAS_LINEAS[filters.marca as keyof typeof MARCAS_LINEAS] || []
    : [];

  const hasActiveFilters = Object.keys(filters).some(key => 
    filters[key as keyof FiltersType] !== undefined && 
    filters[key as keyof FiltersType] !== '' &&
    key !== 'searchTerm'
  );

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 space-y-4">
      {/* Búsqueda principal */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <Input
          type="text"
          placeholder="Buscar por nombre, modelo, compatibilidad o etiquetas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-4 py-3 text-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500 rounded-xl"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Filtros rápidos */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Tipo */}
        <Select
          value={filters.tipo || ''}
          onChange={(e) => onFiltersChange({ tipo: e.target.value || undefined })}
          className="min-w-[140px]"
        >
          <option value="">Todos los tipos</option>
          {TIPOS_REPUESTO.map(tipo => (
            <option key={tipo} value={tipo}>{tipo}</option>
          ))}
        </Select>

        {/* Marca */}
        <Select
          value={filters.marca || ''}
          onChange={(e) => {
            const marca = e.target.value || undefined;
            onFiltersChange({ 
              marca,
              linea: undefined // Reset línea cuando cambia marca
            });
          }}
          className="min-w-[120px]"
        >
          <option value="">Todas las marcas</option>
          {Object.keys(MARCAS_LINEAS).map(marca => (
            <option key={marca} value={marca}>{marca}</option>
          ))}
        </Select>

        {/* Línea (condicional) */}
        {filters.marca && lineasDisponibles.length > 0 && (
          <Select
            value={filters.linea || ''}
            onChange={(e) => onFiltersChange({ linea: e.target.value || undefined })}
            className="min-w-[140px]"
          >
            <option value="">Todas las líneas</option>
            {lineasDisponibles.map(linea => (
              <option key={linea} value={linea}>{linea}</option>
            ))}
          </Select>
        )}

        {/* Solo con stock */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.soloConStock || false}
            onChange={(e) => onFiltersChange({ soloConStock: e.target.checked || undefined })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Solo con stock</span>
        </label>

        {/* Botón filtros avanzados */}
        <Button
          variant={showAdvanced ? "primary" : "ghost"}
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="ml-auto"
        >
          <Filter size={16} />
          Filtros avanzados
        </Button>
      </div>

      {/* Filtros avanzados */}
      {showAdvanced && (
        <div className="border-t border-gray-200 pt-4 space-y-4">
          <h4 className="font-medium text-gray-900">Filtros avanzados</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Rango de precio */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Rango de precio (Q)
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Mín"
                  value={filters.precioMin || ''}
                  onChange={(e) => onFiltersChange({ 
                    precioMin: e.target.value ? Number(e.target.value) : undefined 
                  })}
                  className="flex-1"
                  min="0"
                  step="0.01"
                />
                <span className="text-gray-500 dark:text-slate-400">-</span>
                <Input
                  type="number"
                  placeholder="Máx"
                  value={filters.precioMax || ''}
                  onChange={(e) => onFiltersChange({ 
                    precioMax: e.target.value ? Number(e.target.value) : undefined 
                  })}
                  className="flex-1"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resultados y limpiar filtros */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-700">
        <div className="text-sm text-gray-600">
          {totalResults} {totalResults === 1 ? 'repuesto encontrado' : 'repuestos encontrados'}
        </div>
        
        {(hasActiveFilters || searchTerm) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchTerm('');
              onClearFilters();
            }}
            className="text-red-600 hover:text-red-700"
          >
            <X size={16} />
            Limpiar filtros
          </Button>
        )}
      </div>
    </div>
  );
}