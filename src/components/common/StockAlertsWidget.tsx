import React, { useEffect, useState } from 'react';
import { AlertTriangle, X, Package, TrendingDown } from 'lucide-react';
import { getCriticalStockProducts } from '../../services/productService';
import { formatMoney } from '../../lib/format';

interface CriticalProduct {
  id: number;
  sku: string;
  nombre: string;
  stock: number;
  stock_minimo: number;
  precio_venta: number;
  categoria: string;
  faltante: number;
}

export const StockAlertsWidget: React.FC = () => {
  const [criticalProducts, setCriticalProducts] = useState<CriticalProduct[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadCriticalProducts = async () => {
    try {
      setLoading(true);
      const response = await getCriticalStockProducts();
      if (response.success) {
        setCriticalProducts(response.data);
      }
    } catch (error) {
      console.error('Error al cargar productos críticos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCriticalProducts();
    // Actualizar cada 5 minutos
    const interval = setInterval(loadCriticalProducts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-50 dark:bg-[#0D1526] border border-slate-200 dark:border-[rgba(72,185,230,0.16)] rounded-lg p-3 animate-pulse">
        <div className="h-6 bg-slate-200 dark:bg-[#0A1220] rounded w-32"></div>
      </div>
    );
  }

  if (criticalProducts.length === 0) {
    return (
      <div className="bg-gradient-to-r from-green-50 dark:from-emerald-950/30 to-emerald-50 dark:to-green-950/20 border-2 border-green-300 dark:border-emerald-800/40 rounded-xl p-4 flex items-center gap-4">
        <div className="bg-green-500 p-3 rounded-xl shadow-md">
          <Package className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-base font-bold text-green-700 dark:text-emerald-300 mb-1">
            ✅ Stock en Niveles Óptimos
          </div>
          <div className="text-sm text-green-600 dark:text-emerald-400 font-medium">
            Todos los productos cuentan con stock suficiente
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="bg-gradient-to-r from-red-50 dark:from-red-950/30 to-orange-50 dark:to-red-950/20 border-2 border-red-300 dark:border-red-800/50 hover:border-red-500 dark:hover:border-red-600 hover:shadow-lg rounded-xl p-4 flex items-center gap-4 transition-all duration-200 w-full text-left group"
      >
        <div className="bg-red-500 p-3 rounded-xl shadow-md group-hover:scale-110 transition-transform">
          <AlertTriangle className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-base font-bold text-red-700 dark:text-red-300 mb-1">
            ⚠️ Alerta de Stock Crítico
          </div>
          <div className="text-sm text-red-600 dark:text-red-400 font-medium">
            {criticalProducts.length} {criticalProducts.length === 1 ? 'producto necesita' : 'productos necesitan'} reabastecimiento inmediato
          </div>
        </div>
        <div className="bg-red-600 text-white px-4 py-2 rounded-xl text-lg font-bold shadow-md">
          {criticalProducts.length}
        </div>
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white dark:bg-[#0D1526] rounded-2xl shadow-2xl max-w-6xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-fadeIn">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white p-6 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Productos con Stock Crítico</h2>
                  <p className="text-white/90 text-sm mt-1">
                    {criticalProducts.length} {criticalProducts.length === 1 ? 'producto' : 'productos'} por debajo del stock mínimo
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="hover:bg-white/20 rounded-xl p-2 transition-colors flex-shrink-0"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Table - Scrollable */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50 dark:bg-[#060B14]">
              <div className="bg-white dark:bg-[#0D1526] rounded-xl shadow-sm dark:shadow-none overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#F8FDFF] dark:bg-[#0A1220] border-b-2 border-slate-200 dark:border-[rgba(72,185,230,0.16)] sticky top-0 z-10">
                        <th className="px-6 py-4 text-left text-xs font-bold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-wider whitespace-nowrap">
                          Producto
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-wider whitespace-nowrap">
                          SKU
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-wider whitespace-nowrap">
                          Categoría
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-wider whitespace-nowrap">
                          Stock Actual
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-wider whitespace-nowrap">
                          Stock Mínimo
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-wider whitespace-nowrap">
                          Faltante
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-wider whitespace-nowrap">
                          Precio Unit.
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {criticalProducts.map((product, index) => (
                        <tr key={product.id} className={`hover:bg-[#F6FCFF] dark:hover:bg-[#0A1220] transition-colors ${index % 2 === 0 ? 'bg-white dark:bg-[#0D1526]' : 'bg-slate-50 dark:bg-[#0A1220]/70'}`}>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-[#14324A] dark:text-[#F8FAFC]">{product.nombre}</div>
                          </td>
                          <td className="px-6 py-4">
                            <code className="text-xs font-mono text-[#5E7184] dark:text-[#B8C2D1] bg-slate-100 dark:bg-[#0A1220] px-3 py-1.5 rounded-lg whitespace-nowrap">
                              {product.sku}
                            </code>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 whitespace-nowrap">
                              {product.categoria}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/40 whitespace-nowrap">
                              <TrendingDown className="w-4 h-4" />
                              {product.stock}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-sm font-semibold text-[#5E7184] dark:text-[#B8C2D1] bg-slate-100 dark:bg-[#0A1220] px-4 py-2 rounded-lg whitespace-nowrap inline-block">
                              {product.stock_minimo}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 whitespace-nowrap">
                              {product.faltante}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-base font-bold text-[#14324A] dark:text-[#F8FAFC] whitespace-nowrap">
                              {formatMoney(product.precio_venta)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-white dark:bg-[#0D1526] px-6 py-5 border-t-2 border-gray-200 dark:border-[rgba(72,185,230,0.16)] flex-shrink-0">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 dark:bg-blue-950/30 p-2 rounded-lg">
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="text-sm text-[#14324A] dark:text-[#B8C2D1]">
                    <strong className="text-blue-600">Sugerencia:</strong> Considera reabastecer estos productos para evitar ventas perdidas
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="bg-gradient-to-r from-gray-700 to-gray-900 hover:from-gray-800 hover:to-black text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
