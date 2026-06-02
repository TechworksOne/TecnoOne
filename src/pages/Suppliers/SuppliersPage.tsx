import {
  Building2, Edit, Eye, Globe, MapPin, Phone, Plus, Search,
  ShoppingCart, Trash2, User, Mail, FileText, Package,
  Calendar, CheckCircle, XCircle, Users, X,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { formatMoney, formatPhone, formatDate } from '../../lib/format';
import { useSuppliersStore } from '../../store/useSuppliers';
import { Supplier } from '../../types/supplier';

// ─── Shared style tokens ──────────────────────────────────────────────────────

const inputCls = 'w-full rounded-xl px-3 py-2.5 text-sm border outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-colors';
const inputStyle = {
  background: 'var(--color-input-bg)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text)',
};
const labelCls = 'block text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5';
const thCls = 'text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] whitespace-nowrap';
const tdCls = 'px-3 py-2.5 text-sm text-[var(--color-text)]';
const tdSecCls = 'px-3 py-2.5 text-sm text-[var(--color-text-sec)]';

// ─── Estado badge ─────────────────────────────────────────────────────────────

function EstadoBadge({ activo }: { activo: boolean }) {
  return activo ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/40">
      <CheckCircle size={11} /> Activo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700/40">
      <XCircle size={11} /> Inactivo
    </span>
  );
}

// ─── Purchase estado badge ────────────────────────────────────────────────────

const COMPRA_ESTADO: Record<string, string> = {
  RECIBIDA:  'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  CONFIRMADA:'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  BORRADOR:  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  CANCELADA: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const {
    suppliers,
    selectedSupplier,
    supplierPurchases,
    isLoading,
    loadSuppliers,
    getSupplierById,
    getSupplierPurchases,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    setSelectedSupplier,
    clearSelectedSupplier,
  } = useSuppliersStore();

  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActivo, setFilterActivo] = useState<'todos' | 'activos' | 'inactivos'>('todos');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [currentSupplier, setCurrentSupplier] = useState({
    nombre: '',
    contacto: '',
    telefono: '',
    email: '',
    direccion: '',
    nit: '',
    empresa: '',
    sitio_web: '',
    notas: '',
    activo: true,
  });

  useEffect(() => { loadSuppliers(); }, []);

  // ─── Filtered list ─────────────────────────────────────────────────────────
  const filteredSuppliers = suppliers.filter(s => {
    const matchSearch = !searchQuery || (() => {
      const q = searchQuery.toLowerCase();
      return (
        s.nombre.toLowerCase().includes(q) ||
        s.telefono?.includes(q) ||
        s.nit?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q)
      );
    })();
    const matchActivo =
      filterActivo === 'todos' ? true :
      filterActivo === 'activos' ? s.activo :
      !s.activo;
    return matchSearch && matchActivo;
  });

  // ─── KPI derived values ────────────────────────────────────────────────────
  const totalActivos = suppliers.filter(s => s.activo).length;
  const totalCompras = suppliers.reduce((acc, s) => acc + (s.totalCompras ?? 0), 0);
  const ultimaCompra = suppliers
    .filter(s => s.ultimaCompra)
    .map(s => s.ultimaCompra as string)
    .sort((a, b) => b.localeCompare(a))[0];

  // ─── Form helpers ──────────────────────────────────────────────────────────
  const resetForm = () => {
    setCurrentSupplier({ nombre: '', contacto: '', telefono: '', email: '', direccion: '', nit: '', empresa: '', sitio_web: '', notas: '', activo: true });
    setEditingSupplier(null);
  };

  const validateForm = () => {
    if (!currentSupplier.nombre.trim()) { toast.add('El nombre del proveedor es requerido', 'error'); return false; }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, currentSupplier);
        toast.add('Proveedor actualizado exitosamente', 'success');
      } else {
        await addSupplier({ ...currentSupplier, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        toast.add('Proveedor creado exitosamente', 'success');
      }
      setIsFormOpen(false);
      resetForm();
      await loadSuppliers();
    } catch (error: any) {
      toast.add(error.message || 'Error al guardar el proveedor', 'error');
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setCurrentSupplier({
      nombre: supplier.nombre, contacto: supplier.contacto || '', telefono: supplier.telefono,
      email: supplier.email || '', direccion: supplier.direccion || '', nit: supplier.nit || '',
      empresa: supplier.empresa || '', sitio_web: supplier.sitio_web || '', notas: supplier.notas || '',
      activo: supplier.activo,
    });
    setIsFormOpen(true);
  };

  const handleView = async (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    await getSupplierPurchases(supplier.id);
    setIsDetailsOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedSupplier) return;
    try {
      await deleteSupplier(selectedSupplier.id);
      toast.add('Proveedor eliminado exitosamente', 'success');
      setIsDeleteOpen(false);
      setSelectedSupplier(null);
      await loadSuppliers();
    } catch (error: any) {
      toast.add(error.message || 'Error al eliminar el proveedor', 'error');
    }
  };

  const confirmDelete = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsDeleteOpen(true);
  };

  // ─── Field setter helper ───────────────────────────────────────────────────
  const setField = (k: keyof typeof currentSupplier, v: string | boolean) =>
    setCurrentSupplier(prev => ({ ...prev, [k]: v }));

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)] flex items-center gap-2.5">
            <Building2 size={24} className="text-[var(--color-primary)]" />
            Proveedores
          </h1>
          <p className="text-sm text-[var(--color-text-sec)] mt-0.5">
            Gestion de proveedores y compras
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setIsFormOpen(true); }}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-colors bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] shadow-sm"
        >
          <Plus size={16} /> Nuevo Proveedor
        </button>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {([
          { label: 'Total Proveedores',  value: suppliers.length,  icon: <Users size={20} />,        iconBg: 'bg-blue-100 dark:bg-blue-900/30',    iconColor: 'text-blue-500 dark:text-blue-400',    desc: 'Registrados en el sistema' },
          { label: 'Activos',            value: totalActivos,       icon: <CheckCircle size={20} />,   iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-500 dark:text-emerald-400', desc: 'Proveedores habilitados' },
          { label: 'Compras registradas',value: totalCompras,       icon: <ShoppingCart size={20} />,  iconBg: 'bg-violet-100 dark:bg-violet-900/30', iconColor: 'text-violet-500 dark:text-violet-400',  desc: 'Ordenes de compra totales' },
          { label: 'Ultima actividad',   value: ultimaCompra ? formatDate(ultimaCompra) : 'Sin registros', icon: <Calendar size={20} />, iconBg: 'bg-cyan-100 dark:bg-cyan-900/30', iconColor: 'text-cyan-500 dark:text-cyan-400', desc: 'Fecha de ultima compra' },
        ] as const).map((kpi, i) => (
          <div key={i} className="rounded-2xl border p-4 flex items-start justify-between gap-3"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">{kpi.label}</p>
              <p className="text-2xl font-extrabold text-[var(--color-text)] mt-1 leading-tight">{kpi.value}</p>
              <p className="text-xs text-[var(--color-text-sec)] mt-0.5">{kpi.desc}</p>
            </div>
            <div className={`p-2.5 rounded-xl shrink-0 ${kpi.iconBg}`}>
              <span className={kpi.iconColor}>{kpi.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search + filter bar ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={15} />
          <input
            type="text"
            placeholder="Buscar por nombre, NIT, telefono o email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-colors"
            style={inputStyle}
          />
        </div>
        <div className="flex gap-1 p-1 rounded-xl border shrink-0"
          style={{ background: 'var(--color-surface-soft)', borderColor: 'var(--color-border)' }}>
          {(['todos', 'activos', 'inactivos'] as const).map(f => (
            <button key={f} onClick={() => setFilterActivo(f)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                filterActivo === f
                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                  : 'text-[var(--color-text-sec)] hover:text-[var(--color-text)] hover:bg-[var(--color-row-hover)]'
              }`}>
              {f}
            </button>
          ))}
        </div>
        {(searchQuery || filterActivo !== 'todos') && (
          <button
            onClick={() => { setSearchQuery(''); setFilterActivo('todos'); }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border shrink-0 transition-colors hover:bg-[var(--color-row-hover)] text-[var(--color-text-sec)]"
            style={{ borderColor: 'var(--color-border)' }}>
            <X size={13} /> Limpiar
          </button>
        )}
      </div>

      {/* ── Providers count ───────────────────────────────────────────────── */}
      <p className="text-xs text-[var(--color-text-muted)] -mt-2">
        {filteredSuppliers.length} {filteredSuppliers.length === 1 ? 'proveedor' : 'proveedores'} encontrado{filteredSuppliers.length !== 1 ? 's' : ''}
      </p>

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
          <p className="text-sm text-[var(--color-text-muted)]">Cargando proveedores...</p>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-[var(--color-text-muted)]">
          <Building2 size={40} className="opacity-25" />
          <p className="text-sm font-medium">
            {searchQuery ? 'No se encontraron proveedores' : 'No hay proveedores registrados'}
          </p>
          {!searchQuery && (
            <button onClick={() => { resetForm(); setIsFormOpen(true); }}
              className="mt-1 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors">
              <Plus size={15} /> Agregar Proveedor
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredSuppliers.map(supplier => (
            <SupplierCard
              key={supplier.id}
              supplier={supplier}
              onView={() => handleView(supplier)}
              onEdit={() => handleEdit(supplier)}
              onDelete={() => confirmDelete(supplier)}
            />
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: FORM (Nuevo / Editar)
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); resetForm(); }}
        title={editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        size="3xl"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-0">

          {/* Info header */}
          <div className="flex items-center gap-3 mb-6 p-4 rounded-xl border"
            style={{ background: 'rgba(72,185,230,0.06)', borderColor: 'rgba(72,185,230,0.20)' }}>
            <div className="p-2.5 rounded-xl shrink-0" style={{ background: 'rgba(72,185,230,0.14)' }}>
              <Building2 size={20} className="text-[var(--color-primary)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-text)]">
                {editingSupplier ? 'Actualizar informacion del proveedor' : 'Registrar nuevo proveedor'}
              </p>
              <p className="text-xs text-[var(--color-text-sec)]">Complete los campos para continuar</p>
            </div>
          </div>

          {/* ── Seccion 1: Info principal ─────────────────────────────────── */}
          <FormSection label="Informacion principal">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={labelCls}>
                  Nombre del proveedor <span className="text-red-500 normal-case font-normal">*</span>
                </label>
                <input type="text" placeholder="Ej: Distribuidora TecnoMax"
                  value={currentSupplier.nombre}
                  onChange={e => setField('nombre', e.target.value)}
                  className={inputCls} style={inputStyle} required />
              </div>
              <div>
                <label className={labelCls}>Empresa / Razon social</label>
                <input type="text" placeholder="Ej: TecnoMax S.A."
                  value={currentSupplier.empresa}
                  onChange={e => setField('empresa', e.target.value)}
                  className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls}>Persona de contacto</label>
                <input type="text" placeholder="Ej: Juan Perez"
                  value={currentSupplier.contacto}
                  onChange={e => setField('contacto', e.target.value)}
                  className={inputCls} style={inputStyle} />
              </div>
            </div>
          </FormSection>

          {/* ── Seccion 2: Contacto ───────────────────────────────────────── */}
          <FormSection label="Contacto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Telefono</label>
                <input type="tel" placeholder="Ej: 2234-5678"
                  value={currentSupplier.telefono}
                  onChange={e => setField('telefono', e.target.value)}
                  className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" placeholder="Ej: ventas@proveedor.com"
                  value={currentSupplier.email}
                  onChange={e => setField('email', e.target.value)}
                  className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls}>Sitio web</label>
                <input type="url" placeholder="https://proveedor.com"
                  value={currentSupplier.sitio_web}
                  onChange={e => setField('sitio_web', e.target.value)}
                  className={inputCls} style={inputStyle} />
              </div>
            </div>
          </FormSection>

          {/* ── Seccion 3: Info fiscal ────────────────────────────────────── */}
          <FormSection label="Informacion fiscal">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>NIT</label>
                <input type="text" placeholder="Ej: 12345678-9"
                  value={currentSupplier.nit}
                  onChange={e => setField('nit', e.target.value)}
                  className={inputCls} style={inputStyle} />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <div
                    onClick={() => setField('activo', !currentSupplier.activo)}
                    className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer flex items-center ${currentSupplier.activo ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'}`}
                    style={{ minWidth: 40, height: 22 }}>
                    <div className={`absolute w-4 h-4 bg-white dark:bg-slate-200 rounded-full shadow transition-transform ${currentSupplier.activo ? 'translate-x-5' : 'translate-x-0.5'}`} style={{ top: 3 }} />
                  </div>
                  <span className="text-sm font-medium text-[var(--color-text-sec)]">
                    Proveedor {currentSupplier.activo ? 'activo' : 'inactivo'}
                  </span>
                </label>
              </div>
            </div>
          </FormSection>

          {/* ── Seccion 4: Ubicacion y notas ─────────────────────────────── */}
          <FormSection label="Ubicacion y observaciones">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className={labelCls}>Direccion</label>
                <input type="text" placeholder="Ej: Zona 10, Ciudad de Guatemala"
                  value={currentSupplier.direccion}
                  onChange={e => setField('direccion', e.target.value)}
                  className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls}>Notas</label>
                <textarea
                  value={currentSupplier.notas}
                  onChange={e => setField('notas', e.target.value)}
                  placeholder="Observaciones, terminos de pago, descuentos especiales..."
                  rows={3}
                  className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-colors resize-none"
                  style={inputStyle}
                />
              </div>
            </div>
          </FormSection>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row gap-3 pt-5 mt-2 border-t"
            style={{ borderColor: 'var(--color-border)' }}>
            <button type="button"
              onClick={() => { setIsFormOpen(false); resetForm(); }}
              className="flex-1 sm:flex-none sm:w-32 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-[var(--color-row-hover)] text-[var(--color-text-sec)]"
              style={{ borderColor: 'var(--color-border)' }}>
              Cancelar
            </button>
            <button type="submit"
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors shadow-sm">
              {editingSupplier ? 'Actualizar Proveedor' : 'Guardar Proveedor'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: DETAILS
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={isDetailsOpen}
        onClose={() => { setIsDetailsOpen(false); clearSelectedSupplier(); }}
        title="Detalles del Proveedor"
        size="xl"
      >
        {selectedSupplier && (
          <div className="space-y-5">
            {/* Header info */}
            <div className="rounded-xl border p-5"
              style={{ background: 'rgba(72,185,230,0.06)', borderColor: 'rgba(72,185,230,0.20)' }}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-[var(--color-text)]">{selectedSupplier.nombre}</h3>
                  {selectedSupplier.empresa && (
                    <p className="text-sm text-[var(--color-text-sec)] mt-0.5">{selectedSupplier.empresa}</p>
                  )}
                </div>
                <EstadoBadge activo={selectedSupplier.activo} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {selectedSupplier.contacto && (
                  <DetailRow icon={<User size={14} className="text-[var(--color-primary)]" />} label="Contacto" value={selectedSupplier.contacto} />
                )}
                <DetailRow icon={<Phone size={14} className="text-emerald-500" />} label="Telefono" value={formatPhone(selectedSupplier.telefono)} />
                {selectedSupplier.email && (
                  <DetailRow icon={<Mail size={14} className="text-violet-500" />} label="Email" value={selectedSupplier.email} />
                )}
                {selectedSupplier.nit && (
                  <DetailRow icon={<FileText size={14} className="text-orange-500" />} label="NIT" value={selectedSupplier.nit} />
                )}
                {selectedSupplier.sitio_web && (
                  <div className="flex items-center gap-2">
                    <Globe size={14} className="text-cyan-500 shrink-0" />
                    <a href={selectedSupplier.sitio_web} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-[var(--color-primary)] hover:underline truncate">
                      {selectedSupplier.sitio_web}
                    </a>
                  </div>
                )}
                {selectedSupplier.direccion && (
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <MapPin size={14} className="text-red-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-[var(--color-text-sec)]">{selectedSupplier.direccion}</span>
                  </div>
                )}
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
              {([
                { icon: <ShoppingCart size={18} />, bg: 'bg-blue-100 dark:bg-blue-900/30', clr: 'text-blue-600 dark:text-blue-400', val: String(selectedSupplier.totalCompras || 0), lbl: 'Total Compras' },
                { icon: <Calendar size={18} />,     bg: 'bg-emerald-100 dark:bg-emerald-900/30', clr: 'text-emerald-600 dark:text-emerald-400', val: selectedSupplier.ultimaCompra ? formatDate(selectedSupplier.ultimaCompra) : 'N/A', lbl: 'Ultima Compra' },
                { icon: <Package size={18} />,      bg: 'bg-violet-100 dark:bg-violet-900/30', clr: 'text-violet-600 dark:text-violet-400', val: selectedSupplier.createdAt ? formatDate(selectedSupplier.createdAt) : 'N/A', lbl: 'Registrado' },
              ] as const).map((item, i) => (
                <div key={i} className="rounded-xl border p-3 text-center"
                  style={{ background: 'var(--color-surface-soft)', borderColor: 'var(--color-border)' }}>
                  <div className={`w-9 h-9 rounded-xl mx-auto mb-2 flex items-center justify-center ${item.bg}`}>
                    <span className={item.clr}>{item.icon}</span>
                  </div>
                  <p className={`text-sm font-bold ${item.clr}`}>{item.val}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{item.lbl}</p>
                </div>
              ))}
            </div>

            {/* Notes */}
            {selectedSupplier.notas && (
              <div className="rounded-xl border p-4"
                style={{ background: 'var(--color-surface-soft)', borderColor: 'var(--color-border)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Notas</p>
                <p className="text-sm text-[var(--color-text-sec)]">{selectedSupplier.notas}</p>
              </div>
            )}

            {/* Purchase history */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3 flex items-center gap-1.5">
                <ShoppingCart size={12} /> Historial de Compras
              </p>
              {supplierPurchases.length === 0 ? (
                <div className="text-center py-10 rounded-xl border"
                  style={{ background: 'var(--color-surface-soft)', borderColor: 'var(--color-border)' }}>
                  <Package size={28} className="mx-auto opacity-25 text-[var(--color-text-muted)] mb-2" />
                  <p className="text-sm text-[var(--color-text-muted)]">No hay compras registradas</p>
                </div>
              ) : (
                <div className="rounded-xl border overflow-hidden"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                  <table className="w-full text-sm">
                    <thead style={{ background: 'var(--color-surface-soft)', borderBottom: '1px solid var(--color-border)' }}>
                      <tr>
                        {['Numero','Fecha','Items','Total','Estado'].map(h => (
                          <th key={h} className={thCls}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {supplierPurchases.map(p => (
                        <tr key={p.id} className="border-t transition-colors hover:bg-[var(--color-row-hover)]"
                          style={{ borderColor: 'var(--color-border)' }}>
                          <td className="px-3 py-2.5 text-sm font-mono font-semibold text-[var(--color-primary)]">{p.numero_compra}</td>
                          <td className={tdSecCls}>{formatDate(p.fecha_compra)}</td>
                          <td className={tdCls + ' text-right'}>{p.total_items || 0}</td>
                          <td className="px-3 py-2.5 text-sm font-semibold text-[var(--color-text)] text-right">{formatMoney(p.total)}</td>
                          <td className="px-3 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${COMPRA_ESTADO[p.estado] || 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400'}`}>
                              {p.estado}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => { setIsDeleteOpen(false); setSelectedSupplier(null); }}
        onConfirm={handleDelete}
        title="Eliminar Proveedor"
        message={`Estas seguro de eliminar el proveedor "${selectedSupplier?.nombre}"? Esta accion no se puede deshacer.`}
        confirmText="Eliminar"
        type="danger"
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FormSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3 flex items-center gap-1.5">
        <span className="w-4 h-px inline-block" style={{ background: 'var(--color-border)' }} />
        {label}
        <span className="flex-1 h-px inline-block" style={{ background: 'var(--color-border)' }} />
      </p>
      {children}
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0">{icon}</span>
      <span className="text-xs font-semibold text-[var(--color-text-muted)] shrink-0">{label}:</span>
      <span className="text-sm text-[var(--color-text-sec)] truncate">{value}</span>
    </div>
  );
}

function SupplierCard({
  supplier, onView, onEdit, onDelete,
}: {
  supplier: Supplier;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="rounded-2xl border flex flex-col overflow-hidden transition-all hover:shadow-md"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      {/* Card header stripe */}
      <div className="p-4 flex items-start justify-between gap-2"
        style={{ background: 'var(--color-surface-soft)', borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl shrink-0 bg-blue-100 dark:bg-blue-900/30">
            <Building2 size={18} className="text-blue-500 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-[var(--color-text)] truncate leading-snug">{supplier.nombre}</h3>
            {supplier.empresa && (
              <p className="text-xs text-[var(--color-text-sec)] truncate">{supplier.empresa}</p>
            )}
          </div>
        </div>
        <EstadoBadge activo={supplier.activo} />
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-2.5 flex-1">
        {supplier.contacto && (
          <InfoRow icon={<User size={13} className="text-[var(--color-primary)]" />} value={supplier.contacto} />
        )}
        <InfoRow icon={<Phone size={13} className="text-emerald-500" />} value={formatPhone(supplier.telefono)} />
        {supplier.email && (
          <InfoRow icon={<Mail size={13} className="text-violet-500" />} value={supplier.email} truncate />
        )}
        {supplier.nit && (
          <InfoRow icon={<FileText size={13} className="text-orange-500" />} value={`NIT: ${supplier.nit}`} />
        )}
        {supplier.sitio_web && (
          <InfoRow icon={<Globe size={13} className="text-cyan-500" />} value={supplier.sitio_web} truncate />
        )}
        {supplier.direccion && (
          <InfoRow icon={<MapPin size={13} className="text-red-500" />} value={supplier.direccion} truncate />
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 pt-2.5 mt-auto border-t"
          style={{ borderColor: 'var(--color-border)' }}>
          <div className="text-center">
            <p className="text-lg font-extrabold text-[var(--color-primary)]">{supplier.totalCompras || 0}</p>
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Compras</p>
          </div>
          <div className="w-px h-8 self-center" style={{ background: 'var(--color-border)' }} />
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-sec)]">
              {supplier.ultimaCompra ? formatDate(supplier.ultimaCompra) : 'Sin compras'}
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Ultima compra</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 p-3 border-t"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-soft)' }}>
        <button onClick={onView}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border transition-colors hover:bg-[var(--color-primary)] hover:text-white hover:border-[var(--color-primary)] text-[var(--color-text-sec)]"
          style={{ borderColor: 'var(--color-border)' }}>
          <Eye size={13} /> Ver
        </button>
        <button onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border transition-colors hover:bg-amber-500 hover:text-white hover:border-amber-500 text-[var(--color-text-sec)]"
          style={{ borderColor: 'var(--color-border)' }}>
          <Edit size={13} /> Editar
        </button>
        <button onClick={onDelete}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors hover:bg-red-500 hover:text-white hover:border-red-500 text-[var(--color-text-sec)]"
          style={{ borderColor: 'var(--color-border)' }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function InfoRow({ icon, value, truncate = false }: { icon: React.ReactNode; value: string; truncate?: boolean }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="shrink-0">{icon}</span>
      <span className={`text-xs text-[var(--color-text-sec)] ${truncate ? 'truncate' : ''}`}>{value}</span>
    </div>
  );
}
