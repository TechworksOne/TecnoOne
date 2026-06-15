import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, ShoppingCart, Wrench, Edit, Trash2, X } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Select from '../../components/ui/Select';
import { useToast } from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import QuotePrintView from '../../components/quotes/QuotePrintView';
import { useQuotesStore } from '../../store/useQuotesStore';
import { formatMoney, formatDate } from '../../lib/format';
import { Quote } from '../../types/quote';
import * as cotizacionService from '../../services/cotizacionService';

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { removeQuote, updateQuoteStatus } = useQuotesStore();
  
  const [showPrintView, setShowPrintView] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'resumen' | 'imprimir'>('resumen');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showConvertSaleDialog, setShowConvertSaleDialog] = useState(false);
  const [isConvertingSale, setIsConvertingSale] = useState(false);

  // Cargar cotización desde el backend
  useEffect(() => {
    const loadQuote = async () => {
      if (!id) {
        toast.add('ID de cotización no válido', 'error');
        navigate('/cotizaciones');
        return;
      }

      setIsLoading(true);
      try {
        const cotizacion = await cotizacionService.getCotizacionById(Number(id));
        
        // Mapear de BD a formato frontend
        const mappedQuote: Quote = {
          id: cotizacion.id!.toString(),
          numero: cotizacion.numero_cotizacion!,
          tipo: cotizacion.tipo,
          cliente: {
            id: cotizacion.cliente_id.toString(),
            name: cotizacion.cliente_nombre,
            phone: cotizacion.cliente_telefono || '',
            email: cotizacion.cliente_email || '',
            nit: cotizacion.cliente_nit || '',
            address: cotizacion.cliente_direccion || '',
          },
          vigenciaDias: cotizacion.vigencia_dias || 15,
          items: typeof cotizacion.items === 'string' 
            ? JSON.parse(cotizacion.items) 
            : Array.isArray(cotizacion.items) 
              ? cotizacion.items 
              : [],
          manoDeObra: cotizacion.mano_de_obra || 0,
          subtotal: cotizacion.subtotal,
          impuestos: cotizacion.impuestos,
          total: cotizacion.total,
          estado: mapEstadoBDtoFrontend(cotizacion.estado || 'BORRADOR'),
          aplicarImpuestos: cotizacion.aplicar_impuestos || false,
          observaciones: cotizacion.observaciones || '',
          createdAt: cotizacion.created_at!,
          updatedAt: cotizacion.updated_at!,
        };
        
        setQuote(mappedQuote);
      } catch (error) {
        console.error('Error al cargar cotización:', error);
        toast.add('Error al cargar la cotización', 'error');
        navigate('/cotizaciones');
      } finally {
        setIsLoading(false);
      }
    };

    loadQuote();
  }, [id, navigate, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Cargando cotización...</p>
        </div>
      </div>
    );
  }

  if (!quote) return null;

  const handlePrint = () => {
    setShowPrintView(true);

    setTimeout(() => {
      const printNode = document.querySelector('.print-view') as HTMLElement | null;

      if (!printNode) {
        window.print();
        setShowPrintView(false);
        return;
      }

      const printWindow = window.open('', '_blank', 'width=900,height=700');

      if (!printWindow) {
        window.print();
        setShowPrintView(false);
        return;
      }

      printWindow.document.open();
      printWindow.document.write(`
        <!doctype html>
        <html lang="es">
          <head>
            <meta charset="UTF-8" />
            <title>Cotización ${quote.numero}</title>
          </head>
          <body>
            ${printNode.outerHTML}
            <script>
              window.onload = function () {
                setTimeout(function () {
                  window.focus();
                  window.print();
                }, 500);
              };

              window.onafterprint = function () {
                window.close();
              };
            <\/script>
          </body>
        </html>
      `);
      printWindow.document.close();

      setShowPrintView(false);
    }, 300);
  };

  const handleConvertToSale = async () => {
    if (isConvertingSale) return;

    if (quote.tipo !== 'VENTA') {
      toast.add('Esta cotizacion no es de tipo VENTA', 'error');
      return;
    }

    if (quote.estado !== 'ABIERTA') {
      toast.add('Esta cotizacion no esta disponible para convertir', 'error');
      return;
    }

    setIsConvertingSale(true);
    try {
      const venta = await cotizacionService.convertirAVenta(quote.id);
      const ventaId = venta?.id || venta?.venta_id || venta?.data?.venta_id;

      setQuote(prev => prev ? { ...prev, estado: 'CERRADA' } : prev);
      updateQuoteStatus(quote.id, 'CERRADA');
      toast.add('Cotizacion convertida a venta', 'success');
      navigate('/ventas', {
        state: {
          convertedFromQuote: quote.id,
          ventaId,
        },
      });
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.response?.data?.message || 'No se pudo convertir la cotizacion a venta';
      toast.add(message, 'error');
    } finally {
      setIsConvertingSale(false);
    }
  };

  const handleConvertToRepair = () => {
    if (quote.tipo !== 'REPARACION') {
      toast.add('Esta cotización no es de tipo REPARACION', 'error');
      return;
    }
    
    // TODO: conectar API real - crear reparación y vincularla
    // Por ahora: simulamos que se crea una reparación y actualizamos el estado
    const mockRepairId = `REP-${Date.now()}`;
    
    // Cambiar estado a REPARANDO y guardar ID de reparación
    updateQuoteStatus(quote.id, 'REPARANDO');
    // TODO: también guardar repairId cuando esté el backend
    
    const repairItems = quote.items.filter(item => item.source === 'REPUESTO');
    toast.add('Cotización convertida a Reparación', 'success');
    
    navigate('/reparaciones/nueva', { 
      state: { 
        fromQuote: quote,
        quoteId: quote.id,
        cliente: quote.cliente,
        repuestos: repairItems,
        manoDeObra: quote.manoDeObra
      } 
    });
  };

  const handleViewRepair = () => {
    if (quote.repairId) {
      // TODO: cuando tengamos el ID real de la reparación
      navigate(`/reparaciones/${quote.repairId}`);
    } else {
      toast.add('No se encontró la reparación vinculada', 'error');
    }
  };

  const handleDelete = () => {
    removeQuote(quote.id);
    toast.add('Cotización eliminada', 'success');
    navigate('/cotizaciones');
  };

  const handleEdit = () => {
    navigate(`/cotizaciones/editar/${quote.id}`);
  };

  const handleStatusChange = (newStatus: 'ABIERTA' | 'CERRADA' | 'PERDIDA') => {
    updateQuoteStatus(quote.id, newStatus);
    toast.add(`Estado actualizado a ${newStatus}`, 'success');
  };

  const vigenciaHasta = new Date(quote.createdAt);
  vigenciaHasta.setDate(vigenciaHasta.getDate() + quote.vigenciaDias);
  const isVigente = new Date() <= vigenciaHasta;

  if (showPrintView) {
    return (
      <div className="quote-print-overlay bg-white min-h-0">
        <div className="no-print p-4 border-b flex justify-between items-center bg-white">
          <h2 className="text-lg font-bold">Vista de Impresión</h2>
          <Button variant="ghost" onClick={() => setShowPrintView(false)}>
            <X size={20} />
            Cerrar
          </Button>
        </div>
        <QuotePrintView quote={quote} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/cotizaciones')}>
                <ArrowLeft size={20} />
              </Button>
              <div>
                <PageHeader
                  title={`Cotización ${quote.numero}`}
                  subtitle={`Cliente: ${quote.cliente.name}`}
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleEdit}>
                <Edit size={16} />
                Editar
              </Button>
              <Button variant="ghost" onClick={handlePrint}>
                <Printer size={16} />
                Imprimir
              </Button>
              
              {/* Mostrar botón según estado y tipo */}
              {quote.estado === 'REPARANDO' ? (
                <Button onClick={handleViewRepair} className="bg-purple-600 hover:bg-purple-700">
                  <Wrench size={16} />
                  Ver Reparación
                </Button>
              ) : (
                <>
                  {quote.tipo === 'VENTA' && quote.estado === 'ABIERTA' && (
                    <Button
                      onClick={() => setShowConvertSaleDialog(true)}
                      disabled={isConvertingSale}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <ShoppingCart size={16} />
                      Convertir a Venta
                    </Button>
                  )}
                  {quote.tipo === 'REPARACION' && (
                    <Button onClick={handleConvertToRepair} className="bg-purple-600 hover:bg-purple-700">
                      <Wrench size={16} />
                      Convertir a Reparación
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Resumen principal */}
        <Card className="p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-500 block mb-1">Estado</label>
              <Select
                value={quote.estado}
                onChange={(e) => handleStatusChange(e.target.value as any)}
                className="w-full"
                disabled={quote.estado === 'REPARANDO'}
              >
                <option value="ABIERTA">ABIERTA</option>
                <option value="CERRADA">CERRADA</option>
                <option value="PERDIDA">PERDIDA</option>
                <option value="REPARANDO">REPARANDO</option>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 block mb-1">Tipo</label>
              <Badge color={quote.tipo === 'VENTA' ? 'blue' : 'purple'}>
                {quote.tipo}
              </Badge>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 block mb-1">Vigencia</label>
              <Badge color={isVigente ? 'green' : 'red'}>
                {isVigente ? `Válida hasta ${formatDate(vigenciaHasta)}` : 'Vencida'}
              </Badge>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 block mb-1">Total</label>
              <p className="text-3xl font-bold text-blue-600">{formatMoney(quote.total)}</p>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b">
          <button
            onClick={() => setActiveTab('resumen')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'resumen' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Resumen
          </button>
          <button
            onClick={() => setActiveTab('imprimir')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'imprimir' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Vista Previa
          </button>
        </div>

        {/* Contenido de tabs */}
        {activeTab === 'resumen' && (
          <div className="space-y-6">
            {/* Items */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Items de la Cotización</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3">Cant.</th>
                      <th className="text-left p-3">Descripción</th>
                      <th className="text-left p-3">Origen</th>
                      <th className="text-right p-3">Precio Unit.</th>
                      <th className="text-right p-3">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {quote.items.map((item, index) => (
                      <tr key={index}>
                        <td className="p-3">{item.cantidad}</td>
                        <td className="p-3">
                          <div className="font-medium">{item.nombre}</div>
                          {item.notas && <div className="text-sm text-gray-500">{item.notas}</div>}
                        </td>
                        <td className="p-3">
                          <Badge color={item.source === 'PRODUCTO' ? 'blue' : 'pink'}>
                            {item.source}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">{formatMoney(item.precioUnit)}</td>
                        <td className="p-3 text-right font-semibold">{formatMoney(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <div className="w-80 space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-semibold">{formatMoney(quote.subtotal)}</span>
                  </div>
                  {quote.manoDeObra && quote.manoDeObra > 0 && (
                    <div className="flex justify-between">
                      <span>Mano de Obra:</span>
                      <span className="font-semibold">{formatMoney(quote.manoDeObra)}</span>
                    </div>
                  )}
                  {quote.impuestos && quote.impuestos > 0 && (
                    <div className="flex justify-between">
                      <span>Impuestos:</span>
                      <span className="font-semibold">{formatMoney(quote.impuestos)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xl font-bold text-blue-600 pt-2 border-t">
                    <span>TOTAL:</span>
                    <span>{formatMoney(quote.total)}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Observaciones */}
            {quote.observaciones && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-2">Observaciones</h3>
                <p className="text-gray-700 dark:text-slate-300">{quote.observaciones}</p>
              </Card>
            )}

            {/* Botón eliminar */}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 size={16} />
                Eliminar Cotización
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'imprimir' && (
          <Card className="p-6 no-print">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                  Vista previa de impresión
                </h3>
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  Usa el botón Imprimir para generar una sola copia limpia.
                </p>
              </div>
              <Button variant="ghost" onClick={handlePrint}>
                <Printer size={16} />
                Imprimir
              </Button>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white overflow-hidden">
            </div>
          </Card>
        )}
      </div>

      {/* Diálogo de confirmación */}
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Eliminar Cotización"
        message={`¿Estás seguro de que deseas eliminar la cotización ${quote.numero}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
      />
      <ConfirmDialog
        open={showConvertSaleDialog}
        onClose={() => setShowConvertSaleDialog(false)}
        onConfirm={handleConvertToSale}
        title="Convertir a venta"
        message={`Deseas convertir la cotizacion ${quote.numero} en una venta real? Esta accion cerrara la cotizacion y creara la venta.`}
        confirmText={isConvertingSale ? 'Convirtiendo...' : 'Convertir'}
        type="info"
      />

    </div>
  );
}

// Función helper para mapear estados de BD a frontend
function mapEstadoBDtoFrontend(estadoBD: string): 'ABIERTA' | 'CERRADA' | 'PERDIDA' | 'REPARANDO' {
  const mapping: Record<string, 'ABIERTA' | 'CERRADA' | 'PERDIDA' | 'REPARANDO'> = {
    'BORRADOR': 'ABIERTA',
    'ENVIADA': 'ABIERTA',
    'APROBADA': 'ABIERTA',
    'RECHAZADA': 'PERDIDA',
    'VENCIDA': 'PERDIDA',
    'CONVERTIDA': 'CERRADA',
  };
  return mapping[estadoBD] || 'ABIERTA';
}
