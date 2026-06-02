import {
  Calendar,
  Edit,
  Eye,
  FileText,
  MapPin,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  User,
  Users,
  Wallet,
  Clock,
  Star,
  TrendingUp,
  Activity,
  Award,
  Heart,
  Target,
  X,
  CreditCard,
  Wrench,
  Filter,
  RefreshCw,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import EmptyState from "../../components/ui/EmptyState";
import Input from "../../components/ui/Input";
import { useToast } from "../../components/ui/Toast";
import { formatMoney, formatPhone, formatDate } from "../../lib/format";
import { useCustomers } from "../../store/useCustomers";
import { Customer, CustomerPurchase } from "../../types/customer";

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const toNum = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const fmtQ = (v: unknown): string => `Q ${toNum(v).toFixed(2)}`;


export default function CustomersPage() {
  const {
    customers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerPurchases,
    loadCustomerPurchases,
    getCustomerVisits,
    getCustomerSummary,
    searchCustomers,
    getLoyaltyLevel,
    loadCustomers,
    isLoading
  } = useCustomers();

  const toast = useToast();

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all"|"new"|"frequent"|"vip">("all");

  // Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [purchasesLoaded, setPurchasesLoaded] = useState(false);

  const [currentCustomer, setCurrentCustomer] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    nit: "",
    email: "",
    address: "",
    notes: "",
    preferredPaymentMethod: "efectivo" as "efectivo" | "tarjeta" | "transferencia",
  });

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  // â”€â”€ Derived data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const newThisMonth = customers.filter(c => new Date(c.customerSince || c.createdAt) >= startOfMonth).length;
  const withPurchases = customers.filter(c => toNum((c as any).totalVisits) > 0).length;
  const totalGastado = customers.reduce((sum, c) => sum + toNum((c as any).totalSpentPreloaded), 0);

  // â”€â”€ Filter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const baseList = searchCustomers(searchQuery);
  const filteredCustomers = baseList.filter(c => {
    if (statusFilter === "all") return true;
    const spent = toNum((c as any).totalSpentPreloaded);
    const visits = toNum(c.totalVisits);
    const loyalty = getLoyaltyLevel(spent, visits);
    if (statusFilter === "new") return loyalty === "Nuevo";
    if (statusFilter === "frequent") return loyalty === "Frecuente" || loyalty === "Regular";
    if (statusFilter === "vip") return loyalty === "VIP";
    return true;
  });

  // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const resetForm = () => {
    setCurrentCustomer({ firstName: "", lastName: "", phone: "", nit: "", email: "", address: "", notes: "", preferredPaymentMethod: "efectivo" });
    setEditingCustomer(null);
  };

  const validateForm = () => {
    if (!currentCustomer.firstName.trim()) { toast.add("El nombre es requerido", "error"); return false; }
    if (!currentCustomer.lastName.trim()) { toast.add("El apellido es requerido", "error"); return false; }
    if (!currentCustomer.phone.trim()) { toast.add("El teléfono es requerido", "error"); return false; }
    if (currentCustomer.phone.replace(/\D/g,'').length < 8) { toast.add("El teléfono debe tener al menos 8 dígitos", "error"); return false; }
    if (currentCustomer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentCustomer.email)) { toast.add("Email inválido", "error"); return false; }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, currentCustomer);
        toast.add("Cliente actualizado exitosamente");
      } else {
        await addCustomer(currentCustomer);
        toast.add("Cliente registrado exitosamente");
      }
      resetForm();
      setIsFormOpen(false);
    } catch (error: any) {
      toast.add(error.message || "Error al guardar el cliente", "error");
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setCurrentCustomer({
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      nit: customer.nit || "",
      email: customer.email || "",
      address: customer.address || "",
      notes: customer.notes || "",
      preferredPaymentMethod: customer.preferredPaymentMethod || "efectivo",
    });
    setIsFormOpen(true);
  };

  const handleViewDetails = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDetailsOpen(true);
    setPurchasesLoaded(false);
    await loadCustomerPurchases(customer.id);
    setPurchasesLoaded(true);
  };

  const handleDelete = (customer: Customer) => { setSelectedCustomer(customer); setIsDeleteOpen(true); };
  const confirmDelete = () => {
    if (selectedCustomer) { deleteCustomer(selectedCustomer.id); toast.add("Cliente eliminado exitosamente"); setIsDeleteOpen(false); setSelectedCustomer(null); }
  };

  const formatPhoneNumber = (phone: string) => {
    const c = phone.replace(/\D/g,'');
    return c.length >= 8 ? c.replace(/(\d{4})(\d{4})/, '$1-$2') : phone;
  };

  const getLoyaltyColor = (level: string) => {
    switch (level) {
      case "VIP": return "bg-gradient-to-r from-purple-500 to-pink-500 text-white";
      case "Frecuente": return "bg-gradient-to-r from-[#2EA7D8] to-[#2563EB] text-white";
      case "Regular": return "bg-gradient-to-r from-emerald-500 to-emerald-700 text-white";
      default: return "bg-[#F0FAFF] dark:bg-[#0A1220] text-[#5E7184] dark:text-[#B8C2D1]";
    }
  };

  const getInitials = (first: string, last: string) =>
    `${(first || '').charAt(0)}${(last || '').charAt(0)}`.toUpperCase();

  const getStatusColor = (status: string) => {
    switch (status) { case "open": return "warning"; case "won": return "success"; case "lost": return "error"; default: return "default"; }
  };
  const getStatusText = (status: string) => {
    switch (status) { case "open": return "Pendiente"; case "won": return "Ganada"; case "lost": return "Perdida"; default: return status; }
  };

  const canSubmit = currentCustomer.firstName.trim() && currentCustomer.lastName.trim() && currentCustomer.phone.trim();

  // â”€â”€ KPI Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const KPI_CARDS = [
    { label: "Total clientes", value: customers.length, icon: Users, color: "from-[#48B9E6] to-[#2563EB]" },
    { label: "Nuevos este mes", value: newThisMonth, icon: TrendingUp, color: "from-emerald-500 to-emerald-700" },
    { label: "Con compras", value: withPurchases, icon: ShoppingBag, color: "from-violet-500 to-purple-700" },
    { label: "Total gastado", value: fmtQ(totalGastado), icon: Wallet, color: "from-amber-500 to-orange-600" },
  ];

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="space-y-5 max-w-screen-2xl">

      {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] font-bold text-[#48B9E6] mb-1">CRM · CLIENTES</p>
          <h1 className="text-2xl font-bold text-[#14324A] dark:text-[#F8FAFC] flex items-center gap-2">
            <Users size={22} className="text-[#48B9E6]" />
            Clientes
          </h1>
          <p className="text-sm text-[#5E7184] dark:text-[#B8C2D1] mt-0.5">
            Gestión de cartera, historial comercial y seguimiento de clientes
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setIsFormOpen(true); }}
          className="shrink-0 flex items-center gap-2 bg-gradient-to-r from-[#2EA7D8] to-[#2563EB] hover:brightness-110 text-white font-semibold rounded-2xl px-5 py-2.5 text-sm shadow-sm transition-all"
        >
          <Plus size={16} />
          Nuevo Cliente
        </button>
      </div>

      {/* â”€â”€ KPI Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CARDS.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`rounded-2xl p-4 bg-gradient-to-br ${color}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-medium text-white/70 uppercase tracking-widest">{label}</p>
                <p className="text-2xl font-bold text-white mt-1">{value}</p>
              </div>
              <div className="bg-white/20 rounded-xl p-2 shrink-0">
                <Icon size={18} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* â”€â”€ Search & Filters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="bg-white dark:bg-[#0D1526] rounded-3xl border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7F8A99] pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, teléfono, email, NIT o dirección..."
            className="w-full h-12 rounded-2xl pl-10 pr-4 bg-[#F8FDFF] dark:bg-[#060B14] text-[#14324A] dark:text-[#F8FAFC] placeholder:text-[#7F8A99] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] focus:border-[#48B9E6] focus:ring-2 focus:ring-[#48B9E6]/20 outline-none text-sm transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7F8A99] hover:text-[#14324A] dark:hover:text-[#F8FAFC]">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          {(["all","new","frequent","vip"] as const).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`h-9 px-3 rounded-xl text-xs font-semibold transition-all border ${
                statusFilter === f
                  ? "bg-[#48B9E6] border-[#48B9E6] text-white"
                  : "border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] text-[#5E7184] dark:text-[#B8C2D1] hover:border-[#48B9E6] bg-transparent"
              }`}
            >
              {f === "all" ? "Todos" : f === "new" ? "Nuevos" : f === "frequent" ? "Frecuentes" : "VIP"}
            </button>
          ))}
          {(searchQuery || statusFilter !== "all") && (
            <button
              onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
              className="h-9 px-3 rounded-xl text-xs font-semibold border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] text-[#5E7184] dark:text-[#B8C2D1] hover:text-red-500 hover:border-red-300 flex items-center gap-1 transition-all"
            >
              <RefreshCw size={11} />
              Limpiar
            </button>
          )}
        </div>
        <span className="text-xs text-[#5E7184] dark:text-[#B8C2D1] whitespace-nowrap self-center shrink-0">
          {filteredCustomers.length} cliente{filteredCustomers.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* â”€â”€ Customer List â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-[#48B9E6] border-t-transparent" />
          <p className="text-sm text-[#5E7184] dark:text-[#B8C2D1]">Cargando clientes...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white dark:bg-[#0D1526] rounded-2xl border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] flex flex-col items-center justify-center py-20 text-center">
          <div className="bg-[#F8FDFF] dark:bg-[#0A1220] rounded-2xl p-4 mb-3">
            <Users size={30} className="text-[#48B9E6]" />
          </div>
          <p className="text-sm font-semibold text-[#14324A] dark:text-[#F8FAFC]">
            {searchQuery || statusFilter !== "all" ? "Sin resultados" : "No hay clientes registrados"}
          </p>
          <p className="text-xs text-[#5E7184] dark:text-[#B8C2D1] mt-1 mb-4">
            {searchQuery || statusFilter !== "all" ? "Ajusta los filtros de búsqueda" : "Comienza registrando tu primer cliente"}
          </p>
          {!searchQuery && statusFilter === "all" && (
            <button
              onClick={() => { resetForm(); setIsFormOpen(true); }}
              className="bg-gradient-to-r from-[#2EA7D8] to-[#2563EB] text-white text-sm rounded-xl px-4 py-2 flex items-center gap-2 hover:brightness-110"
            >
              <Plus size={14} /> Agregar Cliente
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white dark:bg-[#0D1526] rounded-2xl border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] overflow-hidden">
            {/* Table header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-[#F8FDFF] dark:bg-[#0A1220] border-b border-[#D6EEF8] dark:border-[rgba(72,185,230,0.12)]">
              <div className="w-9 shrink-0" />
              <p className="flex-1 text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest">Cliente</p>
              <p className="w-36 text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest shrink-0">Contacto</p>
              <p className="w-24 text-right text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest shrink-0">Compras</p>
              <p className="w-28 text-right text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest shrink-0">Total gastado</p>
              <p className="w-20 text-center text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest shrink-0">Nivel</p>
              <p className="w-28 text-right text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest shrink-0">Acciones</p>
            </div>
            {filteredCustomers.map(customer => {
              const spent = toNum((customer as any).totalSpentPreloaded);
              const visits = toNum(customer.totalVisits);
              const loyalty = getLoyaltyLevel(spent, visits);
              return (
                <div key={customer.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-[#0A1220] transition-colors border-b border-slate-100 dark:border-[rgba(72,185,230,0.08)] last:border-0">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#48B9E6] to-[#2563EB] flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {getInitials(customer.firstName, customer.lastName)}
                  </div>
                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#14324A] dark:text-[#F8FAFC] truncate leading-tight">
                      {customer.firstName} {customer.lastName}
                    </p>
                    <p className="text-[11px] text-[#7F8A99] mt-0.5">
                      Desde {formatDate(customer.customerSince || customer.createdAt)}
                    </p>
                  </div>
                  {/* Contact */}
                  <div className="w-36 shrink-0">
                    <p className="text-xs font-medium text-[#14324A] dark:text-[#F8FAFC] flex items-center gap-1">
                      <Phone size={10} className="text-[#48B9E6]" />{formatPhoneNumber(customer.phone)}
                    </p>
                    {customer.email && <p className="text-[11px] text-[#7F8A99] truncate mt-0.5">{customer.email}</p>}
                    {customer.nit && <p className="text-[11px] text-[#7F8A99] mt-0.5">NIT: {customer.nit}</p>}
                  </div>
                  {/* Purchases */}
                  <div className="w-24 text-right shrink-0">
                    <p className="text-sm font-bold text-[#14324A] dark:text-[#F8FAFC]">{visits}</p>
                    <p className="text-[11px] text-[#7F8A99]">ventas</p>
                  </div>
                  {/* Total spent */}
                  <div className="w-28 text-right shrink-0">
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{fmtQ(spent)}</p>
                  </div>
                  {/* Level */}
                  <div className="w-20 flex justify-center shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${getLoyaltyColor(loyalty)}`}>{loyalty}</span>
                  </div>
                  {/* Actions */}
                  <div className="w-28 flex items-center justify-end gap-0.5 shrink-0">
                    <button onClick={() => handleViewDetails(customer)} title="Ver detalle" className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                      <Eye size={14} className="text-[#5E7184] dark:text-[#B8C2D1]" />
                    </button>
                    <button onClick={() => handleEdit(customer)} title="Editar" className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                      <Edit size={14} className="text-[#5E7184] dark:text-[#B8C2D1]" />
                    </button>
                    <button onClick={() => handleDelete(customer)} title="Eliminar" className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors">
                      <Trash2 size={14} className="text-red-400 dark:text-red-500" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredCustomers.map(customer => {
              const spent = toNum((customer as any).totalSpentPreloaded);
              const visits = toNum(customer.totalVisits);
              const loyalty = getLoyaltyLevel(spent, visits);
              return (
                <div key={customer.id} className="bg-white dark:bg-[#0D1526] rounded-2xl border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#48B9E6] to-[#2563EB] flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {getInitials(customer.firstName, customer.lastName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-[#14324A] dark:text-[#F8FAFC] leading-tight">{customer.firstName} {customer.lastName}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${getLoyaltyColor(loyalty)}`}>{loyalty}</span>
                      </div>
                      <p className="text-xs text-[#7F8A99] flex items-center gap-1 mt-0.5">
                        <Phone size={10} className="text-[#48B9E6]" />{formatPhoneNumber(customer.phone)}
                      </p>
                      {customer.email && <p className="text-xs text-[#7F8A99] truncate">{customer.email}</p>}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#D6EEF8] dark:border-[rgba(72,185,230,0.10)] pt-3">
                    <div className="text-center">
                      <p className="text-sm font-bold text-[#14324A] dark:text-[#F8FAFC]">{visits}</p>
                      <p className="text-[10px] text-[#7F8A99]">Compras</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{fmtQ(spent)}</p>
                      <p className="text-[10px] text-[#7F8A99]">Total</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] text-[#7F8A99]">Desde</p>
                      <p className="text-[11px] font-medium text-[#5E7184] dark:text-[#B8C2D1]">{formatDate(customer.customerSince || customer.createdAt)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2 border-t border-[#D6EEF8] dark:border-[rgba(72,185,230,0.10)] pt-3">
                    <button onClick={() => handleViewDetails(customer)} className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold text-[#48B9E6] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] rounded-xl py-2 hover:bg-[#F8FDFF] dark:hover:bg-[#0A1220] transition-colors">
                      <Eye size={13} /> Ver
                    </button>
                    <button onClick={() => handleEdit(customer)} className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold text-[#5E7184] dark:text-[#B8C2D1] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] rounded-xl py-2 hover:bg-[#F8FDFF] dark:hover:bg-[#0A1220] transition-colors">
                      <Edit size={13} /> Editar
                    </button>
                    <button onClick={() => handleDelete(customer)} className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold text-red-500 border border-red-100 dark:border-red-900/30 rounded-xl py-2 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                      <Trash2 size={13} /> Borrar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* â”€â”€ Customer Form Modal (almost fullscreen) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {isFormOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-[100] bg-slate-950/60 dark:bg-black/75 backdrop-blur-md backdrop-saturate-150"
            onClick={() => { setIsFormOpen(false); resetForm(); }}
          />
          {/* Modal panel */}
          <div className="fixed top-3 left-3 right-3 bottom-3 md:top-5 md:left-6 md:right-6 md:bottom-5 z-[110] rounded-3xl overflow-hidden bg-white dark:bg-[#0D1526] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] shadow-2xl shadow-sky-950/30 flex flex-col">
            {/* Header */}
            <div className="shrink-0 flex items-start justify-between px-6 py-5 border-b border-[#D6EEF8] dark:border-[rgba(72,185,230,0.14)] bg-white dark:bg-[#0D1526]">
              <div>
                <h2 className="text-xl font-bold text-[#14324A] dark:text-[#F8FAFC]">
                  {editingCustomer ? "Editar Cliente" : "Nuevo Cliente"}
                </h2>
                <p className="text-xs text-[#5E7184] dark:text-[#B8C2D1] mt-0.5">
                  Registra datos de contacto, facturación y seguimiento
                </p>
              </div>
              <button
                onClick={() => { setIsFormOpen(false); resetForm(); }}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#0A1220] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] text-[#5E7184] dark:text-[#B8C2D1] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body â€” scrollable */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6
                [&::-webkit-scrollbar]:w-1.5
                [&::-webkit-scrollbar-track]:bg-transparent
                [&::-webkit-scrollbar-thumb]:bg-slate-200
                dark:[&::-webkit-scrollbar-thumb]:bg-[rgba(72,185,230,0.20)]
                [&::-webkit-scrollbar-thumb]:rounded-full">

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Sección 1: Datos personales */}
                  <div className="space-y-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#5E7184] dark:text-[#B8C2D1]">Datos personales</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest">Nombre <span className="text-red-400">*</span></label>
                        <input
                          value={currentCustomer.firstName}
                          onChange={(e) => setCurrentCustomer({ ...currentCustomer, firstName: e.target.value })}
                          placeholder="Juan"
                          className="w-full h-12 rounded-2xl px-4 bg-[#F8FDFF] dark:bg-[#060B14] text-[#14324A] dark:text-[#F8FAFC] placeholder:text-[#7F8A99] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] focus:border-[#48B9E6] focus:ring-2 focus:ring-[#48B9E6]/20 outline-none text-sm transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest">Apellido <span className="text-red-400">*</span></label>
                        <input
                          value={currentCustomer.lastName}
                          onChange={(e) => setCurrentCustomer({ ...currentCustomer, lastName: e.target.value })}
                          placeholder="Pérez"
                          className="w-full h-12 rounded-2xl px-4 bg-[#F8FDFF] dark:bg-[#060B14] text-[#14324A] dark:text-[#F8FAFC] placeholder:text-[#7F8A99] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] focus:border-[#48B9E6] focus:ring-2 focus:ring-[#48B9E6]/20 outline-none text-sm transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest">Teléfono <span className="text-red-400">*</span></label>
                      <input
                        value={currentCustomer.phone}
                        onChange={(e) => setCurrentCustomer({ ...currentCustomer, phone: e.target.value })}
                        placeholder="5551-2345"
                        className="w-full h-12 rounded-2xl px-4 bg-[#F8FDFF] dark:bg-[#060B14] text-[#14324A] dark:text-[#F8FAFC] placeholder:text-[#7F8A99] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] focus:border-[#48B9E6] focus:ring-2 focus:ring-[#48B9E6]/20 outline-none text-sm transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest">Email</label>
                      <input
                        type="email"
                        value={currentCustomer.email}
                        onChange={(e) => setCurrentCustomer({ ...currentCustomer, email: e.target.value })}
                        placeholder="cliente@email.com"
                        className="w-full h-12 rounded-2xl px-4 bg-[#F8FDFF] dark:bg-[#060B14] text-[#14324A] dark:text-[#F8FAFC] placeholder:text-[#7F8A99] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] focus:border-[#48B9E6] focus:ring-2 focus:ring-[#48B9E6]/20 outline-none text-sm transition-all"
                      />
                    </div>
                  </div>

                  {/* Sección 2: Datos fiscales y ubicación */}
                  <div className="space-y-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#5E7184] dark:text-[#B8C2D1]">Datos fiscales y ubicación</p>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest">NIT</label>
                      <input
                        value={currentCustomer.nit}
                        onChange={(e) => setCurrentCustomer({ ...currentCustomer, nit: e.target.value })}
                        placeholder="12345678-9 o CF"
                        className="w-full h-12 rounded-2xl px-4 bg-[#F8FDFF] dark:bg-[#060B14] text-[#14324A] dark:text-[#F8FAFC] placeholder:text-[#7F8A99] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] focus:border-[#48B9E6] focus:ring-2 focus:ring-[#48B9E6]/20 outline-none text-sm transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest">Dirección</label>
                      <input
                        value={currentCustomer.address}
                        onChange={(e) => setCurrentCustomer({ ...currentCustomer, address: e.target.value })}
                        placeholder="Dirección del cliente"
                        className="w-full h-12 rounded-2xl px-4 bg-[#F8FDFF] dark:bg-[#060B14] text-[#14324A] dark:text-[#F8FAFC] placeholder:text-[#7F8A99] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] focus:border-[#48B9E6] focus:ring-2 focus:ring-[#48B9E6]/20 outline-none text-sm transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest">Método de pago preferido</label>
                      <select
                        value={currentCustomer.preferredPaymentMethod}
                        onChange={(e) => setCurrentCustomer({ ...currentCustomer, preferredPaymentMethod: e.target.value as any })}
                        className="w-full h-12 rounded-2xl px-4 bg-[#F8FDFF] dark:bg-[#060B14] text-[#14324A] dark:text-[#F8FAFC] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] focus:border-[#48B9E6] focus:ring-2 focus:ring-[#48B9E6]/20 outline-none text-sm transition-all"
                      >
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="transferencia">Transferencia</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest">Notas</label>
                      <textarea
                        value={currentCustomer.notes}
                        onChange={(e) => setCurrentCustomer({ ...currentCustomer, notes: e.target.value })}
                        placeholder="Información adicional sobre el cliente..."
                        rows={4}
                        className="w-full rounded-2xl px-4 py-3 min-h-[120px] bg-[#F8FDFF] dark:bg-[#060B14] text-[#14324A] dark:text-[#F8FAFC] placeholder:text-[#7F8A99] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] focus:border-[#48B9E6] focus:ring-2 focus:ring-[#48B9E6]/20 outline-none text-sm resize-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Summary preview */}
                {(currentCustomer.firstName || currentCustomer.lastName) && (
                  <div className="bg-[#F8FDFF] dark:bg-[#0A1220] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.14)] rounded-2xl px-5 py-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#48B9E6] to-[#2563EB] flex items-center justify-center text-white font-bold text-lg shrink-0">
                      {getInitials(currentCustomer.firstName, currentCustomer.lastName)}
                    </div>
                    <div>
                      <p className="font-bold text-[#14324A] dark:text-[#F8FAFC]">
                        {currentCustomer.firstName} {currentCustomer.lastName}
                      </p>
                      <p className="text-xs text-[#7F8A99]">
                        {currentCustomer.phone || "Sin teléfono"}{currentCustomer.nit ? ` · NIT: ${currentCustomer.nit}` : ""}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="shrink-0 flex flex-col sm:flex-row gap-3 justify-end px-6 py-4 border-t border-[#D6EEF8] dark:border-[rgba(72,185,230,0.14)] bg-white dark:bg-[#0D1526]">
                <button
                  type="button"
                  onClick={() => { setIsFormOpen(false); resetForm(); }}
                  className="sm:w-auto w-full px-5 py-2.5 rounded-2xl border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] text-[#5E7184] dark:text-[#B8C2D1] text-sm font-semibold hover:bg-slate-50 dark:hover:bg-[#0A1220] transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="sm:w-auto w-full px-6 py-2.5 rounded-2xl bg-gradient-to-r from-[#2EA7D8] to-[#2563EB] hover:brightness-110 text-white text-sm font-semibold disabled:opacity-50 transition-all"
                >
                  {editingCustomer ? "Actualizar Cliente" : "Registrar Cliente"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* â”€â”€ Detail Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {isDetailsOpen && selectedCustomer && (
        <>
          <div className="fixed inset-0 z-[100] bg-slate-950/60 dark:bg-black/75 backdrop-blur-md backdrop-saturate-150" onClick={() => setIsDetailsOpen(false)} />
          <div className="fixed top-3 left-3 right-3 bottom-3 md:top-5 md:left-6 md:right-6 md:bottom-5 z-[110] rounded-3xl overflow-hidden bg-white dark:bg-[#0D1526] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] shadow-2xl shadow-sky-950/30 flex flex-col">
            {/* Header */}
            <div className="shrink-0 flex items-start justify-between px-6 py-5 border-b border-[#D6EEF8] dark:border-[rgba(72,185,230,0.14)]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#48B9E6] to-[#2563EB] flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {getInitials(selectedCustomer.firstName, selectedCustomer.lastName)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#14324A] dark:text-[#F8FAFC]">
                    {selectedCustomer.firstName} {selectedCustomer.lastName}
                  </h2>
                  <p className="text-xs text-[#7F8A99]">
                    Cliente desde {formatDate(selectedCustomer.customerSince || selectedCustomer.createdAt)}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsDetailsOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#0A1220] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] text-[#5E7184] dark:text-[#B8C2D1]">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5
              [&::-webkit-scrollbar]:w-1.5
              [&::-webkit-scrollbar-track]:bg-transparent
              [&::-webkit-scrollbar-thumb]:bg-slate-200
              dark:[&::-webkit-scrollbar-thumb]:bg-[rgba(72,185,230,0.20)]
              [&::-webkit-scrollbar-thumb]:rounded-full">

              {/* Contact info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#F8FDFF] dark:bg-[#0A1220] rounded-2xl p-4 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#5E7184] dark:text-[#B8C2D1]">Contacto</p>
                  <div className="flex items-center gap-2 text-sm text-[#14324A] dark:text-[#F8FAFC]">
                    <Phone size={13} className="text-[#48B9E6] shrink-0" />
                    {formatPhoneNumber(selectedCustomer.phone)}
                  </div>
                  {selectedCustomer.email && (
                    <div className="flex items-center gap-2 text-sm text-[#14324A] dark:text-[#F8FAFC]">
                      <span className="text-[#48B9E6] shrink-0">âœ‰</span>{selectedCustomer.email}
                    </div>
                  )}
                  {selectedCustomer.nit && (
                    <div className="flex items-center gap-2 text-sm text-[#14324A] dark:text-[#F8FAFC]">
                      <FileText size={13} className="text-[#48B9E6] shrink-0" />NIT: {selectedCustomer.nit}
                    </div>
                  )}
                  {selectedCustomer.address && (
                    <div className="flex items-center gap-2 text-sm text-[#14324A] dark:text-[#F8FAFC]">
                      <MapPin size={13} className="text-[#48B9E6] shrink-0" />{selectedCustomer.address}
                    </div>
                  )}
                </div>
                <div className="bg-[#F8FDFF] dark:bg-[#0A1220] rounded-2xl p-4 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#5E7184] dark:text-[#B8C2D1]">Resumen comercial</p>
                  {(() => {
                    const spent = toNum((selectedCustomer as any).totalSpentPreloaded);
                    const visits = toNum(selectedCustomer.totalVisits);
                    const loyalty = getLoyaltyLevel(spent, visits);
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#7F8A99]">Nivel</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${getLoyaltyColor(loyalty)}`}>{loyalty}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#7F8A99]">Compras</span>
                          <span className="text-sm font-bold text-[#14324A] dark:text-[#F8FAFC]">{visits}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#7F8A99]">Total gastado</span>
                          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{fmtQ(spent)}</span>
                        </div>
                      </>
                    );
                  })()}
                  {selectedCustomer.preferredPaymentMethod && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#7F8A99]">Pago preferido</span>
                      <span className="text-xs font-medium text-[#5E7184] dark:text-[#B8C2D1] capitalize">{selectedCustomer.preferredPaymentMethod}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {selectedCustomer.notes && (
                <div className="bg-[#F8FDFF] dark:bg-[#0A1220] rounded-2xl p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#5E7184] dark:text-[#B8C2D1] mb-2">Notas</p>
                  <p className="text-sm text-[#14324A] dark:text-[#F8FAFC]">{selectedCustomer.notes}</p>
                </div>
              )}

              {/* Purchases */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#5E7184] dark:text-[#B8C2D1] mb-3">Historial de compras</p>
                {!purchasesLoaded ? (
                  <div className="flex items-center gap-3 py-8 justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#48B9E6] border-t-transparent" />
                    <span className="text-sm text-[#7F8A99]">Cargando...</span>
                  </div>
                ) : (() => {
                  const purchases = getCustomerPurchases(selectedCustomer.id);
                  return purchases.length === 0 ? (
                    <div className="text-center py-8 bg-[#F8FDFF] dark:bg-[#0A1220] rounded-2xl">
                      <ShoppingBag size={30} className="mx-auto text-[#B8C2D1] mb-2" />
                      <p className="text-sm text-[#7F8A99]">No hay compras registradas</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {purchases.map((purchase) => (
                        <div key={purchase.id} className="bg-[#F8FDFF] dark:bg-[#0A1220] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.12)] rounded-2xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-sm font-semibold text-[#14324A] dark:text-[#F8FAFC]">{purchase.reference || "Venta"}</p>
                              <p className="text-[11px] text-[#7F8A99]">{formatDate(purchase.date)} Â· {purchase.items} item{purchase.items !== 1 ? "s" : ""}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{fmtQ(purchase.total)}</p>
                              <span className="text-[10px] text-[#7F8A99]">{getStatusText(purchase.status || "")}</span>
                            </div>
                          </div>
                          {purchase.products && purchase.products.length > 0 && (
                            <div className="border-t border-[#D6EEF8] dark:border-[rgba(72,185,230,0.10)] pt-2 space-y-1">
                              {purchase.products.slice(0, 3).map((p, i) => (
                                <div key={i} className="flex justify-between text-xs text-[#5E7184] dark:text-[#B8C2D1]">
                                  <span>{p.quantity}x {p.name}</span>
                                  <span>{fmtQ(p.price * p.quantity)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 flex flex-wrap gap-2 justify-between px-6 py-4 border-t border-[#D6EEF8] dark:border-[rgba(72,185,230,0.14)] bg-white dark:bg-[#0D1526]">
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => { setIsDetailsOpen(false); handleEdit(selectedCustomer); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-[#2EA7D8] to-[#2563EB] text-white text-xs font-semibold hover:brightness-110 transition-all"
                >
                  <Edit size={13} /> Editar
                </button>
                <button
                  onClick={() => { setIsDetailsOpen(false); handleDelete(selectedCustomer); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-2xl border border-red-200 dark:border-red-900/40 text-red-500 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
                >
                  <Trash2 size={13} /> Eliminar
                </button>
              </div>
              <button
                onClick={() => setIsDetailsOpen(false)}
                className="px-4 py-2 rounded-2xl border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] text-[#5E7184] dark:text-[#B8C2D1] text-xs font-semibold hover:bg-slate-50 dark:hover:bg-[#0A1220] transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </>
      )}

      {/* â”€â”€ Confirm Delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <ConfirmDialog
        open={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={confirmDelete}
        title="Eliminar Cliente"
        description={selectedCustomer ? `¿Está seguro de que desea eliminar a ${selectedCustomer.firstName} ${selectedCustomer.lastName}? Esta acción no se puede deshacer.` : ""}
        confirmText="Eliminar"
        variant="danger"
      />
    </div>
  );
}
