import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Package,
  AlertTriangle,
  DollarSign,
  Activity,
  Eye,
  Pencil,
  Power,
  PowerOff,
  Wrench,
  Battery,
  Monitor,
  Camera,
  Cpu,
  Speaker,
  Smartphone,
  Building2,
  History,
  Tag,
  Edit,
  Trash2,
} from 'lucide-react';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import ImageModal from '../../components/ui/ImageModal';
import { useAuth } from '../../store/useAuth';
import { useRepuestosStore } from '../../store/useRepuestosStore';
import type { Repuesto } from '../../types/repuesto';
import * as repuestoService from '../../services/repuestoService';
import { useToast } from '../../components/ui/Toast';
import RepuestoForm from './RepuestoForm';
import { canViewCosts } from '../../lib/permissions';
import { getImageUrl } from '../../utils/getImageUrl';
import { printBarcode } from '../../lib/printBarcode';

// ─── Helpers ──────────────────────────────────────────────────────────────────────────────────
// ─── Helpers ──────────────────────────────────────────────────────────────────────────────────
const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtQ = (v: unknown): string => `Q ${toNum(v).toFixed(2)}`;

const REPUESTO_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 44 44'%3E%3Crect fill='%231e293b' width='44' height='44'/%3E%3Ctext fill='%2364748b' font-family='system-ui' font-size='8' x='50%25' y='57%25' dominant-baseline='middle' text-anchor='middle'%3ESin img%3C/text%3E%3C/svg%3E";

function isBrokenLegacyImagePath(path?: string | null): boolean {
  if (!path) return true;

  const value = String(path).trim();

  return (
    value === "" ||
    value.includes("/api/placeholder") ||
    value.includes("api/placeholder") ||
    value.includes("placeholder/400")
  );
}

function buildImageUrl(path?: string | null): string {
  if (isBrokenLegacyImagePath(path)) return REPUESTO_PLACEHOLDER;
  return getImageUrl(path) || REPUESTO_PLACEHOLDER;
}

function getFirstSafeImageUrl(images?: string[] | null): string {
  const firstValidImage = (images || []).find((img) => !isBrokenLegacyImagePath(img));
  return buildImageUrl(firstValidImage);
}

function getSafeImageUrls(images?: string[] | null): string[] {
  return (images || [])
    .filter((img) => !isBrokenLegacyImagePath(img))
    .map((img) => buildImageUrl(img));
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TIPOS_REPUESTO = ['Pantalla', 'Batería', 'Cámara', 'Flex', 'Placa', 'Back Cover', 'Altavoz', 'Conector', 'Otro'];

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

const getTipoIcon = (tipo: string) => {
  switch (tipo) {
    case 'Pantalla': return <Monitor size={13} className="text-blue-500" />;
    case 'Batería': return <Battery size={13} className="text-yellow-500" />;
    case 'Cámara': return <Camera size={13} className="text-purple-500" />;
    case 'Placa': return <Cpu size={13} className="text-red-500" />;
    case 'Altavoz': return <Speaker size={13} className="text-green-500" />;
    case 'Back Cover': return <Smartphone size={13} className="text-slate-500" />;
    default: return <Wrench size={13} className="text-slate-400" />;
  }
};

const getCondicionBadge = (condicion: string) => {
  const map: Record<string, string> = {
    'Original': 'bg-emerald-50 dark:bg-[#202124] dark:border dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400',
    'OEM':      'bg-blue-50 dark:bg-[#202124] dark:border dark:border-blue-900/50 text-blue-700 dark:text-blue-400',
    'Genérico': 'bg-amber-50 dark:bg-[#202124] dark:border dark:border-amber-900/50 text-amber-700 dark:text-amber-400',
    'Usado':    'bg-slate-100 dark:bg-[#202124] dark:border dark:border-[#303134] text-slate-600 dark:text-[#9AA0A6]',
  };
  return map[condicion] || 'bg-slate-100 dark:bg-[#202124] dark:border dark:border-[#303134] text-slate-500 dark:text-[#9AA0A6]';
};

const actionBtn = "p-1.5 rounded-lg transition-colors text-[#5E7184] dark:text-[#B8C2D1] hover:text-[#48B9E6] hover:bg-[rgba(72,185,230,0.10)]";

function RepuestoRow({ repuesto, onView, onEdit, onToggle, onKardex }: {
  repuesto: Repuesto;
  onView: (r: Repuesto) => void;
  onEdit: (r: Repuesto) => void;
  onToggle: (r: Repuesto) => void;
  onKardex: (r: Repuesto) => void;
}) {
  const { user } = useAuth();
  const showCost = canViewCosts(user?.roles);
  const stock = toNum(repuesto.stock);
  const precio = toNum(repuesto.precio);
  const precioCosto = toNum(repuesto.precioCosto);
  const stockMin = toNum(repuesto.stockMinimo ?? 1);
  const lowStock = stock > 0 && stock <= stockMin;
  const noStock = stock === 0;
  const img = getFirstSafeImageUrl(repuesto.imagenes);

  return (
    <>
      {/* ── Desktop row ────────────────────────────────────────────────── */}
      <div className="hidden md:flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-[var(--color-row-hover)] transition-colors border-b border-slate-100 dark:border-[var(--color-border)] last:border-0">
        <img
          src={img}
          alt={repuesto.nombre}
          className="w-11 h-11 rounded-xl object-cover shrink-0 bg-slate-100 dark:bg-[var(--color-surface-soft)] border border-slate-200 dark:border-[var(--color-border)]"
          onError={(e) => { e.currentTarget.src = REPUESTO_PLACEHOLDER; }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {getTipoIcon(repuesto.tipo)}
            <p className="text-sm font-semibold text-[#14324A] dark:text-[#F8FAFC] truncate leading-tight">{repuesto.nombre}</p>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {(repuesto.sku || repuesto.codigo) && (
              <span className="text-[10px] font-mono text-sky-700 dark:text-[#60A5FA] bg-sky-50 dark:bg-[#202124] border dark:border-[#303134] px-1.5 py-0.5 rounded">{repuesto.sku || repuesto.codigo}</span>
            )}
            <span className="text-[10px] font-medium text-[#5E7184] dark:text-[#B8C2D1]">{repuesto.marca}</span>
            {repuesto.linea && <span className="text-[10px] text-[#7F8A99] dark:text-[#7F8A99]">· {repuesto.linea}</span>}
            {repuesto.modelo && <span className="text-[10px] text-[#7F8A99] dark:text-[#7F8A99]">· {repuesto.modelo}</span>}
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getCondicionBadge(repuesto.condicion)}`}>{repuesto.condicion}</span>
          </div>
        </div>
        <div className="text-right w-20 shrink-0">
          <p className={`text-sm font-bold ${noStock ? 'text-red-600 dark:text-red-400' : lowStock ? 'text-amber-600 dark:text-amber-400' : 'text-[#14324A] dark:text-[#F8FAFC]'}`}>
            {stock} uds
          </p>
          <p className="text-[10px] text-[#7F8A99] dark:text-[#7F8A99]">mín {stockMin}</p>
        </div>
        <div className="text-right w-28 shrink-0">
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{fmtQ(precio)}</p>
          {showCost && (
            <p className="text-[10px] text-[#7F8A99] dark:text-[#7F8A99]">costo {fmtQ(precioCosto)}</p>
          )}
        </div>
        <div className="hidden lg:flex items-center justify-center w-20 shrink-0">
          {noStock && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-50 dark:bg-[#202124] dark:border dark:border-red-900/50 text-red-600 dark:text-red-400">Sin stock</span>}
          {!noStock && lowStock && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-orange-50 dark:bg-[#202124] dark:border dark:border-amber-900/50 text-orange-600 dark:text-amber-400">Stock bajo</span>}
          {!noStock && !lowStock && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
              repuesto.activo
                ? 'bg-emerald-50 dark:bg-[#202124] dark:border dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-100 dark:bg-[#202124] dark:border dark:border-[#303134] text-slate-500 dark:text-[#9AA0A6]'
            }`}>{repuesto.activo ? 'Activo' : 'Inactivo'}</span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => onView(repuesto)} className={actionBtn} title="Ver detalles"><Eye size={14} /></button>
          <button onClick={() => onEdit(repuesto)} className={actionBtn} title="Editar repuesto"><Pencil size={14} /></button>
          <button onClick={() => onToggle(repuesto)} className={actionBtn} title={repuesto.activo ? 'Desactivar repuesto' : 'Activar repuesto'}>
            {repuesto.activo ? <PowerOff size={14} className="text-orange-400 dark:text-orange-300" /> : <Power size={14} className="text-emerald-500 dark:text-emerald-400" />}
          </button>
          <button onClick={() => onKardex(repuesto)} className={actionBtn} title="Ver movimientos"><History size={14} /></button>
          <button onClick={() => printBarcode(repuesto.sku || repuesto.codigo || repuesto.id, repuesto.nombre, 'Repuesto')} className={actionBtn} title="Imprimir código de barras"><Tag size={14} /></button>
        </div>
      </div>

      {/* ── Mobile card ────────────────────────────────────────────────── */}
      <div className="md:hidden p-4 border-b border-[#D6EEF8] dark:border-[var(--color-border)] last:border-0">
        <div className="flex items-start gap-3">
          <img
            src={img}
            alt={repuesto.nombre}
            className="w-12 h-12 rounded-xl object-cover shrink-0 bg-slate-100 dark:bg-[var(--color-surface-soft)] border border-slate-200 dark:border-[var(--color-border)]"
            onError={(e) => { e.currentTarget.src = REPUESTO_PLACEHOLDER; }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-[#14324A] dark:text-[#F8FAFC] leading-tight">{repuesto.nombre}</p>
              {noStock
                ? <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 bg-red-50 dark:bg-[#202124] dark:border dark:border-red-900/50 text-red-600 dark:text-red-400">Sin stock</span>
                : lowStock
                ? <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 bg-orange-50 dark:bg-[#202124] dark:border dark:border-amber-900/50 text-orange-600 dark:text-amber-400">Stock bajo</span>
                : <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${
                    repuesto.activo
                      ? 'bg-emerald-50 dark:bg-[#202124] dark:border dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-100 dark:bg-[#202124] dark:border dark:border-[#303134] text-slate-500 dark:text-[#9AA0A6]'
                  }`}>{repuesto.activo ? 'Activo' : 'Inactivo'}</span>
              }
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {(repuesto.sku || repuesto.codigo) && (
                <span className="text-[10px] font-mono text-sky-700 dark:text-[#60A5FA] bg-sky-50 dark:bg-[#202124] border dark:border-[#303134] px-1.5 py-0.5 rounded">{repuesto.sku || repuesto.codigo}</span>
              )}
              <span className="text-[10px] font-medium text-[#5E7184] dark:text-[#B8C2D1]">{repuesto.marca}</span>
              {repuesto.linea && <span className="text-[10px] text-[#7F8A99]">· {repuesto.linea}</span>}
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getCondicionBadge(repuesto.condicion)}`}>{repuesto.condicion}</span>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-4 text-sm">
            <div>
              <p className="text-[10px] text-[#7F8A99] dark:text-[#7F8A99] uppercase tracking-wide">Stock</p>
              <p className={`font-bold ${noStock ? 'text-red-600 dark:text-red-400' : lowStock ? 'text-amber-600 dark:text-amber-400' : 'text-[#14324A] dark:text-[#F8FAFC]'}`}>{stock} uds</p>
            </div>
            <div>
              <p className="text-[10px] text-[#7F8A99] dark:text-[#7F8A99] uppercase tracking-wide">Precio</p>
              <p className="font-bold text-emerald-600 dark:text-emerald-400">{fmtQ(precio)}</p>
            </div>
            {showCost && (
              <div>
                <p className="text-[10px] text-[#7F8A99] dark:text-[#7F8A99] uppercase tracking-wide">Costo</p>
                <p className="font-bold text-[#5E7184] dark:text-[#B8C2D1]">{fmtQ(precioCosto)}</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => onView(repuesto)} className={actionBtn} title="Ver detalles"><Eye size={16} /></button>
            <button onClick={() => onEdit(repuesto)} className={actionBtn} title="Editar repuesto"><Pencil size={16} /></button>
            <button onClick={() => onToggle(repuesto)} className={actionBtn} title={repuesto.activo ? 'Desactivar repuesto' : 'Activar repuesto'}>
              {repuesto.activo ? <PowerOff size={16} className="text-orange-400 dark:text-orange-300" /> : <Power size={16} className="text-emerald-500 dark:text-emerald-400" />}
            </button>
            <button onClick={() => onKardex(repuesto)} className={actionBtn} title="Ver movimientos"><History size={16} /></button>
            <button onClick={() => printBarcode(repuesto.sku || repuesto.codigo || repuesto.id, repuesto.nombre, 'Repuesto')} className={actionBtn} title="Imprimir código de barras"><Tag size={16} /></button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function RepuestosPage() {
  const toast = useToast();
  const { user } = useAuth();
  const showCost = canViewCosts(user?.roles);
  const { repuestos, removeRepuesto, duplicateRepuesto, loadRepuestos, isLoading } = useRepuestosStore();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [formEditId, setFormEditId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showKardexModal, setShowKardexModal] = useState(false);

  // Selection
  const [selectedRepuesto, setSelectedRepuesto] = useState<Repuesto | null>(null);
  const [repuestoToDelete, setRepuestoToDelete] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [kardexRepuesto, setKardexRepuesto] = useState<Repuesto | null>(null);
  const [kardexData, setKardexData] = useState<any[]>([]);
  const [kardexLoading, setKardexLoading] = useState(false);

  useEffect(() => { loadRepuestos(); }, [loadRepuestos]);

  // Image modal keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!showImageModal) return;
      if (e.key === 'ArrowLeft') setCurrentImageIndex(p => Math.max(0, p - 1));
      if (e.key === 'ArrowRight') setCurrentImageIndex(p => Math.min(selectedImages.length - 1, p + 1));
      if (e.key === 'Escape') setShowImageModal(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showImageModal, selectedImages.length]);

  // Filtered list
  const filteredRepuestos = repuestos.filter(r => {
    const sl = searchTerm.toLowerCase();
    const matchSearch = !searchTerm ||
      r.nombre.toLowerCase().includes(sl) ||
      r.tipo.toLowerCase().includes(sl) ||
      (r.sku && r.sku.toLowerCase().includes(sl)) ||
      (r.codigo && r.codigo.toLowerCase().includes(sl)) ||
      r.marca.toLowerCase().includes(sl) ||
      (r.linea && r.linea.toLowerCase().includes(sl)) ||
      (r.modelo && r.modelo.toLowerCase().includes(sl)) ||
      (r.proveedor && r.proveedor.toLowerCase().includes(sl)) ||
      (r.compatibilidad && r.compatibilidad.some(c => c.toLowerCase().includes(sl)));
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? r.activo : !r.activo);
    const matchCat = categoryFilter === 'all' || r.tipo === categoryFilter;
    const matchStock = stockFilter === 'all' ||
      (stockFilter === 'low' && r.stockMinimo != null && r.stock <= r.stockMinimo) ||
      (stockFilter === 'available' && r.stock > 0) ||
      (stockFilter === 'out' && r.stock === 0);
    return matchSearch && matchStatus && matchCat && matchStock;
  });

  const totalActivos = repuestos.filter(r => r.activo).length;
  const totalLowStock = repuestos.filter(r => {
    const st = toNum(r.stock); const mn = toNum(r.stockMinimo ?? 1);
    return st > 0 && st <= mn;
  }).length;
  const valorInventario = repuestos.reduce((s, r) => s + toNum(r.precioCosto) * toNum(r.stock), 0);
  const hasFilters = searchTerm || statusFilter !== 'all' || categoryFilter !== 'all' || stockFilter !== 'all';

  // Handlers
  const handleViewDetails = (r: Repuesto) => { setSelectedRepuesto(r); setShowDetailModal(true); };
  const handleEditRepuesto = (r: Repuesto) => { setFormEditId(r.id); setShowFormModal(true); };
  const handleDeleteRepuesto = (id: string) => { setRepuestoToDelete(id); setShowDeleteDialog(true); };
  const confirmDelete = () => {
    if (repuestoToDelete) { removeRepuesto(repuestoToDelete); setRepuestoToDelete(null); }
    setShowDeleteDialog(false);
  };
  const handleDuplicateRepuesto = (r: Repuesto) => {
    const dup = duplicateRepuesto(r.id);
    if (dup) { setFormEditId(dup.id); setShowFormModal(true); }
  };

  const handleToggleActive = async (r: Repuesto) => {
    try {
      const nuevoEstado = !r.activo;
      await repuestoService.updateRepuesto(Number(r.id), { activo: nuevoEstado });
      toast.add(`Repuesto ${nuevoEstado ? 'activado' : 'desactivado'} exitosamente`, 'success');
      await loadRepuestos();
      const updated = await repuestoService.getAllRepuestos({ limit: 500 });
      const found = updated.find(x => x.id === Number(r.id));
      if (found) {
        setSelectedRepuesto(prev => prev ? {
          ...prev,
          activo: found.activo !== false
        } : prev);
      }
    } catch (error: any) {
      toast.add(error.response?.data?.error || 'Error al cambiar estado', 'error');
    }
  };

  const handleKardex = async (r: Repuesto) => {
    setKardexRepuesto(r);
    setKardexData([]);
    setShowKardexModal(true);
    setKardexLoading(true);
    try {
      const data = await repuestoService.getMovimientosRepuesto(Number(r.id));
      setKardexData(data);
    } catch {
      toast.add('Error al cargar movimientos', 'error');
    } finally {
      setKardexLoading(false);
    }
  };

  const openNewModal = () => { setFormEditId(null); setShowFormModal(true); };

  const selectedRepuestoImageUrls = getSafeImageUrls(selectedRepuesto?.imagenes);
  return (
    <div className="space-y-5 max-w-screen-2xl">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#14324A] dark:text-[#F8FAFC] flex items-center gap-2">
            <Wrench size={20} className="text-[#48B9E6]" />
            Repuestos
          </h1>
          <p className="text-xs text-[#5E7184] dark:text-[#B8C2D1] mt-0.5">Gestión de repuestos y compatibilidades</p>
        </div>
        <Button
          onClick={openNewModal}
          className="bg-gradient-to-r from-[#48B9E6] to-[#2EA7D8] dark:bg-none dark:bg-[#2563EB] hover:from-[#2EA7D8] hover:to-[#2563EB] dark:hover:bg-[#1D4ED8] text-white font-semibold rounded-xl text-sm px-4 py-2 shadow-sm shrink-0 transition-all"
        >
          <Plus size={15} className="mr-1.5" />
          Nuevo Repuesto
        </Button>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Repuestos" value={repuestos.length} sub="en inventario" icon={Package} gradient="bg-gradient-to-br from-[#48B9E6] to-[#2563EB]" />
        <KpiCard label="Activos" value={totalActivos} sub="disponibles" icon={Activity} gradient="bg-gradient-to-br from-emerald-500 to-emerald-700" />
        <KpiCard label="Stock Bajo" value={totalLowStock} sub="por reponer" icon={AlertTriangle} gradient="bg-gradient-to-br from-amber-500 to-orange-600" />
        {showCost && <KpiCard label="Valor inventario" value={fmtQ(valorInventario)} sub="precio costo" icon={DollarSign} gradient="bg-gradient-to-br from-violet-500 to-purple-700" />}
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[var(--color-surface)] rounded-2xl border border-[#D6EEF8] dark:border-[var(--color-border)] px-4 py-3 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7F8A99] pointer-events-none" />
          <Input
            placeholder="Buscar por nombre, SKU, marca, modelo..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            className="pl-9 py-2 text-sm rounded-xl border-[#D6EEF8] dark:border-[var(--color-border)] bg-[#F8FDFF] dark:bg-[var(--color-input-bg)] text-[#14324A] dark:text-[var(--color-text)] placeholder:text-[#7F8A99] w-full focus:ring-[var(--tenant-primary-color)]"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter} className="text-sm rounded-xl border-[#D6EEF8] dark:border-[var(--color-border)] bg-white dark:bg-[var(--color-input-bg)] text-[#14324A] dark:text-[var(--color-text)] py-2 sm:w-40 shrink-0">
          <option value="all">Todos los tipos</option>
          {TIPOS_REPUESTO.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter} className="text-sm rounded-xl border-[#D6EEF8] dark:border-[var(--color-border)] bg-white dark:bg-[var(--color-input-bg)] text-[#14324A] dark:text-[var(--color-text)] py-2 sm:w-36 shrink-0">
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </Select>
        <Select value={stockFilter} onValueChange={setStockFilter} className="text-sm rounded-xl border-[#D6EEF8] dark:border-[var(--color-border)] bg-white dark:bg-[var(--color-input-bg)] text-[#14324A] dark:text-[var(--color-text)] py-2 sm:w-36 shrink-0">
          <option value="all">Todo el stock</option>
          <option value="available">Disponible</option>
          <option value="low">Stock bajo</option>
          <option value="out">Sin stock</option>
        </Select>
        {hasFilters && (
          <Button variant="ghost" onClick={() => { setSearchTerm(''); setStatusFilter('all'); setCategoryFilter('all'); setStockFilter('all'); }} className="text-sm text-[#5E7184] dark:text-[#B8C2D1] hover:text-[#14324A] dark:hover:text-[#F8FAFC] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] rounded-xl px-3 py-2 whitespace-nowrap shrink-0">
            Limpiar
          </Button>
        )}
        <span className="text-xs text-[#5E7184] dark:text-[#B8C2D1] whitespace-nowrap self-center sm:ml-1 shrink-0">
          {filteredRepuestos.length} repuestos
        </span>
      </div>

      {/* ── List ────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[var(--color-surface)] rounded-2xl border border-[#D6EEF8] dark:border-[var(--color-border)] overflow-hidden">
        {/* Table header — only on desktop */}
        <div className="hidden md:flex items-center gap-3 px-4 py-2.5 bg-[#F8FDFF] dark:bg-[var(--color-surface-soft)] border-b border-[#D6EEF8] dark:border-[var(--color-border)]">
          <div className="w-11 shrink-0" />
          <p className="flex-1 text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest">Repuesto</p>
          <p className="w-20 text-right text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest shrink-0">Stock</p>
          <p className="w-28 text-right text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest shrink-0">Precio venta</p>
          <p className="hidden lg:block w-20 text-center text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest shrink-0">Estado</p>
          <p className="w-24 text-right text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest shrink-0">Acciones</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-[#48B9E6] border-t-transparent" />
            <p className="text-sm text-[#5E7184] dark:text-[#B8C2D1]">Cargando repuestos...</p>
          </div>
        ) : filteredRepuestos.length > 0 ? (
          <div>
            {filteredRepuestos.map(r => (
              <RepuestoRow
                key={r.id}
                repuesto={r}
                onView={handleViewDetails}
                onEdit={handleEditRepuesto}
                onToggle={handleToggleActive}
                onKardex={handleKardex}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-[#F8FDFF] dark:bg-[var(--color-surface-soft)] rounded-2xl p-4 mb-3">
              <Wrench size={28} className="text-[#48B9E6]" />
            </div>
            <p className="text-sm font-semibold text-[#14324A] dark:text-[#F8FAFC]">{hasFilters ? 'Sin resultados' : 'No hay repuestos'}</p>
            <p className="text-xs text-[#5E7184] dark:text-[#B8C2D1] mt-1 mb-4">{hasFilters ? 'Ajusta los filtros' : 'Comienza agregando tu primer repuesto'}</p>
            {!hasFilters && (
              <Button onClick={openNewModal} className="bg-gradient-to-r from-[#48B9E6] to-[#2EA7D8] dark:bg-none dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] text-white text-sm rounded-xl px-4 py-2">
                <Plus size={14} className="mr-1.5" />
                Agregar Repuesto
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Repuesto Form Modal ─────────────────────────────────────────── */}
      <RepuestoForm
        open={showFormModal}
        onClose={() => { setShowFormModal(false); setFormEditId(null); loadRepuestos(); }}
        editId={formEditId ?? undefined}
      />

            {/* ── Detail Modal ─────────────────────────────────────────────── */}
      <Modal open={showDetailModal} onClose={() => setShowDetailModal(false)} title="Detalle del Repuesto">
        {selectedRepuesto && (
          <div className="flex flex-col lg:flex-row gap-5">
            {/* Image */}
            <div className="lg:w-44 shrink-0">
{selectedRepuestoImageUrls.length > 0 ? (
  <button
    onClick={() => {
      setSelectedImages(selectedRepuestoImageUrls);
      setCurrentImageIndex(0);
      setShowImageModal(true);
    }}
    className="w-full aspect-square rounded-2xl overflow-hidden bg-slate-100 block"
  >
    <img
      src={selectedRepuestoImageUrls[0]}
      alt={selectedRepuesto.nombre}
      className="w-full h-full object-cover hover:scale-105 transition-transform"
      onError={(e) => {
        e.currentTarget.src = REPUESTO_PLACEHOLDER;
      }}
    />
  </button>
) : (
  <div className="w-full aspect-square rounded-2xl bg-slate-100 flex flex-col items-center justify-center text-slate-400">
    {getTipoIcon(selectedRepuesto.tipo)}
    <p className="text-[10px] mt-1">Sin imagen</p>
  </div>
)}

  {selectedRepuestoImageUrls.length > 1 && (
    <div className="flex gap-1 mt-2 flex-wrap">
      {selectedRepuestoImageUrls.slice(1, 5).map((img, i) => (
        <button
          key={i}
          onClick={() => {
            setSelectedImages(selectedRepuestoImageUrls);
            setCurrentImageIndex(i + 1);
            setShowImageModal(true);
          }}
          className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 hover:border-blue-300 transition-colors shrink-0"
        >
          <img
            src={img}
            alt={`Imagen ${i + 2}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src = REPUESTO_PLACEHOLDER;
            }}
          />
        </button>
      ))}

      {selectedRepuestoImageUrls.length > 5 && (
        <span className="text-[10px] text-slate-400 self-center">
          +{selectedRepuestoImageUrls.length - 5}
        </span>
      )}
    </div>
  )}
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Estado</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${selectedRepuesto.activo ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    {selectedRepuesto.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Condición</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${getCondicionBadge(selectedRepuesto.condicion)}`}>{selectedRepuesto.condicion}</span>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-4">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  {getTipoIcon(selectedRepuesto.tipo)}
                  <span className="text-xs text-slate-500 font-medium">{selectedRepuesto.tipo}</span>
                </div>
                <h2 className="text-lg font-bold text-slate-800 leading-tight">{selectedRepuesto.nombre}</h2>
                <p className="text-xs font-mono text-slate-400 mt-0.5">{selectedRepuesto.sku || selectedRepuesto.codigo}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-[#0A1220] rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest">Marca / Línea</p>
                  <p className="text-sm font-semibold text-[#14324A] dark:text-[#F8FAFC] mt-0.5">{selectedRepuesto.marca}</p>
                  {selectedRepuesto.linea && <p className="text-[11px] text-[#7F8A99]">{selectedRepuesto.linea}{selectedRepuesto.modelo ? ` · ${selectedRepuesto.modelo}` : ''}</p>}
                </div>
                <div className="bg-slate-50 dark:bg-[#0A1220] rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest">Stock</p>
                  <p className={`text-sm font-bold mt-0.5 ${toNum(selectedRepuesto.stock) === 0 ? 'text-red-600 dark:text-red-400' : (selectedRepuesto.stockMinimo && toNum(selectedRepuesto.stock) <= toNum(selectedRepuesto.stockMinimo)) ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {toNum(selectedRepuesto.stock)} uds
                  </p>
                  <p className="text-[11px] text-[#7F8A99]">mín {selectedRepuesto.stockMinimo ?? 1}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {showCost && (
                <div className="bg-blue-50 dark:bg-[#202124] dark:border dark:border-[#303134] rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-widest">Precio Costo</p>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-300 mt-0.5">{fmtQ(selectedRepuesto.precioCosto)}</p>
                </div>
                )}
                <div className="bg-emerald-50 dark:bg-[#202124] dark:border dark:border-[#303134] rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest">Precio Venta</p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">{fmtQ(selectedRepuesto.precio)}</p>
                </div>
              </div>

              {showCost && toNum(selectedRepuesto.precioCosto) > 0 && toNum(selectedRepuesto.precio) > 0 && (
                <div className="bg-violet-50 dark:bg-[#202124] border border-violet-200 dark:border-[#303134] rounded-xl px-3 py-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-violet-600 dark:text-[#9AA0A6]">Margen</span>
                  <span className="text-sm font-bold text-violet-700 dark:text-[var(--color-text)]">
                    {fmtQ(toNum(selectedRepuesto.precio) - toNum(selectedRepuesto.precioCosto))}
                    <span className="font-normal text-[11px] ml-1">
                      ({(((toNum(selectedRepuesto.precio) - toNum(selectedRepuesto.precioCosto)) / toNum(selectedRepuesto.precioCosto)) * 100).toFixed(1)}%)
                    </span>
                  </span>
                </div>
              )}

              {selectedRepuesto.proveedor && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Building2 size={13} className="text-slate-400 shrink-0" />
                  <span>{selectedRepuesto.proveedor}</span>
                </div>
              )}

              {selectedRepuesto.compatibilidad && selectedRepuesto.compatibilidad.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Compatibilidad</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedRepuesto.compatibilidad.map((c, i) => (
                      <span key={i} className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedRepuesto.notas && (
                <div className="bg-slate-50 dark:bg-[#0A1220] rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest mb-1">Notas</p>
                  <p className="text-sm text-[#14324A] dark:text-[#F8FAFC]">{selectedRepuesto.notas}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
                <Button onClick={() => { setShowDetailModal(false); handleEditRepuesto(selectedRepuesto); }} className="text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2">
                  <Edit size={13} className="mr-1.5" />
                  Editar
                </Button>
                <Button variant="ghost" onClick={() => handleToggleActive(selectedRepuesto)}
                  className={`text-sm border rounded-xl px-4 py-2 ${selectedRepuesto.activo ? 'border-orange-200 dark:border-amber-900/50 text-orange-600 dark:text-amber-400 hover:bg-orange-50 dark:hover:bg-[#202124]' : 'border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-[#202124]'}`}>
                  {selectedRepuesto.activo ? 'Desactivar' : 'Activar'}
                </Button>
                <Button variant="ghost" onClick={() => { setShowDetailModal(false); handleDeleteRepuesto(selectedRepuesto.id); }} className="text-sm border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-[#202124] rounded-xl px-4 py-2">
                  <Trash2 size={13} className="mr-1.5" />
                  Eliminar
                </Button>
                <Button variant="ghost" onClick={() => setShowDetailModal(false)} className="text-sm border border-slate-200 rounded-xl px-4 py-2 ml-auto">
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Image Modal ──────────────────────────────────────────────── */}
      {showImageModal && (
        <ImageModal
          isOpen={showImageModal}
          images={selectedImages}
          initialIndex={currentImageIndex}
          onClose={() => setShowImageModal(false)}
        />
      )}

      {/* ── Delete Confirm ───────────────────────────────────────────── */}
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={confirmDelete}
        title="Eliminar Repuesto"
        message="¿Estás seguro de que deseas eliminar este repuesto? Esta acción no se puede deshacer."
        confirmText="Eliminar"
      />

      {/* ── Kardex / Movimientos Modal ───────────────────────────────── */}
      <Modal open={showKardexModal} onClose={() => setShowKardexModal(false)} title={`Movimientos — ${kardexRepuesto?.nombre ?? ''}`}>
        {kardexLoading ? (
          <div className="flex items-center justify-center py-10 gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#48B9E6] border-t-transparent" />
            <p className="text-sm text-[#5E7184] dark:text-[#B8C2D1]">Cargando movimientos...</p>
          </div>
        ) : kardexData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <History size={28} className="text-[#48B9E6] mb-2" />
            <p className="text-sm font-semibold text-[#14324A] dark:text-[#F8FAFC]">Sin movimientos</p>
            <p className="text-xs text-[#5E7184] dark:text-[#B8C2D1] mt-1">No hay movimientos de stock registrados para este repuesto.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#D6EEF8] dark:border-[rgba(72,185,230,0.12)]">
                  <th className="text-left py-2 px-3 text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-wide">Fecha</th>
                  <th className="text-left py-2 px-3 text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-wide">Tipo</th>
                  <th className="text-right py-2 px-3 text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-wide">Cant.</th>
                  <th className="text-right py-2 px-3 text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-wide">Stock anterior</th>
                  <th className="text-right py-2 px-3 text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-wide">Stock nuevo</th>
                  <th className="text-left py-2 px-3 text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-wide">Usuario</th>
                  <th className="text-left py-2 px-3 text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-wide">Notas</th>
                </tr>
              </thead>
              <tbody>
                {kardexData.map((mov: any) => {
                  const isEntrada = ['ENTRADA', 'DEVOLUCION'].includes(mov.tipo_movimiento);
                  const isSalida = ['SALIDA', 'VENTA', 'REPARACION'].includes(mov.tipo_movimiento);
                  return (
                    <tr key={mov.id} className="border-b border-[#D6EEF8] dark:border-[rgba(72,185,230,0.06)] hover:bg-slate-50 dark:hover:bg-[#0A1220] transition-colors">
                      <td className="py-2 px-3 text-[12px] text-[#5E7184] dark:text-[#B8C2D1] whitespace-nowrap">
                        {new Date(mov.created_at).toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          isEntrada ? 'bg-emerald-50 dark:bg-[#202124] dark:border dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400' :
                          isSalida ? 'bg-red-50 dark:bg-[#202124] dark:border dark:border-red-900/50 text-red-700 dark:text-red-400' :
                          'bg-blue-50 dark:bg-[#202124] dark:border dark:border-blue-900/50 text-blue-700 dark:text-blue-400'
                        }`}>{mov.tipo_movimiento}</span>
                      </td>
                      <td className={`py-2 px-3 text-right text-[12px] font-bold ${isEntrada ? 'text-emerald-600 dark:text-emerald-400' : isSalida ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                        {isEntrada ? '+' : isSalida ? '-' : ''}{mov.cantidad}
                      </td>
                      <td className="py-2 px-3 text-right text-[12px] text-[#5E7184] dark:text-[#B8C2D1]">{mov.stock_anterior}</td>
                      <td className="py-2 px-3 text-right text-[12px] font-semibold text-[#14324A] dark:text-[#F8FAFC]">{mov.stock_nuevo}</td>
                      <td className="py-2 px-3 text-[12px] text-[#5E7184] dark:text-[#B8C2D1]">{mov.usuario_nombre ?? '—'}</td>
                      <td className="py-2 px-3 text-[12px] text-[#7F8A99] max-w-[160px] truncate">{mov.notas ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}

