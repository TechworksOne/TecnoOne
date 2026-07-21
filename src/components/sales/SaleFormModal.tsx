import React, { useState, useEffect } from 'react';
import {
  ShoppingBag, User, Package, DollarSign, Banknote, CreditCard,
  ArrowLeftRight, Plus, Search, Trash2, Save, FileText, RefreshCw,
} from 'lucide-react';
import Modal from '../ui/Modal';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Badge from '../ui/Badge';
import { useToast } from '../ui/Toast';
import QuotePicker from './QuotePicker';
import { useQuotesStore } from '../../store/useQuotesStore';
import { useSales } from '../../store/useSales';
import { PaymentMethod, Payment, SaleItem } from '../../types/sale';
import { isCardMethod, getPosFromMethod } from '../../constants/paymentMethods';
import { formatMoney } from '../../lib/format';
import * as productService from '../../services/productService';
import * as repuestoService from '../../services/repuestoService';
import * as customerService from '../../services/customerService';
import * as ventaService from '../../services/ventaService';
import API_URL from '../../services/config';
import { getImageUrl } from '../../utils/getImageUrl';
import { empresaCajaApi, type CajaCatalogo } from '../../services/cajaCatalogoService';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PaymentRowData {
  id: string;
  metodo: Exclude<PaymentMethod, 'MIXTO'>;
  monto: number;
  referencia?: string;
  comprobanteUrl?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  origenVenta: 'DIRECTA' | 'COTIZACION';
  /** Pass the full quote object when converting from quote */
  preloadedQuote?: any;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const inputCls =
  'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#48B9E6]/40 transition-colors';
const inputStyle = {
  background: 'var(--color-input-bg)',
  color: 'var(--color-text)',
  borderColor: 'var(--color-border)',
};

const METODO_COLORS: Record<string, { active: string; hover: string; icon: string }> = {
  EFECTIVO:        { active: 'border-emerald-500 bg-emerald-100 dark:bg-emerald-900/30', hover: 'hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20', icon: 'text-emerald-500 dark:text-emerald-400' },
  TARJETA_BAC:     { active: 'border-blue-500 bg-blue-100 dark:bg-blue-900/30',          hover: 'hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20',          icon: 'text-blue-500 dark:text-blue-400' },
  TARJETA_NEONET:  { active: 'border-cyan-500 bg-cyan-100 dark:bg-cyan-900/30',          hover: 'hover:border-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20',          icon: 'text-cyan-500 dark:text-cyan-400' },
  TRANSFERENCIA:   { active: 'border-purple-500 bg-purple-100 dark:bg-purple-900/30',    hover: 'hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20',    icon: 'text-purple-500 dark:text-purple-400' },
  MIXTO:           { active: 'border-orange-500 bg-orange-100 dark:bg-orange-900/30',    hover: 'hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20',    icon: 'text-orange-500 dark:text-orange-400' },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function SaleFormModal({ isOpen, onClose, onSuccess, origenVenta, preloadedQuote }: Props) {
  const toast = useToast();
  const { getQuoteById, updateQuoteStatus } = useQuotesStore();
  const { upsertSale } = useSales();

  // ── origin ──
  const [showQuotePicker, setShowQuotePicker] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);

  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [cliente, setCliente] = useState<any>(null);
  const [subtotal, setSubtotal] = useState(0);
  const [impuestos, setImpuestos] = useState(0);
  const [total, setTotal] = useState(0);

  // ── product search ──
  const [tipoItem, setTipoItem] = useState<'PRODUCTO' | 'REPUESTO'>('PRODUCTO');
  const [searchTerm, setSearchTerm] = useState('');
  const [productos, setProductos] = useState<any[]>([]);
  const [repuestos, setRepuestos] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // ── customer search ──
  const [searchCliente, setSearchCliente] = useState('');
  const [clientes, setClientes] = useState<any[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);

  // ── payment ──
  const [metodo, setMetodo] = useState<PaymentMethod>('EFECTIVO');
  const [montoRecibido, setMontoRecibido] = useState(0);
  const [referencia, setReferencia] = useState('');
  const [comprobanteUrl, setComprobanteUrl] = useState('');
  const [isUploadingComprobante, setIsUploadingComprobante] = useState(false);
  const [pagosMixtos, setPagosMixtos] = useState<PaymentRowData[]>([
    { id: '1', metodo: 'EFECTIVO', monto: 0, referencia: '', comprobanteUrl: '' },
  ]);
  const [observaciones, setObservaciones] = useState('');
  const [interesTarjeta, setInteresTarjeta] = useState(0);
  const [bancoSeleccionado, setBancoSeleccionado] = useState('');
  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([]);
  const [montoEfectivo, setMontoEfectivo] = useState(0);
  const [montoBanco, setMontoBanco] = useState(0);
  const [confirmarPago, setConfirmarPago] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cajas, setCajas] = useState<CajaCatalogo[]>([]);
  const [cajaId, setCajaId] = useState('');

  // ── Reset state when modal opens ──────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    // reset everything
    setShowQuotePicker(false);
    setShowCustomerPicker(false);
    setShowProductSearch(false);
    setQuoteId(null);
    setItems([]);
    setCliente(null);
    setSubtotal(0); setImpuestos(0); setTotal(0);
    setTipoItem('PRODUCTO');
    setSearchTerm(''); setProductos([]); setRepuestos([]);
    setSearchCliente(''); setClientes([]);
    setMetodo('EFECTIVO'); setMontoRecibido(0);
    setReferencia(''); setComprobanteUrl('');
    setPagosMixtos([{ id: '1', metodo: 'EFECTIVO', monto: 0, referencia: '', comprobanteUrl: '' }]);
    setObservaciones('');
    setInteresTarjeta(0); setBancoSeleccionado('');
    setMontoEfectivo(0); setMontoBanco(0);
    setConfirmarPago(false);
    setCajaId('');

    // pre-load quote if provided
    if (origenVenta === 'COTIZACION' && preloadedQuote) {
      setQuoteId(preloadedQuote.id?.toString() ?? null);
      setCliente(preloadedQuote.cliente || null);
      const arr = Array.isArray(preloadedQuote.items) ? preloadedQuote.items : [];
      setItems(arr);
      setSubtotal(preloadedQuote.subtotal || 0);
      setImpuestos(preloadedQuote.impuestos || 0);
      setTotal(preloadedQuote.total || 0);
      setMontoRecibido(preloadedQuote.total || 0);
    } else if (origenVenta === 'DIRECTA') {
      setShowCustomerPicker(true);
    }
  }, [isOpen, origenVenta, preloadedQuote]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    empresaCajaApi.listar()
      .then(rows => { if (!cancelled) setCajas(rows.filter(row => Boolean(row.activa))); })
      .catch(() => { if (!cancelled) setCajas([]); });
    return () => { cancelled = true; };
  }, [isOpen]);

  // ── Load banks ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const token = sessionStorage.getItem('token');
        const res = await fetch(`${API_URL}/caja/bancos`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setCuentasBancarias(data.data);
      } catch { /* non-critical */ }
    })();
  }, [isOpen]);

  // ── Recalculate totals ───────────────────────────────────────────────────
  useEffect(() => {
    const s = items.reduce((sum, i) => sum + Number(i.subtotal), 0);
    setSubtotal(s);
    setTotal(s + impuestos);
    setMontoRecibido(s + impuestos);
  }, [items, impuestos]);

  // ── Search products / repuestos ──────────────────────────────────────────
  useEffect(() => {
    if (!showProductSearch) return;
    loadItemsFromInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showProductSearch, searchTerm, tipoItem]);

  // ── Search clients ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!showCustomerPicker) return;
    loadClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCustomerPicker, searchCliente]);

  // ── Loaders ──────────────────────────────────────────────────────────────
  const loadItemsFromInventory = async () => {
    setLoadingItems(true);
    try {
      const query = searchTerm.trim();
      const limit = query ? 20 : 5;

      if (tipoItem === 'PRODUCTO') {
        const res = await productService.getAllProducts({ search: query, activo: true, limit });
        const data = res.data || res.productos || res || [];
        setProductos(Array.isArray(data) ? data.slice(0, limit) : []);
      } else {
        const res = await repuestoService.getAllRepuestos({ searchTerm: query, activo: true, limit });
        setRepuestos(Array.isArray(res) ? res.slice(0, limit) : []);
      }
    } catch { toast.add('Error al cargar items', 'error'); }
    finally { setLoadingItems(false); }
  };

  const loadClientes = async () => {
    setLoadingClientes(true);
    try {
      const query = searchCliente.trim();
      const limit = query ? 20 : 5;
      const res = await customerService.searchCustomers(query);
      const data = res.data || res.customers || res || [];
      setClientes(Array.isArray(data) ? data.slice(0, limit) : []);
    } catch { toast.add('Error al cargar clientes', 'error'); setClientes([]); }
    finally { setLoadingClientes(false); }
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSelectQuote = (quote: any) => {
    setQuoteId(quote.id?.toString() ?? null);
    setCliente(quote.cliente);
    setItems(quote.items ?? []);
    setSubtotal(quote.subtotal ?? 0);
    setImpuestos(quote.impuestos ?? 0);
    setTotal(quote.total ?? 0);
    setMontoRecibido(quote.total ?? 0);
    setShowQuotePicker(false);
  };

  const handleSelectCliente = (c: any) => {
    setCliente({
      id: c.id?.toString() ?? '',
      name: c.nombre
        ? `${c.nombre}${c.apellido ? ' ' + c.apellido : ''}`.trim()
        : `${c.firstName || ''} ${c.lastName || ''}`.trim(),
      phone: c.telefono || c.phone || '',
      email: c.correo || c.email || '',
      nit: c.nit || '',
      address: c.direccion || c.address || '',
    });
    setShowCustomerPicker(false);
    setSearchCliente('');
    setClientes([]);
  };

  const handleAddItem = (item: any) => {
    const stockDisponible = Math.max(0, Number(item.stock ?? 0));

    if (stockDisponible <= 0) {
      toast.add('Este artículo no tiene stock disponible', 'error');
      return;
    }

    const itemId = item.id?.toString() || item.sku;
    const existing = items.find(
      i => i.refId === itemId && i.source === tipoItem
    );

    if (existing) {
      if (existing.cantidad >= stockDisponible) {
        toast.add(
          `Solo hay ${stockDisponible} unidad(es) disponibles`,
          'error'
        );
        return;
      }

      setItems(items.map(i => {
        if (i.refId === itemId && i.source === tipoItem) {
          const cantidad = i.cantidad + 1;

          return {
            ...i,
            cantidad,
            stockDisponible,
            subtotal: cantidad * i.precioUnit,
          };
        }

        return i;
      }));
    } else {
      const precio = tipoItem === 'PRODUCTO'
        ? Number(item.precio_venta)
        : Number(repuestoService.centavosAQuetzales(item.precio_publico));

      setItems([...items, {
        id: `${tipoItem}-${item.id}-${Date.now()}`,
        refId: itemId,
        source: tipoItem,
        nombre: item.nombre,
        cantidad: 1,
        precioUnit: precio,
        subtotal: precio,
        stockDisponible,
      }]);
    }

    setShowProductSearch(false);
    setSearchTerm('');
    setProductos([]);
    setRepuestos([]);
  };

  const handleUpdateCantidad = (index: number, cantidad: number) => {
    if (cantidad <= 0) return;

    const item = items[index];
    const stockDisponible = Number(item.stockDisponible);

    if (
      Number.isFinite(stockDisponible) &&
      cantidad > stockDisponible
    ) {
      toast.add(
        `Solo hay ${stockDisponible} unidad(es) disponibles`,
        'error'
      );
      return;
    }

    setItems(items.map((it, i) =>
      i === index
        ? {
            ...it,
            cantidad,
            subtotal: cantidad * it.precioUnit,
          }
        : it
    ));
  };

  const handleRemoveItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const handleMetodoChange = (m: PaymentMethod) => {
    setMetodo(m);
    setReferencia(''); setComprobanteUrl(''); setInteresTarjeta(0);
    if (m === 'MIXTO') setPagosMixtos([{ id: '1', metodo: 'EFECTIVO', monto: 0 }]);
    else setMontoRecibido(total);
  };

  const handleComprobanteChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = e.target;
    const file = input.files?.[0];

    if (!file) return;

    const tiposPermitidos = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!tiposPermitidos.includes(file.type)) {
      toast.add('Solo se permiten imágenes JPG, PNG o WEBP', 'error');
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.add('El comprobante no debe superar los 5 MB', 'error');
      input.value = '';
      return;
    }

    setIsUploadingComprobante(true);
    setComprobanteUrl('');

    try {
      const url = await ventaService.uploadComprobante(file);
      setComprobanteUrl(url);
      toast.add('Comprobante cargado correctamente', 'success');
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Error al subir el comprobante';

      toast.add(message, 'error');
      input.value = '';
    } finally {
      setIsUploadingComprobante(false);
    }
  };

  const cambio = montoRecibido - total;
  const sumaPagosMixtos = pagosMixtos.reduce((s, p) => s + Number(p.monto), 0);
  const restanteMixto = total - sumaPagosMixtos;

  // ── Validation ───────────────────────────────────────────────────────────
  const validateSale = (): boolean => {
    if (isUploadingComprobante) {
      toast.add('Espera a que termine de subir el comprobante', 'error');
      return false;
    }

    if (origenVenta === 'DIRECTA' && !cliente) { toast.add('Debes seleccionar un cliente', 'error'); return false; }
    if (origenVenta === 'COTIZACION' && !quoteId) { toast.add('Debes seleccionar una cotización', 'error'); return false; }
    if (items.length === 0) { toast.add('No hay items en la venta', 'error'); return false; }
    if (!confirmarPago) { toast.add('Debes confirmar que has recibido el pago', 'error'); return false; }
    const tieneEfectivo = metodo === 'EFECTIVO' ||
      (metodo === 'MIXTO' && pagosMixtos.some(p => p.metodo === 'EFECTIVO' && Number(p.monto) > 0));
    if (tieneEfectivo && !cajaId) { toast.add('Debes seleccionar una caja activa de la sucursal', 'error'); return false; }
    if (metodo === 'EFECTIVO' && montoRecibido < total) { toast.add('El monto recibido debe ser mayor o igual al total', 'error'); return false; }
    if (metodo === 'TRANSFERENCIA') {
      if (!referencia) { toast.add('Debes ingresar la referencia de la transferencia', 'error'); return false; }
      if (!comprobanteUrl) { toast.add('Debes cargar el comprobante de transferencia', 'error'); return false; }
    }
    if (isCardMethod(metodo) && (!referencia || referencia.length < 4)) { toast.add('Debes ingresar los últimos 4 dígitos de la tarjeta', 'error'); return false; }
    if (metodo === 'MIXTO') {
      if (Math.abs(sumaPagosMixtos - total) > 0.01) { toast.add(`La suma de pagos (${formatMoney(sumaPagosMixtos)}) debe ser igual al total (${formatMoney(total)})`, 'error'); return false; }
      for (const p of pagosMixtos) {
        if (p.metodo === 'TRANSFERENCIA' && (!p.referencia || !p.comprobanteUrl)) { toast.add('Completa todos los campos de las transferencias', 'error'); return false; }
        if (isCardMethod(p.metodo) && (!p.referencia || p.referencia.length < 4)) { toast.add('Completa los últimos 4 dígitos de todas las tarjetas', 'error'); return false; }
      }
    }
    return true;
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleConcluirVenta = async () => {
    if (!validateSale()) return;
    setIsLoading(true);
    try {
      const interesMontoTarjeta = isCardMethod(metodo) && interesTarjeta > 0 ? total * (interesTarjeta / 100) : 0;
      const totalConInteres = total + interesMontoTarjeta;
      const now = new Date().toISOString();

      let pagosArray: any[];
      if (metodo === 'MIXTO') {
        pagosArray = pagosMixtos.map(p => ({
          metodo: p.metodo,
          monto: ventaService.quetzalesACentavos(p.monto),
          referencia: p.referencia || null,
          comprobante_url: p.comprobanteUrl || null,
          fecha: now,
          pos_seleccionado: getPosFromMethod(p.metodo),
          banco_id: p.metodo === 'TRANSFERENCIA' ? bancoSeleccionado : null,
          caja_id: p.metodo === 'EFECTIVO' ? Number(cajaId) : null,
        }));
      } else {
        // El pago aplicado es el total de la venta.
        // El efectivo recibido y el cambio son informativos.
        const montoPago = totalConInteres;
        const montoRecibidoCentavos =
          metodo === 'EFECTIVO'
            ? ventaService.quetzalesACentavos(montoRecibido)
            : null;
        const cambioCentavos =
          metodo === 'EFECTIVO'
            ? ventaService.quetzalesACentavos(
                Math.max(0, montoRecibido - totalConInteres)
              )
            : null;
        pagosArray = [{
          metodo,
          monto: ventaService.quetzalesACentavos(montoPago),
          monto_recibido: montoRecibidoCentavos,
          cambio: cambioCentavos,
          referencia: referencia || null,
          comprobante_url: comprobanteUrl || null,
          fecha: now,
          pos_seleccionado: getPosFromMethod(metodo),
          banco_id: metodo === 'TRANSFERENCIA' ? bancoSeleccionado : null,
          interes_porcentaje: isCardMethod(metodo) ? interesTarjeta : null,
          interes_monto: isCardMethod(metodo) ? interesMontoTarjeta : null,
          caja_id: metodo === 'EFECTIVO' ? Number(cajaId) : null,
        }];
      }

      let ventaCreada;
      if (origenVenta === 'COTIZACION' && quoteId) {
        ventaCreada = await ventaService.createVentaFromQuote(parseInt(quoteId), {
          pagos: pagosArray,
          metodo_pago: pagosArray.length === 1 ? pagosArray[0].metodo : 'MIXTO',
          observaciones: observaciones || null,
        });
        updateQuoteStatus(quoteId, 'CERRADA');
        toast.add('Venta creada exitosamente desde cotización', 'success');
      } else {
        const itemsParaBackend = items.map(it => ({
          source: it.source,
          ref_id: parseInt(it.refId),
          nombre: it.nombre,
          cantidad: it.cantidad,
          precio_unitario: ventaService.quetzalesACentavos(it.precioUnit),
          subtotal: ventaService.quetzalesACentavos(it.subtotal),
        }));
        ventaCreada = await ventaService.createVenta({
          cliente_id: cliente?.id ? parseInt(cliente.id) : null,
          cliente_nombre: cliente?.name,
          cliente_telefono: cliente?.phone || null,
          cliente_email: cliente?.email || null,
          cliente_nit: cliente?.nit || null,
          items: itemsParaBackend,
          subtotal: ventaService.quetzalesACentavos(subtotal),
          impuestos: ventaService.quetzalesACentavos(impuestos || 0),
          total: ventaService.quetzalesACentavos(totalConInteres),
          monto_pagado: ventaService.quetzalesACentavos(totalConInteres),
          metodo_pago: pagosArray.length === 1 ? pagosArray[0].metodo : 'MIXTO',
          pagos: pagosArray,
          interes_tarjeta: isCardMethod(metodo) ? interesMontoTarjeta : 0,
        });
        toast.add('Venta directa creada exitosamente', 'success');
      }

      // update local store
      upsertSale({
        quoteId: origenVenta === 'COTIZACION' ? quoteId! : undefined,
        cliente,
        items,
        subtotal,
        impuestos,
        total,
        payments: pagosArray.map(p => ({
          metodo: p.metodo,
          monto: ventaService.centavosAQuetzales(p.monto),
          referencia: p.referencia,
          comprobanteUrl: p.comprobante_url,
          fecha: p.fecha,
        })) as Payment[],
        estado: 'PAGADA',
      });

      onClose();
      onSuccess();
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Error al registrar la venta';
      toast.add(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={origenVenta === 'COTIZACION' ? 'Nueva Venta — Desde Cotización' : 'Nueva Venta Directa'}
        size="5xl"
      >
        <div className="space-y-5">

          {/* Banner: quote origin */}
          {origenVenta === 'COTIZACION' && quoteId && (
            <div className="flex items-center gap-3 rounded-xl p-3 text-sm border"
              style={{ background: 'rgba(72,185,230,0.08)', borderColor: 'rgba(72,185,230,0.25)', color: 'var(--color-primary)' }}>
              <FileText size={18} className="shrink-0" />
              <p>Venta basada en cotización <strong>#{quoteId}</strong>. Al concluir, la cotización se cerrará automáticamente.</p>
            </div>
          )}

          {/* ── A) Cliente ────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                  <User size={16} className="text-indigo-500 dark:text-indigo-400" />
                </div>
                <h3 className="font-semibold text-[var(--color-text)]">Cliente</h3>
              </div>
              {origenVenta === 'DIRECTA' && (
                <Button variant="ghost" onClick={() => setShowCustomerPicker(true)} className="text-xs">
                  <Search size={13} /> {cliente ? 'Cambiar' : 'Seleccionar'}
                </Button>
              )}
            </div>
            {!cliente ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-[var(--color-text-muted)]"
                style={{ borderColor: 'var(--color-border)' }}>
                <User size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No hay cliente seleccionado</p>
                {origenVenta === 'DIRECTA' && (
                  <Button variant="ghost" onClick={() => setShowCustomerPicker(true)} className="mt-3 text-xs">
                    Seleccionar cliente
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-xl border p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-soft)' }}>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Nombre</p>
                  <p className="font-medium text-[var(--color-text)]">{cliente.name}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Teléfono</p>
                  <p className="font-medium text-[var(--color-text)]">{cliente.phone || '—'}</p>
                </div>
                {cliente.email && (
                  <div>
                    <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Email</p>
                    <p className="font-medium text-[var(--color-text)] truncate">{cliente.email}</p>
                  </div>
                )}
                {cliente.nit && (
                  <div>
                    <p className="text-xs text-[var(--color-text-muted)] mb-0.5">NIT</p>
                    <p className="font-medium text-[var(--color-text)]">{cliente.nit}</p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── B) Items ─────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <Package size={16} className="text-purple-500 dark:text-purple-400" />
                </div>
                <h3 className="font-semibold text-[var(--color-text)]">Items de la Venta</h3>
              </div>
              {origenVenta === 'DIRECTA' && (
                <Button onClick={() => setShowProductSearch(true)} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Plus size={13} /> Agregar Item
                </Button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-[var(--color-text-muted)]"
                style={{ borderColor: 'var(--color-border)' }}>
                <Package size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No hay items agregados</p>
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                <table className="w-full text-sm">
                  <thead style={{ background: 'var(--color-surface-soft)' }}>
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-sec)]">Cant.</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-sec)]">Descripción</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-[var(--color-text-sec)]">P. Unit.</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-[var(--color-text-sec)]">Subtotal</th>
                      {origenVenta === 'DIRECTA' && <th className="px-3 py-2 text-center text-xs font-semibold text-[var(--color-text-sec)]"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                    {items.map((item, idx) => (
                      <tr key={item.id ?? idx} className="hover:bg-[var(--color-row-hover)] transition-colors">
                        <td className="px-3 py-2">
                          {origenVenta === 'DIRECTA' ? (
                            <Input
                              type="number" min="1" value={item.cantidad}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateCantidad(idx, parseInt(e.target.value) || 1)}
                              className="w-16 text-center text-sm"
                            />
                          ) : (
                            <span className="text-[var(--color-text)]">{item.cantidad}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-[var(--color-text)]">{item.nombre}</p>
                          <Badge color={item.source === 'PRODUCTO' ? 'blue' : 'purple'} className="mt-0.5 text-xs">{item.source}</Badge>
                        </td>
                        <td className="px-3 py-2 text-right text-[var(--color-text-sec)]">{formatMoney(item.precioUnit)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-[var(--color-text)]">{formatMoney(item.subtotal)}</td>
                        {origenVenta === 'DIRECTA' && (
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => handleRemoveItem(idx)}
                              className="p-1 rounded text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── C) Totales ───────────────────────────────────────────── */}
          <section className="rounded-xl border p-4 text-sm space-y-2"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-soft)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <DollarSign size={16} className="text-emerald-500 dark:text-emerald-400" />
              </div>
              <h3 className="font-semibold text-[var(--color-text)]">Totales</h3>
            </div>
            <div className="flex justify-between text-[var(--color-text-sec)]">
              <span>Subtotal</span>
              <span className="font-medium text-[var(--color-text)]">{formatMoney(subtotal)}</span>
            </div>
            {impuestos > 0 && (
              <div className="flex justify-between text-amber-500 dark:text-amber-400">
                <span>Impuestos</span>
                <span className="font-medium">{formatMoney(impuestos)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold pt-2 border-t text-[var(--color-primary)]"
              style={{ borderColor: 'var(--color-border)' }}>
              <span>TOTAL</span>
              <span>{formatMoney(total)}</span>
            </div>
          </section>

          {/* ── D) Método de Pago ────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Banknote size={16} className="text-amber-500 dark:text-amber-400" />
              </div>
              <h3 className="font-semibold text-[var(--color-text)]">Método de Pago</h3>
            </div>

            {/* Payment method selector */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-5">
              {(['EFECTIVO', 'TARJETA_BAC', 'TARJETA_NEONET', 'TRANSFERENCIA', 'MIXTO'] as PaymentMethod[]).map(m => {
                const c = METODO_COLORS[m];
                const labels: Record<string, string> = { EFECTIVO: 'Efectivo', TARJETA_BAC: 'Tarjeta BAC', TARJETA_NEONET: 'Tarjeta Neonet', TRANSFERENCIA: 'Transferencia', MIXTO: 'Mixto' };
                const isActive = metodo === m;
                return (
                  <button key={m} onClick={() => handleMetodoChange(m)}
                    className={`p-3 rounded-xl border-2 transition-all text-center ${isActive ? c.active : `border-[var(--color-border)] ${c.hover}`}`}
                    style={!isActive ? { background: 'var(--color-surface-soft)' } : undefined}>
                    {m === 'EFECTIVO' && <Banknote size={20} className={`mx-auto mb-1 ${isActive ? c.icon : 'text-[var(--color-text-muted)]'}`} />}
                    {(m === 'TARJETA_BAC' || m === 'TARJETA_NEONET') && <CreditCard size={20} className={`mx-auto mb-1 ${isActive ? c.icon : 'text-[var(--color-text-muted)]'}`} />}
                    {m === 'TRANSFERENCIA' && <ArrowLeftRight size={20} className={`mx-auto mb-1 ${isActive ? c.icon : 'text-[var(--color-text-muted)]'}`} />}
                    {m === 'MIXTO' && (
                      <div className="flex justify-center gap-1 mb-1">
                        <Banknote size={14} className={isActive ? c.icon : 'text-[var(--color-text-muted)]'} />
                        <CreditCard size={14} className={isActive ? c.icon : 'text-[var(--color-text-muted)]'} />
                      </div>
                    )}
                    <p className={`text-xs font-semibold ${isActive ? c.icon : 'text-[var(--color-text-sec)]'}`}>{labels[m]}</p>
                  </button>
                );
              })}
            </div>

            {(metodo === 'EFECTIVO' || metodo === 'MIXTO') && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-[var(--color-text-sec)] mb-1">
                  Caja de la sucursal <span className="text-red-500">*</span>
                </label>
                <select value={cajaId} onChange={e => setCajaId(e.target.value)} className={inputCls} style={inputStyle}>
                  <option value="">Selecciona una caja</option>
                  {cajas.map(caja => (
                    <option key={caja.id} value={caja.id}>{caja.nombre} ({caja.codigo})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Efectivo */}
            {metodo === 'EFECTIVO' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-sec)] mb-1">Monto Recibido (Q) *</label>
                  <Input type="number" min={total} step="0.01" value={montoRecibido}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMontoRecibido(Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-sec)] mb-1">Cambio</label>
                  <div className={`px-3 py-2 rounded-lg border text-base font-bold ${cambio >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500'}`}
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-soft)' }}>
                    {formatMoney(cambio)}
                  </div>
                </div>
              </div>
            )}

            {/* Transferencia */}
            {metodo === 'TRANSFERENCIA' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-sec)] mb-1">Banco de Destino *</label>
                  <Select value={bancoSeleccionado} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBancoSeleccionado(e.target.value)} className="w-full text-sm">
                    <option value="">Seleccione un banco...</option>
                    {cuentasBancarias.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-sec)] mb-1">Número de Voucher / Referencia *</label>
                  <Input value={referencia} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReferencia(e.target.value)} placeholder="Ej: TRF123456789" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-sec)] mb-1">Comprobante (Imagen)</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    onChange={handleComprobanteChange}
                    disabled={isUploadingComprobante}
                    className="block w-full text-sm text-[var(--color-text-sec)] disabled:opacity-60 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-[var(--color-border)] file:text-xs file:font-medium file:bg-[var(--color-surface-soft)] file:text-[var(--color-text-sec)]"
                  />
                  {isUploadingComprobante && (
                    <p className="mt-1 text-xs text-[var(--color-primary)]">
                      Subiendo comprobante...
                    </p>
                  )}
                </div>
                {comprobanteUrl && (
                  <img
                    src={getImageUrl(comprobanteUrl)}
                    alt="Comprobante"
                    className="h-32 rounded-lg border object-contain"
                    style={{ borderColor: 'var(--color-border)' }}
                  />
                )}
              </div>
            )}

            {/* Tarjeta */}
            {isCardMethod(metodo) && (
              <div className="space-y-3">
                <div className="rounded-lg p-3 text-xs font-medium border"
                  style={{ borderColor: 'rgba(72,185,230,0.25)', background: 'rgba(72,185,230,0.08)', color: 'var(--color-primary)' }}>
                  {metodo === 'TARJETA_BAC' ? '💳 POS BAC — Cuenta BAC' : '💳 POS NEONET — Banco Industrial'}
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-sec)] mb-1">Interés/Recargo del POS (%)</label>
                  <Input type="number" min={0} max={100} step="0.1" value={interesTarjeta}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInteresTarjeta(Number(e.target.value))} placeholder="Ej: 3.5" />
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">Recargo que cobra el banco. Se sumará al total.</p>
                </div>
                {interesTarjeta > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-sec)] mb-1">Subtotal</label>
                      <div className="px-3 py-2 rounded-lg text-sm font-bold text-[var(--color-text)]"
                        style={{ background: 'var(--color-surface-soft)', border: '1px solid var(--color-border)' }}>{formatMoney(total)}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-sec)] mb-1">Interés ({interesTarjeta}%)</label>
                      <div className="px-3 py-2 rounded-lg text-sm font-bold text-amber-500 dark:text-amber-400"
                        style={{ background: 'var(--color-surface-soft)', border: '1px solid var(--color-border)' }}>+{formatMoney(total * (interesTarjeta / 100))}</div>
                    </div>
                  </div>
                )}
                <div className="rounded-xl p-4 border-2 text-center"
                  style={{ borderColor: 'rgba(72,185,230,0.4)', background: 'rgba(72,185,230,0.07)' }}>
                  <p className="text-xs text-[var(--color-text-muted)] mb-1">Total a Cobrar (con interés)</p>
                  <p className="text-2xl font-bold text-[var(--color-primary)]">{formatMoney(total + total * (interesTarjeta / 100))}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-sec)] mb-1">Últimos 4 dígitos / Referencia *</label>
                  <Input type="text" maxLength={20} value={referencia}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReferencia(e.target.value)} placeholder="1234" />
                </div>
              </div>
            )}

            {/* Mixto */}
            {metodo === 'MIXTO' && (
              <div className="space-y-4">
                <div className="rounded-lg p-3 border text-sm font-semibold text-amber-500 dark:text-amber-400"
                  style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)' }}>
                  Total a pagar: {formatMoney(total)}
                </div>

                {/* Efectivo */}
                <div className="rounded-xl border p-4 space-y-2"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-soft)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Banknote size={16} className="text-emerald-500 dark:text-emerald-400" />
                    <p className="font-semibold text-sm text-[var(--color-text)]">Efectivo</p>
                  </div>
                  <Input type="number" min="0" max={total} step="0.01" value={montoEfectivo}
                    placeholder="0.00"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const v = Number(e.target.value); setMontoEfectivo(v); setMontoBanco(total - v);
                    }} />
                </div>

                {/* Banco */}
                <div className="rounded-xl border p-4 space-y-3"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-soft)' }}>
                  <div className="flex items-center gap-2">
                    <CreditCard size={16} className="text-blue-500 dark:text-blue-400" />
                    <p className="font-semibold text-sm text-[var(--color-text)]">Banco / Tarjeta</p>
                  </div>
                  <Input type="number" min="0" max={total} step="0.01" value={montoBanco}
                    placeholder="0.00"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const v = Number(e.target.value); setMontoBanco(v); setMontoEfectivo(total - v);
                    }} />
                  {montoBanco > 0 && (
                    <>
                      <Select value={bancoSeleccionado} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBancoSeleccionado(e.target.value)} className="w-full text-sm">
                        <option value="">Seleccione cuenta / POS...</option>
                        <optgroup label="POS">
                          <option value="pos_bac">POS BAC (BAC)</option>
                          <option value="pos_neonet">POS NEONET (Banco Industrial)</option>
                        </optgroup>
                        <optgroup label="Transferencias / Depósitos">
                          {cuentasBancarias.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                        </optgroup>
                      </Select>
                      <Input value={referencia} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReferencia(e.target.value)} placeholder="Referencia / Voucher" />
                    </>
                  )}
                </div>

                {/* Resumen mixto */}
                <div className="rounded-xl border p-4 space-y-2 text-sm"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-soft)' }}>
                  <div className="flex justify-between text-[var(--color-text-sec)]">
                    <span>Efectivo</span><span className="font-semibold text-emerald-500 dark:text-emerald-400">{formatMoney(montoEfectivo)}</span>
                  </div>
                  <div className="flex justify-between text-[var(--color-text-sec)]">
                    <span>Banco</span><span className="font-semibold text-blue-500 dark:text-blue-400">{formatMoney(montoBanco)}</span>
                  </div>
                  <div className={`flex justify-between font-bold pt-2 border-t text-base ${Math.abs((montoEfectivo + montoBanco) - total) < 0.01 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500'}`}
                    style={{ borderColor: 'var(--color-border)' }}>
                    <span>Total a pagar</span><span>{formatMoney(total)}</span>
                  </div>
                  {Math.abs((montoEfectivo + montoBanco) - total) >= 0.01 && (
                    <p className="text-xs text-red-400">⚠️ La suma de efectivo + banco debe ser igual al total</p>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ── E) Observaciones ─────────────────────────────────────── */}
          <section>
            <label className="block text-xs font-medium text-[var(--color-text-sec)] mb-1">Observaciones (opcional)</label>
            <textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              rows={2}
              className={`${inputCls} resize-none`}
              style={inputStyle}
              placeholder="Notas adicionales sobre la venta…"
            />
          </section>

          {/* ── F) Confirmación ──────────────────────────────────────── */}
          <section className="rounded-xl border p-4"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-soft)' }}>
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={confirmarPago} onChange={e => setConfirmarPago(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-[#48B9E6]" />
              <div>
                <p className="font-semibold text-sm text-[var(--color-text)]">Confirmo que he recibido el pago total</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Al confirmar y concluir, se registrará la venta{origenVenta === 'COTIZACION' ? ' y se cerrará la cotización' : ''}.
                </p>
              </div>
            </label>
          </section>

          {/* ── Footer buttons ───────────────────────────────────────── */}
          <div className="flex gap-3 justify-end pt-1">
            <Button variant="ghost" onClick={onClose} disabled={isLoading}>Cancelar</Button>
            <Button
              onClick={handleConcluirVenta}
              disabled={isLoading || !confirmarPago}
              className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
            >
              {isLoading
                ? <><RefreshCw size={14} className="animate-spin" /> Procesando…</>
                : <><Save size={14} /> Concluir Venta</>}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Product search modal ──────────────────────────────────────── */}
      <Modal isOpen={showProductSearch} onClose={() => { setShowProductSearch(false); setSearchTerm(''); setProductos([]); setRepuestos([]); }} title="Agregar Item" size="lg">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button variant={tipoItem === 'PRODUCTO' ? 'default' : 'ghost'} onClick={() => setTipoItem('PRODUCTO')} className="flex-1 text-sm">
              <Package size={14} /> Productos
            </Button>
            <Button variant={tipoItem === 'REPUESTO' ? 'default' : 'ghost'} onClick={() => setTipoItem('REPUESTO')} className="flex-1 text-sm">
              <Package size={14} /> Repuestos
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={16} />
            <Input placeholder={`Buscar ${tipoItem === 'PRODUCTO' ? 'producto' : 'repuesto'}…`} value={searchTerm} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)} className="pl-9" />
          </div>

          {loadingItems && <p className="text-center py-6 text-sm text-[var(--color-text-muted)]">Buscando…</p>}

          {!loadingItems && (
            <div className="max-h-80 overflow-y-auto space-y-1.5">
              {tipoItem === 'PRODUCTO' && productos.length === 0 && (
                <p className="text-center py-6 text-sm text-[var(--color-text-muted)]">No se encontraron productos</p>
              )}
              {tipoItem === 'PRODUCTO' && productos.map(p => (
                <button key={p.id} onClick={() => handleAddItem(p)}
                  className="w-full p-3 rounded-xl border text-left transition-colors hover:bg-[var(--color-row-hover)]"
                  style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-[var(--color-text)] truncate">{p.nombre}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{p.sku}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm text-emerald-500 dark:text-emerald-400">{formatMoney(p.precio_venta)}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">Stock: {p.stock || 0}</p>
                    </div>
                  </div>
                </button>
              ))}
              {tipoItem === 'REPUESTO' && repuestos.length === 0 && (
                <p className="text-center py-6 text-sm text-[var(--color-text-muted)]">No se encontraron repuestos</p>
              )}
              {tipoItem === 'REPUESTO' && repuestos.map(r => (
                <button key={r.id} onClick={() => handleAddItem(r)}
                  className="w-full p-3 rounded-xl border text-left transition-colors hover:bg-[var(--color-row-hover)]"
                  style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-[var(--color-text)] truncate">{r.nombre}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{r.marca} — {r.tipo}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm text-emerald-500 dark:text-emerald-400">{repuestoService.formatearPrecio(r.precio_publico)}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">Stock: {r.stock || 0}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

        </div>
      </Modal>

      {/* ── Customer picker modal ─────────────────────────────────────── */}
      <Modal isOpen={showCustomerPicker} onClose={() => { setShowCustomerPicker(false); setSearchCliente(''); setClientes([]); }} title="Seleccionar Cliente" size="lg">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={16} />
            <Input placeholder="Buscar por nombre, teléfono, NIT o correo…" value={searchCliente} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchCliente(e.target.value)} className="pl-9" />
          </div>

          {loadingClientes && <p className="text-center py-6 text-sm text-[var(--color-text-muted)]">Buscando clientes…</p>}

          {!loadingClientes && (
            <div className="max-h-80 overflow-y-auto space-y-1.5">
              {clientes.length === 0 ? (
                <div className="text-center py-6 text-[var(--color-text-muted)]">
                  <User size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No se encontraron clientes</p>
                </div>
              ) : clientes.map(c => (
                <button key={c.id} onClick={() => handleSelectCliente(c)}
                  className="w-full p-3 rounded-xl border text-left transition-colors hover:bg-[var(--color-row-hover)]"
                  style={{ borderColor: 'var(--color-border)' }}>
                  <p className="font-medium text-sm text-[var(--color-text)]">
                    {c.nombre
                      ? `${c.nombre}${c.apellido ? ' ' + c.apellido : ''}`.trim()
                      : `${c.firstName || ''} ${c.lastName || ''}`.trim()}
                  </p>
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5 space-y-0.5">
                    {(c.telefono || c.phone) && <p>📱 {c.telefono || c.phone}</p>}
                    {(c.correo || c.email) && <p>📧 {c.correo || c.email}</p>}
                    {c.nit && <p>🆔 NIT: {c.nit}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}

        </div>
      </Modal>

      {/* ── Quote picker (for COTIZACION origin) ─────────────────────── */}
      {showQuotePicker && (
        <QuotePicker
          open={showQuotePicker}
          onClose={() => setShowQuotePicker(false)}
          onSelect={handleSelectQuote}
        />
      )}
    </>
  );
}
