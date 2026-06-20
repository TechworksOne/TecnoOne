import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Eye, Printer, FileText, ShoppingBag, DollarSign,
  Calendar, Plus, XCircle, CreditCard, TrendingUp, Clock,
  AlertTriangle, CheckCircle, RefreshCw, Ban
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import QuotePicker from '../../components/sales/QuotePicker';
import SaleFormModal from '../../components/sales/SaleFormModal';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../store/useAuth';
import { useEmpresa } from '../../store/useEmpresa';
import * as ventaService from '../../services/ventaService';
import type { VentaData, VentaEstadisticas } from '../../services/ventaService';
import { formatDate } from '../../lib/format';
import { printSaleReceipt } from '../../lib/printSaleReceipt';
import { getImageUrl } from '../../utils/getImageUrl';

// ─── Constants ─────────────────────────────────────────────────────────────

const ESTADO_BADGE: Record<string, string> = {
  PAGADA:   'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
  PENDIENTE:'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
  PARCIAL:  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
  ANULADA:  'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800',
};

const METODO_LABEL: Record<string, string> = {
  EFECTIVO:     'Efectivo',
  TARJETA:      'Tarjeta',
  TRANSFERENCIA:'Transferencia',
  MIXTO:        'Mixto',
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function estadoBadge(estado: string) {
  const cls = ESTADO_BADGE[estado] ?? 'bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{estado}</span>;
}

function getDateRange(preset: string): { fecha_desde: string; fecha_hasta: string } | null {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  if (preset === 'hoy') return { fecha_desde: fmt(today), fecha_hasta: fmt(today) };
  if (preset === 'semana') {
    const mon = new Date(today); mon.setDate(today.getDate() - today.getDay() + 1);
    return { fecha_desde: fmt(mon), fecha_hasta: fmt(today) };
  }
  if (preset === 'mes') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { fecha_desde: fmt(first), fecha_hasta: fmt(today) };
  }
  return null;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function SalesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { empresa, loadEmpresa } = useEmpresa();

  useEffect(() => {
    loadEmpresa();
  }, [loadEmpresa]);

  // ── data ──
  const [ventas, setVentas] = useState<VentaData[]>([]);
  const [stats, setStats] = useState<VentaEstadisticas | null>(null);
  const [loading, setLoading] = useState(false);

  // ── filters ──
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterMetodo, setFilterMetodo] = useState('');
  const [filterDate, setFilterDate] = useState('');          // preset: hoy/semana/mes
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // ── modals ──
  const [selectedVenta, setSelectedVenta] = useState<VentaData | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [showAnularDialog, setShowAnularDialog] = useState(false);
  const [showQuotePicker, setShowQuotePicker] = useState(false);
  const [showNuevaVentaModal, setShowNuevaVentaModal] = useState(false);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [saleFormOrigen, setSaleFormOrigen] = useState<'DIRECTA' | 'COTIZACION'>('DIRECTA');
  const [saleFormQuote, setSaleFormQuote] = useState<any>(undefined);
  const [anularTarget, setAnularTarget] = useState<VentaData | null>(null);
  const [motivo, setMotivo] = useState('');

  // ── pago form ──
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagoMetodo, setPagoMetodo] = useState('EFECTIVO');
  const [pagoRef, setPagoRef] = useState('');
  const [pagoComprobanteUrl, setPagoComprobanteUrl] = useState('');
  const [pagoComprobanteUploading, setPagoComprobanteUploading] = useState(false);
  const [pagoLoading, setPagoLoading] = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────

  // Debounce search input 400 ms so API is not called on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const loadVentas = useCallback(async () => {
    setLoading(true);
    try {
      const dateRange = filterDate ? getDateRange(filterDate) : null;
      const filters: ventaService.VentaFilters = {
        ...(filterEstado    && { estado: filterEstado }),
        ...(filterMetodo    && { metodo_pago: filterMetodo }),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(dateRange       && { fecha_desde: dateRange.fecha_desde, fecha_hasta: dateRange.fecha_hasta }),
        ...(!filterDate && fechaDesde && { fecha_desde: fechaDesde }),
        ...(!filterDate && fechaHasta && { fecha_hasta: fechaHasta }),
      };
      const data = await ventaService.getAllVentas(filters);
      setVentas(data);
    } catch {
      toast.add('Error al cargar ventas', 'error');
    } finally {
      setLoading(false);
    }
  }, [filterEstado, filterMetodo, debouncedSearch, filterDate, fechaDesde, fechaHasta, toast]);

  const loadStats = useCallback(async () => {
    try {
      const data = await ventaService.getEstadisticas();
      setStats(data);
    } catch {
      // stats are non-critical
    }
  }, []);

  useEffect(() => {
    loadVentas();
    loadStats();
  }, [loadVentas, loadStats]);

  // ── Actions ─────────────────────────────────────────────────────────────

  const openDetail = (v: VentaData) => { setSelectedVenta(v); setShowDetail(true); };

  const openPago = (v: VentaData) => {
    setSelectedVenta(v);
    const saldo = (v.saldo_pendiente ?? (v.total - (v.monto_pagado ?? 0)));
    setPagoMonto((saldo / 100).toFixed(2));
    setPagoMetodo('EFECTIVO');
    setPagoRef('');
    setPagoComprobanteUrl('');
    setPagoComprobanteUploading(false);
    setShowPagoModal(true);
  };

  const openAnular = (v: VentaData) => {
    setAnularTarget(v);
    setMotivo('');
    setShowAnularDialog(true);
  };

  const handlePagoComprobanteChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.add('El comprobante debe ser una imagen', 'error');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.add('El comprobante no debe superar los 5 MB', 'error');
      event.target.value = '';
      return;
    }

    setPagoComprobanteUploading(true);
    setPagoComprobanteUrl('');

    try {
      const url = await ventaService.uploadComprobante(file);
      setPagoComprobanteUrl(url);
      toast.add('Boleta cargada correctamente', 'success');
    } catch (error: any) {
      toast.add(
        error?.response?.data?.message ||
          error?.message ||
          'Error al subir la boleta',
        'error',
      );
      event.target.value = '';
    } finally {
      setPagoComprobanteUploading(false);
    }
  };

  const saldoPagoCentavos = selectedVenta
    ? Number(
        selectedVenta.saldo_pendiente ??
        (
          selectedVenta.total -
          (selectedVenta.monto_pagado ?? 0)
        )
      )
    : 0;

  const saldoPagoQuetzales =
    saldoPagoCentavos / 100;

  const montoPagoIngresado =
    Number.parseFloat(pagoMonto) || 0;

  const pagoAplicado =
    Math.min(
      montoPagoIngresado,
      saldoPagoQuetzales
    );

  const cambioPago =
    pagoMetodo === 'EFECTIVO'
      ? Math.max(
          0,
          montoPagoIngresado - saldoPagoQuetzales
        )
      : 0;

  const handleRegistrarPago = async () => {
    if (!selectedVenta) return;

    if (!pagoMonto || parseFloat(pagoMonto) <= 0) {
      toast.add('Ingresa un monto válido', 'error');
      return;
    }

    if (
      pagoMetodo !== 'EFECTIVO' &&
      montoPagoIngresado > saldoPagoQuetzales + 0.005
    ) {
      toast.add(
        `El monto no puede exceder el saldo pendiente de Q${saldoPagoQuetzales.toFixed(2)}`,
        'error'
      );
      return;
    }

    if (pagoComprobanteUploading) {
      toast.add('Espera a que termine de subir la boleta', 'error');
      return;
    }

    if (
      pagoMetodo === 'TRANSFERENCIA' &&
      !pagoComprobanteUrl
    ) {
      toast.add(
        'Debes adjuntar la imagen de la boleta de transferencia',
        'error',
      );
      return;
    }

    setPagoLoading(true);
    try {
      await ventaService.registrarPago(selectedVenta.id!, {
        monto:
          pagoMetodo === 'EFECTIVO'
            ? pagoAplicado
            : montoPagoIngresado,

        monto_recibido:
          pagoMetodo === 'EFECTIVO'
            ? montoPagoIngresado
            : undefined,

        cambio:
          pagoMetodo === 'EFECTIVO'
            ? cambioPago
            : undefined,

        metodo: pagoMetodo,
        referencia: pagoRef || undefined,
        comprobanteUrl: pagoComprobanteUrl || undefined,
        usuario_id: user?.id,
      });
      toast.add('Pago registrado correctamente', 'success');
      setShowPagoModal(false);
      setShowDetail(false);
      await Promise.all([loadVentas(), loadStats()]);
    } catch (err: any) {
      toast.add(err?.response?.data?.error ?? 'Error al registrar pago', 'error');
    } finally {
      setPagoLoading(false);
    }
  };

  const handleAnular = async () => {
    if (!anularTarget) return;
    if (!motivo.trim()) { toast.add('Ingresa el motivo de anulación', 'error'); return; }
    try {
      await ventaService.anularVenta(anularTarget.id!, { motivo, usuario_id: user?.id });
      toast.add('Venta anulada correctamente', 'success');
      setShowAnularDialog(false);
      setShowDetail(false);
      await Promise.all([loadVentas(), loadStats()]);
    } catch (err: any) {
      toast.add(err?.response?.data?.error ?? 'Error al anular venta', 'error');
    }
  };

  const handlePrint = (v: VentaData) => {
    printSaleReceipt(v, empresa);
  };

  const clearFilters = () => {
    setSearch(''); setDebouncedSearch(''); setFilterEstado(''); setFilterMetodo('');
    setFilterDate(''); setFechaDesde(''); setFechaHasta('');
  };

  const hasFilters = search || filterEstado || filterMetodo || filterDate || fechaDesde || fechaHasta;

  // ── KPI helpers ─────────────────────────────────────────────────────────

  const kpiCards = stats
    ? [
        { label: 'Total Ventas',    value: stats.total_ventas,          icon: ShoppingBag,  color: 'text-indigo-500 dark:text-indigo-400',  bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
        { label: 'Ventas Hoy',      value: stats.ventas_hoy,            icon: Calendar,     color: 'text-blue-500 dark:text-blue-400',    bg: 'bg-blue-100 dark:bg-blue-900/30' },
        { label: 'Ingresos Totales',value: `Q${Number(stats.total_vendido_quetzales ?? 0).toFixed(2)}`, icon: DollarSign, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
        { label: 'Promedio Venta',  value: `Q${Number(stats.promedio_venta_quetzales ?? 0).toFixed(2)}`, icon: TrendingUp, color: 'text-purple-500 dark:text-purple-400',  bg: 'bg-purple-100 dark:bg-purple-900/30' },
        { label: 'Pendientes',      value: stats.ventas_pendientes,     icon: Clock,        color: 'text-amber-500 dark:text-amber-400',   bg: 'bg-amber-100 dark:bg-amber-900/30' },
        { label: 'Pagadas',         value: stats.ventas_pagadas,        icon: CheckCircle,  color: 'text-green-500 dark:text-green-400',   bg: 'bg-green-100 dark:bg-green-900/30' },
      ]
    : [];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <PageHeader
          title="Gestión de Ventas"
          subtitle="Control y seguimiento de todas las ventas"
        />
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => { loadVentas(); loadStats(); }} title="Actualizar">
            <RefreshCw size={16} />
          </Button>
          <Button onClick={() => setShowQuotePicker(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <FileText size={16} /> Desde Cotización
          </Button>
          <Button onClick={() => setShowNuevaVentaModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus size={16} /> Nueva Venta
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {kpiCards.map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label} className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${bg}`}>
                  <Icon size={18} className={color} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[var(--color-text-sec)] truncate">{label}</p>
                  <p className={`text-lg font-bold truncate ${color}`}>{value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={16} />
            <Input
              type="text"
              placeholder="Cliente, código, teléfono…"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Estado */}
          <select
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#48B9E6]/40 transition-colors"
            style={{ background: 'var(--color-input-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
          >
            <option value="">Todos los estados</option>
            <option value="PAGADA">Pagada</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="PARCIAL">Parcial</option>
            <option value="ANULADA">Anulada</option>
          </select>

          {/* Método pago */}
          <select
            value={filterMetodo}
            onChange={e => setFilterMetodo(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#48B9E6]/40 transition-colors"
            style={{ background: 'var(--color-input-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
          >
            <option value="">Todos los métodos</option>
            <option value="EFECTIVO">Efectivo</option>
            <option value="TARJETA">Tarjeta</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="MIXTO">Mixto</option>
          </select>

          {/* Date preset */}
          <div className="flex gap-1">
            {['hoy', 'semana', 'mes'].map(p => (
              <button
                key={p}
                onClick={() => setFilterDate(filterDate === p ? '' : p)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  filterDate === p
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'text-[var(--color-text-sec)] border-[var(--color-border)] hover:bg-[var(--color-row-hover)]'
                }`}
                style={filterDate !== p ? { background: 'var(--color-surface)' } : undefined}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          {/* Custom date range */}
          {!filterDate && (
            <>
              <Input type="date" value={fechaDesde} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFechaDesde(e.target.value)} className="w-36 text-sm" />
              <Input type="date" value={fechaHasta} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFechaHasta(e.target.value)} className="w-36 text-sm" />
            </>
          )}

          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-[var(--color-text-muted)] hover:text-red-500 dark:hover:text-red-400 flex items-center gap-1 transition-colors">
              <XCircle size={14} /> Limpiar
            </button>
          )}
        </div>
      </Card>

      {/* Table / List */}
      {loading ? (
        <Card className="p-12 text-center text-[var(--color-text-muted)]">
          <RefreshCw size={32} className="mx-auto animate-spin mb-2" />
          Cargando ventas…
        </Card>
      ) : ventas.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={56} className="text-[var(--color-text-muted)]" />}
          title={hasFilters ? 'No se encontraron ventas' : 'No hay ventas registradas'}
          description={hasFilters ? 'Ajusta los filtros de búsqueda' : 'Crea una nueva venta directa o convierte una cotización'}
          action={
            <div className="flex gap-3 flex-wrap justify-center">
              <Button onClick={() => setShowNuevaVentaModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus size={16} /> Nueva Venta
              </Button>
              <Button onClick={() => setShowQuotePicker(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <FileText size={16} /> Desde Cotización
              </Button>
            </div>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface-soft)] border-b border-[var(--color-border)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-sec)] uppercase tracking-wide">Código</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-sec)] uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-sec)] uppercase tracking-wide">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-sec)] uppercase tracking-wide">Teléfono</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-sec)] uppercase tracking-wide">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-sec)] uppercase tracking-wide">Vendedor</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--color-text-sec)] uppercase tracking-wide">Items</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--color-text-sec)] uppercase tracking-wide">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--color-text-sec)] uppercase tracking-wide">Pagado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--color-text-sec)] uppercase tracking-wide">Saldo</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--color-text-sec)] uppercase tracking-wide">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {ventas.map(v => {
                    const saldo = v.saldo_pendiente ?? (v.total - (v.monto_pagado ?? 0));
                    const items = Array.isArray(v.items) ? v.items : [];
                    return (
                      <tr key={v.id} className="hover:bg-[var(--color-row-hover)] transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-indigo-500 dark:text-indigo-400 font-semibold whitespace-nowrap">
                          {v.numero_venta ?? `#${v.id}`}
                        </td>
                        <td className="px-4 py-3">{estadoBadge(v.estado ?? 'PENDIENTE')}</td>
                        <td className="px-4 py-3 font-medium text-[var(--color-text)] max-w-[160px] truncate">{v.cliente_nombre}</td>
                        <td className="px-4 py-3 text-[var(--color-text-sec)]">{v.cliente_telefono ?? '—'}</td>
                        <td className="px-4 py-3 text-[var(--color-text-sec)] whitespace-nowrap">
                          {formatDate(v.fecha_venta ?? v.created_at ?? '')}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-sec)] max-w-[120px] truncate">
                          {(v as any).vendedor_nombre ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center text-[var(--color-text-sec)]">{items.length}</td>
                        <td className="px-4 py-3 text-right font-semibold text-[var(--color-text)] whitespace-nowrap">
                          Q{(v.total / 100).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-500 dark:text-emerald-400 whitespace-nowrap">
                          Q{((v.monto_pagado ?? 0) / 100).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={saldo > 0 ? 'text-amber-500 dark:text-amber-400 font-semibold' : 'text-[var(--color-text-muted)]'}>
                            Q{(saldo / 100).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openDetail(v)}
                              className="p-1.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-500 dark:text-indigo-400"
                              title="Ver detalle"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => handlePrint(v)}
                              className="p-1.5 rounded hover:bg-[var(--color-row-hover)] text-[var(--color-text-sec)]"
                              title="Imprimir"
                            >
                              <Printer size={14} />
                            </button>
                            {(v.estado === 'PENDIENTE' || v.estado === 'PARCIAL') && (
                              <button
                                onClick={() => openPago(v)}
                                className="p-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-500 dark:text-emerald-400"
                                title="Registrar pago"
                              >
                                <CreditCard size={14} />
                              </button>
                            )}
                            {v.estado !== 'ANULADA' && (
                              <button
                                onClick={() => openAnular(v)}
                                className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400"
                                title="Anular"
                              >
                                <Ban size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
              {ventas.length} venta{ventas.length !== 1 ? 's' : ''} encontrada{ventas.length !== 1 ? 's' : ''}
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {ventas.map(v => {
              const saldo = v.saldo_pendiente ?? (v.total - (v.monto_pagado ?? 0));
              const items = Array.isArray(v.items) ? v.items : [];
              return (
                <Card key={v.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-mono text-xs text-indigo-500 dark:text-indigo-400 font-semibold">{v.numero_venta ?? `#${v.id}`}</span>
                      <div className="mt-1">{estadoBadge(v.estado ?? 'PENDIENTE')}</div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[var(--color-text)]">Q{(v.total / 100).toFixed(2)}</p>
                      {saldo > 0 && <p className="text-xs text-amber-500 dark:text-amber-400">Saldo: Q{(saldo / 100).toFixed(2)}</p>}
                    </div>
                  </div>
                  <p className="text-sm font-medium text-[var(--color-text)]">{v.cliente_nombre}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{formatDate(v.fecha_venta ?? v.created_at ?? '')} · {items.length} item{items.length !== 1 ? 's' : ''}</p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => openDetail(v)} className="flex-1 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-primary)] hover:bg-[var(--color-active-bg)] transition-colors">Ver</button>
                    {(v.estado === 'PENDIENTE' || v.estado === 'PARCIAL') && (
                      <button onClick={() => openPago(v)} className="flex-1 py-1.5 text-xs rounded-lg border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">Pagar</button>
                    )}
                    {v.estado !== 'ANULADA' && (
                      <button onClick={() => openAnular(v)} className="flex-1 py-1.5 text-xs rounded-lg border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">Anular</button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* ── Detail Modal ─────────────────────────────────────────────────── */}
      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title={selectedVenta?.numero_venta ?? 'Detalle de Venta'} size="3xl">
        {selectedVenta && (
          <div className="space-y-4 text-sm">
            {/* Header info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[var(--color-surface-soft)] rounded-lg p-3">
                <p className="text-xs text-[var(--color-text-sec)] mb-0.5">Estado</p>
                {estadoBadge(selectedVenta.estado ?? 'PENDIENTE')}
              </div>
              <div className="bg-[var(--color-surface-soft)] rounded-lg p-3">
                <p className="text-xs text-[var(--color-text-sec)] mb-0.5">Fecha</p>
                <p className="font-medium text-[var(--color-text)]">{formatDate(selectedVenta.fecha_venta ?? selectedVenta.created_at ?? '')}</p>
              </div>
              <div className="bg-[var(--color-surface-soft)] rounded-lg p-3">
                <p className="text-xs text-[var(--color-text-sec)] mb-0.5">Total</p>
                <p className="font-bold text-[var(--color-text)]">Q{(selectedVenta.total / 100).toFixed(2)}</p>
              </div>
              <div className="bg-[var(--color-surface-soft)] rounded-lg p-3">
                <p className="text-xs text-[var(--color-text-sec)] mb-0.5">Saldo pendiente</p>
                <p className="font-bold text-amber-500 dark:text-amber-400">
                  Q{((selectedVenta.saldo_pendiente ?? (selectedVenta.total - (selectedVenta.monto_pagado ?? 0))) / 100).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Cliente */}
            <div className="border border-[var(--color-border)] rounded-lg p-3">
              <p className="font-semibold text-[var(--color-text)] mb-2">Cliente</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-[var(--color-text-muted)]">Nombre: </span><span className="text-[var(--color-text)]">{selectedVenta.cliente_nombre}</span></div>
                <div><span className="text-[var(--color-text-muted)]">Teléfono: </span><span className="text-[var(--color-text)]">{selectedVenta.cliente_telefono ?? '—'}</span></div>
                <div><span className="text-[var(--color-text-muted)]">Email: </span><span className="text-[var(--color-text)]">{selectedVenta.cliente_email ?? '—'}</span></div>
                <div><span className="text-[var(--color-text-muted)]">NIT: </span><span className="text-[var(--color-text)]">{selectedVenta.cliente_nit ?? '—'}</span></div>
                {selectedVenta.cliente_direccion && (
                  <div className="col-span-2"><span className="text-[var(--color-text-muted)]">Dirección: </span><span className="text-[var(--color-text)]">{selectedVenta.cliente_direccion}</span></div>
                )}
              </div>
            </div>

            {/* Items */}
            <div>
              <p className="font-semibold text-[var(--color-text)] mb-2">Productos / Servicios</p>
              <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--color-surface-soft)]">
                    <tr>
                      <th className="px-3 py-2 text-left text-[var(--color-text-sec)]">Descripción</th>
                      <th className="px-3 py-2 text-center text-[var(--color-text-sec)]">Cant.</th>
                      <th className="px-3 py-2 text-right text-[var(--color-text-sec)]">Precio u.</th>
                      <th className="px-3 py-2 text-right text-[var(--color-text-sec)]">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {(Array.isArray(selectedVenta.items) ? selectedVenta.items : []).map((item, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-[var(--color-text)]">{item.nombre}</td>
                        <td className="px-3 py-2 text-center text-[var(--color-text-sec)]">{item.cantidad}</td>
                        <td className="px-3 py-2 text-right text-[var(--color-text-sec)]">Q{(item.precioUnit / 100).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-medium text-[var(--color-text)]">Q{(item.subtotal / 100).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[var(--color-surface-soft)] border-t border-[var(--color-border)]">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-right font-semibold text-[var(--color-text-sec)]">Total</td>
                      <td className="px-3 py-2 text-right font-bold text-[var(--color-text)]">Q{(selectedVenta.total / 100).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Pagos */}
            {Array.isArray(selectedVenta.pagos) && selectedVenta.pagos.length > 0 && (
              <div>
                <p className="font-semibold text-[var(--color-text)] mb-2">Historial de Pagos</p>
                <div className="space-y-1">
                  {selectedVenta.pagos.map((p: any, i: number) => {
                    const comprobante =
                      p.comprobanteUrl ||
                      p.comprobante_url ||
                      '';

                    return (
                      <div
                        key={i}
                        className="bg-emerald-100 dark:bg-emerald-900/20 rounded px-3 py-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                            {METODO_LABEL[p.metodo] ?? p.metodo}
                          </span>

                          {p.referencia && (
                            <span className="text-[var(--color-text-muted)]">
                              Ref: {p.referencia}
                            </span>
                          )}

                          <span className="font-bold text-emerald-700 dark:text-emerald-400">
                            Q{(p.monto / 100).toFixed(2)}
                          </span>
                        </div>

                        {comprobante && (
                          <a
                            href={getImageUrl(comprobante)}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block"
                          >
                            <img
                              src={getImageUrl(comprobante)}
                              alt="Boleta de pago"
                              className="h-28 max-w-full rounded-lg border border-emerald-300 dark:border-emerald-800 object-contain"
                            />
                            <p className="mt-1 text-[11px] text-blue-500">
                              Ver boleta completa
                            </p>
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedVenta.observaciones && (
              <div className="bg-blue-100 dark:bg-blue-900/20 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-400">
                <span className="font-semibold">Observaciones: </span>{selectedVenta.observaciones}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-2 border-t border-[var(--color-border)]">
              <Button variant="ghost" onClick={() => handlePrint(selectedVenta)} className="flex-1">
                <Printer size={14} /> Imprimir
              </Button>
              {(selectedVenta.estado === 'PENDIENTE' || selectedVenta.estado === 'PARCIAL') && (
                <Button
                  onClick={() => { setShowDetail(false); setTimeout(() => openPago(selectedVenta), 100); }}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CreditCard size={14} /> Registrar Pago
                </Button>
              )}
              {selectedVenta.estado !== 'ANULADA' && (
                <Button
                  variant="ghost"
                  onClick={() => { setShowDetail(false); setTimeout(() => openAnular(selectedVenta), 100); }}
                  className="text-red-500 hover:bg-red-50"
                >
                  <Ban size={14} /> Anular
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Pago Modal ───────────────────────────────────────────────────── */}
      <Modal isOpen={showPagoModal} onClose={() => setShowPagoModal(false)} title="Registrar Pago" size="sm">
        {selectedVenta && (
          <div className="space-y-4 text-sm">
            <div className="bg-amber-100 dark:bg-amber-900/20 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400">
              <span className="font-semibold">Saldo pendiente: </span>
              Q{((selectedVenta.saldo_pendiente ?? (selectedVenta.total - (selectedVenta.monto_pagado ?? 0))) / 100).toFixed(2)}
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-sec)] mb-1">
                {pagoMetodo === 'EFECTIVO'
                  ? 'Efectivo recibido (Q)'
                  : 'Monto a pagar (Q)'}
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={pagoMonto}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPagoMonto(e.target.value)}
                placeholder="0.00"
              />
            </div>

            {pagoMetodo === 'EFECTIVO' && montoPagoIngresado > 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between text-[var(--color-text-sec)]">
                  <span>Pago aplicado</span>
                  <span className="font-semibold text-[var(--color-text)]">
                    Q {pagoAplicado.toFixed(2)}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-emerald-200 pt-2 dark:border-emerald-900/50">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Cambio
                  </span>

                  <span className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                    Q {cambioPago.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-sec)] mb-1">Método de pago</label>
              <select
                value={pagoMetodo}
                onChange={e => {
                  const metodo = e.target.value;
                  setPagoMetodo(metodo);

                  if (metodo !== 'TRANSFERENCIA') {
                    setPagoComprobanteUrl('');
                  }
                }}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#48B9E6]/40 transition-colors"
                style={{ background: 'var(--color-input-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TARJETA">Tarjeta</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </select>
            </div>

            {(pagoMetodo === 'TARJETA' || pagoMetodo === 'TRANSFERENCIA') && (
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-sec)] mb-1">
                  Referencia
                </label>
                <Input
                  value={pagoRef}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setPagoRef(e.target.value)
                  }
                  placeholder="Número de referencia…"
                />
              </div>
            )}

            {pagoMetodo === 'TRANSFERENCIA' && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-[var(--color-text-sec)]">
                  Foto de la boleta <span className="text-red-500">*</span>
                </label>

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handlePagoComprobanteChange}
                  disabled={pagoComprobanteUploading || pagoLoading}
                  className="block w-full text-xs text-[var(--color-text-sec)] file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-blue-700 disabled:opacity-50"
                />

                {pagoComprobanteUploading && (
                  <p className="flex items-center gap-2 text-xs text-blue-500">
                    <RefreshCw size={12} className="animate-spin" />
                    Subiendo boleta...
                  </p>
                )}

                {pagoComprobanteUrl && (
                  <a
                    href={getImageUrl(pagoComprobanteUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block"
                  >
                    <img
                      src={getImageUrl(pagoComprobanteUrl)}
                      alt="Vista previa de la boleta"
                      className="h-32 max-w-full rounded-lg border border-[var(--color-border)] object-contain"
                    />
                    <p className="mt-1 text-xs text-blue-500">
                      Abrir imagen completa
                    </p>
                  </a>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowPagoModal(false)} className="flex-1">Cancelar</Button>
              <Button
                onClick={handleRegistrarPago}
                disabled={pagoLoading || pagoComprobanteUploading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {pagoLoading ? <RefreshCw size={14} className="animate-spin" /> : <CreditCard size={14} />}
                {pagoLoading ? 'Procesando…' : 'Confirmar Pago'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Anular Dialog ────────────────────────────────────────────────── */}
      <Modal isOpen={showAnularDialog} onClose={() => setShowAnularDialog(false)} title="Anular Venta" size="sm">
        {anularTarget && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3 bg-red-100 dark:bg-red-900/20 rounded-lg p-3 text-red-700 dark:text-red-400">
              <AlertTriangle size={20} className="shrink-0" />
              <p>Estás a punto de anular la venta <strong>{anularTarget.numero_venta}</strong>. Esta acción no se puede deshacer.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-sec)] mb-1">Motivo de anulación <span className="text-red-500">*</span></label>
              <textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none transition-colors"
                style={{ background: 'var(--color-input-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
                placeholder="Describe el motivo de la anulación…"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowAnularDialog(false)} className="flex-1">Cancelar</Button>
              <Button
                onClick={handleAnular}
                disabled={!motivo.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                <Ban size={14} /> Anular Venta
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Quote Picker ─────────────────────────────────────────────────── */}
      {showQuotePicker && (
        <QuotePicker
          open={showQuotePicker}
          onClose={() => setShowQuotePicker(false)}
          onSelect={(quote: any) => {
            setShowQuotePicker(false);
            setSaleFormOrigen('COTIZACION');
            setSaleFormQuote(quote);
            setShowSaleForm(true);
          }}
        />
      )}

      {/* ── Nueva Venta Modal ────────────────────────────────────────────── */}
      <SaleFormModal
        isOpen={showSaleForm}
        onClose={() => setShowSaleForm(false)}
        onSuccess={() => { loadVentas(); loadStats(); }}
        origenVenta={saleFormOrigen}
        preloadedQuote={saleFormQuote}
      />

      <Modal isOpen={showNuevaVentaModal} onClose={() => setShowNuevaVentaModal(false)} title="Nueva Venta" size="md">
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-sec)]">Selecciona cómo deseas crear la venta</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Venta Directa */}
            <button
              onClick={() => { setShowNuevaVentaModal(false); setSaleFormOrigen('DIRECTA'); setSaleFormQuote(undefined); setShowSaleForm(true); }}
              className="group flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all duration-200 text-left"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-soft)' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = '#48B9E6';
                (e.currentTarget as HTMLElement).style.background = 'var(--color-active-bg)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
                (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-soft)';
              }}
            >
              <div className="p-3 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 group-hover:scale-110 transition-transform">
                <ShoppingBag size={28} className="text-indigo-500 dark:text-indigo-400" />
              </div>
              <div>
                <p className="font-semibold text-[var(--color-text)] text-base">Venta Directa</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Agrega productos y registra el pago al instante</p>
              </div>
            </button>

            {/* Desde Cotización */}
            <button
              onClick={() => { setShowNuevaVentaModal(false); setShowQuotePicker(true); }}
              className="group flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all duration-200 text-left"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-soft)' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = '#10b981';
                (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.08)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
                (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-soft)';
              }}
            >
              <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 group-hover:scale-110 transition-transform">
                <FileText size={28} className="text-emerald-500 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-[var(--color-text)] text-base">Desde Cotización</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Convierte una cotización existente en venta</p>
              </div>
            </button>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="ghost" onClick={() => setShowNuevaVentaModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
