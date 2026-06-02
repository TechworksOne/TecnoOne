import {
  Package,
  Plus,
  Search,
  Box,
  TrendingUp,
  AlertCircle,
  Calendar,
  FileText,
  Eye,
  ShoppingCart,
  Wrench,
  X,
  RefreshCw,
  Ban,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { useCatalog } from "../../store/useCatalog";
import { useRepuestosStore } from "../../store/useRepuestosStore";
import { getAllCompras, anularCompra } from "../../services/purchaseService";
import { useToast } from "../../components/ui/Toast";
import Modal from "../../components/ui/Modal";
import NuevaCompraModal from "./NuevaCompraModal";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const fmtQ = (v: unknown): string => `Q ${toNum(v).toFixed(2)}`;

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon, gradient,
}: {
  label: string; value: string | number; sub: string; icon: React.ReactNode; gradient: string;
}) {
  return (
    <div className={`${gradient} rounded-2xl p-4 text-white flex items-center justify-between`}>
      <div>
        <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-bold mt-0.5 leading-none">{value}</p>
        <p className="text-white/60 text-[11px] mt-1">{sub}</p>
      </div>
      <div className="bg-white/20 rounded-xl p-2.5 shrink-0">{icon}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PurchasesPage() {
  const { products, loadProducts } = useCatalog();
  const { repuestos, loadRepuestos } = useRepuestosStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "in" | "low" | "out">("all");
  const [compras, setCompras] = useState<any[]>([]);
  const [loadingCompras, setLoadingCompras] = useState(false);
  const [selectedCompra, setSelectedCompra] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showNuevaCompra, setShowNuevaCompra] = useState(false);
  const [activeTab, setActiveTab] = useState<"inventario" | "historial">("inventario");
  const [inventarioTipo, setInventarioTipo] = useState<"productos" | "repuestos">("productos");
  const [confirmAnular, setConfirmAnular] = useState<{ id: number; numero: string } | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const [anulando, setAnulando] = useState(false);
  const toast = useToast();

  useEffect(() => {
    loadProducts();
    loadRepuestos();
    loadCompras();
  }, []);

  const loadCompras = async () => {
    try {
      setLoadingCompras(true);
      const response = await getAllCompras({ limit: 100 });
      setCompras(response.data || []);
    } catch (error) {
      console.error("Error al cargar compras:", error);
    } finally {
      setLoadingCompras(false);
    }
  };

  const handleViewDetails = (compraId: number) => {
    const compra = compras.find((c) => c.id === compraId);
    if (compra) { setSelectedCompra(compra); setShowDetailModal(true); }
  };

  const handleConfirmAnular = async () => {
    if (!confirmAnular) return;
    setAnulando(true);
    try {
      await anularCompra(confirmAnular.id, motivoAnulacion);
      toast.add(`Compra ${confirmAnular.numero} anulada. Stock revertido.`, "success");
      setConfirmAnular(null);
      setMotivoAnulacion("");
      loadCompras();
      loadProducts();
      loadRepuestos();
    } catch (err: any) {
      toast.add(err?.response?.data?.message || "Error al anular la compra", "error");
    } finally {
      setAnulando(false);
    }
  };

  // ── Stock filter helper ───────────────────────────────────────────────────
  const passStockFilter = (stock: number, low: number) => {
    if (stockFilter === "all") return true;
    if (stockFilter === "out") return stock === 0;
    if (stockFilter === "low") return stock > 0 && stock < low;
    if (stockFilter === "in") return stock >= low;
    return true;
  };

  // ── Filtered lists ────────────────────────────────────────────────────────
  const filteredProducts = products.filter((p) => {
    const s = searchTerm.toLowerCase();
    const ok = !searchTerm ||
      p.name.toLowerCase().includes(s) ||
      (p.sku || "").toLowerCase().includes(s) ||
      (p.category || "").toLowerCase().includes(s);
    return ok && passStockFilter(toNum(p.stock), 10);
  });

  const filteredRepuestos = repuestos.filter((r) => {
    const s = searchTerm.toLowerCase();
    const ok = !searchTerm ||
      r.nombre.toLowerCase().includes(s) ||
      (r.sku || "").toLowerCase().includes(s) ||
      (r.tipo || "").toLowerCase().includes(s) ||
      (r.marca || "").toLowerCase().includes(s) ||
      (r.modelo || "").toLowerCase().includes(s);
    return ok && passStockFilter(toNum(r.stock), 5);
  });

  // ── Metrics ───────────────────────────────────────────────────────────────
  const totalProductos = products.length;
  const totalStockProd = products.reduce((s, p) => s + toNum(p.stock), 0);
  const productosConSerie = products.filter((p) => p.aplica_serie).length;
  const productosBajoStock = products.filter((p) => {
    const st = toNum(p.stock);
    return st > 0 && st < 10;
  }).length;

  const totalRepuestos = repuestos.length;
  const totalStockRep = repuestos.reduce((s, r) => s + toNum(r.stock), 0);
  const tiposRepuestos = new Set(repuestos.map((r) => r.tipo).filter(Boolean)).size;
  const repuestosBajoStock = repuestos.filter((r) => {
    const st = toNum(r.stock);
    return st > 0 && st < 5;
  }).length;

  const totalCompras = compras.length;
  const totalInvertido = compras.reduce((s, c) => s + toNum(c.total), 0);

  // ── Badge helpers ─────────────────────────────────────────────────────────
  const stockBadge = (stock: number, threshold: number) => {
    if (stock === 0) return { label: "Sin Stock", cls: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" };
    if (stock < threshold) return { label: "Stock Bajo", cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" };
    return { label: "En Stock", cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" };
  };

  const getEstadoBadge = (estado: string) => {
    const m: Record<string, { cls: string; label: string }> = {
      CONFIRMADA: { cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400", label: "Confirmada" },
      RECIBIDA:   { cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400", label: "Recibida" },
      BORRADOR:   { cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",   label: "Borrador" },
      CANCELADA:  { cls: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",           label: "Cancelada" },
    };
    return m[estado] || { cls: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400", label: estado };
  };

  const STOCK_FILTERS = [
    { key: "all" as const, label: "Todos" },
    { key: "in"  as const, label: "Con stock" },
    { key: "low" as const, label: "Stock bajo" },
    { key: "out" as const, label: "Sin stock" },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-screen-2xl">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] font-bold text-[#48B9E6] mb-1">
            Gestión de Inventario
          </p>
          <h1 className="text-2xl font-bold text-[#14324A] dark:text-[#F8FAFC] flex items-center gap-2">
            <ShoppingCart size={22} className="text-[#48B9E6]" />
            Compras
          </h1>
          <p className="text-sm text-[#5E7184] dark:text-[#B8C2D1] mt-0.5">
            Inventario de productos, repuestos e historial de compras
          </p>
        </div>
        <button
          onClick={() => setShowNuevaCompra(true)}
          className="shrink-0 flex items-center gap-2 bg-gradient-to-r from-[#2EA7D8] to-[#2563EB] hover:brightness-110 text-white font-semibold rounded-2xl px-5 py-2.5 text-sm shadow-sm transition-all self-start"
        >
          <Plus size={16} />
          Nueva Compra
        </button>
      </div>

      {/* ── Main Tabs ────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-[#F8FDFF] dark:bg-[#0A1220] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] p-1 rounded-2xl w-fit">
        {(["inventario", "historial"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === tab
                ? "bg-white dark:bg-[#0D1526] shadow-sm text-[#14324A] dark:text-[#F8FAFC] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)]"
                : "text-[#5E7184] dark:text-[#B8C2D1] hover:text-[#14324A] dark:hover:text-[#F8FAFC]"
            }`}
          >
            {tab === "inventario" ? <Box size={15} /> : <FileText size={15} />}
            {tab === "inventario" ? "Inventario" : `Historial (${totalCompras})`}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: INVENTARIO                                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "inventario" && (
        <>
          {/* Sub-tabs */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setInventarioTipo("productos"); setSearchTerm(""); setStockFilter("all"); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                inventarioTipo === "productos"
                  ? "bg-gradient-to-r from-[#2EA7D8] to-[#2563EB] text-white border-transparent"
                  : "bg-white dark:bg-[#0D1526] text-[#5E7184] dark:text-[#B8C2D1] border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] hover:border-[#48B9E6]"
              }`}
            >
              <Package size={13} />
              Productos
              <span className="opacity-70">({totalProductos})</span>
            </button>
            <button
              onClick={() => { setInventarioTipo("repuestos"); setSearchTerm(""); setStockFilter("all"); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                inventarioTipo === "repuestos"
                  ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white border-transparent"
                  : "bg-white dark:bg-[#0D1526] text-[#5E7184] dark:text-[#B8C2D1] border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] hover:border-violet-400"
              }`}
            >
              <Wrench size={13} />
              Repuestos
              <span className="opacity-70">({totalRepuestos})</span>
            </button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {inventarioTipo === "productos" ? (
              <>
                <KpiCard label="Total Productos" value={totalProductos} sub="registrados" icon={<Box size={17} />} gradient="bg-gradient-to-br from-blue-500 to-indigo-600" />
                <KpiCard label="Unidades en Stock" value={totalStockProd} sub="disponibles" icon={<TrendingUp size={17} />} gradient="bg-gradient-to-br from-emerald-500 to-green-600" />
                <KpiCard label="Con Número de Serie" value={productosConSerie} sub="equipos con serie" icon={<Package size={17} />} gradient="bg-gradient-to-br from-violet-500 to-purple-600" />
                <KpiCard label="Stock Bajo" value={productosBajoStock} sub="requieren reposición" icon={<AlertCircle size={17} />} gradient="bg-gradient-to-br from-orange-500 to-rose-500" />
              </>
            ) : (
              <>
                <KpiCard label="Total Repuestos" value={totalRepuestos} sub="registrados" icon={<Wrench size={17} />} gradient="bg-gradient-to-br from-violet-500 to-purple-600" />
                <KpiCard label="Unidades en Stock" value={totalStockRep} sub="disponibles" icon={<TrendingUp size={17} />} gradient="bg-gradient-to-br from-emerald-500 to-green-600" />
                <KpiCard label="Tipos de Repuestos" value={tiposRepuestos} sub="tipos distintos" icon={<Box size={17} />} gradient="bg-gradient-to-br from-blue-500 to-indigo-600" />
                <KpiCard label="Stock Bajo" value={repuestosBajoStock} sub="requieren reposición" icon={<AlertCircle size={17} />} gradient="bg-gradient-to-br from-orange-500 to-rose-500" />
              </>
            )}
          </div>

          {/* Search & Filters */}
          <div className="bg-white dark:bg-[#0D1526] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] rounded-3xl p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7F8A99] pointer-events-none" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  inventarioTipo === "productos"
                    ? "Buscar por nombre, SKU o categoría…"
                    : "Buscar por nombre, SKU, tipo, marca o modelo…"
                }
                className="w-full h-12 rounded-2xl pl-10 pr-4 bg-[#F8FDFF] dark:bg-[#060B14] text-[#14324A] dark:text-[#F8FAFC] placeholder:text-[#7F8A99] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] focus:border-[#48B9E6] focus:ring-2 focus:ring-[#48B9E6]/20 outline-none text-sm transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7F8A99] hover:text-[#14324A] dark:hover:text-[#F8FAFC]"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap shrink-0">
              {STOCK_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStockFilter(f.key)}
                  className={`h-9 px-3 rounded-xl text-xs font-semibold transition-all border ${
                    stockFilter === f.key
                      ? "bg-[#48B9E6] border-[#48B9E6] text-white"
                      : "border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] text-[#5E7184] dark:text-[#B8C2D1] hover:border-[#48B9E6] bg-transparent"
                  }`}
                >
                  {f.label}
                </button>
              ))}
              {(searchTerm || stockFilter !== "all") && (
                <button
                  onClick={() => { setSearchTerm(""); setStockFilter("all"); }}
                  className="h-9 px-3 rounded-xl text-xs font-semibold border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] text-[#5E7184] dark:text-[#B8C2D1] hover:text-red-500 hover:border-red-300 flex items-center gap-1 transition-all"
                >
                  <RefreshCw size={11} /> Limpiar
                </button>
              )}
            </div>
            <span className="text-xs text-[#5E7184] dark:text-[#B8C2D1] whitespace-nowrap self-center shrink-0">
              {inventarioTipo === "productos"
                ? `${filteredProducts.length} producto${filteredProducts.length !== 1 ? "s" : ""}`
                : `${filteredRepuestos.length} repuesto${filteredRepuestos.length !== 1 ? "s" : ""}`}
            </span>
          </div>

          {/* ── Lista de Productos ────────────────────────────────────────── */}
          {inventarioTipo === "productos" && (
            filteredProducts.length === 0 ? (
              <div className="bg-white dark:bg-[#0D1526] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] rounded-2xl py-16 flex flex-col items-center gap-3 text-center">
                <div className="w-14 h-14 bg-[#F8FDFF] dark:bg-[#0A1220] rounded-2xl flex items-center justify-center">
                  <Package size={26} className="text-[#48B9E6]" />
                </div>
                <p className="font-semibold text-[#14324A] dark:text-[#F8FAFC]">
                  {searchTerm || stockFilter !== "all" ? "Sin resultados" : "No hay productos registrados"}
                </p>
                <p className="text-sm text-[#5E7184] dark:text-[#B8C2D1]">
                  {searchTerm || stockFilter !== "all" ? "Intenta con otro término o filtro" : "Crea productos primero para registrar compras"}
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#0D1526] rounded-2xl border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] overflow-hidden">
                <div className="hidden sm:flex items-center gap-3 px-4 py-3 bg-[#F8FDFF] dark:bg-[#0A1220] border-b border-[#D6EEF8] dark:border-[rgba(72,185,230,0.12)]">
                  <div className="w-10 shrink-0" />
                  <p className="flex-1 text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest">Producto</p>
                  <p className="w-20 text-right text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest shrink-0">Stock</p>
                  <p className="w-28 text-right text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest shrink-0">Costo</p>
                  <p className="w-28 text-right text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest shrink-0">Venta</p>
                  <p className="w-24 text-center text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest shrink-0">Estado</p>
                </div>
                {filteredProducts.map((product) => {
                  const stock = toNum(product.stock);
                  const sb = stockBadge(stock, 10);
                  return (
                    <div
                      key={product.id}
                      className="flex flex-wrap sm:flex-nowrap items-center gap-3 px-4 py-3 hover:bg-[#F8FDFF] dark:hover:bg-[#0A1220] transition-colors border-b border-[#D6EEF8] dark:border-[rgba(72,185,230,0.08)] last:border-0"
                    >
                      <div className="w-10 h-10 bg-[#F8FDFF] dark:bg-[#0A1220] rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                        {product.image
                          ? <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                          : <Package size={17} className="text-[#48B9E6]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-[#14324A] dark:text-[#F8FAFC] truncate">{product.name}</p>
                          {product.aplica_serie && (
                            <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-semibold">Serie</span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#7F8A99] mt-0.5">SKU: {product.sku} · {product.category || "Sin categoría"}</p>
                      </div>
                      <div className="sm:w-20 text-right shrink-0">
                        <p className="text-sm font-bold text-[#14324A] dark:text-[#F8FAFC]">{stock}</p>
                        <p className="text-[10px] text-[#7F8A99]">unidades</p>
                      </div>
                      <div className="sm:w-28 text-right shrink-0">
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{fmtQ(product.precioProducto)}</p>
                        <p className="text-[10px] text-[#7F8A99]">costo</p>
                      </div>
                      <div className="sm:w-28 text-right shrink-0">
                        <p className="text-sm font-semibold text-[#48B9E6]">{fmtQ(product.precioPublico)}</p>
                        <p className="text-[10px] text-[#7F8A99]">venta</p>
                      </div>
                      <div className="sm:w-24 flex sm:justify-center shrink-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${sb.cls}`}>{sb.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* ── Lista de Repuestos ───────────────────────────────────────── */}
          {inventarioTipo === "repuestos" && (
            filteredRepuestos.length === 0 ? (
              <div className="bg-white dark:bg-[#0D1526] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] rounded-2xl py-16 flex flex-col items-center gap-3 text-center">
                <div className="w-14 h-14 bg-[#F8FDFF] dark:bg-[#0A1220] rounded-2xl flex items-center justify-center">
                  <Wrench size={26} className="text-violet-500" />
                </div>
                <p className="font-semibold text-[#14324A] dark:text-[#F8FAFC]">
                  {searchTerm || stockFilter !== "all" ? "Sin resultados" : "No hay repuestos registrados"}
                </p>
                <p className="text-sm text-[#5E7184] dark:text-[#B8C2D1]">
                  {searchTerm || stockFilter !== "all" ? "Intenta con otro término o filtro" : "Crea repuestos primero para registrar compras"}
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#0D1526] rounded-2xl border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] overflow-hidden">
                <div className="hidden sm:flex items-center gap-3 px-4 py-3 bg-[#F8FDFF] dark:bg-[#0A1220] border-b border-[#D6EEF8] dark:border-[rgba(72,185,230,0.12)]">
                  <div className="w-10 shrink-0" />
                  <p className="flex-1 text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest">Repuesto</p>
                  <p className="w-20 text-right text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest shrink-0">Stock</p>
                  <p className="w-28 text-right text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest shrink-0">Costo</p>
                  <p className="w-28 text-right text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest shrink-0">Venta</p>
                  <p className="w-24 text-center text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest shrink-0">Estado</p>
                </div>
                {filteredRepuestos.map((repuesto) => {
                  const stock = toNum(repuesto.stock);
                  const sb = stockBadge(stock, 5);
                  return (
                    <div
                      key={repuesto.id}
                      className="flex flex-wrap sm:flex-nowrap items-center gap-3 px-4 py-3 hover:bg-[#F8FDFF] dark:hover:bg-[#0A1220] transition-colors border-b border-[#D6EEF8] dark:border-[rgba(72,185,230,0.08)] last:border-0"
                    >
                      <div className="w-10 h-10 bg-[#F8FDFF] dark:bg-[#0A1220] rounded-xl flex items-center justify-center shrink-0">
                        <Wrench size={17} className="text-violet-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#14324A] dark:text-[#F8FAFC] truncate">{repuesto.nombre}</p>
                        <p className="text-[11px] text-[#7F8A99] mt-0.5">
                          SKU: {repuesto.sku || "N/A"} · {repuesto.tipo || "N/A"}
                          {repuesto.marca ? ` · ${repuesto.marca}` : ""}
                        </p>
                      </div>
                      <div className="sm:w-20 text-right shrink-0">
                        <p className="text-sm font-bold text-[#14324A] dark:text-[#F8FAFC]">{stock}</p>
                        <p className="text-[10px] text-[#7F8A99]">unidades</p>
                      </div>
                      <div className="sm:w-28 text-right shrink-0">
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{fmtQ(repuesto.precioCosto)}</p>
                        <p className="text-[10px] text-[#7F8A99]">costo</p>
                      </div>
                      <div className="sm:w-28 text-right shrink-0">
                        <p className="text-sm font-semibold text-[#48B9E6]">{fmtQ(repuesto.precio)}</p>
                        <p className="text-[10px] text-[#7F8A99]">venta</p>
                      </div>
                      <div className="sm:w-24 flex sm:justify-center shrink-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${sb.cls}`}>{sb.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: HISTORIAL                                                       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "historial" && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <KpiCard label="Total Compras" value={totalCompras} sub="registradas" icon={<FileText size={17} />} gradient="bg-gradient-to-br from-violet-500 to-purple-600" />
            <KpiCard label="Total Invertido" value={fmtQ(totalInvertido)} sub="en compras" icon={<TrendingUp size={17} />} gradient="bg-gradient-to-br from-emerald-500 to-green-600" />
          </div>

          {loadingCompras ? (
            <div className="bg-white dark:bg-[#0D1526] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] rounded-2xl py-16 flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-9 w-9 border-2 border-[#48B9E6] border-t-transparent" />
              <p className="text-sm text-[#5E7184] dark:text-[#B8C2D1]">Cargando historial…</p>
            </div>
          ) : compras.length === 0 ? (
            <div className="bg-white dark:bg-[#0D1526] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] rounded-2xl py-16 flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 bg-[#F8FDFF] dark:bg-[#0A1220] rounded-2xl flex items-center justify-center">
                <FileText size={26} className="text-[#48B9E6]" />
              </div>
              <p className="font-semibold text-[#14324A] dark:text-[#F8FAFC]">No hay compras registradas</p>
              <p className="text-sm text-[#5E7184] dark:text-[#B8C2D1]">Aún no has registrado ninguna compra</p>
              <button
                onClick={() => setShowNuevaCompra(true)}
                className="mt-1 flex items-center gap-1.5 bg-gradient-to-r from-[#2EA7D8] to-[#2563EB] text-white text-sm rounded-xl px-4 py-2 hover:brightness-110"
              >
                <Plus size={14} /> Registrar Primera Compra
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#0D1526] rounded-2xl border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] overflow-hidden">
              <div className="hidden sm:flex items-center gap-3 px-4 py-3 bg-[#F8FDFF] dark:bg-[#0A1220] border-b border-[#D6EEF8] dark:border-[rgba(72,185,230,0.12)]">
                <p className="flex-1 text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest">Compra / Proveedor</p>
                <p className="w-32 text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest shrink-0">Fecha</p>
                <p className="w-28 text-right text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest shrink-0">Total</p>
                <p className="w-24 text-center text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest shrink-0">Estado</p>
                <p className="w-24 shrink-0" />
              </div>
              {compras.map((compra) => {
                const eb = getEstadoBadge(compra.estado);
                return (
                  <div
                    key={compra.id}
                    className="flex flex-wrap sm:flex-nowrap items-center gap-3 px-4 py-3 hover:bg-[#F8FDFF] dark:hover:bg-[#0A1220] transition-colors border-b border-[#D6EEF8] dark:border-[rgba(72,185,230,0.08)] last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#14324A] dark:text-[#F8FAFC]">{compra.numero_compra}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[#7F8A99] mt-0.5">
                        <span>{compra.proveedor_nombre}</span>
                        {compra.proveedor_telefono && <span>{compra.proveedor_telefono}</span>}
                      </div>
                      {compra.notas && <p className="text-[11px] text-[#7F8A99] mt-0.5 truncate max-w-xs">{compra.notas}</p>}
                    </div>
                    <div className="sm:w-32 shrink-0">
                      <p className="text-xs text-[#7F8A99] flex items-center gap-1">
                        <Calendar size={11} />
                        {new Date(compra.fecha_compra).toLocaleDateString("es-GT")}
                      </p>
                    </div>
                    <div className="sm:w-28 text-right shrink-0">
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{fmtQ(compra.total)}</p>
                    </div>
                    <div className="sm:w-24 flex sm:justify-center shrink-0">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${eb.cls}`}>{eb.label}</span>
                    </div>
                    <div className="sm:w-24 flex justify-end gap-1.5 shrink-0">
                      <button
                        onClick={() => handleViewDetails(compra.id)}
                        title="Ver detalle"
                        className="p-1.5 rounded-lg hover:bg-[#F8FDFF] dark:hover:bg-[#0A1220] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] text-[#5E7184] dark:text-[#B8C2D1] transition-colors"
                      >
                        <Eye size={14} />
                      </button>
                      {compra.estado !== "CANCELADA" && (
                        <button
                          onClick={() => { setConfirmAnular({ id: compra.id, numero: compra.numero_compra }); setMotivoAnulacion(""); }}
                          title="Anular compra"
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] hover:border-red-300 dark:hover:border-red-800 text-[#5E7184] dark:text-[#B8C2D1] hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
                          <Ban size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Detail Modal ──────────────────────────────────────────────────── */}
      {showDetailModal && selectedCompra && (
        <Modal
          isOpen={showDetailModal}
          onClose={() => { setShowDetailModal(false); setSelectedCompra(null); }}
          title={`Detalles — ${selectedCompra.numero_compra}`}
          size="3xl"
        >
          <div className="space-y-4">
            <div className="bg-[#F8FDFF] dark:bg-[#0A1220] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.14)] rounded-2xl p-4">
              <p className="text-[10px] font-bold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest mb-3">Proveedor</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Nombre",    value: selectedCompra.proveedor_nombre },
                  { label: "Teléfono",  value: selectedCompra.proveedor_telefono || "N/A" },
                  { label: "NIT",       value: selectedCompra.proveedor_nit || "N/A" },
                  { label: "Dirección", value: selectedCompra.proveedor_direccion || "N/A" },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-[10px] text-[#7F8A99]">{item.label}</p>
                    <p className="text-sm font-medium text-[#14324A] dark:text-[#F8FAFC]">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#F8FDFF] dark:bg-[#0A1220] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.14)] rounded-2xl p-3">
                <p className="text-[10px] text-[#7F8A99]">Subtotal</p>
                <p className="text-lg font-bold text-[#14324A] dark:text-[#F8FAFC]">{fmtQ(selectedCompra.subtotal)}</p>
              </div>
              <div className="bg-[#F8FDFF] dark:bg-[#0A1220] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.14)] rounded-2xl p-3">
                <p className="text-[10px] text-[#7F8A99]">Impuestos</p>
                <p className="text-lg font-bold text-[#14324A] dark:text-[#F8FAFC]">{fmtQ(selectedCompra.impuestos)}</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-3 text-white">
                <p className="text-[10px] text-green-100">Total</p>
                <p className="text-lg font-bold">{fmtQ(selectedCompra.total)}</p>
              </div>
            </div>
            {selectedCompra.notas && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-2xl p-3">
                <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 mb-1">Notas</p>
                <p className="text-sm text-[#14324A] dark:text-[#F8FAFC]">{selectedCompra.notas}</p>
              </div>
            )}
            <p className="text-[11px] text-[#7F8A99] text-center">
              Registrado el {new Date(selectedCompra.created_at).toLocaleString("es-GT")}
            </p>
          </div>
        </Modal>
      )}

      {/* ── Confirm Anular Modal ──────────────────────────────────────── */}
      {confirmAnular && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-[#0D1526] rounded-2xl shadow-2xl w-full max-w-md border border-red-200 dark:border-red-900/50 overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20">
              <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                <Ban size={18} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-red-800 dark:text-red-300">Anular Compra</h3>
                <p className="text-xs text-red-600 dark:text-red-400">{confirmAnular.numero}</p>
              </div>
              <button onClick={() => setConfirmAnular(null)} className="ml-auto p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400">
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-[#14324A] dark:text-[#F8FAFC]">
                Esta acción <span className="font-semibold">revertirá el stock</span> de todos los productos/repuestos incluidos en la compra y no se puede deshacer.
              </p>
              <div>
                <label className="block text-xs font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-wide mb-1.5">
                  Motivo de anulación (opcional)
                </label>
                <input
                  autoFocus
                  type="text"
                  value={motivoAnulacion}
                  onChange={(e) => setMotivoAnulacion(e.target.value)}
                  placeholder="Ej: Error en datos, compra duplicada..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] bg-[#F8FDFF] dark:bg-[#060B14] text-sm text-[#14324A] dark:text-[#F8FAFC] placeholder:text-[#7F8A99] focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400"
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirmAnular()}
                />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)]">
              <button
                onClick={() => setConfirmAnular(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] text-sm font-medium text-[#5E7184] dark:text-[#B8C2D1] hover:bg-[#F8FDFF] dark:hover:bg-[#0A1220] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmAnular}
                disabled={anulando}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {anulando ? "Anulando..." : <><Ban size={14} /> Confirmar Anulación</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <NuevaCompraModal
        isOpen={showNuevaCompra}
        onClose={() => setShowNuevaCompra(false)}
        onSuccess={() => {
          loadCompras();
          loadProducts();
          loadRepuestos();
        }}
      />
    </div>
  );
}
