import { Package, Plus, Search, Eye, AlertTriangle, Tag, Sparkles, ChevronDown, Trash2, Pencil, Power, PowerOff } from "lucide-react";
import { useState, useEffect } from "react";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import Select from "../../components/ui/Select";
import { useToast } from "../../components/ui/Toast";
import ConfirmModal from "../../components/ui/ConfirmModal";
import { formatMoney } from "../../lib/format";
import { useCatalog } from "../../store/useCatalog";
import { Product } from "../../types/product";
import * as categoryService from "../../services/categoryService";
import { StockAlertsWidget } from "../../components/common/StockAlertsWidget";
import { useAuth } from "../../store/useAuth";
import { canViewCosts } from "../../lib/permissions";
import { getImageUrl } from "../../utils/getImageUrl";
import { printBarcode } from "../../lib/printBarcode";

// ─── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, gradient }: {
  label: string; value: string | number; sub?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  gradient: string;
}) {
  return (
    <div className={`rounded-2xl p-4 ${gradient} dark:bg-none dark:bg-[var(--color-surface)] dark:border dark:border-[var(--color-border)]`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium text-white/70 dark:text-[var(--color-text-sec)] uppercase tracking-widest">{label}</p>
          <p className="text-2xl font-bold text-white dark:text-[var(--color-text)] mt-1">{value}</p>
          {sub && <p className="text-[11px] text-white/60 dark:text-[var(--color-text-muted)] mt-0.5">{sub}</p>}
        </div>
        <div className="bg-white/20 dark:bg-[rgba(var(--tenant-primary-rgb),0.12)] rounded-xl p-2 shrink-0">
          <Icon size={18} className="text-white dark:text-[var(--tenant-primary-color)]" />
        </div>
      </div>
    </div>
  );
}

const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Crect fill='%23e5e7eb' width='48' height='48'/%3E%3Ctext fill='%239ca3af' font-family='system-ui' font-size='9' x='50%25' y='57%25' dominant-baseline='middle' text-anchor='middle'%3ESin img%3C/text%3E%3C/svg%3E";

function ProductRow({ product, onEdit, onView, onToggle, onStock, getImage, capitalize }: {
  product: Product;
  onEdit: (p: Product) => void;
  onView: (p: Product) => void;
  onToggle: (p: Product) => void;
  onStock: (id: string) => void;
  getImage: (p: Product) => string;
  capitalize: (s: string) => string;
}) {
  const { user } = useAuth();
  const showCost = canViewCosts(user?.roles);
  const lowStock = product.stock <= product.stockMin && product.stock > 0;
  const noStock = product.stock === 0;

  const stockColor = noStock
    ? 'text-red-600 dark:text-red-400'
    : lowStock
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-[#14324A] dark:text-[#F8FAFC]';

  const statusCls = noStock
    ? 'bg-red-50 dark:bg-[#202124] dark:border dark:border-red-900/50 text-red-600 dark:text-red-400'
    : lowStock
    ? 'bg-amber-50 dark:bg-[#202124] dark:border dark:border-amber-900/50 text-amber-600 dark:text-amber-400'
    : product.active
    ? 'bg-emerald-50 dark:bg-[#202124] dark:border dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400'
    : 'bg-slate-100 dark:bg-[#202124] dark:border dark:border-[#303134] text-slate-400 dark:text-[#9AA0A6]';

  const statusLabel = noStock ? 'Sin stock' : lowStock ? 'Stock bajo' : product.active ? 'Activo' : 'Inactivo';
  const actionBtn = "p-1.5 rounded-lg transition-colors text-[#5E7184] dark:text-[#B8C2D1] hover:text-[#48B9E6] hover:bg-[rgba(72,185,230,0.10)]";

  return (
    <div>
      {/* ─ Desktop row (md+) ─ */}
      <div className="hidden md:flex items-center gap-3 px-4 py-3 hover:bg-[#F6FCFF] dark:hover:bg-[var(--color-row-hover)] transition-colors">
        <img
          src={getImage(product)}
          alt={product.name}
          loading="lazy"
          decoding="async"
          className="w-11 h-11 rounded-xl object-cover shrink-0 bg-slate-100 dark:bg-[var(--color-surface-soft)] border border-slate-100 dark:border-[var(--color-border)]"
          onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#14324A] dark:text-[#F8FAFC] truncate leading-tight">{product.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[10px] font-mono bg-sky-50 dark:bg-[#202124] text-sky-700 dark:text-[#60A5FA] border border-sky-100 dark:border-[#303134] px-1.5 py-0.5 rounded">{product.sku}</span>
            {product.category && (
              <span className="text-[10px] bg-blue-50 dark:bg-[#202124] text-blue-700 dark:text-[#60A5FA] px-1.5 py-0.5 rounded font-medium">{capitalize(product.category)}</span>
            )}
            {product.subcategory && (
              <span className="text-[10px] bg-violet-50 dark:bg-[#202124] text-violet-700 dark:text-[#9AA0A6] px-1.5 py-0.5 rounded font-medium">{capitalize(product.subcategory)}</span>
            )}
            {product.aplica_serie && (
              <span className="text-[10px] bg-cyan-50 dark:bg-[#202124] text-cyan-700 dark:text-[#60A5FA] px-1.5 py-0.5 rounded font-medium">Serie/IMEI</span>
            )}
          </div>
        </div>
        <div className="text-right w-20 shrink-0">
          <p className={`text-sm font-bold ${stockColor}`}>{product.stock} uds</p>
          <p className="text-[10px] text-[#7F8A99]">mín {product.stockMin}</p>
        </div>
        <div className="text-right w-28 shrink-0">
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(product.price)}</p>
          {showCost && (
            <p className="text-[10px] text-[#7F8A99]">costo {formatMoney(product.precioProducto || 0)}</p>
          )}
        </div>
        <div className="flex items-center justify-center w-20 shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusCls}`}>{statusLabel}</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => onView(product)} className={actionBtn} title="Ver detalles"><Eye size={14} /></button>
          <button onClick={() => onEdit(product)} className={actionBtn} title="Editar"><Pencil size={14} /></button>
          <button onClick={() => onToggle(product)} className={actionBtn} title={product.active ? "Desactivar" : "Activar"}>
            {product.active ? <PowerOff size={14} className="text-orange-400 dark:text-orange-300" /> : <Power size={14} className="text-emerald-500 dark:text-emerald-400" />}
          </button>
          <button onClick={() => onStock(product.id)} className={actionBtn} title="Ajustar stock"><Package size={14} /></button>
          <button onClick={() => printBarcode(product.sku, product.name, 'Producto')} className={actionBtn} title="Imprimir código de barras"><Tag size={14} /></button>
        </div>
      </div>

      {/* ─ Mobile card (< md) ─ */}
      <div className="md:hidden flex items-start gap-3 px-4 py-3 hover:bg-[#F6FCFF] dark:hover:bg-[var(--color-row-hover)] transition-colors">
        <img
          src={getImage(product)}
          alt={product.name}
          className="w-12 h-12 rounded-xl object-cover shrink-0 bg-slate-100 dark:bg-[var(--color-surface-soft)] border border-slate-100 dark:border-[var(--color-border)]"
          onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-[#14324A] dark:text-[#F8FAFC] leading-tight">{product.name}</p>
            <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusCls}`}>{statusLabel}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-[10px] font-mono bg-sky-50 dark:bg-[#202124] text-sky-700 dark:text-[#60A5FA] border border-sky-100 dark:border-[#303134] px-1.5 py-0.5 rounded">{product.sku}</span>
            {product.category && (
              <span className="text-[10px] bg-blue-50 dark:bg-[#202124] text-blue-700 dark:text-[#60A5FA] px-1.5 py-0.5 rounded font-medium">{capitalize(product.category)}</span>
            )}
          </div>
          <div className="flex items-center justify-between mt-2">
            <div>
              <span className={`text-sm font-bold ${stockColor}`}>{product.stock} uds</span>
              <span className="text-[10px] text-[#7F8A99] ml-1">/ mín {product.stockMin}</span>
            </div>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(product.price)}</span>
          </div>
          <div className="flex items-center gap-0.5 mt-2">
            <button onClick={() => onView(product)} className={actionBtn} title="Ver detalles"><Eye size={15} /></button>
            <button onClick={() => onEdit(product)} className={actionBtn} title="Editar"><Pencil size={15} /></button>
            <button onClick={() => onToggle(product)} className={actionBtn} title={product.active ? "Desactivar" : "Activar"}>
              {product.active ? <PowerOff size={15} className="text-orange-400 dark:text-orange-300" /> : <Power size={15} className="text-emerald-500 dark:text-emerald-400" />}
            </button>
            <button onClick={() => onStock(product.id)} className={actionBtn} title="Ajustar stock"><Package size={15} /></button>
            <button onClick={() => printBarcode(product.sku, product.name, 'Producto')} className={actionBtn} title="Imprimir código de barras"><Tag size={15} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const { 
    products, 
    addProduct, 
    updateProduct, 
    adjustStock,
    getAllCategories,
    getSubcategories,
    addCustomCategory,
    addSubcategory,
    loadCategories,
    loadProducts,
    isLoadingCategories,
    isLoadingProducts,
    pagination
  } = useCatalog();
  const toast = useToast();
  const { user } = useAuth();
  const showCost = canViewCosts(user?.roles);

  // Estados - TODOS los useState deben estar declarados ANTES de cualquier useEffect
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showProductModal, setShowProductModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stockAdjustment, setStockAdjustment] = useState({ productId: "", quantity: 0, note: "" });
  const [categoriesData, setCategoriesData] = useState<any>({ categories: [], subcategories: [] });
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const [productForm, setProductForm] = useState({
    sku: "",
    name: "",
    category: "",
    subcategory: "",
    precioProducto: 0,
    precioPublico: 0,
    price: 0,
    stock: 0,
    stockMin: 0,
    active: true,
    image: "",
    description: "",
    aplica_serie: false,
  });

  const [newCategoryForm, setNewCategoryForm] = useState({
    category: "",
    subcategory: "",
    isSubcategory: false,
    selectedParentCategory: "",
    editingCategoryId: null as number | null,
    editingSubcategoryId: null as number | null,
    isEditing: false
  });

  // Debounce search input (400 ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Cargar categorías y productos al montar el componente
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Re-fetch from server whenever search or category filter changes
  useEffect(() => {
    loadProducts(1, pagination.pageSize, debouncedSearch || undefined, categoryFilter || undefined);
  }, [debouncedSearch, categoryFilter]);

  // Cargar datos completos de categorías cuando se abre el modal
  useEffect(() => {
    if (showAddCategoryModal) {
      const loadCategoriesData = async () => {
        try {
          const response = await categoryService.getAllCategories();
          if (response.success) {
            setCategoriesData(response.data);
          }
        } catch (error) {
          console.error('Error al cargar categorías:', error);
        }
      };
      loadCategoriesData();
    }
  }, [showAddCategoryModal]);

  // Filtering is done server-side; only apply subcategory client-side (not sent to API)
  const filteredProducts = subcategoryFilter
    ? products.filter((p) => p.subcategory === subcategoryFilter)
    : products;

  function handleEditProduct(product: Product) {
    setEditingProduct(product);
    setProductForm({
      sku: product.sku || "",
      name: product.name || "",
      category: product.category || "",
      subcategory: product.subcategory || "",
      description: product.description || "",
      image: product.image || "",
      stock: product.stock || 0,
      stockMin: product.stockMin || 0,
      active: product.active,
      aplica_serie: product.aplica_serie || false,
      // Mapear precios correctamente
      precioProducto: product.precioProducto || 0,
      precioPublico: product.precioPublico || product.price || 0,
      price: product.precioPublico || product.price || 0,
    });
    setShowProductModal(true);
  }

  function handleViewProduct(product: Product) {
    setSelectedProduct(product);
    setShowDetailModal(true);
  }

  async function handleToggleActive(product: Product) {
    try {
      const newActiveState = !product.active;
      await updateProduct(product.id, { active: newActiveState });
      toast.add(
        newActiveState 
          ? `Producto "${product.name}" activado exitosamente` 
          : `Producto "${product.name}" desactivado exitosamente`,
        "success"
      );
      await loadProducts(pagination.currentPage, pagination.pageSize, debouncedSearch || undefined, categoryFilter || undefined);
    } catch (error: any) {
      toast.add(error.message || "Error al cambiar el estado del producto", "error");
      console.error('Error:', error);
    }
  }

  function handleOpenNewProductModal() {
    resetProductForm();
    setEditingProduct(null);
    setShowProductModal(true);
  }

  function handleStockAdjust(productId: string) {
    const product = products.find(p => p.id === productId);
    if (product) {
      setSelectedProduct(product);
      setStockAdjustment({ productId, quantity: 0, note: "" });
      setShowStockModal(true);
    }
  }

  async function handleSaveProduct() {
    try {
      // Validaciones (SKU ya no es requerido, se genera automático)
      if (!productForm.name || !productForm.category) {
        toast.add("Por favor completa todos los campos requeridos (Nombre, Categoría)", "error");
        return;
      }

      console.log('📋 Guardando producto con:', {
        categoria: productForm.category,
        subcategoria: productForm.subcategory,
        nombre: productForm.name,
        stockMin: productForm.stockMin,
        precioProducto: productForm.precioProducto,
        precioPublico: productForm.precioPublico
      });

      if (editingProduct) {
        await updateProduct(editingProduct.id, productForm);
        toast.add("Producto actualizado exitosamente");
      } else {
        await addProduct(productForm);
        toast.add("Producto creado exitosamente");
      }
      
      // Cerrar modal, limpiar formulario y recargar productos
      setShowProductModal(false);
      setEditingProduct(null);
      resetProductForm();
      await loadProducts(pagination.currentPage, pagination.pageSize, debouncedSearch || undefined, categoryFilter || undefined);
    } catch (error: any) {
      toast.add(error.message || "Error al guardar el producto", "error");
      console.error('Error:', error);
    }
  }

  function resetProductForm() {
    setProductForm({
      sku: "",
      name: "",
      category: "",
      subcategory: "",
      precioProducto: 0,
      precioPublico: 0,
      price: 0,
      stock: 0,
      stockMin: 0,
      active: true,
      image: "",
      description: "",
      aplica_serie: false,
    });
  }

  async function handleStockAdjustment() {
    try {
      await adjustStock(stockAdjustment.productId, stockAdjustment.quantity, stockAdjustment.note);
      toast.add("Stock ajustado correctamente");
      setShowStockModal(false);
    } catch (error) {
      toast.add("Error al ajustar el stock", "error");
      console.error('Error:', error);
    }
  }

  async function handleToggleProductStatus() {
    try {
      const product = products.find(p => p.id === stockAdjustment.productId);
      if (!product) return;
      
      // Solo enviar el campo active
      await updateProduct(product.id, { active: !product.active });
      toast.add(product.active ? "Producto desactivado" : "Producto activado");
      setShowStockModal(false);
      setSelectedProduct({ ...product, active: !product.active });
    } catch (error) {
      toast.add("Error al cambiar estado del producto", "error");
      console.error('Error:', error);
    }
  }

  async function handleDeleteProduct() {
    setConfirmState({
      message: '¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.',
      onConfirm: async () => {
        setConfirmState(null);
        try {
          const { deleteProduct } = useCatalog.getState();
          await deleteProduct(stockAdjustment.productId);
          toast.add("Producto eliminado exitosamente");
          setShowStockModal(false);
        } catch (error) {
          toast.add("Error al eliminar el producto", "error");
          console.error('Error:', error);
        }
      }
    });
  }

  async function handleAddCategory() {
    try {
      if (newCategoryForm.isEditing) {
        // Modo edición
        if (newCategoryForm.isSubcategory && newCategoryForm.editingSubcategoryId) {
          await categoryService.updateSubcategory(newCategoryForm.editingSubcategoryId, { nombre: newCategoryForm.subcategory });
          toast.add("Subcategoría actualizada exitosamente");
        } else if (newCategoryForm.editingCategoryId) {
          await categoryService.updateCategory(newCategoryForm.editingCategoryId, { nombre: newCategoryForm.category });
          toast.add("Categoría actualizada exitosamente");
        }
      } else {
        // Modo crear
        if (newCategoryForm.isSubcategory && newCategoryForm.subcategory && newCategoryForm.selectedParentCategory) {
          await addSubcategory(newCategoryForm.selectedParentCategory, newCategoryForm.subcategory);
          toast.add("Subcategoría agregada exitosamente");
        } else if (!newCategoryForm.isSubcategory && newCategoryForm.category) {
          await addCustomCategory(newCategoryForm.category, []);
          toast.add("Categoría agregada exitosamente");
        }
      }
      
      await loadCategories();
    } catch (error: any) {
      toast.add(error.message || "Error al procesar categoría", "error");
      console.error('Error:', error);
      return;
    }
    
    setNewCategoryForm({
      category: "",
      subcategory: "",
      isSubcategory: false,
      selectedParentCategory: "",
      editingCategoryId: null,
      editingSubcategoryId: null,
      isEditing: false
    });
  }

  async function handleEditCategory(categoryName: string, categoryId: number) {
    setNewCategoryForm({
      category: categoryName,
      subcategory: "",
      isSubcategory: false,
      selectedParentCategory: "",
      editingCategoryId: categoryId,
      editingSubcategoryId: null,
      isEditing: true
    });
  }

  async function handleEditSubcategory(categoryName: string, subcategoryName: string, subcategoryId: number) {
    setNewCategoryForm({
      category: "",
      subcategory: subcategoryName,
      isSubcategory: true,
      selectedParentCategory: categoryName,
      editingCategoryId: null,
      editingSubcategoryId: subcategoryId,
      isEditing: true
    });
  }

  async function handleDeleteCategory(categoryId: number, categoryName: string) {
    setConfirmState({
      message: `¿Estás seguro de eliminar la categoría "${categoryName}"? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await categoryService.deleteCategory(categoryId);
          toast.add("Categoría eliminada exitosamente");
          await loadCategories();
        } catch (error: any) {
          toast.add(error.message || "Error al eliminar categoría", "error");
          console.error('Error:', error);
        }
      }
    });
  }

  async function handleDeleteSubcategory(subcategoryId: number, subcategoryName: string) {
    setConfirmState({
      message: `¿Estás seguro de eliminar la subcategoría "${subcategoryName}"? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await categoryService.deleteSubcategory(subcategoryId);
          toast.add("Subcategoría eliminada exitosamente");
          await loadCategories();
        } catch (error: any) {
          toast.add(error.message || "Error al eliminar subcategoría", "error");
          console.error('Error:', error);
        }
      }
    });
  }

  function getProductImage(product: Product) {
    return getImageUrl(product.image) || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Crect fill='%23e5e7eb' width='300' height='200'/%3E%3Ctext fill='%239ca3af' font-family='system-ui, sans-serif' font-size='18' font-weight='600' x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle'%3ESin Imagen%3C/text%3E%3C/svg%3E";
  }

  function capitalizeText(text: string): string {
    if (!text) return '';
    return text
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  function handlePageChange(newPage: number) {
    loadProducts(newPage, pagination.pageSize, debouncedSearch || undefined, categoryFilter || undefined);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const categories = getAllCategories();
  const totalActive = products.filter(p => p.active).length;
  const totalLowStock = products.filter(p => p.stock <= p.stockMin && p.stock > 0).length;
  const totalNoStock = products.filter(p => p.stock === 0).length;
  const hasFilters = !!(searchTerm || categoryFilter || subcategoryFilter);
  const isSearching = searchTerm !== debouncedSearch;

  return (
    <>
    <div className="space-y-5 max-w-screen-2xl">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#14324A] dark:text-[#F8FAFC] flex items-center gap-2">
            <Package size={20} className="text-[#2EA7D8] dark:text-[#48B9E6]" />
            Productos
          </h1>
          <p className="text-xs text-[#5E7184] dark:text-[#B8C2D1] mt-0.5">Gestión del catálogo de productos</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="ghost"
            onClick={() => setShowAddCategoryModal(true)}
            className="text-[#14324A] dark:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-[#0A1220] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] rounded-xl text-sm px-4 py-2"
          >
            <Tag size={15} className="mr-1.5" />
            Categorías
          </Button>
          <Button
            onClick={handleOpenNewProductModal}
            className="bg-gradient-to-r from-[#2EA7D8] to-[#2563EB] dark:bg-none dark:bg-[#2563EB] hover:opacity-90 dark:hover:bg-[#1D4ED8] text-white font-semibold rounded-xl text-sm px-4 py-2 shadow-sm"
          >
            <Plus size={15} className="mr-1.5" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Productos"
          value={pagination.total || products.length}
          sub="en catálogo"
          icon={Package}
          gradient="bg-gradient-to-br from-blue-500 to-blue-700"
        />
        <KpiCard
          label="Activos"
          value={totalActive}
          sub="disponibles"
          icon={Package}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
        />
        <KpiCard
          label="Stock Bajo"
          value={totalLowStock}
          sub="por reponer"
          icon={AlertTriangle}
          gradient="bg-gradient-to-br from-amber-500 to-orange-600"
        />
        <KpiCard
          label="Sin Stock"
          value={totalNoStock}
          sub="agotados"
          icon={AlertTriangle}
          gradient="bg-gradient-to-br from-red-500 to-rose-700"
        />
      </div>

      {/* ── Stock Alerts ─────────────────────────────────────────────── */}
      <StockAlertsWidget />

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[var(--color-surface)] rounded-2xl border border-slate-100 dark:border-[var(--color-border)] px-4 py-3 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7F8A99] pointer-events-none" />
          <Input
            type="text"
            placeholder="Buscar por nombre, SKU o categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`pl-9 py-2 text-sm rounded-xl border bg-[#F8FDFF] dark:bg-[var(--color-input-bg)] text-[#14324A] dark:text-[var(--color-text)] placeholder:text-[#7F8A99] focus:border-[var(--tenant-primary-color)] outline-none w-full transition-colors ${isSearching ? 'border-[#48B9E6] dark:border-[var(--tenant-primary-color)]' : 'border-[#D6EEF8] dark:border-[var(--color-border)]'}`}
          />
        </div>
        <Select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setSubcategoryFilter(""); setDebouncedSearch(searchTerm); }}
          className="text-sm rounded-xl border border-[#D6EEF8] dark:border-[var(--color-border)] bg-[#F8FDFF] dark:bg-[var(--color-input-bg)] text-[#14324A] dark:text-[var(--color-text)] py-2 min-w-0 sm:w-44"
        >
          <option value="">Todas las categorías</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{capitalizeText(cat)}</option>
          ))}
        </Select>
        {categoryFilter && (
          <Select
            value={subcategoryFilter}
            onChange={(e) => setSubcategoryFilter(e.target.value)}
            className="text-sm rounded-xl border border-[#D6EEF8] dark:border-[var(--color-border)] bg-[#F8FDFF] dark:bg-[var(--color-input-bg)] text-[#14324A] dark:text-[var(--color-text)] py-2 min-w-0 sm:w-44"
          >
            <option value="">Todas las subcategorías</option>
            {getSubcategories(categoryFilter).map((sub) => (
              <option key={sub} value={sub}>{capitalizeText(sub)}</option>
            ))}
          </Select>
        )}
        {hasFilters && (
          <Button
            variant="ghost"
            onClick={() => { setSearchTerm(""); setDebouncedSearch(""); setCategoryFilter(""); setSubcategoryFilter(""); }}
            className="text-sm text-[#5E7184] dark:text-[#B8C2D1] hover:text-[#14324A] dark:hover:text-[#F8FAFC] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] rounded-xl px-3 py-2 whitespace-nowrap"
          >
            Limpiar
          </Button>
        )}
        <span className="text-xs text-[#7F8A99] whitespace-nowrap self-center sm:ml-1">
          {isSearching ? '...' : `${pagination.total ?? filteredProducts.length} productos`}
        </span>
      </div>

      {/* ── Product List ─────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[var(--color-surface)] rounded-2xl border border-slate-100 dark:border-[var(--color-border)] overflow-hidden shadow-sm dark:shadow-none">
        {/* Table header */}
        <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-[#F8FDFF] dark:bg-[var(--color-surface-soft)] border-b border-slate-100 dark:border-[var(--color-border)]">
          <div className="w-11 shrink-0" />
          <p className="flex-1 text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest">Producto</p>
          <p className="w-20 text-right text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest shrink-0">Stock</p>
          <p className="w-28 text-right text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest shrink-0">Precio venta</p>
          <p className="w-20 text-center text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest shrink-0">Estado</p>
          <p className="w-20 text-right text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest shrink-0">Acciones</p>
        </div>

        {/* Rows */}
        {filteredProducts.length > 0 ? (
          <div className="divide-y divide-slate-50 dark:divide-[rgba(72,185,230,0.10)]">
            {filteredProducts.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                onEdit={handleEditProduct}
                onView={handleViewProduct}
                onToggle={handleToggleActive}
                onStock={handleStockAdjust}
                getImage={getProductImage}
                capitalize={capitalizeText}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-slate-100 dark:bg-[#0A1220] rounded-2xl p-4 mb-3">
              <Package size={28} className="text-slate-400 dark:text-[#7F8A99]" />
            </div>
            <p className="text-sm font-semibold text-[#14324A] dark:text-[#F8FAFC]">
              {hasFilters ? 'Sin resultados' : 'No hay productos'}
            </p>
            <p className="text-xs text-[#7F8A99] mt-1 mb-4">
              {hasFilters ? 'Ajusta los filtros o la búsqueda' : 'Comienza agregando tu primer producto'}
            </p>
            {!hasFilters && (
              <Button onClick={handleOpenNewProductModal} className="bg-gradient-to-r from-[#2EA7D8] to-[#2563EB] dark:bg-none dark:bg-[#2563EB] hover:opacity-90 dark:hover:bg-[#1D4ED8] text-white text-sm rounded-xl px-4 py-2">
                <Plus size={14} className="mr-1.5" />
                Agregar Producto
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Pagination ───────────────────────────────────────────────── */}
      {pagination.totalPages > 1 && (
        <div className="bg-white dark:bg-[var(--color-surface)] rounded-2xl border border-slate-100 dark:border-[var(--color-border)] px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[#5E7184] dark:text-[#B8C2D1]">
            Mostrando <span className="font-semibold text-[#14324A] dark:text-[#F8FAFC]">{products.length}</span> de{' '}
            <span className="font-semibold text-[#14324A] dark:text-[#F8FAFC]">{pagination.total}</span> productos
            <span className="text-[#7F8A99] ml-1">(p. {pagination.currentPage}/{pagination.totalPages})</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] text-[#5E7184] dark:text-[#B8C2D1] hover:bg-[#F6FCFF] dark:hover:bg-[#0A1220] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Anterior
            </button>
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              let pageNum: number;
              if (pagination.totalPages <= 5) pageNum = i + 1;
              else if (pagination.currentPage <= 3) pageNum = i + 1;
              else if (pagination.currentPage >= pagination.totalPages - 2) pageNum = pagination.totalPages - 4 + i;
              else pageNum = pagination.currentPage - 2 + i;
              const isActive = pagination.currentPage === pageNum;
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`w-8 h-8 text-xs font-semibold rounded-lg transition-colors ${
                    isActive ? 'bg-[#2EA7D8] text-white' : 'border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] text-[#5E7184] dark:text-[#B8C2D1] hover:bg-[#F6FCFF] dark:hover:bg-[#0A1220]'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.totalPages}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] text-[#5E7184] dark:text-[#B8C2D1] hover:bg-[#F6FCFF] dark:hover:bg-[#0A1220] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* ── Product Modal ─────────────────────────────────────────────── */}
      <Modal
        open={showProductModal}
        onClose={() => setShowProductModal(false)}
        title={editingProduct ? "Editar Producto" : "Nuevo Producto"}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: image */}
          <div className="lg:col-span-3 flex flex-col items-center gap-3">
            <div className="w-full max-w-[160px] mx-auto aspect-square rounded-3xl border-2 border-dashed border-[#D6EEF8] dark:border-[rgba(72,185,230,0.25)] overflow-hidden bg-[#F8FDFF] dark:bg-[#060B14] flex items-center justify-center hover:border-[#48B9E6] transition-colors cursor-pointer">
              {productForm.image ? (
                <img
                  src={productForm.image}
                  alt="Vista previa"
                  className="w-full h-full object-cover rounded-3xl"
                  onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                />
              ) : (
                <div className="text-center px-2">
                  <Package size={28} className="mx-auto text-[#D6EEF8] dark:text-[rgba(72,185,230,0.30)] mb-1" />
                  <p className="text-[10px] text-[#7F8A99] dark:text-[#5E7184]">Sin imagen</p>
                </div>
              )}
            </div>
            <input type="file" accept="image/*" capture="environment" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => setProductForm({ ...productForm, image: ev.target?.result as string });
                reader.readAsDataURL(file);
              }
            }} className="hidden" id="imageUpload" />
            <label htmlFor="imageUpload" className="cursor-pointer text-xs font-semibold text-[#48B9E6] bg-[#F0FAFF] dark:bg-[rgba(72,185,230,0.10)] hover:bg-[#E0F5FF] dark:hover:bg-[rgba(72,185,230,0.18)] border border-[#C4E8F7] dark:border-[rgba(72,185,230,0.25)] px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5">
              <Sparkles size={12} />
              Subir imagen
            </label>
            <label className="flex items-center gap-2 cursor-pointer w-full">
              <input
                type="checkbox"
                checked={productForm.aplica_serie}
                onChange={(e) => setProductForm({ ...productForm, aplica_serie: e.target.checked })}
                className="w-4 h-4 accent-[#48B9E6] rounded focus:ring-[#48B9E6]"
              />
              <span className="text-xs font-medium text-[#5E7184] dark:text-[#B8C2D1] leading-tight">Aplica Serie/IMEI</span>
            </label>
          </div>

          {/* Right: form */}
          <div className="lg:col-span-9 space-y-4 min-w-0">
            {/* SKU notice */}
            <div className="bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/40 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Sparkles size={13} className="text-cyan-500 dark:text-cyan-400 shrink-0" />
              <p className="text-[11px] text-cyan-800 dark:text-cyan-200"><span className="font-semibold">SKU automático:</span> se generará como TEC_PROD###</p>
            </div>

            {/* Nombre + Descripción */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest">Nombre <span className="text-red-400">*</span></label>
              <Input
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                placeholder="Nombre descriptivo del producto"
                className="text-sm rounded-2xl w-full focus:ring-2 focus:ring-[#48B9E6]/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest">Descripción</label>
              <textarea
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                className="w-full px-4 py-3 text-sm border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] rounded-2xl bg-[#F8FDFF] dark:bg-[#060B14] text-[#14324A] dark:text-[#F8FAFC] placeholder:text-[#7F8A99] focus:outline-none focus:border-[#48B9E6] focus:ring-2 focus:ring-[#48B9E6]/20 resize-none transition-colors"
                rows={2}
                placeholder="Descripción del producto..."
              />
            </div>

            {/* Categorización */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest">Categorización</label>
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(true)}
                  className="text-[11px] font-medium text-[#48B9E6] hover:text-[#2EA7D8] flex items-center gap-1"
                >
                  <Plus size={11} /> Gestionar
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value, subcategory: "" })}
                  className="text-sm rounded-2xl w-full"
                >
                  <option value="">Categoría *</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </Select>
                <Select
                  value={productForm.subcategory}
                  onChange={(e) => setProductForm({ ...productForm, subcategory: e.target.value })}
                  className="text-sm rounded-2xl w-full"
                  disabled={!productForm.category}
                >
                  <option value="">Subcategoría</option>
                  {productForm.category && getSubcategories(productForm.category).map((sub) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Precios + Stock */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest">Precios y stock</label>
              <div className="grid grid-cols-3 gap-3">
                {showCost && (
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-[#7F8A99] dark:text-[#B8C2D1] uppercase tracking-widest">Costo <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#7F8A99] dark:text-[#5E7184]">Q</span>
                    <Input
                      type="number" step="0.01" min="0"
                      value={productForm.precioProducto}
                      onChange={(e) => setProductForm({ ...productForm, precioProducto: Number(e.target.value) })}
                      className="pl-7 text-sm rounded-2xl focus:ring-2 focus:ring-[#48B9E6]/20"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-[#7F8A99] dark:text-[#B8C2D1] uppercase tracking-widest">Venta <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#7F8A99] dark:text-[#5E7184]">Q</span>
                    <Input
                      type="number" step="0.01" min="0"
                      value={productForm.precioPublico}
                      onChange={(e) => {
                        const precio = Number(e.target.value);
                        setProductForm({ ...productForm, precioPublico: precio, price: precio });
                      }}
                      className="pl-7 text-sm rounded-2xl focus:ring-2 focus:ring-[#48B9E6]/20"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-[#7F8A99] dark:text-[#B8C2D1] uppercase tracking-widest">Stock mín.</label>
                  <Input
                    type="number" min="0"
                    value={productForm.stockMin}
                    onChange={(e) => setProductForm({ ...productForm, stockMin: Number(e.target.value) })}
                    className="text-sm rounded-2xl focus:ring-2 focus:ring-[#48B9E6]/20"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Margin preview */}
            {showCost && productForm.precioProducto > 0 && productForm.precioPublico > 0 && (
              <div className="bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/40 rounded-2xl px-4 py-3 flex items-center justify-between">
                <span className="text-[11px] font-medium text-violet-600 dark:text-violet-300">Margen de ganancia</span>
                <span className="text-sm font-bold text-violet-700 dark:text-violet-200">
                  Q{(productForm.precioPublico - productForm.precioProducto).toFixed(2)}
                  {' '}
                  <span className="font-normal text-[11px]">
                    ({((productForm.precioPublico - productForm.precioProducto) / productForm.precioProducto * 100).toFixed(1)}%)
                  </span>
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-3 border-t border-[#D6EEF8] dark:border-[rgba(72,185,230,0.14)]">
              <Button
                variant="ghost"
                onClick={() => setShowProductModal(false)}
                className="text-sm rounded-xl px-4 py-2 bg-transparent border border-[#D6EEF8] dark:border-[rgba(248,250,252,0.18)] text-[#14324A] dark:text-[#F8FAFC] hover:bg-[#F6FCFF] dark:hover:bg-[#0A1220]"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveProduct}
                disabled={!productForm.name || !productForm.category}
                className="text-sm bg-gradient-to-r from-[#2EA7D8] to-[#2563EB] dark:bg-none dark:bg-[#2563EB] hover:brightness-110 dark:hover:bg-[#1D4ED8] text-white font-semibold rounded-xl px-5 py-2 shadow-lg shadow-sky-900/20 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed disabled:brightness-100"
              >
                {editingProduct ? "Actualizar" : "Crear Producto"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Category Modal ───────────────────────────────────────────── */}
      <Modal
        open={showAddCategoryModal}
        onClose={() => {
          setShowAddCategoryModal(false);
          setNewCategoryForm({ category: "", subcategory: "", isSubcategory: false, selectedParentCategory: "", editingCategoryId: null, editingSubcategoryId: null, isEditing: false });
        }}
        title={newCategoryForm.isEditing ? "Editar Categoría" : "Gestionar Categorías"}
      >
        <div className="space-y-4">
          {/* Type selector */}
          {!newCategoryForm.isEditing && (
            <div className="bg-[#F8FDFF] dark:bg-[#0A1220] rounded-xl p-1 flex gap-1 border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)]">
              <button
                type="button"
                onClick={() => setNewCategoryForm({ ...newCategoryForm, isSubcategory: false })}
                className={`flex-1 text-xs font-semibold py-2.5 rounded-lg transition-colors ${
                  !newCategoryForm.isSubcategory
                    ? 'bg-white dark:bg-[#0D1526] text-[#2563EB] dark:text-[#48B9E6] shadow-sm border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.20)]'
                    : 'text-[#5E7184] dark:text-[#B8C2D1] hover:text-[#14324A] dark:hover:text-[#F8FAFC]'
                }`}
              >
                Nueva Categoría
              </button>
              <button
                type="button"
                onClick={() => setNewCategoryForm({ ...newCategoryForm, isSubcategory: true })}
                className={`flex-1 text-xs font-semibold py-2.5 rounded-lg transition-colors ${
                  newCategoryForm.isSubcategory
                    ? 'bg-white dark:bg-[#0D1526] text-[#2563EB] dark:text-[#48B9E6] shadow-sm border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.20)]'
                    : 'text-[#5E7184] dark:text-[#B8C2D1] hover:text-[#14324A] dark:hover:text-[#F8FAFC]'
                }`}
              >
                Nueva Subcategoría
              </button>
            </div>
          )}

          {/* Fields */}
          <div className="space-y-3">
            {(newCategoryForm.isSubcategory || newCategoryForm.editingSubcategoryId) && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest">Categoría principal</label>
                <Select
                  value={newCategoryForm.selectedParentCategory}
                  onChange={(e) => setNewCategoryForm({ ...newCategoryForm, selectedParentCategory: e.target.value })}
                  className="text-sm rounded-xl w-full"
                  disabled={newCategoryForm.isEditing}
                >
                  <option value="">Seleccionar categoría</option>
                  {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest">
                {newCategoryForm.isSubcategory || newCategoryForm.editingSubcategoryId ? 'Nombre de la subcategoría' : 'Nombre de la categoría'}
              </label>
              <Input
                value={newCategoryForm.isSubcategory || newCategoryForm.editingSubcategoryId ? newCategoryForm.subcategory : newCategoryForm.category}
                onChange={(e) => newCategoryForm.isSubcategory || newCategoryForm.editingSubcategoryId
                  ? setNewCategoryForm({ ...newCategoryForm, subcategory: e.target.value })
                  : setNewCategoryForm({ ...newCategoryForm, category: e.target.value })
                }
                placeholder="Nombre..."
                className="text-sm rounded-xl"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {newCategoryForm.isEditing && (
              <Button variant="ghost" onClick={() => setNewCategoryForm({ category: "", subcategory: "", isSubcategory: false, selectedParentCategory: "", editingCategoryId: null, editingSubcategoryId: null, isEditing: false })} className="text-sm text-[#5E7184] dark:text-[#B8C2D1] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] rounded-xl px-4 py-2">
                Cancelar edición
              </Button>
            )}
            <Button onClick={handleAddCategory} className="text-sm bg-gradient-to-r from-[#2EA7D8] to-[#2563EB] dark:bg-none dark:bg-[#2563EB] hover:opacity-90 dark:hover:bg-[#1D4ED8] text-white font-semibold rounded-xl px-5 py-2 shadow-sm">
              {newCategoryForm.isEditing ? "Actualizar" : "Agregar"}
            </Button>
          </div>

          {/* Existing categories list */}
          <div className="border-t border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] pt-4">
            <p className="text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest mb-3">Categorías existentes</p>
            <div className="category-list-scroll max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {categoriesData.categories?.map((category: any) => (
                <div key={category.id} className="rounded-xl border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.12)] overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2.5 bg-[#F8FDFF] dark:bg-[#0A1220]">
                    <div className="flex items-center gap-2">
                      <Tag size={13} className="text-[#2EA7D8] dark:text-[#48B9E6] shrink-0" />
                      <span className="text-sm font-semibold text-[#14324A] dark:text-[#F8FAFC]">{category.nombre}</span>
                    </div>
                    <div className="flex gap-0.5">
                      <button onClick={() => handleEditCategory(category.nombre, category.id)} className="p-1.5 rounded-lg text-sky-600 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/30 transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => handleDeleteCategory(category.id, category.nombre)} className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-[#202124] transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  {categoriesData.subcategories?.filter((sub: any) => sub.categoria_id === category.id).map((sub: any) => (
                    <div key={sub.id} className="flex items-center justify-between px-3 py-2 border-t border-[#D6EEF8] dark:border-[rgba(72,185,230,0.10)] bg-white dark:bg-[#0D1526] ml-4">
                      <div className="flex items-center gap-2">
                        <ChevronDown size={11} className="text-[#7F8A99] shrink-0" />
                        <span className="text-xs text-[#5E7184] dark:text-[#B8C2D1]">{sub.nombre}</span>
                      </div>
                      <div className="flex gap-0.5">
                        <button onClick={() => handleEditSubcategory(category.nombre, sub.nombre, sub.id)} className="p-1.5 rounded-lg text-sky-600 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/30 transition-colors"><Pencil size={11} /></button>
                        <button onClick={() => handleDeleteSubcategory(sub.id, sub.nombre)} className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-[#202124] transition-colors"><Trash2 size={11} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end border-t border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] pt-3">
            <Button variant="ghost" onClick={() => {
              setShowAddCategoryModal(false);
              setNewCategoryForm({ category: "", subcategory: "", isSubcategory: false, selectedParentCategory: "", editingCategoryId: null, editingSubcategoryId: null, isEditing: false });
            }} className="text-sm text-[#5E7184] dark:text-[#B8C2D1] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] rounded-xl px-4 py-2">
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Detail Modal ─────────────────────────────────────────────── */}
      <Modal
        open={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Detalle del Producto"
      >
        {selectedProduct && (
          <div className="flex flex-col lg:flex-row gap-5">
            {/* Image */}
            <div className="lg:w-48 shrink-0">
              <div className="rounded-2xl overflow-hidden bg-slate-100 aspect-square">
                <img
                  src={getProductImage(selectedProduct)}
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                />
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Estado</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${selectedProduct.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    {selectedProduct.active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Serie/IMEI</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${selectedProduct.aplica_serie ? 'bg-cyan-50 text-cyan-600' : 'bg-slate-100 text-slate-400'}`}>
                    {selectedProduct.aplica_serie ? 'Sí' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800 leading-tight">{selectedProduct.name}</h2>
                <p className="text-xs font-mono text-slate-400 mt-0.5">SKU: {selectedProduct.sku}</p>
                {selectedProduct.description && (
                  <p className="text-sm text-slate-500 mt-1">{selectedProduct.description}</p>
                )}
              </div>

              {/* Category + prices row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 space-y-0.5">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Categoría</p>
                  <p className="text-sm font-semibold text-slate-700">{selectedProduct.category}</p>
                  {selectedProduct.subcategory && (
                    <p className="text-[11px] text-slate-400">{selectedProduct.subcategory}</p>
                  )}
                </div>
                <div className="bg-slate-50 rounded-xl p-3 space-y-0.5">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Stock</p>
                  <p className={`text-sm font-bold ${selectedProduct.stock === 0 ? 'text-red-600' : selectedProduct.stock <= selectedProduct.stockMin ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {selectedProduct.stock} uds
                  </p>
                  <p className="text-[11px] text-slate-400">mín {selectedProduct.stockMin}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {showCost && (
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-widest">Costo</p>
                  <p className="text-lg font-bold text-blue-700 mt-0.5">{formatMoney(selectedProduct.precioProducto || 0)}</p>
                </div>
                )}
                <div className="bg-emerald-50 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-widest">Precio venta</p>
                  <p className="text-lg font-bold text-emerald-700 mt-0.5">{formatMoney(selectedProduct.precioPublico || selectedProduct.price)}</p>
                </div>
              </div>

              {showCost && selectedProduct.precioProducto > 0 && selectedProduct.precioPublico > 0 && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl px-3 py-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-violet-600">Margen</span>
                  <span className="text-sm font-bold text-violet-700">
                    {formatMoney(selectedProduct.precioPublico - selectedProduct.precioProducto)}
                    {' '}
                    <span className="font-normal text-[11px]">
                      ({((selectedProduct.precioPublico - selectedProduct.precioProducto) / selectedProduct.precioProducto * 100).toFixed(1)}%)
                    </span>
                  </span>
                </div>
              )}

              <div className="flex justify-between pt-1 border-t border-slate-100">
                <Button
                  variant="ghost"
                  onClick={() => { setShowDetailModal(false); handleEditProduct(selectedProduct); }}
                  className="text-sm text-blue-600 border border-blue-200 rounded-xl px-4 py-2"
                >
                  <Pencil size={13} className="mr-1.5" />
                  Editar
                </Button>
                <Button variant="ghost" onClick={() => setShowDetailModal(false)} className="text-sm border border-slate-200 rounded-xl px-4 py-2">
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Stock Modal ───────────────────────────────────────────────── */}
      <Modal open={showStockModal} onClose={() => setShowStockModal(false)} title="Gestión de Producto">
        {selectedProduct && (
          <div className="space-y-4">
            {/* Product info */}
            <div className="flex items-center gap-3 bg-slate-50 rounded-2xl px-4 py-3">
              <img
                src={getProductImage(selectedProduct)}
                alt={selectedProduct.name}
                className="w-12 h-12 rounded-xl object-cover shrink-0 bg-slate-200"
                onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{selectedProduct.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{selectedProduct.sku} · Stock actual: <span className="font-semibold text-slate-600">{selectedProduct.stock} uds</span></p>
              </div>
              <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-semibold ${selectedProduct.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                {selectedProduct.active ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            {/* Stock adjustment */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Ajustar Stock</p>
              <Input
                type="number"
                placeholder="Cantidad (+/-)"
                value={stockAdjustment.quantity}
                onChange={(e) => setStockAdjustment({ ...stockAdjustment, quantity: Number(e.target.value) })}
                className="text-sm rounded-xl border-slate-200"
              />
              <Input
                placeholder="Motivo del ajuste"
                value={stockAdjustment.note}
                onChange={(e) => setStockAdjustment({ ...stockAdjustment, note: e.target.value })}
                className="text-sm rounded-xl border-slate-200"
              />
              <Button onClick={handleStockAdjustment} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl py-2">
                <Package size={14} className="mr-2" />
                Ajustar Stock
              </Button>
            </div>

            {/* Actions */}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Acciones</p>
              <button
                onClick={handleToggleProductStatus}
                className={`w-full text-left text-sm font-medium px-4 py-2.5 rounded-xl transition-colors ${selectedProduct.active ? 'text-orange-600 dark:text-amber-400 hover:bg-orange-50 dark:hover:bg-[#202124]' : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-[#202124]'}`}
              >
                {selectedProduct.active ? '⏸ Desactivar producto' : '▶ Activar producto'}
              </button>
              <button
                onClick={handleDeleteProduct}
                className="w-full text-left text-sm font-medium px-4 py-2.5 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-[#202124] transition-colors"
              >
                🗑 Eliminar producto
              </button>
            </div>

            <div className="flex justify-end pt-1">
              <Button variant="ghost" onClick={() => setShowStockModal(false)} className="text-sm border border-slate-200 rounded-xl px-4 py-2">
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>

    {confirmState && (
      <ConfirmModal
        isOpen
        message={confirmState.message}
        variant="danger"
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(null)}
      />
    )}
    </>
  );
}
