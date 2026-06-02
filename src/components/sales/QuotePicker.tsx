import React, { useState, useMemo } from 'react';
import { Search, FileText, User, Calendar, X } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Badge from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import { useQuotesStore } from '../../store/useQuotesStore';
import { Quote, QuoteType } from '../../types/quote';
import { formatMoney, formatDate } from '../../lib/format';

interface QuotePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (quote: Quote) => void;
  allowedType?: QuoteType; // 'VENTA' | 'REPARACION' | undefined (ambos)
}

export default function QuotePicker({ open, onClose, onSelect, allowedType = 'VENTA' }: QuotePickerProps) {
  const { quotes } = useQuotesStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState<QuoteType | 'all'>(allowedType || 'all');

  // Filtrar solo cotizaciones disponibles para convertir
  const availableQuotes = useMemo(() => {
    return quotes.filter(quote => {
      // Solo mostrar cotizaciones ABIERTAS (ya mapeadas desde BD)
      if (quote.estado !== 'ABIERTA') return false;

      // Filtro de tipo
      const matchesTipo = tipoFilter === 'all' || quote.tipo === tipoFilter;
      
      // Filtro de búsqueda
      const matchesSearch = searchTerm === '' || 
        quote.cliente.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quote.numero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quote.cliente.phone.includes(searchTerm);
      
      return matchesTipo && matchesSearch;
    });
  }, [quotes, searchTerm, tipoFilter]);

  const handleSelect = (quote: Quote) => {
    onSelect(quote);
    onClose();
  };

  const handleClose = () => {
    setSearchTerm('');
    setTipoFilter(allowedType || 'all');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Seleccionar Cotización">
      <div className="space-y-6">
        {/* Filtros */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              type="text"
              placeholder="Buscar por cliente, número o teléfono..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {!allowedType && (
            <Select 
              value={tipoFilter} 
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTipoFilter(e.target.value as QuoteType | 'all')}
              className="min-w-[140px]"
            >
              <option value="all">Todos los tipos</option>
              <option value="VENTA">VENTA</option>
              <option value="REPARACION">REPARACION</option>
            </Select>
          )}
        </div>

        {/* Lista de cotizaciones */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {availableQuotes.length === 0 ? (
            <EmptyState
              icon={<FileText size={48} className="text-gray-400 dark:text-slate-500" />}
              title="No hay cotizaciones disponibles"
              description={searchTerm 
                ? "No se encontraron cotizaciones con ese criterio" 
                : `No hay cotizaciones abiertas de tipo ${allowedType || 'disponibles'}`
              }
            />
          ) : (
            availableQuotes.map((quote) => (
              <div
                key={quote.id}
                className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                onClick={() => handleSelect(quote)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-gray-900">{quote.numero}</h4>
                      <Badge color={quote.tipo === 'VENTA' ? 'blue' : 'purple'}>
                        {quote.tipo}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <User size={14} />
                      <span>{quote.cliente.name}</span>
                      <span className="text-gray-400 dark:text-slate-500">•</span>
                      <span>{quote.cliente.phone}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xl font-bold text-blue-600">{formatMoney(quote.total)}</p>
                    <p className="text-xs text-gray-500">{quote.items.length} items</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    <span>Creada: {formatDate(quote.createdAt)}</span>
                  </div>
                  <span>•</span>
                  <span>Válida {quote.vigenciaDias} días</span>
                  {quote.manoDeObra && quote.manoDeObra > 0 && (
                    <>
                      <span>•</span>
                      <span>Inc. Mano de Obra</span>
                    </>
                  )}
                </div>

                <div className="mt-3">
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => handleSelect(quote)}
                  >
                    Seleccionar esta cotización
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="ghost" onClick={handleClose}>
            <X size={16} />
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
