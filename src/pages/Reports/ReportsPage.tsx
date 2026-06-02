import { AlertTriangle, BarChart2, FileText, TrendingUp, User } from "lucide-react";
import { useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Table from "../../components/ui/Table";
import { formatDate, formatMoney } from "../../lib/format";
import { useToast } from "../../components/ui/Toast";
import { mockKardex, mockSales, mockUsers } from "../../lib/mock";
import { useCatalog } from "../../store/useCatalog";

export default function ReportsPage() {
  const { products } = useCatalog();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("kardex");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [dateFrom, setDateFrom] = useState("2024-10-01");
  const [dateTo, setDateeTo] = useState("2024-10-21");
  const [selectedEmployee, setSelectedEmployee] = useState("");

  // Filtrar kardex
  const filteredKardex = mockKardex.filter((entry) => {
    const matchesProduct = !selectedProduct || entry.productId === selectedProduct;
    const matchesDateFrom = !dateFrom || entry.date >= dateFrom;
    const matchesDateTo = !dateTo || entry.date <= dateTo;
    return matchesProduct && matchesDateFrom && matchesDateTo;
  });

  const kardexTableData = filteredKardex.map((entry) => {
    const product = products.find((p) => p.id === entry.productId);
    return {
      Fecha: formatDate(entry.date),
      Producto: product?.name || "N/A",
      Tipo:
        entry.type === "purchase"
          ? "Compra"
          : entry.type === "sale"
          ? "Venta"
          : entry.type === "adjustment"
          ? "Ajuste"
          : "Devolución",
      Cantidad: entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity.toString(),
      Nota: entry.note || "-",
    };
  });

  // Ventas por día
  const salesByDay = mockSales.reduce((acc, sale) => {
    const day = sale.date;
    if (!acc[day]) {
      acc[day] = { total: 0, count: 0 };
    }
    acc[day].total += sale.total;
    acc[day].count += 1;
    return acc;
  }, {} as Record<string, { total: number; count: number }>);

  const salesByDayData = Object.entries(salesByDay).map(([date, data]) => ({
    Fecha: formatDate(date),
    Ventas: data.count,
    Total: formatMoney(data.total),
    Promedio: formatMoney(data.total / data.count),
  }));

  // Ventas por empleado
  const salesByEmployee = mockSales.reduce((acc, sale) => {
    const empId = sale.employeeId;
    if (!acc[empId]) {
      acc[empId] = { total: 0, count: 0 };
    }
    acc[empId].total += sale.total;
    acc[empId].count += 1;
    return acc;
  }, {} as Record<string, { total: number; count: number }>);

  const salesByEmployeeData = Object.entries(salesByEmployee).map(([empId, data]) => {
    const employee = mockUsers.find((u) => u.id === empId);
    return {
      Empleado: employee?.name || "N/A",
      Ventas: data.count,
      Total: formatMoney(data.total),
      Promedio: formatMoney(data.total / data.count),
    };
  });

  // Productos con stock bajo
  const lowStockProducts = products.filter((p) => p.stock <= p.stockMin);
  const lowStockData = lowStockProducts.map((p) => ({
    SKU: p.sku,
    Producto: p.name,
    "Stock Actual": p.stock,
    "Stock Mínimo": p.stockMin,
    Diferencia: p.stock - p.stockMin,
    Estado: <Badge color="red">Reponer</Badge>,
  }));

  function exportReport() {
    // Simulación de exportación
    const reportName =
      activeTab === "kardex" ? "Kardex" : activeTab === "sales" ? "Ventas" : "Stock Mínimo";
    toast.info(`Exportando reporte de ${reportName} a Excel`);
  }

  const tabs = [
    { id: "kardex", label: "Kardex", icon: <FileText size={16} /> },
    { id: "sales", label: "Ventas", icon: <BarChart2 size={16} /> },
    { id: "lowstock", label: "Stock Mínimo", icon: <AlertTriangle size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50 space-y-6 sm:space-y-8">
      <div className="bg-white/80 dark:bg-slate-900/90 backdrop-blur-sm border-0 shadow-lg rounded-2xl p-6">
        <PageHeader title="Reportes" subtitle="Análisis y estadísticas del negocio" />
      </div>

      {/* Resumen de reportes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-blue-500 to-cyan-600 text-white border-0 shadow-xl rounded-2xl overflow-hidden cursor-pointer hover:scale-105 transition-all duration-200">
          <div className="p-6" onClick={() => setActiveTab("kardex")}>
            <div className="flex items-center justify-between mb-4">
              <FileText size={28} className="text-white/80" />
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">{filteredKardex.length}</div>
            <div className="text-blue-100">Movimientos Kardex</div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0 shadow-xl rounded-2xl overflow-hidden cursor-pointer hover:scale-105 transition-all duration-200">
          <div className="p-6" onClick={() => setActiveTab("sales")}>
            <div className="flex items-center justify-between mb-4">
              <TrendingUp size={28} className="text-white/80" />
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl">💰</span>
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">{mockSales.length}</div>
            <div className="text-emerald-100">Ventas Realizadas</div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-violet-600 text-white border-0 shadow-xl rounded-2xl overflow-hidden cursor-pointer hover:scale-105 transition-all duration-200">
          <div className="p-6" onClick={() => setActiveTab("employees")}>
            <div className="flex items-center justify-between mb-4">
              <User size={28} className="text-white/80" />
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl">👥</span>
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">{Object.keys(salesByEmployee).length}</div>
            <div className="text-purple-100">Empleados Activos</div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 to-rose-600 text-white border-0 shadow-xl rounded-2xl overflow-hidden cursor-pointer hover:scale-105 transition-all duration-200">
          <div className="p-6" onClick={() => setActiveTab("stock")}>
            <div className="flex items-center justify-between mb-4">
              <AlertTriangle size={28} className="text-white/80" />
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl">⚠️</span>
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">{lowStockProducts.length}</div>
            <div className="text-red-100">Stock Bajo</div>
          </div>
        </Card>
      </div>

      {/* Pestañas de reportes */}
      <Card className="bg-white/95 dark:bg-slate-900/98 backdrop-blur-sm border-0 shadow-2xl rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-slate-600 to-gray-700 p-6 text-white">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex flex-wrap gap-3">
              <Button
                variant={activeTab === "kardex" ? "primary" : "ghost"}
                onClick={() => setActiveTab("kardex")}
                className={`font-semibold transition-all duration-200 rounded-xl ${
                  activeTab === "kardex"
                    ? "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-lg hover:scale-105"
                    : "bg-white/20 hover:bg-white/30 text-white border border-white/30"
                }`}
              >
                <FileText size={16} className="mr-2" />
                Kardex
              </Button>
              <Button
                variant={activeTab === "sales" ? "primary" : "ghost"}
                onClick={() => setActiveTab("sales")}
                className={`font-semibold transition-all duration-200 rounded-xl ${
                  activeTab === "sales"
                    ? "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-lg hover:scale-105"
                    : "bg-white/20 hover:bg-white/30 text-white border border-white/30"
                }`}
              >
                <BarChart2 size={16} className="mr-2" />
                Ventas
              </Button>
              <Button
                variant={activeTab === "employees" ? "primary" : "ghost"}
                onClick={() => setActiveTab("employees")}
                className={`font-semibold transition-all duration-200 rounded-xl ${
                  activeTab === "employees"
                    ? "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-lg hover:scale-105"
                    : "bg-white/20 hover:bg-white/30 text-white border border-white/30"
                }`}
              >
                <User size={16} className="mr-2" />
                Empleados
              </Button>
              <Button
                variant={activeTab === "stock" ? "primary" : "ghost"}
                onClick={() => setActiveTab("stock")}
                className={`font-semibold transition-all duration-200 rounded-xl ${
                  activeTab === "stock"
                    ? "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-lg hover:scale-105"
                    : "bg-white/20 hover:bg-white/30 text-white border border-white/30"
                }`}
              >
                <AlertTriangle size={16} className="mr-2" />
                Stock Bajo
              </Button>
            </div>
            <Button
              onClick={exportReport}
              className="w-full lg:w-auto bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 border-0 shadow-lg font-semibold transition-all duration-200 hover:scale-105"
            >
              <FileText size={16} className="mr-2" />
              Exportar Excel
            </Button>
          </div>
        </div>

        {/* Contenido de pestañas */}
        {activeTab === "kardex" && (
          <div className="space-y-6">
            {/* Filtros de kardex */}
            <Card>
              <h3 className="font-medium mb-4">Filtros de Kardex</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Producto</label>
                  <Select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                  >
                    <option value="">Todos los productos</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha Desde</label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha Hasta</label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateeTo(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelectedProduct("");
                      setDateFrom("2024-10-01");
                      setDateeTo("2024-10-21");
                    }}
                    className="w-full"
                  >
                    Limpiar
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="overflow-x-auto">
              <h3 className="font-medium mb-4">Movimientos de Kardex</h3>
              <Table columns={Object.keys(kardexTableData[0] || {})} data={kardexTableData} />
            </Card>
          </div>
        )}

        {activeTab === "sales" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Ventas por día */}
              <Card className="overflow-x-auto">
                <h3 className="font-medium mb-4">Ventas por Día</h3>
                <Table columns={Object.keys(salesByDayData[0] || {})} data={salesByDayData} />
              </Card>

              {/* Gráfico placeholder */}
              <Card>
                <h3 className="font-medium mb-4">Tendencia de Ventas</h3>
                <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <div className="text-center">
                    <BarChart2 className="text-gray-300 dark:text-slate-600 mx-auto mb-2" size={48} />
                    <p className="text-gray-500 dark:text-slate-400">Gráfico de tendencias</p>
                    <p className="text-sm text-gray-400">Implementación futura</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Ventas por empleado */}
            <Card className="overflow-x-auto">
              <h3 className="font-medium mb-4">Ventas por Empleado</h3>
              <Table
                columns={Object.keys(salesByEmployeeData[0] || {})}
                data={salesByEmployeeData}
              />
            </Card>
          </div>
        )}

        {activeTab === "employees" && (
          <div className="space-y-6">
            <Card className="overflow-x-auto">
              <h3 className="font-medium mb-4">Rendimiento por Empleado</h3>
              <Table
                columns={Object.keys(salesByEmployeeData[0] || {})}
                data={salesByEmployeeData}
              />
            </Card>
          </div>
        )}

        {activeTab === "stock" && (
          <div className="space-y-6">
            <Card>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <h3 className="font-medium">Productos con Stock Mínimo</h3>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <AlertTriangle size={16} />
                  {lowStockProducts.length} productos requieren reposición
                </div>
              </div>

              {lowStockProducts.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table columns={Object.keys(lowStockData[0] || {})} data={lowStockData} />
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">✅</div>
                  <p>Todos los productos tienen stock suficiente</p>
                </div>
              )}
            </Card>

            {/* Resumen por categoría */}
            <Card>
              <h3 className="font-medium mb-4">Stock por Categoría</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array.from(new Set(products.map((p) => p.category))).map((category) => {
                  const categoryProducts = products.filter((p) => p.category === category);
                  const lowStockInCategory = categoryProducts.filter((p) => p.stock <= p.stockMin);
                  return (
                    <div key={category} className="p-4 border rounded-lg">
                      <h4 className="font-medium">{category}</h4>
                      <div className="mt-2 space-y-1 text-sm">
                        <div>Total productos: {categoryProducts.length}</div>
                        <div
                          className={
                            lowStockInCategory.length > 0 ? "text-red-600" : "text-green-600"
                          }
                        >
                          Stock bajo: {lowStockInCategory.length}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}
      </Card>
    </div>
  );
}
