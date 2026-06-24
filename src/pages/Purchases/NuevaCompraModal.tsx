import {
  ShoppingCart, Plus, Search, Package, Hash, X, Save,
  Building2, ChevronDown, Wrench, Loader2, CreditCard,
  Landmark, Wallet, AlertTriangle, ExternalLink,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../components/ui/Toast";
import ConfirmModal from "../../components/ui/ConfirmModal";
import { formatMoney } from "../../lib/format";
import { useCatalog } from "../../store/useCatalog";
import { useSuppliersStore } from "../../store/useSuppliers";
import { useRepuestosStore } from "../../store/useRepuestosStore";
import * as purchaseService from "../../services/purchaseService";
import * as TarjetaService from "../../services/tarjetaCreditoService";
import type { TarjetaCredito } from "../../services/tarjetaCreditoService";

// ─────────────────────────────────────────────────────────────────────────────
interface CompraItem {
  producto_id: number;
  sku: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  aplica_serie: boolean;
  series: string[];
  tipo_item: "producto" | "repuesto";
}

interface NuevaCompraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const EMPTY_FORM = () => ({
  fecha_compra: new Date().toISOString().split("T")[0],
  proveedor_id: null as number | null,
  proveedor_nombre: "",
  proveedor_telefono: "",
  proveedor_nit: "",
  proveedor_direccion: "",
  notas: "",
  estado: "CONFIRMADA" as const,
});

// ─── Dark-theme field wrapper ──────────────────────────────────────────────
function DField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-[#7F8A99] uppercase tracking-widest mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-3.5 py-2.5 bg-[#0D1526] border border-[rgba(72,185,230,0.18)] rounded-xl text-sm text-[#F8FAFC] placeholder:text-[#5E7184] focus:outline-none focus:border-[#48B9E6] focus:ring-2 focus:ring-[#48B9E6]/20 transition-all";

// ─────────────────────────────────────────────────────────────────────────────
export default function NuevaCompraModal({
  isOpen,
  onClose,
  onSuccess,
}: NuevaCompraModalProps) {
  const { products, loadProducts } = useCatalog();
  const { suppliers, loadSuppliers } = useSuppliersStore();
  const { repuestos, loadRepuestos } = useRepuestosStore();
  const toast = useToast();
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [searchProduct, setSearchProduct] = useState("");
  const [showSupplierDrop, setShowSupplierDrop] = useState(false);
  const [compraForm, setCompraForm] = useState(EMPTY_FORM);
  const [items, setItems] = useState<CompraItem[]>([]);
  const supplierBtnRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'tarjeta_credito'>('efectivo');
  const [tarjetaId, setTarjetaId] = useState<number | ''>('');
  const [tarjetas, setTarjetas] = useState<TarjetaCredito[]>([]);
  const [cuentaId, setCuentaId] = useState<number | ''>('');
  const [cuentas, setCuentas] = useState<purchaseService.CuentaPago[]>([]);
  const [saldoCaja, setSaldoCaja] = useState(0);
  const [loadingFuentes, setLoadingFuentes] = useState(false);
  const [fuentesError, setFuentesError] = useState("");

  const isDirty = items.length > 0 || compraForm.proveedor_nombre !== "";
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Load catalogs and financial sources when opened
  useEffect(() => {
    if (!isOpen) return;

    loadProducts(1, 9999);
    loadSuppliers();
    loadRepuestos();

    setLoadingFuentes(true);
    setFuentesError("");

    purchaseService
      .getFuentesPago()
      .then((fuentes) => {
        setSaldoCaja(Number(fuentes.saldo_caja || 0));
        setCuentas(fuentes.cuentas || []);
        setTarjetas(fuentes.tarjetas || []);
      })
      .catch((error) => {
        setSaldoCaja(0);
        setCuentas([]);
        setTarjetas([]);
        setFuentesError(
          error.response?.data?.message ||
          "No fue posible consultar los saldos disponibles"
        );
      })
      .finally(() => setLoadingFuentes(false));
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") attemptClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, isDirty]);

  // Close supplier dropdown on outside click
  useEffect(() => {
    if (!showSupplierDrop) return;
    const handler = (e: MouseEvent) => {
      if (supplierBtnRef.current && !supplierBtnRef.current.closest("[data-supplier-drop]")?.contains(e.target as Node)) {
        setShowSupplierDrop(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSupplierDrop]);

  function resetForm() {
    setCompraForm(EMPTY_FORM);
    setItems([]);
    setSearchProduct("");
    setShowSupplierDrop(false);
    setMetodoPago('efectivo');
    setTarjetaId('');
    setCuentaId('');
    setFuentesError('');
  }

  function attemptClose() {
    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }
    resetForm();
    onClose();
  }

  // ── Supplier helpers ─────────────────────────────────────────────────────
  function handleSelectSupplier(sup: any) {
    setCompraForm((f) => ({
      ...f,
      proveedor_id: parseInt(sup.id),
      proveedor_nombre: sup.nombre,
      proveedor_telefono: sup.telefono || "",
      proveedor_nit: sup.nit || "",
      proveedor_direccion: sup.direccion || "",
    }));
    setShowSupplierDrop(false);
  }

  // ── Item helpers ─────────────────────────────────────────────────────────
  function handleAddProduct(product: any, tipo: "producto" | "repuesto") {
    const newItem: CompraItem = {
      producto_id: parseInt(product.id),
      sku: product.sku || product.codigo || "",
      nombre_producto: product.name || product.nombre,
      cantidad: 1,
      precio_unitario:
        tipo === "producto"
          ? product.precioProducto || 0
          : product.precioCosto || 0,
      aplica_serie: tipo === "producto" ? product.aplica_serie || false : false,
      series: [],
      tipo_item: tipo,
    };
    setItems((prev) => [...prev, newItem]);
    setSearchProduct("");
    searchInputRef.current?.focus();
  }

  function handleRemoveItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleUpdateItem(
    index: number,
    field: keyof CompraItem,
    value: any
  ) {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const updated = { ...item, [field]: value };
        if (field === "cantidad" && item.aplica_serie) {
          const newQty = parseInt(value) || 1;
          updated.series =
            newQty > item.series.length
              ? [...item.series, ...Array(newQty - item.series.length).fill("")]
              : item.series.slice(0, newQty);
        }
        return updated;
      })
    );
  }

  function handleUpdateSerie(itemIndex: number, value: string) {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== itemIndex) return item;
        return { ...item, series: Array(item.cantidad).fill(value) };
      })
    );
  }

  // ── Totals ───────────────────────────────────────────────────────────────
  const total = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const totalUnidades = items.reduce((s, i) => s + i.cantidad, 0);

  const cuentaSeleccionada = cuentas.find((cuenta) => cuenta.id === cuentaId);
  const tarjetaSeleccionada = tarjetas.find((tarjeta) => tarjeta.id === tarjetaId);

  const creditoDisponible = tarjetaSeleccionada
    ? Math.max(
        0,
        TarjetaService.centsToQ(
          Number(tarjetaSeleccionada.limite_credito || 0) -
          Number(tarjetaSeleccionada.saldo_centavos || 0)
        )
      )
    : null;

  const saldoFuente =
    metodoPago === 'efectivo'
      ? saldoCaja
      : metodoPago === 'transferencia'
        ? cuentaSeleccionada?.saldo_actual ?? null
        : creditoDisponible;

  const fuenteSinSeleccionar =
    (metodoPago === 'transferencia' && !cuentaId) ||
    (metodoPago === 'tarjeta_credito' && !tarjetaId);

  const fondosInsuficientes =
    saldoFuente !== null &&
    total > Number(saldoFuente) + 0.0001;

  const pagoInvalido =
    loadingFuentes ||
    Boolean(fuentesError) ||
    fuenteSinSeleccionar ||
    fondosInsuficientes ||
    total <= 0;

  // ── Search filter ────────────────────────────────────────────────────────
  const q = searchProduct.toLowerCase();
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.sku || "").toLowerCase().includes(q)
  );
  const filteredRepuestos = repuestos.filter(
    (r) =>
      r.nombre.toLowerCase().includes(q) ||
      (r.sku || "").toLowerCase().includes(q) ||
      (r.codigo || "").toLowerCase().includes(q)
  );
  const hasResults = filteredProducts.length > 0 || filteredRepuestos.length > 0;

  // ── Save ─────────────────────────────────────────────────────────────────
  async function handleSaveCompra() {
    if (!compraForm.proveedor_nombre.trim()) {
      toast.add("El nombre del proveedor es requerido", "error");
      return;
    }

    if (items.length === 0) {
      toast.add("Debes agregar al menos un producto o repuesto", "error");
      return;
    }

    if (total <= 0) {
      toast.add("El total de la compra debe ser mayor que cero", "error");
      return;
    }

    for (const item of items) {
      if (item.aplica_serie && (!item.series[0] || !item.series[0].trim())) {
        toast.add(
          `Ingresa el número de serie para "${item.nombre_producto}"`,
          "error"
        );
        return;
      }
    }

    if (fuentesError) {
      toast.add(fuentesError, "error");
      return;
    }

    if (loadingFuentes) {
      toast.add("Espera mientras se consultan los saldos disponibles", "error");
      return;
    }

    if (metodoPago === 'transferencia' && !cuentaId) {
      toast.add("Selecciona una cuenta bancaria", "error");
      return;
    }

    if (metodoPago === 'tarjeta_credito' && !tarjetaId) {
      toast.add("Selecciona una tarjeta de crédito", "error");
      return;
    }

    if (fondosInsuficientes) {
      toast.add(
        `Fondos insuficientes. Disponible: ${formatMoney(Number(saldoFuente || 0))}`,
        "error"
      );
      return;
    }

    try {
      setSaving(true);

      await purchaseService.createCompra({
        ...compraForm,
        proveedor_id: compraForm.proveedor_id ?? undefined,
        items: items.map((item) => ({
          ...item,
          series:
            item.tipo_item === "producto" && item.aplica_serie
              ? item.series
              : [],
        })),
        metodo_pago: metodoPago,
        tarjeta_id:
          metodoPago === 'tarjeta_credito'
            ? Number(tarjetaId)
            : undefined,
        cuenta_id:
          metodoPago === 'transferencia'
            ? Number(cuentaId)
            : undefined,
      });

      toast.add(
        `✅ Compra registrada. Stock actualizado: +${totalUnidades} unidades`
      );

      resetForm();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.add(
        err.response?.data?.message || "Error al registrar la compra",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) attemptClose();
      }}
    >
      {/* Modal container */}
      <div className="w-full max-w-5xl bg-[#0D1526] rounded-2xl shadow-2xl border border-[rgba(72,185,230,0.22)] flex flex-col max-h-[92vh]">

        {/* ── HEADER ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[rgba(72,185,230,0.14)] shrink-0">
          <div className="flex items-start gap-3">
            <div className="bg-gradient-to-br from-[#2EA7D8] to-[#2563EB] rounded-xl p-2 mt-0.5 shrink-0">
              <ShoppingCart size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F8FAFC] leading-tight">
                Registrar Nueva Compra
              </h2>
              <p className="text-xs text-[#B8C2D1] mt-0.5">
                Ingreso de productos y repuestos al inventario
              </p>
            </div>
          </div>
          <button
            onClick={attemptClose}
            className="rounded-xl p-2 text-[#7F8A99] hover:text-[#F8FAFC] hover:bg-[rgba(72,185,230,0.08)] transition-colors shrink-0 ml-4"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── BODY (scrollable) ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* 1. PROVEEDOR ───────────────────────────────────────────────── */}
          <section className="bg-[#060B14] border border-[rgba(72,185,230,0.12)] rounded-2xl p-5">
            <h3 className="flex items-center gap-2 text-xs font-bold text-[#F8FAFC] uppercase tracking-widest mb-4">
              <Building2 size={14} className="text-[#48B9E6]" />
              Datos del Proveedor
            </h3>

            {/* Supplier selector dropdown */}
            <div className="mb-4 relative" data-supplier-drop="true">
              <label className="block text-[10px] font-semibold text-[#7F8A99] uppercase tracking-widest mb-1.5">
                Seleccionar Proveedor Registrado
              </label>
              <button
                ref={supplierBtnRef}
                type="button"
                onClick={() => setShowSupplierDrop((v) => !v)}
                className="w-full px-4 py-2.5 bg-[#0D1526] border border-[rgba(72,185,230,0.18)] rounded-xl text-left flex items-center justify-between hover:border-[#48B9E6] focus:outline-none focus:border-[#48B9E6] focus:ring-2 focus:ring-[#48B9E6]/20 transition-all"
              >
                <span
                  className={
                    compraForm.proveedor_id
                      ? "text-sm font-semibold text-[#F8FAFC]"
                      : "text-sm text-[#5E7184]"
                  }
                >
                  {compraForm.proveedor_nombre || "Buscar proveedor existente..."}
                </span>
                <ChevronDown
                  size={15}
                  className={`text-[#7F8A99] transition-transform shrink-0 ${showSupplierDrop ? "rotate-180" : ""}`}
                />
              </button>

              {showSupplierDrop && (
                <div className="absolute z-30 w-full mt-1 max-h-56 overflow-y-auto bg-[#0D1526] border border-[rgba(72,185,230,0.25)] rounded-xl shadow-2xl">
                  {suppliers.filter((s) => s.activo).length === 0 ? (
                    <div className="p-4 text-center text-sm text-[#5E7184]">
                      No hay proveedores registrados
                    </div>
                  ) : (
                    suppliers
                      .filter((s) => s.activo)
                      .map((sup) => (
                        <div
                          key={sup.id}
                          onClick={() => handleSelectSupplier(sup)}
                          className="px-4 py-3 hover:bg-[rgba(72,185,230,0.07)] cursor-pointer border-b border-[rgba(72,185,230,0.07)] last:border-0 transition-colors"
                        >
                          <p className="text-sm font-semibold text-[#F8FAFC]">
                            {sup.nombre}
                          </p>
                          <p className="text-xs text-[#7F8A99] mt-0.5">
                            {sup.telefono || ""}
                            {sup.nit ? ` · NIT: ${sup.nit}` : ""}
                          </p>
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>

            {/* Form fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DField label="Nombre del Proveedor *">
                <input
                  className={inputCls}
                  value={compraForm.proveedor_nombre}
                  onChange={(e) =>
                    setCompraForm({ ...compraForm, proveedor_nombre: e.target.value })
                  }
                  placeholder="Ej: Distribuidora XYZ"
                />
              </DField>
              <DField label="Teléfono">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={15}
                  className={inputCls}
                  value={compraForm.proveedor_telefono}
                  onChange={(e) =>
                    setCompraForm({
                      ...compraForm,
                      proveedor_telefono: e.target.value.replace(/\D/g, '').slice(0, 15),
                    })
                  }
                  placeholder="22223333"
                />
              </DField>
              <DField label="NIT">
                <input
                  className={inputCls}
                  value={compraForm.proveedor_nit}
                  onChange={(e) =>
                    setCompraForm({ ...compraForm, proveedor_nit: e.target.value })
                  }
                  placeholder="12345678-9"
                />
              </DField>
              <DField label="Fecha de Compra">
                <input
                  type="date"
                  className={inputCls}
                  value={compraForm.fecha_compra}
                  onChange={(e) =>
                    setCompraForm({ ...compraForm, fecha_compra: e.target.value })
                  }
                />
              </DField>
            </div>
          </section>

          {/* 2. BUSCAR PRODUCTOS / REPUESTOS ────────────────────────────── */}
          <section className="bg-[#060B14] border border-[rgba(72,185,230,0.12)] rounded-2xl p-5">
            <h3 className="flex items-center gap-2 text-xs font-bold text-[#F8FAFC] uppercase tracking-widest mb-4">
              <Package size={14} className="text-[#48B9E6]" />
              Agregar Productos o Repuestos a la Compra
            </h3>

            <div className="relative">
              {/* Search input */}
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5E7184] pointer-events-none"
                />
                <input
                  ref={searchInputRef}
                  value={searchProduct}
                  onChange={(e) => setSearchProduct(e.target.value)}
                  placeholder="Buscar producto o repuesto por nombre o SKU..."
                  className="w-full h-10 pl-10 pr-9 bg-[#0D1526] border border-[rgba(72,185,230,0.18)] rounded-xl text-sm text-[#F8FAFC] placeholder:text-[#5E7184] focus:outline-none focus:border-[#48B9E6] focus:ring-2 focus:ring-[#48B9E6]/20 transition-all"
                />
                {searchProduct && (
                  <button
                    onClick={() => setSearchProduct("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5E7184] hover:text-[#F8FAFC] transition-colors"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Dropdown results */}
              {searchProduct && hasResults && (
                <div className="absolute z-20 w-full mt-1.5 max-h-72 overflow-y-auto bg-[#0D1526] border border-[rgba(72,185,230,0.22)] rounded-xl shadow-2xl">
                  {/* Products section */}
                  {filteredProducts.length > 0 && (
                    <div>
                      <div className="sticky top-0 bg-[#0A1220] px-4 py-2 border-b border-[rgba(72,185,230,0.1)]">
                        <span className="text-[10px] font-bold text-[#48B9E6] uppercase tracking-widest">
                          📦 Productos ({filteredProducts.length})
                        </span>
                      </div>
                      {filteredProducts.slice(0, 8).map((p) => (
                        <div
                          key={`prod-${p.id}`}
                          onClick={() => handleAddProduct(p, "producto")}
                          className="flex items-center justify-between px-4 py-3 hover:bg-[rgba(72,185,230,0.06)] cursor-pointer border-b border-[rgba(72,185,230,0.05)] last:border-0 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#F8FAFC] truncate">
                              {p.name}
                            </p>
                            <p className="text-xs text-[#7F8A99] mt-0.5">
                              SKU: {p.sku} · Stock: {p.stock || 0} ·{" "}
                              {formatMoney(p.precioProducto || 0)}
                            </p>
                          </div>
                          <div className="ml-3 flex items-center gap-1.5 shrink-0">
                            {p.aplica_serie && (
                              <span className="text-[10px] bg-blue-900/50 text-blue-300 border border-blue-700/40 px-1.5 py-0.5 rounded font-semibold">
                                Serie
                              </span>
                            )}
                            <Plus
                              size={15}
                              className="text-[#48B9E6] opacity-60"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Repuestos section */}
                  {filteredRepuestos.length > 0 && (
                    <div>
                      <div className="sticky top-0 bg-[#0A1220] px-4 py-2 border-b border-[rgba(72,185,230,0.1)]">
                        <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">
                          🔧 Repuestos ({filteredRepuestos.length})
                        </span>
                      </div>
                      {filteredRepuestos.slice(0, 8).map((r) => (
                        <div
                          key={`rep-${r.id}`}
                          onClick={() => handleAddProduct(r, "repuesto")}
                          className="flex items-center justify-between px-4 py-3 hover:bg-[rgba(120,80,230,0.06)] cursor-pointer border-b border-[rgba(72,185,230,0.05)] last:border-0 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#F8FAFC] truncate">
                              {r.nombre}
                            </p>
                            <p className="text-xs text-[#7F8A99] mt-0.5">
                              Código: {r.codigo || "N/A"} · Stock: {r.stock || 0}{" "}
                              · {formatMoney(r.precio_venta || 0)}
                            </p>
                          </div>
                          <div className="ml-3 flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] bg-violet-900/50 text-violet-300 border border-violet-700/40 px-1.5 py-0.5 rounded font-semibold">
                              Repuesto
                            </span>
                            <Plus
                              size={15}
                              className="text-violet-400 opacity-60"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {searchProduct && !hasResults && (
                <div className="absolute z-20 w-full mt-1.5 p-4 bg-[#0D1526] border border-[rgba(72,185,230,0.18)] rounded-xl shadow-2xl text-center text-sm text-[#5E7184]">
                  No se encontraron resultados para &ldquo;{searchProduct}&rdquo;
                </div>
              )}
            </div>
          </section>

          {/* 3. DETALLE DE ITEMS ─────────────────────────────────────────── */}
          {items.length > 0 && (
            <section className="bg-[#060B14] border border-[rgba(72,185,230,0.12)] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="flex items-center gap-2 text-xs font-bold text-[#F8FAFC] uppercase tracking-widest">
                  <ShoppingCart size={14} className="text-[#48B9E6]" />
                  Detalle de la Compra ({items.length} ítem
                  {items.length !== 1 ? "s" : ""})
                </h3>
                <span className="text-[10px] text-[#7F8A99] bg-[#0D1526] border border-[rgba(72,185,230,0.12)] px-2.5 py-1 rounded-lg">
                  ⚡ Stock se actualiza al guardar
                </span>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => {
                  const itemData =
                    item.tipo_item === "producto"
                      ? products.find((p) => p.id === String(item.producto_id))
                      : repuestos.find((r) => r.id === String(item.producto_id));
                  const stockActual = itemData?.stock || 0;
                  const isProducto = item.tipo_item === "producto";

                  return (
                    <div
                      key={index}
                      className={`rounded-xl border p-4 ${
                        isProducto
                          ? "bg-[#0A1525] border-[rgba(72,185,230,0.18)]"
                          : "bg-[#10082A] border-[rgba(139,92,246,0.22)]"
                      }`}
                    >
                      {/* Item header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                isProducto
                                  ? "bg-blue-900/40 text-blue-300 border-blue-700/40"
                                  : "bg-violet-900/40 text-violet-300 border-violet-700/40"
                              }`}
                            >
                              {isProducto ? "📦 PRODUCTO" : "🔧 REPUESTO"}
                            </span>
                            {item.aplica_serie && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-amber-900/40 text-amber-300 border-amber-700/40">
                                ⚠️ Serie
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-[#F8FAFC]">
                            {item.nombre_producto}
                          </p>
                          <p className="text-xs text-[#7F8A99] mt-0.5">
                            {isProducto ? "SKU" : "Código"}: {item.sku}
                          </p>
                          {/* Stock preview */}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-[10px] bg-[#0D1526] text-[#B8C2D1] px-2 py-0.5 rounded border border-[rgba(72,185,230,0.1)]">
                              Actual: {stockActual}
                            </span>
                            <span className="text-[10px] text-[#5E7184]">→</span>
                            <span className="text-[10px] bg-emerald-900/30 text-emerald-400 border border-emerald-700/40 px-2 py-0.5 rounded font-semibold">
                              Nuevo: {stockActual + item.cantidad}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="shrink-0 p-1.5 rounded-lg text-[#5E7184] hover:text-red-400 hover:bg-red-900/20 transition-colors"
                          title="Eliminar"
                        >
                          <X size={15} />
                        </button>
                      </div>

                      {/* Quantity & price */}
                      <div className="grid grid-cols-2 gap-3">
                        <DField label="Cantidad">
                          <input
                            type="number"
                            min="1"
                            value={item.cantidad}
                            onChange={(e) =>
                              handleUpdateItem(
                                index,
                                "cantidad",
                                parseInt(e.target.value) || 1
                              )
                            }
                            className="w-full px-3 py-2 bg-[#0D1526] border border-[rgba(72,185,230,0.18)] rounded-lg text-sm text-[#F8FAFC] focus:outline-none focus:border-[#48B9E6] transition-all"
                          />
                        </DField>
                        <DField label="Precio Unitario (Q)">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.precio_unitario}
                            onChange={(e) =>
                              handleUpdateItem(
                                index,
                                "precio_unitario",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full px-3 py-2 bg-[#0D1526] border border-[rgba(72,185,230,0.18)] rounded-lg text-sm text-[#F8FAFC] focus:outline-none focus:border-[#48B9E6] transition-all"
                          />
                        </DField>
                      </div>

                      {/* Serie input */}
                      {item.aplica_serie && (
                        <div className="mt-3 bg-[#0D1526] border border-amber-700/30 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Hash size={13} className="text-amber-400" />
                            <span className="text-xs font-semibold text-amber-300">
                              Número de Serie / IMEI
                            </span>
                          </div>
                          <p className="text-[11px] text-[#7F8A99] mb-2">
                            Se aplicará a las {item.cantidad} unidad
                            {item.cantidad > 1 ? "es" : ""}
                          </p>
                          <input
                            placeholder="Ej: IMEI123456789 o Modelo-XYZ"
                            value={item.series[0] || ""}
                            onChange={(e) =>
                              handleUpdateSerie(index, e.target.value)
                            }
                            className="w-full px-3 py-2 bg-[#060B14] border border-amber-700/30 rounded-lg text-sm text-[#F8FAFC] font-mono placeholder:text-[#5E7184] focus:outline-none focus:border-amber-500 transition-all"
                          />
                          {item.series[0] && (
                            <p className="text-xs text-emerald-400 mt-1.5">
                              ✓ Lista para {item.cantidad} unidad
                              {item.cantidad > 1 ? "es" : ""}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Subtotal */}
                      <div className="mt-3 pt-3 border-t border-[rgba(72,185,230,0.07)] flex justify-end">
                        <span
                          className={`text-sm font-bold ${
                            isProducto ? "text-[#48B9E6]" : "text-violet-400"
                          }`}
                        >
                          Subtotal:{" "}
                          {formatMoney(item.cantidad * item.precio_unitario)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Empty state */}
          {items.length === 0 && (
            <div className="bg-[#060B14] border border-dashed border-[rgba(72,185,230,0.18)] rounded-2xl py-10 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 bg-[#0D1526] rounded-xl flex items-center justify-center">
                <Package size={22} className="text-[#48B9E6] opacity-50" />
              </div>
              <p className="text-sm text-[#5E7184] font-medium">
                Usa el buscador para agregar productos o repuestos
              </p>
            </div>
          )}

          {/* 4. OBSERVACIONES ────────────────────────────────────────────── */}
          <section className="bg-[#060B14] border border-[rgba(72,185,230,0.12)] rounded-2xl p-5">
            <h3 className="text-xs font-bold text-[#F8FAFC] uppercase tracking-widest mb-3">
              Notas / Observaciones
            </h3>
            <textarea
              rows={3}
              value={compraForm.notas}
              onChange={(e) =>
                setCompraForm({ ...compraForm, notas: e.target.value })
              }
              placeholder="Observaciones adicionales sobre esta compra..."
              className="w-full px-3.5 py-3 bg-[#0D1526] border border-[rgba(72,185,230,0.18)] rounded-xl text-sm text-[#F8FAFC] placeholder:text-[#5E7184] focus:outline-none focus:border-[#48B9E6] focus:ring-2 focus:ring-[#48B9E6]/20 transition-all resize-none"
            />
          </section>

          {/* ── MÉTODO DE PAGO ───────────────────────────────────────────── */}
          <section className="space-y-3 border-t border-[rgba(72,185,230,0.14)] pt-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-xs font-bold text-[#7F8A99] uppercase tracking-widest flex items-center gap-2">
                <CreditCard size={13} /> Método de pago
              </h3>

              <button
                type="button"
                onClick={() => navigate("/caja-bancos")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#48B9E6] hover:text-[#7DD3FC] transition-colors"
              >
                Administrar caja y cuentas
                <ExternalLink size={12} />
              </button>
            </div>

            <div className="flex gap-2 flex-wrap">
              {(['efectivo', 'transferencia', 'tarjeta_credito'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMetodoPago(m);

                    if (m !== 'transferencia') {
                      setCuentaId('');
                    }

                    if (m !== 'tarjeta_credito') {
                      setTarjetaId('');
                    }
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                    metodoPago === m
                      ? 'bg-[#48B9E6]/20 border-[#48B9E6] text-[#48B9E6]'
                      : 'border-[rgba(72,185,230,0.18)] text-[#7F8A99] hover:border-[#48B9E6]/40 hover:text-[#B8C2D1]'
                  }`}
                >
                  {m === 'efectivo'
                    ? 'Efectivo'
                    : m === 'transferencia'
                      ? 'Transferencia'
                      : 'Tarjeta de Crédito'}
                </button>
              ))}
            </div>

            {loadingFuentes && (
              <div className="flex items-center gap-2 rounded-xl border border-[rgba(72,185,230,0.18)] bg-[#0D1526] px-3.5 py-3 text-xs text-[#B8C2D1]">
                <Loader2 size={14} className="animate-spin text-[#48B9E6]" />
                Consultando saldos y crédito disponible...
              </div>
            )}

            {fuentesError && !loadingFuentes && (
              <div className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-3 text-xs text-red-200">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>{fuentesError}</span>
              </div>
            )}

            {!loadingFuentes && !fuentesError && metodoPago === 'efectivo' && (
              <div
                className={`rounded-xl border px-4 py-3 ${
                  fondosInsuficientes
                    ? 'border-red-400/30 bg-red-500/10'
                    : 'border-[rgba(72,185,230,0.18)] bg-[#0D1526]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Wallet size={16} className="text-[#48B9E6]" />
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-[#7F8A99]">
                        Saldo disponible en caja
                      </p>
                      <p className="text-sm font-bold text-[#F8FAFC]">
                        {formatMoney(saldoCaja)}
                      </p>
                    </div>
                  </div>

                  {saldoCaja <= 0 && (
                    <button
                      type="button"
                      onClick={() => navigate("/caja-bancos")}
                      className="text-xs font-semibold text-[#48B9E6] hover:text-[#7DD3FC]"
                    >
                      Registrar ingreso
                    </button>
                  )}
                </div>

                {fondosInsuficientes && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-red-200">
                    <AlertTriangle size={13} />
                    La caja no tiene saldo suficiente para esta compra.
                  </p>
                )}
              </div>
            )}

            {!loadingFuentes && !fuentesError && metodoPago === 'transferencia' && (
              <div className="space-y-2">
                <label className="block text-[10px] font-semibold text-[#7F8A99] uppercase tracking-widest">
                  Cuenta bancaria *
                </label>

                {cuentas.length > 0 ? (
                  <>
                    <select
                      value={cuentaId}
                      onChange={(e) => setCuentaId(Number(e.target.value) || '')}
                      className="w-full px-3.5 py-2.5 bg-[#0D1526] border border-[rgba(72,185,230,0.18)] rounded-xl text-sm text-[#F8FAFC] focus:outline-none focus:border-[#48B9E6] focus:ring-2 focus:ring-[#48B9E6]/20 transition-all"
                    >
                      <option value="">— Seleccionar cuenta bancaria —</option>

                      {cuentas.map((cuenta) => (
                        <option key={cuenta.id} value={cuenta.id}>
                          {cuenta.nombre} — {formatMoney(cuenta.saldo_actual)}
                        </option>
                      ))}
                    </select>

                    {cuentaSeleccionada && (
                      <div
                        className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                          fondosInsuficientes
                            ? 'border-red-400/30 bg-red-500/10'
                            : 'border-[rgba(72,185,230,0.18)] bg-[#0D1526]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Landmark size={16} className="text-[#48B9E6]" />
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-[#7F8A99]">
                              Saldo disponible
                            </p>
                            <p className="text-sm font-bold text-[#F8FAFC]">
                              {formatMoney(cuentaSeleccionada.saldo_actual)}
                            </p>
                          </div>
                        </div>

                        {fondosInsuficientes && (
                          <span className="text-xs font-semibold text-red-200">
                            Saldo insuficiente
                          </span>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3">
                    <p className="text-xs text-amber-100">
                      No hay cuentas bancarias activas para realizar la transferencia.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate("/caja-bancos")}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#48B9E6] hover:text-[#7DD3FC]"
                    >
                      Registrar una cuenta bancaria
                      <ExternalLink size={12} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {!loadingFuentes && !fuentesError && metodoPago === 'tarjeta_credito' && (
              <div className="space-y-2">
                <label className="block text-[10px] font-semibold text-[#7F8A99] uppercase tracking-widest">
                  Tarjeta *
                </label>

                {tarjetas.length > 0 ? (
                  <>
                    <select
                      value={tarjetaId}
                      onChange={(e) => setTarjetaId(Number(e.target.value) || '')}
                      className="w-full px-3.5 py-2.5 bg-[#0D1526] border border-[rgba(72,185,230,0.18)] rounded-xl text-sm text-[#F8FAFC] focus:outline-none focus:border-[#48B9E6] focus:ring-2 focus:ring-[#48B9E6]/20 transition-all"
                    >
                      <option value="">— Seleccionar tarjeta —</option>

                      {tarjetas.map((tarjeta) => {
                        const disponible = Math.max(
                          0,
                          TarjetaService.centsToQ(
                            Number(tarjeta.limite_credito || 0) -
                            Number(tarjeta.saldo_centavos || 0)
                          )
                        );

                        return (
                          <option key={tarjeta.id} value={tarjeta.id}>
                            {TarjetaService.formatTarjeta(tarjeta)} — Disponible {formatMoney(disponible)}
                          </option>
                        );
                      })}
                    </select>

                    {tarjetaSeleccionada && creditoDisponible !== null && (
                      <div
                        className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                          fondosInsuficientes
                            ? 'border-red-400/30 bg-red-500/10'
                            : 'border-[rgba(72,185,230,0.18)] bg-[#0D1526]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <CreditCard size={16} className="text-[#48B9E6]" />
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-[#7F8A99]">
                              Crédito disponible
                            </p>
                            <p className="text-sm font-bold text-[#F8FAFC]">
                              {formatMoney(creditoDisponible)}
                            </p>
                          </div>
                        </div>

                        {fondosInsuficientes && (
                          <span className="text-xs font-semibold text-red-200">
                            Crédito insuficiente
                          </span>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3">
                    <p className="text-xs text-amber-100">
                      No hay tarjetas de crédito activas registradas.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate("/caja-bancos")}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#48B9E6] hover:text-[#7DD3FC]"
                    >
                      Registrar una tarjeta
                      <ExternalLink size={12} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* ── FOOTER (sticky) ───────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-[rgba(72,185,230,0.14)] bg-[#060B14] px-6 py-4 rounded-b-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Totals summary */}
            {items.length > 0 ? (
              <div className="flex items-center gap-5 flex-wrap">
                <div>
                  <p className="text-[10px] text-[#7F8A99] uppercase tracking-widest">
                    Ítems
                  </p>
                  <p className="text-lg font-bold text-[#F8FAFC]">
                    {items.length}
                  </p>
                </div>
                <div className="h-8 w-px bg-[rgba(72,185,230,0.12)]" />
                <div>
                  <p className="text-[10px] text-[#7F8A99] uppercase tracking-widest">
                    Unidades
                  </p>
                  <p className="text-lg font-bold text-[#F8FAFC]">
                    {totalUnidades}
                  </p>
                </div>
                <div className="h-8 w-px bg-[rgba(72,185,230,0.12)]" />
                <div>
                  <p className="text-[10px] text-[#7F8A99] uppercase tracking-widest">
                    Total
                  </p>
                  <p className="text-xl font-bold text-[#48B9E6]">
                    {formatMoney(total)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#5E7184]">
                Agrega al menos un producto para continuar
              </p>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 ml-auto">
              <button
                onClick={attemptClose}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[#B8C2D1] border border-[rgba(72,185,230,0.18)] hover:bg-[rgba(72,185,230,0.06)] hover:text-[#F8FAFC] transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCompra}
                disabled={
                  saving ||
                  items.length === 0 ||
                  !compraForm.proveedor_nombre.trim() ||
                  pagoInvalido
                }
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-[#2EA7D8] to-[#2563EB] hover:brightness-110 text-white shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100"
              >
                {saving ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                {saving ? "Guardando..." : "Registrar Compra"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <ConfirmModal
      isOpen={confirmDiscard}
      title="Descartar cambios"
      message="¿Descartar los datos ingresados y cerrar?"
      confirmLabel="Descartar"
      variant="danger"
      onConfirm={() => { setConfirmDiscard(false); resetForm(); onClose(); }}
      onCancel={() => setConfirmDiscard(false)}
    />
    </>
  );
}
