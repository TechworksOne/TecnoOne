import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, Filter, Eye, ShoppingBag, Wrench, Calendar, DollarSign, User, Phone } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { useQuotesStore } from '../../store/useQuotesStore';
import { QuoteType, QuoteStatus } from '../../types/quote';
import { formatMoney, formatDate } from '../../lib/format';

export default function QuotesPage() {
  const navigate = useNavigate();
  const { quotes } = useQuotesStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState<'all' | QuoteType>('all');
  const [estadoFilter, setEstadoFilter] = useState<'all' | QuoteStatus>('all');

  // Filtrar cotizaciones
  const filteredQuotes = useMemo(() => {
    return quotes.filter(quote => {
      const matchesSearch = searchTerm === '' || 
        quote.cliente.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quote.numero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quote.cliente.phone.includes(searchTerm);
      
      const matchesTipo = tipoFilter === 'all' || quote.tipo === tipoFilter;
      const matchesEstado = estadoFilter === 'all' || quote.estado === estadoFilter;
      
      return matchesSearch && matchesTipo && matchesEstado;
    });
  }, [quotes, searchTerm, tipoFilter, estadoFilter]);

  // Estadísticas
  const stats = useMemo(() => {
    const totalQuotes = quotes.length;
    const abiertas = quotes.filter(q => q.estado === 'ABIERTA').length;
    const cerradas = quotes.filter(q => q.estado === 'CERRADA').length;
    const totalMonto = quotes
      .filter(q => q.estado !== 'PERDIDA')
      .reduce((sum, q) => sum + q.total, 0);
    
    return { totalQuotes, abiertas, cerradas, totalMonto };
  }, [quotes]);

  const handleViewQuote = (id: string) => {
    navigate(`/cotizaciones/${id}`);
  };

  const handleNewQuote = () => {
    // Por ahora navegar a la página existente, o crear una nueva
    navigate('/cotizaciones/nueva');
  };

  const clearFilters = () => {
    setSearchTerm('');
    setTipoFilter('all');
    setEstadoFilter('all');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <PageHeader
              title="Cotizaciones"
              subtitle="Gestión integral de cotizaciones para clientes"
            />
            <Button 
              onClick={handleNewQuote}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
            >
              <Plus size={20} />
              Nueva Cotización
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500 rounded-lg">
                <FileText className="text-white" size={24} />
              </div>
              <div>
                <p className="text-sm text-blue-600 font-medium">Total Cotizaciones</p>
                <p className="text-2xl font-bold text-blue-900">{stats.totalQuotes}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500 rounded-lg">
                <ShoppingBag className="text-white" size={24} />
              </div>
              <div>
                <p className="text-sm text-green-600 font-medium">Abiertas</p>
                <p className="text-2xl font-bold text-green-900">{stats.abiertas}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500 rounded-lg">
                <Calendar className="text-white" size={24} />
              </div>
              <div>
                <p className="text-sm text-purple-600 font-medium">Cerradas</p>
                <p className="text-2xl font-bold text-purple-900">{stats.cerradas}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-500 rounded-lg">
                <DollarSign className="text-white" size={24} />
              </div>
              <div>
                <p className="text-sm text-yellow-600 font-medium">Monto Total</p>
                <p className="text-xl font-bold text-yellow-900">{formatMoney(stats.totalMonto)}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Buscar por cliente, teléfono o número..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value as any)}>
              <option value="all">Todos los tipos</option>
              <option value="VENTA">VENTA</option>
              <option value="REPARACION">REPARACION</option>
            </Select>

            <Select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value as any)}>
              <option value="all">Todos los estados</option>
              <option value="ABIERTA">ABIERTA</option>
              <option value="CERRADA">CERRADA</option>
              <option value="PERDIDA">PERDIDA</option>
            </Select>

            <Button variant="ghost" onClick={clearFilters}>
              Limpiar Filtros
            </Button>
          </div>
        </Card>

        {/* Lista de cotizaciones */}
        {filteredQuotes.length === 0 ? (
          <EmptyState
            icon={<FileText size={64} className="text-gray-400" />}
            title={searchTerm || tipoFilter !== 'all' || estadoFilter !== 'all' ? 'No se encontraron cotizaciones' : 'No hay cotizaciones'}
            description={searchTerm || tipoFilter !== 'all' || estadoFilter !== 'all' 
              ? 'Intenta ajustar los filtros de búsqueda' 
              : 'Comienza creando tu primera cotización'}
            action={
              <Button onClick={handleNewQuote}>
                <Plus size={20} />
                Nueva Cotización
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredQuotes.map((quote) => {
              const vigenciaHasta = new Date(quote.createdAt);
              vigenciaHasta.setDate(vigenciaHasta.getDate() + quote.vigenciaDias);
              const isVigente = new Date() <= vigenciaHasta;

              return (
                <Card 
                  key={quote.id} 
                  className="p-6 hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
                  onClick={() => handleViewQuote(quote.id)}
                >
                  <div className="flex items-start justify-between">
                    {/* Información principal */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-bold text-gray-900">{quote.numero}</h3>
                        <Badge color={quote.tipo === 'VENTA' ? 'blue' : 'purple'}>
                          {quote.tipo}
                        </Badge>
                        <Badge 
                          color={
                            quote.estado === 'ABIERTA' ? 'green' : 
                            quote.estado === 'CERRADA' ? 'blue' : 'red'
                          }
                        >
                          {quote.estado}
                        </Badge>
                        {!isVigente && quote.estado === 'ABIERTA' && (
                          <Badge color="red">Vencida</Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <User size={16} className="text-gray-400" />
                          <span className="font-medium">{quote.cliente.name}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone size={16} className="text-gray-400" />
                          <span>{quote.cliente.phone}</span>
                        </div>

                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar size={16} className="text-gray-400" />
                          <span>Creada: {formatDate(quote.createdAt)}</span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                        <span>{quote.items.length} item{quote.items.length !== 1 ? 's' : ''}</span>
                        <span>•</span>
                        <span>Válida {quote.vigenciaDias} días</span>
                        {quote.manoDeObra && quote.manoDeObra > 0 && (
                          <>
                            <span>•</span>
                            <span>Incluye mano de obra</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Total y acción */}
                    <div className="text-right ml-6">
                      <p className="text-sm text-gray-500 mb-1">Total</p>
                      <p className="text-2xl font-bold text-blue-600">{formatMoney(quote.total)}</p>
                      <Button 
                        className="mt-3" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewQuote(quote.id);
                        }}
                      >
                        <Eye size={16} />
                        Ver Detalles
                      </Button>
                    </div>
                  </div>

                  {/* Observaciones si existen */}
                  {quote.observaciones && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-600 italic">"{quote.observaciones}"</p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
