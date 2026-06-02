new_content = r"""import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Plus, Search, Eye, ShoppingBag, Wrench, Calendar,
  DollarSign, User, Phone, Activity, CheckCircle,
} from 'lucide-react';
import { useQuotesStore } from '../../store/useQuotesStore';
import { QuoteType, QuoteStatus } from '../../types/quote';
import { formatMoney, formatDate } from '../../lib/format';
import NuevaCotizacionModal from './NuevaCotizacionModal';

function KpiCard({
  label, value, sub, icon: Icon, gradient,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  gradient: string;
}) {
  return (
    <div className={`rounded-2xl p-4 ${gradient}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium text-white/70 uppercase tracking-widest">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {sub && <p className="text-[11px] text-white/60 mt-0.5">{sub}</p>}
        </div>
        <div className="bg-white/15 rounded-xl p-2.5 shrink-0">
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  );
}

function estadoBadgeCls(estado: QuoteStatus): string {
  switch (estado) {
    case 'ABIERTA':   return 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40';
    case 'CERRADA':   return 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40';
    case 'PERDIDA':   return 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/40';
    case 'REPARANDO': return 'bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800/40';
    default:          return 'bg-gray-100 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700';
  }
}

function QuoteRow({ quote, onView }: { quote: any; onView: (id: string) => void }) {
  const vigenciaHasta = new Date(quote.createdAt);
  vigenciaHasta.setDate(vigenciaHasta.getDate() + quote.vigenciaDias);
  const vencida = new Date() > vigenciaHasta && quote.estado === 'ABIERTA';

  return (
    <div
      onClick={() => onView(quote.id)}
      className="group flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5 hover:bg-[rgba(72,185,230,0.05)] dark:hover:bg-[rgba(72,185,230,0.04)] transition-colors cursor-pointer border-b border-[var(--color-border)] last:border-b-0"
    >
      <div className={`shrink-0 p-2.5 rounded-xl ${quote.tipo === 'VENTA' ? 'bg-blue-100 dark:bg-blue-950/40' : 'bg-violet-100 dark:bg-violet-950/40'}`}>
        {quote.tipo === 'VENTA'
          ? <ShoppingBag size={16} className="text-blue-600 dark:text-blue-400" />
          : <Wrench size={16} className="text-violet-600 dark:text-violet-400" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-sm font-bold text-[var(--color-text)]">{quote.numero}</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${quote.tipo === 'VENTA' ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' : 'bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'}`}>
            {quote.tipo}
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${estadoBadgeCls(quote.estado)}`}>
            {quote.estado}
          </span>
          {vencida && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40">
              Vencida
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-4 text-[11px] text-[var(--color-text-sec)]">
          <span className="flex items-center gap-1"><User size={11} /> {quote.cliente.name}</span>
          {quote.cliente.phone && <span className="flex items-center gap-1"><Phone size={11} /> {quote.cliente.phone}</span>}
          <span className="flex items-center gap-1"><Calendar size={11} /> {formatDate(quote.createdAt)}</span>
          <span>{quote.items.length} item{quote.items.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <p className="text-[10px] text-[var(--color-text-sec)]">Total</p>
          <p className="text-base font-bold text-[#48B9E6]">{formatMoney(quote.total)}</p>
        </div>
        <div className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity border border-[var(--color-border)]">
          <Eye size={14} className="text-[var(--color-text-sec)]" />
        </div>
      </div>
    </div>
  );
}

export default function QuotesPage() {
  const navigate = useNavigate();
  const { quotes, loadQuotes, isLoading } = useQuotesStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState<'all' | QuoteType>('all');
  const [estadoFilter, setEstadoFilter] = useState<'all' | QuoteStatus>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => { loadQuotes(); }, [loadQuotes]);

  const filteredQuotes = useMemo(() => quotes.filter(q => {
    const sl = searchTerm.toLowerCase();
    const matchSearch = !searchTerm ||
      q.cliente.name.toLowerCase().includes(sl) ||
      (q.numero || '').toLowerCase().includes(sl) ||
      q.cliente.phone.includes(searchTerm);
    return matchSearch && (tipoFilter === 'all' || q.tipo === tipoFilter) && (estadoFilter === 'all' || q.estado === estadoFilter);
  }), [quotes, searchTerm, tipoFilter, estadoFilter]);

  const stats = useMemo(() => ({
    total: quotes.length,
    abiertas: quotes.filter(q => q.estado === 'ABIERTA').length,
    cerradas: quotes.filter(q => q.estado === 'CERRADA').length,
    totalMonto: quotes.filter(q => q.estado !== 'PERDIDA').reduce((s, q) => s + q.total, 0),
  }), [quotes]);

  const hasFilters = searchTerm || tipoFilter !== 'all' || estadoFilter !== 'all';
  const openModal = () => setShowCreateModal(true);
  const closeModal = () => { setShowCreateModal(false); loadQuotes(); };

  return (
    <div className="space-y-5 max-w-screen-2xl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)] flex items-center gap-2">
            <FileText size={20} className="text-[#48B9E6]" />
            Cotizaciones
          </h1>
          <p className="text-xs text-[var(--color-text-sec)] mt-0.5">
            Gestión integral de cotizaciones para clientes
          </p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-1.5 bg-gradient-to-r from-[#48B9E6] to-[#2EA7D8] hover:from-[#2EA7D8] hover:to-[#2563EB] text-white font-semibold rounded-xl text-sm px-4 py-2 shadow-sm shrink-0 transition-all"
        >
          <Plus size={15} />
          Nueva Cotización
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total" value={stats.total} sub="cotizaciones" icon={FileText} gradient="bg-gradient-to-br from-[#48B9E6] to-[#2563EB]" />
        <KpiCard label="Abiertas" value={stats.abiertas} sub="en curso" icon={Activity} gradient="bg-gradient-to-br from-emerald-500 to-emerald-700" />
        <KpiCard label="Cerradas" value={stats.cerradas} sub="concretadas" icon={CheckCircle} gradient="bg-gradient-to-br from-blue-500 to-blue-700" />
        <KpiCard label="Monto activas" value={formatMoney(stats.totalMonto)} icon={DollarSign} gradient="bg-gradient-to-br from-violet-500 to-purple-700" />
      </div>

      {/* Toolbar */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] px-4 py-3 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-sec)] pointer-events-none" />
          <input
            placeholder="Buscar por cliente, teléfono o número..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] placeholder:text-[var(--color-text-sec)] focus:outline-none focus:ring-2 focus:ring-[#48B9E6]/30 focus:border-[#48B9E6]"
          />
        </div>
        <select
          value={tipoFilter}
          onChange={e => setTipoFilter(e.target.value as any)}
          className="text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] px-3 py-2 focus:outline-none sm:w-40 shrink-0"
        >
          <option value="all">Todos los tipos</option>
          <option value="VENTA">Venta</option>
          <option value="REPARACION">Reparación</option>
        </select>
        <select
          value={estadoFilter}
          onChange={e => setEstadoFilter(e.target.value as any)}
          className="text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] px-3 py-2 focus:outline-none sm:w-36 shrink-0"
        >
          <option value="all">Todos los estados</option>
          <option value="ABIERTA">Abierta</option>
          <option value="CERRADA">Cerrada</option>
          <option value="PERDIDA">Perdida</option>
          <option value="REPARANDO">Reparando</option>
        </select>
        {hasFilters && (
          <button
            onClick={() => { setSearchTerm(''); setTipoFilter('all'); setEstadoFilter('all'); }}
            className="text-sm font-medium text-[var(--color-text-sec)] hover:text-[var(--color-text)] border border-[var(--color-border)] rounded-xl px-3 py-2 whitespace-nowrap shrink-0 transition-colors"
          >
            Limpiar
          </button>
        )}
        <span className="text-xs text-[var(--color-text-sec)] whitespace-nowrap self-center shrink-0">
          {filteredQuotes.length} resultados
        </span>
      </div>

      {/* List */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-[#48B9E6] border-t-transparent" />
            <p className="text-sm text-[var(--color-text-sec)]">Cargando cotizaciones...</p>
          </div>
        ) : filteredQuotes.length > 0 ? (
          <div>
            {filteredQuotes.map(quote => (
              <QuoteRow
                key={quote.id}
                quote={quote}
                onView={id => navigate(`/cotizaciones/${id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-[var(--color-input-bg)] rounded-2xl p-4 mb-3">
              <FileText size={28} className="text-[#48B9E6]" />
            </div>
            <p className="text-sm font-semibold text-[var(--color-text)]">
              {hasFilters ? 'Sin resultados' : 'No hay cotizaciones'}
            </p>
            <p className="text-xs text-[var(--color-text-sec)] mt-1 mb-4">
              {hasFilters ? 'Ajusta los filtros' : 'Comienza creando tu primera cotización'}
            </p>
            {!hasFilters && (
              <button
                onClick={openModal}
                className="flex items-center gap-1.5 bg-gradient-to-r from-[#48B9E6] to-[#2EA7D8] text-white text-sm font-semibold rounded-xl px-4 py-2 transition-all hover:brightness-110"
              >
                <Plus size={14} />
                Nueva Cotización
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      <NuevaCotizacionModal open={showCreateModal} onClose={closeModal} />
    </div>
  );
}
"""

with open(r'c:\Users\brenn\Desktop\TechWorksOne\Tecnocell_web\src\pages\Quotes\QuotesPage.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
print("Done!")
