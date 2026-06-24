import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, FileText, User, Phone, Calendar, CreditCard } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { useSales } from '../../store/useSales';
import { useEmpresa } from '../../store/useEmpresa';
import { formatMoney, formatDate } from '../../lib/format';
import { printSaleReceipt } from '../../lib/printSaleReceipt';
import { getImageUrl } from '../../utils/getImageUrl';

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { getSaleById } = useSales();
  const { empresa, loadEmpresa } = useEmpresa();

  useEffect(() => {
    loadEmpresa();
  }, [loadEmpresa]);

  const sale = id ? getSaleById(id) : null;

  useEffect(() => {
    if (!sale) {
      toast.add('Venta no encontrada', 'error');
      navigate('/ventas');
    }
  }, [sale, navigate, toast]);

  if (!sale) return null;

  const handlePrint = () => {
    printSaleReceipt(sale, empresa);
  };

  const getMetodoIcon = (metodo: string) => {
    switch (metodo) {
      case 'EFECTIVO':
        return '💵';
      case 'TARJETA':
      case 'TARJETA_BAC':
      case 'TARJETA_NEONET':
      case 'TARJETA_OTRA':
        return '💳';
      case 'TRANSFERENCIA':
        return '🏦';
      case 'MIXTO':
        return '💰';
      default:
        return '💵';
    }
  };

  return (
    <>
      {/* Versión para pantalla */}
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 no-print">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => navigate('/ventas')}>
                  <ArrowLeft size={20} />
                </Button>
                <PageHeader
                  title={`Venta ${sale.numero}`}
                  subtitle={`Cliente: ${sale.cliente.name}`}
                />
              </div>
              
              <Button onClick={handlePrint} className="bg-green-600 hover:bg-green-700">
                <Printer size={16} />
                Imprimir Recibo
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          {/* Info principal */}
          <Card className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Estado</p>
                <Badge color={sale.estado === 'PAGADA' ? 'green' : sale.estado === 'PENDIENTE' ? 'orange' : 'red'}>
                  {sale.estado}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Fecha</p>
                <p className="font-semibold">{formatDate(sale.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Total</p>
                <p className="text-2xl font-bold text-green-600">{formatMoney(sale.total)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Origen</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/cotizaciones/${sale.quoteId}`)}
                >
                  <FileText size={14} />
                  Ver Cotización
                </Button>
              </div>
            </div>
          </Card>

          {/* Cliente */}
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <User size={20} className="text-green-600" />
              Información del Cliente
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Nombre</p>
                <p className="font-semibold">{sale.cliente.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Teléfono</p>
                <p className="font-semibold">{sale.cliente.phone}</p>
              </div>
              {sale.cliente.email && (
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-semibold">{sale.cliente.email}</p>
                </div>
              )}
              {sale.cliente.nit && (
                <div>
                  <p className="text-sm text-gray-500">NIT</p>
                  <p className="font-semibold">{sale.cliente.nit}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Items */}
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4">Productos / Servicios</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 text-sm font-semibold">Cant.</th>
                    <th className="text-left p-3 text-sm font-semibold">Descripción</th>
                    <th className="text-right p-3 text-sm font-semibold">P. Unit.</th>
                    <th className="text-right p-3 text-sm font-semibold">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sale.items.map((item, index) => (
                    <tr key={index}>
                      <td className="p-3 text-center font-medium">{item.cantidad}</td>
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{item.nombre}</p>
                          <Badge color={item.source === 'PRODUCTO' ? 'blue' : 'purple'} className="mt-1">
                            {item.source}
                          </Badge>
                        </div>
                      </td>
                      <td className="p-3 text-right">{formatMoney(item.precioUnit)}</td>
                      <td className="p-3 text-right font-semibold">{formatMoney(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="p-3 text-right font-semibold">Subtotal:</td>
                    <td className="p-3 text-right font-semibold">{formatMoney(sale.subtotal)}</td>
                  </tr>
                  {sale.impuestos && sale.impuestos > 0 && (
                    <tr>
                      <td colSpan={3} className="p-3 text-right font-semibold text-orange-600">Impuestos:</td>
                      <td className="p-3 text-right font-semibold text-orange-600">{formatMoney(sale.impuestos)}</td>
                    </tr>
                  )}
                  <tr className="text-lg">
                    <td colSpan={3} className="p-3 text-right font-bold">TOTAL:</td>
                    <td className="p-3 text-right font-bold text-green-600">{formatMoney(sale.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Pagos */}
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <CreditCard size={20} className="text-green-600" />
              Información de Pago
            </h3>
            <div className="space-y-3">
              {sale.payments.map((payment, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getMetodoIcon(payment.metodo)}</span>
                      <span className="font-semibold">{payment.metodo}</span>
                    </div>
                    <span className="text-lg font-bold text-green-600">{formatMoney(payment.monto)}</span>
                  </div>
                  {payment.referencia && (
                    <p className="text-sm text-gray-600">
                      Referencia: <span className="font-medium">{payment.referencia}</span>
                    </p>
                  )}
                  {payment.comprobanteUrl && (
                    <div className="mt-2">
                      <a
                        href={getImageUrl(payment.comprobanteUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block"
                      >
                        <img
                          src={getImageUrl(payment.comprobanteUrl)}
                          alt="Comprobante"
                          className="h-32 max-w-full rounded border object-contain"
                        />
                        <p className="mt-1 text-xs text-blue-600">
                          Ver comprobante completo
                        </p>
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {sale.payments.length > 1 && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Pagado:</span>
                  <span className="text-green-600">
                    {formatMoney(sale.payments.reduce((sum, p) => sum + p.monto, 0))}
                  </span>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Versión para imprimir */}
      <div className="only-print bg-white">
        <style>{`
          @media print {
            .no-print { display: none !important; }
            .only-print { display: block !important; }
            body { margin: 0; padding: 20px; }
            @page { size: A4; margin: 15mm; }
          }
          @media screen {
            .only-print { display: none; }
          }
        `}</style>

        <div className="max-w-4xl mx-auto p-8">
          {/* Header empresa */}
          <div className="text-center mb-8 border-b-2 border-gray-300 pb-6">
            <h1 className="text-3xl font-bold mb-2">TecnoOne</h1>
            <p className="text-gray-600 dark:text-slate-400">by EMPRENDE360</p>
            <p className="text-sm text-gray-600 mt-2">
              Gestión Comercial | Tel: +502 1234-5678
            </p>
          </div>

          {/* Título y número */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-1">RECIBO DE VENTA</h2>
            <p className="text-xl font-semibold text-green-600">{sale.numero}</p>
            <p className="text-sm text-gray-600">Fecha: {formatDate(sale.createdAt)}</p>
          </div>

          {/* Cliente */}
          <div className="mb-6 p-4 bg-gray-50 rounded">
            <h3 className="font-bold mb-2">CLIENTE:</h3>
            <p><strong>Nombre:</strong> {sale.cliente.name}</p>
            <p><strong>Teléfono:</strong> {sale.cliente.phone}</p>
            {sale.cliente.nit && <p><strong>NIT:</strong> {sale.cliente.nit}</p>}
            {sale.cliente.email && <p><strong>Email:</strong> {sale.cliente.email}</p>}
          </div>

          {/* Items */}
          <table className="w-full mb-6">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-2">Cant.</th>
                <th className="text-left py-2">Descripción</th>
                <th className="text-right py-2">P. Unit.</th>
                <th className="text-right py-2">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, index) => (
                <tr key={index} className="border-b border-gray-200">
                  <td className="py-2 text-center">{item.cantidad}</td>
                  <td className="py-2">
                    {item.nombre}
                    <span className="text-xs text-gray-600 ml-2">({item.source})</span>
                  </td>
                  <td className="py-2 text-right">{formatMoney(item.precioUnit)}</td>
                  <td className="py-2 text-right font-semibold">{formatMoney(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="py-2 text-right font-semibold">Subtotal:</td>
                <td className="py-2 text-right font-semibold">{formatMoney(sale.subtotal)}</td>
              </tr>
              {sale.impuestos && sale.impuestos > 0 ? (
                <tr>
                  <td colSpan={3} className="py-2 text-right font-semibold">Impuestos:</td>
                  <td className="py-2 text-right font-semibold">{formatMoney(sale.impuestos)}</td>
                </tr>
              ) : null}
              <tr className="border-t-2 border-gray-300">
                <td colSpan={3} className="py-3 text-right text-xl font-bold">TOTAL:</td>
                <td className="py-3 text-right text-xl font-bold">{formatMoney(sale.total)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Pagos */}
          <div className="mb-6 p-4 bg-gray-50 rounded">
            <h3 className="font-bold mb-2">FORMA DE PAGO:</h3>
            {sale.payments.map((payment, index) => (
              <div key={index} className="mb-2">
                <p>
                  <strong>{payment.metodo}:</strong> {formatMoney(payment.monto)}
                  {payment.referencia && ` (Ref: ${payment.referencia})`}
                </p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-gray-300 text-center text-sm text-gray-600">
            <p className="mb-2">Venta originada desde Cotización</p>
            <p>¡Gracias por su compra!</p>
            <p className="mt-4 text-xs">
              Este recibo es un comprobante de venta. Para factura fiscal, solicítela en el momento de la compra.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

