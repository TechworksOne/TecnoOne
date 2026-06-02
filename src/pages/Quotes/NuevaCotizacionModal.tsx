import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Save, Printer, User, Package,
  FileText, Wrench, ShoppingBag, X, Plus, Trash2,
} from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import ProductoPicker from '../../components/quotes/ProductoPicker';
import RepuestoPicker from '../../components/repuestos/RepuestoPicker';
import QuotePrintView from '../../components/quotes/QuotePrintView';
import { useCustomers } from '../../store/useCustomers';
import { QuoteType, QuoteItem, QuoteCustomer } from '../../types/quote';
import { formatMoney } from '../../lib/format';
import * as cotizacionService from '../../services/cotizacionService';
import * as interactionService from '../../services/interactionService';

type Step = 1 | 2 | 3;

interface FormState {
  tipo: QuoteType;
  cliente: QuoteCustomer | null;
  vigenciaDias: number;
  items: QuoteItem[];
  manoDeObra: number;
  observaciones: string;
  aplicarImpuestos: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const emptyForm = (): FormState => ({
  tipo: 'VENTA',
  cliente: null,
  vigenciaDias: 15,
  items: [],
  manoDeObra: 0,
  observaciones: '',
  aplicarImpuestos: false,
});

// ─── Step indicator ──────────────────────────────────────────────────────────
function StepBar({ current }: { current: Step }) {
  const steps = [
    { num: 1 as Step, label: 'Cliente', icon: User },
    { num: 2 as Step, label: 'Productos', icon: Package },
    { num: 3 as Step, label: 'Resumen', icon: FileText },
  ];
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const done = current > step.num;
        const active = current === step.num;
        return (
          <React.Fragment key={step.num}>
            <div className="flex items-center gap-2 shrink-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  done
                    ? 'bg-[#48B9E6] text-white'
                    : active
                    ? 'bg-[rgba(72,185,230,0.18)] border-2 border-[#48B9E6] text-[#48B9E6]'
                    : 'bg-[rgba(255,255,255,0.06)] border border-[var(--color-border)] text-[var(--color-text-sec)]'
                }`}
              >
                {done ? '✓' : <Icon size={14} />}
              </div>
              <span
                className={`text-[11px] font-semibold hidden sm:block ${
                  active
                    ? 'text-[#48B9E6]'
                    : done
                    ? 'text-[var(--color-text)]'
                    : 'text-[var(--color-text-sec)]'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-px mx-3 transition-all ${
                  current > step.num ? 'bg-[#48B9E6]' : 'bg-[var(--color-border)]'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function NuevaCotizacionModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const { customers, loadCustomers, isLoading: isLoadingCustomers } = useCustomers();

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [showProductoPicker, setShowProductoPicker] = useState(false);
  const [showRepuestoPicker, setShowRepuestoPicker] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formState, setFormState] = useState<FormState>(emptyForm());
  const [searchCliente, setSearchCliente] = useState('');
  const [showManualItemForm, setShowManualItemForm] = useState(false);
  const [manualItem, setManualItem] = useState({
    nombre: '', cantidad: 1, precioUnit: 0, aplicarImpuestos: false, notas: '',
  });

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setFormState(emptyForm());
      setCurrentStep(1);
      setSearchCliente('');
      setShowManualItemForm(false);
    }
  }, [open]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // ── Clientes ─────────────────────────────────────────────────────────────
  const filteredCustomers = customers.filter(c => {
    if (!searchCliente) return true;
    const sl = searchCliente.toLowerCase();
    const nombre = `${c.firstName} ${c.lastName}`.toLowerCase();
    return nombre.includes(sl) || (c.phone || '').includes(searchCliente) ||
      (c.nit || '').includes(searchCliente) || (c.email || '').toLowerCase().includes(sl);
  });

  const handleSelectCliente = (customer: typeof customers[0]) => {
    const fullName = (
      customer.nombre_completo ||
      `${customer.firstName || ''} ${customer.lastName || ''}`
    ).replace(/\s+/g, ' ').trim();
    setFormState(prev => ({
      ...prev,
      cliente: {
        id: customer.id,
        name: fullName,
        phone: customer.phone,
        email: customer.email,
        nit: customer.nit,
        address: customer.address,
      },
    }));
    setSearchCliente('');
  };

  // ── Cálculos ──────────────────────────────────────────────────────────────
  const calcSubtotal = () =>
    Number(formState.items.reduce((s, i) => s + (Number(i.subtotal) || 0), 0).toFixed(2));

  const calcImpuestos = () => {
    if (formState.tipo !== 'VENTA') return 0;
    return Number(
      formState.items.reduce((s, i) => s + ((i as any).aplicarImpuestos ? Number(i.subtotal) * 0.12 : 0), 0).toFixed(2)
    );
  };

  const calcTotal = () => {
    const mano = formState.tipo === 'REPARACION' ? Number(formState.manoDeObra) : 0;
    return Number((calcSubtotal() + calcImpuestos() + mano).toFixed(2));
  };

  // ── Validación ────────────────────────────────────────────────────────────
  const validateStep = (step: Step): boolean => {
    if (step === 1 && !formState.cliente) {
      toast.add('Debes seleccionar un cliente', 'error'); return false;
    }
    if (step === 2 && formState.items.length === 0) {
      toast.add('Debes agregar al menos un ítem', 'error'); return false;
    }
    return true;
  };

  const handleNext = () => { if (validateStep(currentStep)) setCurrentStep(p => Math.min(3, p + 1) as Step); };
  const handlePrev = () => setCurrentStep(p => Math.max(1, p - 1) as Step);

  // ── Items ─────────────────────────────────────────────────────────────────
  const handleAddProductos = (items: any[]) => {
    const newItems: QuoteItem[] = items.map(item => ({
      id: `${Date.now()}-${Math.random()}`,
      source: 'PRODUCTO',
      refId: item.refId,
      nombre: item.nombre,
      cantidad: Number(item.cantidad) || 1,
      precioUnit: Number(item.precioUnit) || 0,
      subtotal: Number(((Number(item.cantidad) || 1) * (Number(item.precioUnit) || 0)).toFixed(2)),
      aplicarImpuestos: item.aplicarImpuestos || false,
    } as any));
    setFormState(prev => ({ ...prev, items: [...prev.items, ...newItems] }));
    setShowProductoPicker(false);
    toast.add(`${newItems.length} producto(s) agregado(s)`, 'success');
  };

  const handleAddRepuestos = (items: any[]) => {
    const newItems: QuoteItem[] = items.map(item => ({
      id: `${Date.now()}-${Math.random()}`,
      source: 'REPUESTO',
      refId: item.id,
      nombre: item.nombre,
      cantidad: Number(item.cantidad) || 1,
      precioUnit: Number(item.precioUnit) || 0,
      subtotal: Number(((Number(item.cantidad) || 1) * (Number(item.precioUnit) || 0)).toFixed(2)),
      notas: item.notas,
    }));
    setFormState(prev => ({ ...prev, items: [...prev.items, ...newItems] }));
    setShowRepuestoPicker(false);
    toast.add(`${newItems.length} repuesto(s) agregado(s)`, 'success');
  };

  const handleAddManualItem = () => {
    if (!manualItem.nombre || manualItem.cantidad <= 0 || manualItem.precioUnit < 0) {
      toast.add('Completa todos los campos correctamente', 'error'); return;
    }
    const newItem: QuoteItem = {
      id: `${Date.now()}-${Math.random()}`,
      source: formState.tipo === 'VENTA' ? 'PRODUCTO' : 'REPUESTO',
      refId: 'manual',
      nombre: manualItem.nombre,
      cantidad: manualItem.cantidad,
      precioUnit: manualItem.precioUnit,
      subtotal: manualItem.cantidad * manualItem.precioUnit,
      notas: manualItem.notas,
      aplicarImpuestos: manualItem.aplicarImpuestos,
    } as any;
    setFormState(prev => ({ ...prev, items: [...prev.items, newItem] }));
    setManualItem({ nombre: '', cantidad: 1, precioUnit: 0, aplicarImpuestos: false, notas: '' });
    setShowManualItemForm(false);
  };

  const handleRemoveItem = (id: string) =>
    setFormState(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id) }));

  const handleUpdateItemCantidad = (id: string, cantidad: number) => {
    if (isNaN(cantidad) || cantidad <= 0) return;
    setFormState(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === id
        ? { ...i, cantidad, subtotal: Number((cantidad * i.precioUnit).toFixed(2)) }
        : i),
    }));
  };

  const handleUpdateItemPrecio = (id: string, precio: number) => {
    if (isNaN(precio) || precio < 0) return;
    setFormState(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === id
        ? { ...i, precioUnit: precio, subtotal: Number((i.cantidad * precio).toFixed(2)) }
        : i),
    }));
  };

  const handleToggleItemImpuestos = (id: string) =>
    setFormState(prev => ({
      ...prev,
      items: prev.items.map(i =>
        i.id === id ? { ...i, aplicarImpuestos: !(i as any).aplicarImpuestos } as any : i),
    }));

  // ── Guardar ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validateStep(1) || !validateStep(2)) return;
    setIsSaving(true);
    try {
      const subtotal = calcSubtotal();
      const impuestos = calcImpuestos();
      const total = calcTotal();

      const data: cotizacionService.CotizacionData = {
        cliente_id: Number(formState.cliente!.id),
        cliente_nombre: formState.cliente!.name,
        cliente_telefono: formState.cliente!.phone,
        cliente_email: formState.cliente!.email,
        cliente_nit: formState.cliente!.nit,
        cliente_direccion: formState.cliente!.address,
        tipo: formState.tipo,
        fecha_emision: new Date().toISOString().split('T')[0],
        vigencia_dias: formState.vigenciaDias,
        items: formState.items,
        subtotal,
        impuestos,
        mano_de_obra: formState.tipo === 'REPARACION' ? formState.manoDeObra : 0,
        total,
        aplicar_impuestos: formState.aplicarImpuestos,
        estado: 'BORRADOR',
        observaciones: formState.observaciones,
      };

      const saved = await cotizacionService.createCotizacion(data);
      toast.add('Cotización creada exitosamente', 'success');

      try {
        await interactionService.createInteraction({
          cliente_id: Number(formState.cliente!.id),
          tipo: 'cotizacion',
          referencia_id: String(saved.id),
          monto: total,
          notas: `Cotización ${saved.numero_cotizacion} - ${formState.tipo}`,
        });
      } catch { /* non-critical */ }

      onClose();
      if (saved?.id) navigate(`/cotizaciones/${saved.id}`);
    } catch (error: any) {
      toast.add(error.response?.data?.message || 'Error al guardar la cotización', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Input/label shared styles ────────────────────────────────────────────
  const labelCls = 'block text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-sec)] mb-1.5';
  const inputCls = 'w-full rounded-xl bg-[var(--color-input-bg)] border border-[var(--color-border)] text-[var(--color-text)] text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#48B9E6]/30 focus:border-[#48B9E6] placeholder:text-[var(--color-text-sec)]';

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <Modal open={open} onClose={onClose} title="Nueva Cotización" size="5xl">
        {/* Subtitle */}
        <p className="text-xs text-[var(--color-text-sec)] -mt-1 mb-5">
          Crea cotizaciones para ventas o reparaciones
        </p>

        {/* Step bar */}
        <StepBar current={currentStep} />

        {/* ═══ PASO 1: CLIENTE ════════════════════════════════════════════ */}
        {currentStep === 1 && (
          <div className="space-y-5">
            {formState.cliente ? (
              /* Cliente seleccionado */
              <div className="rounded-2xl border border-[#48B9E6]/30 bg-[rgba(72,185,230,0.07)] p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[var(--color-text)]">{formState.cliente.name}</p>
                  <p className="text-sm text-[var(--color-text-sec)] mt-0.5">{formState.cliente.phone}</p>
                  {formState.cliente.email && (
                    <p className="text-xs text-[var(--color-text-sec)]">{formState.cliente.email}</p>
                  )}
                </div>
                <button
                  onClick={() => setFormState(prev => ({ ...prev, cliente: null }))}
                  className="text-xs font-semibold text-[#48B9E6] hover:text-[#2EA7D8] border border-[#48B9E6]/30 rounded-xl px-3 py-1.5 transition-colors"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              /* Buscador de clientes */
              <div>
                <label className={labelCls}>
                  Buscar cliente <span className="text-red-400">*</span>
                </label>
                <div className="relative mb-3">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-sec)] pointer-events-none" />
                  <input
                    className={`${inputCls} pl-9`}
                    placeholder="Nombre, teléfono, NIT o email..."
                    value={searchCliente}
                    onChange={e => setSearchCliente(e.target.value)}
                  />
                </div>

                {/* Lista de clientes */}
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] overflow-hidden">
                  {isLoadingCustomers ? (
                    <div className="py-8 text-center text-sm text-[var(--color-text-sec)]">
                      Cargando clientes...
                    </div>
                  ) : filteredCustomers.length === 0 ? (
                    <div className="py-8 text-center text-sm text-[var(--color-text-sec)]">
                      {searchCliente ? 'Sin resultados' : 'No hay clientes registrados'}
                    </div>
                  ) : (
                    <div className="max-h-52 overflow-y-auto divide-y divide-[var(--color-border)]">
                      {filteredCustomers.map(customer => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => handleSelectCliente(customer)}
                          className="w-full text-left px-4 py-2.5 hover:bg-[rgba(72,185,230,0.07)] transition-colors flex items-center justify-between gap-4"
                        >
                          <div>
                            <p className="text-sm font-semibold text-[var(--color-text)]">
                              {customer.nombre_completo || `${customer.firstName} ${customer.lastName}`.trim()}
                            </p>
                            <div className="flex gap-3 text-[11px] text-[var(--color-text-sec)] mt-0.5">
                              {customer.phone && <span>📱 {customer.phone}</span>}
                              {customer.nit && <span>🆔 {customer.nit}</span>}
                              {customer.email && <span>📧 {customer.email}</span>}
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-[#48B9E6] shrink-0">Seleccionar</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => toast.add('Funcionalidad de registro pendiente', 'info')}
                  className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#48B9E6] hover:text-[#2EA7D8] transition-colors"
                >
                  <Plus size={13} />
                  Registrar nuevo cliente
                </button>
              </div>
            )}

            {/* Vigencia */}
            <div>
              <label className={labelCls}>Válida por (días)</label>
              <input
                type="number"
                min="1"
                className={`${inputCls} w-28`}
                value={formState.vigenciaDias}
                onChange={e => setFormState(prev => ({ ...prev, vigenciaDias: Number(e.target.value) }))}
              />
            </div>

            {/* Footer nav */}
            <div className="flex justify-end pt-2 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-2 bg-gradient-to-r from-[#48B9E6] to-[#2EA7D8] hover:from-[#2EA7D8] hover:to-[#2563EB] text-white text-sm font-semibold px-5 py-2 rounded-xl transition-all"
              >
                Siguiente <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ═══ PASO 2: TIPO + PRODUCTOS ════════════════════════════════════ */}
        {currentStep === 2 && (
          <div className="space-y-5">
            {/* Tipo */}
            <div>
              <label className={labelCls}>Tipo de cotización</label>
              <div className="grid grid-cols-2 gap-3">
                {(['VENTA', 'REPARACION'] as QuoteType[]).map(tipo => {
                  const Icon = tipo === 'VENTA' ? ShoppingBag : Wrench;
                  const active = formState.tipo === tipo;
                  return (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setFormState(prev => ({ ...prev, tipo, items: [], manoDeObra: 0 }))}
                      className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                        active
                          ? 'border-[#48B9E6] bg-[rgba(72,185,230,0.10)]'
                          : 'border-[var(--color-border)] hover:border-[#48B9E6]/50 bg-[var(--color-input-bg)]'
                      }`}
                    >
                      <Icon size={24} className={active ? 'text-[#48B9E6]' : 'text-[var(--color-text-sec)]'} />
                      <span className={`font-bold text-sm ${active ? 'text-[#48B9E6]' : 'text-[var(--color-text)]'}`}>
                        {tipo === 'VENTA' ? 'Venta' : 'Reparación'}
                      </span>
                      <span className="text-[11px] text-[var(--color-text-sec)]">
                        {tipo === 'VENTA' ? 'Productos del inventario' : 'Repuestos + Mano de obra'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Acciones agregar */}
            <div className="flex flex-wrap gap-2">
              {formState.tipo === 'VENTA' ? (
                <button
                  type="button"
                  onClick={() => setShowProductoPicker(true)}
                  className="flex items-center gap-1.5 text-sm font-semibold bg-gradient-to-r from-[#48B9E6] to-[#2EA7D8] text-white px-4 py-2 rounded-xl transition-all hover:brightness-110"
                >
                  <ShoppingBag size={14} /> Agregar Producto
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowRepuestoPicker(true)}
                  className="flex items-center gap-1.5 text-sm font-semibold bg-gradient-to-r from-violet-500 to-purple-600 text-white px-4 py-2 rounded-xl transition-all hover:brightness-110"
                >
                  <Package size={14} /> Desde Repuestos
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowManualItemForm(p => !p)}
                className="flex items-center gap-1.5 text-sm font-semibold border border-[var(--color-border)] text-[var(--color-text-sec)] hover:text-[var(--color-text)] px-4 py-2 rounded-xl transition-colors"
              >
                <Plus size={14} /> Línea manual
              </button>
            </div>

            {/* Formulario línea manual */}
            {showManualItemForm && (
              <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-input-bg)] p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-sec)]">Línea manual</p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    className={`${inputCls} sm:col-span-2`}
                    placeholder="Nombre del producto/servicio"
                    value={manualItem.nombre}
                    onChange={e => setManualItem(p => ({ ...p, nombre: e.target.value }))}
                  />
                  <input
                    type="number"
                    min="1"
                    className={inputCls}
                    placeholder="Cantidad"
                    value={manualItem.cantidad}
                    onChange={e => setManualItem(p => ({ ...p, cantidad: Number(e.target.value) }))}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputCls}
                    placeholder="Precio unit."
                    value={manualItem.precioUnit}
                    onChange={e => setManualItem(p => ({ ...p, precioUnit: Number(e.target.value) }))}
                  />
                </div>
                {formState.tipo === 'VENTA' && (
                  <label className="flex items-center gap-2 text-xs text-[var(--color-text-sec)]">
                    <input
                      type="checkbox"
                      checked={manualItem.aplicarImpuestos}
                      onChange={e => setManualItem(p => ({ ...p, aplicarImpuestos: e.target.checked }))}
                      className="accent-[#48B9E6]"
                    />
                    Aplicar IVA (12%)
                  </label>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddManualItem}
                    className="text-xs font-semibold bg-[#48B9E6] text-white px-3 py-1.5 rounded-lg hover:bg-[#2EA7D8] transition-colors"
                  >
                    Agregar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowManualItemForm(false)}
                    className="text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text-sec)] px-3 py-1.5 rounded-lg hover:text-[var(--color-text)] transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Tabla de items */}
            {formState.items.length > 0 ? (
              <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[var(--color-input-bg)] border-b border-[var(--color-border)]">
                        <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-sec)]">Nombre</th>
                        <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-sec)]">Cant.</th>
                        <th className="text-right px-3 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-sec)]">P. Unit.</th>
                        <th className="text-right px-3 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-sec)]">Subtotal</th>
                        {formState.tipo === 'VENTA' && (
                          <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-sec)]">IVA</th>
                        )}
                        <th className="px-3 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {formState.items.map(item => (
                        <tr key={item.id} className="hover:bg-[rgba(72,185,230,0.04)] transition-colors">
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-[var(--color-text)]">{item.nombre}</p>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                              item.source === 'PRODUCTO'
                                ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                                : 'bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400'
                            }`}>
                              {item.source}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="number"
                              min="1"
                              value={item.cantidad}
                              onChange={e => handleUpdateItemCantidad(item.id!, Number(e.target.value))}
                              className="w-16 text-center rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#48B9E6]"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.precioUnit}
                              onChange={e => handleUpdateItemPrecio(item.id!, Number(e.target.value))}
                              className="w-24 text-right rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#48B9E6]"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-[var(--color-text)]">
                            {formatMoney(item.subtotal)}
                          </td>
                          {formState.tipo === 'VENTA' && (
                            <td className="px-3 py-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={(item as any).aplicarImpuestos || false}
                                onChange={() => handleToggleItemImpuestos(item.id!)}
                                className="accent-[#48B9E6]"
                              />
                            </td>
                          )}
                          <td className="px-3 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id!)}
                              className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/40 text-red-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--color-border)] py-10 text-center">
                <Package size={32} className="mx-auto text-[var(--color-text-sec)] mb-3 opacity-50" />
                <p className="text-sm text-[var(--color-text-sec)]">No hay ítems agregados</p>
              </div>
            )}

            {/* Mano de obra para reparación */}
            {formState.tipo === 'REPARACION' && (
              <div className="rounded-2xl bg-[rgba(139,92,246,0.07)] border border-[rgba(139,92,246,0.25)] p-4">
                <label className={labelCls}>Mano de obra (opcional)</label>
                <div className="relative w-40">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--color-text-sec)]">Q</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.manoDeObra}
                    onChange={e => setFormState(prev => ({ ...prev, manoDeObra: Number(e.target.value) }))}
                    className={`${inputCls} pl-7`}
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}

            {/* Footer nav */}
            <div className="flex justify-between pt-2 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center gap-2 text-sm font-semibold border border-[var(--color-border)] text-[var(--color-text-sec)] hover:text-[var(--color-text)] px-4 py-2 rounded-xl transition-colors"
              >
                <ArrowLeft size={14} /> Anterior
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-2 bg-gradient-to-r from-[#48B9E6] to-[#2EA7D8] hover:from-[#2EA7D8] hover:to-[#2563EB] text-white text-sm font-semibold px-5 py-2 rounded-xl transition-all"
              >
                Siguiente <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ═══ PASO 3: RESUMEN ════════════════════════════════════════════ */}
        {currentStep === 3 && (
          <div className="space-y-5">
            {/* Info grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Cliente', value: formState.cliente?.name || '-' },
                { label: 'Tipo', value: formState.tipo },
                { label: 'Ítems', value: String(formState.items.length) },
                { label: 'Vigencia', value: `${formState.vigenciaDias} días` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-[var(--color-input-bg)] border border-[var(--color-border)] px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-sec)] mb-1">{label}</p>
                  <p className="text-sm font-semibold text-[var(--color-text)] truncate">{value}</p>
                </div>
              ))}
            </div>

            {/* Totales */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-4 space-y-2">
              <div className="flex justify-between text-sm text-[var(--color-text-sec)]">
                <span>Subtotal</span>
                <span className="font-semibold text-[var(--color-text)]">{formatMoney(calcSubtotal())}</span>
              </div>
              {formState.tipo === 'REPARACION' && formState.manoDeObra > 0 && (
                <div className="flex justify-between text-sm text-[var(--color-text-sec)]">
                  <span>Mano de obra</span>
                  <span className="font-semibold text-[var(--color-text)]">{formatMoney(formState.manoDeObra)}</span>
                </div>
              )}
              {calcImpuestos() > 0 && (
                <div className="flex justify-between text-sm text-amber-500 dark:text-amber-400">
                  <span>IVA (12%)</span>
                  <span className="font-semibold">{formatMoney(calcImpuestos())}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-[var(--color-border)]">
                <span className="text-base font-bold text-[var(--color-text)]">TOTAL</span>
                <span className="text-xl font-bold text-[#48B9E6]">{formatMoney(calcTotal())}</span>
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label className={labelCls}>Observaciones</label>
              <textarea
                value={formState.observaciones}
                onChange={e => setFormState(prev => ({ ...prev, observaciones: e.target.value }))}
                rows={3}
                className={`${inputCls} resize-none`}
                placeholder="Notas adicionales..."
              />
            </div>

            {/* Footer nav */}
            <div className="flex justify-between pt-2 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center gap-2 text-sm font-semibold border border-[var(--color-border)] text-[var(--color-text-sec)] hover:text-[var(--color-text)] px-4 py-2 rounded-xl transition-colors"
              >
                <ArrowLeft size={14} /> Anterior
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-sm font-semibold border border-[var(--color-border)] text-[var(--color-text-sec)] hover:text-[var(--color-text)] px-4 py-2 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-gradient-to-r from-[#48B9E6] to-[#2EA7D8] hover:from-[#2EA7D8] hover:to-[#2563EB] disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-all"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <><Save size={15} /> Guardar Cotización</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Sub-pickers (rendered outside the main modal to avoid z-index conflicts) */}
      {showProductoPicker && (
        <ProductoPicker
          open={showProductoPicker}
          onClose={() => setShowProductoPicker(false)}
          onSelect={handleAddProductos}
        />
      )}

      {showRepuestoPicker && (
        <RepuestoPicker
          isOpen={showRepuestoPicker}
          onClose={() => setShowRepuestoPicker(false)}
          onConfirm={handleAddRepuestos}
        />
      )}
    </>
  );
}
