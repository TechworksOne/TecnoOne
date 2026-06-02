import { AlertTriangle, CheckCircle, Download, FileText, XCircle } from "lucide-react";
import { useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import Select from "../../components/ui/Select";
import Table from "../../components/ui/Table";
import { useToast } from "../../components/ui/Toast";
import { formatDate, formatMoney } from "../../lib/format";
import { mockInvoices, mockSales } from "../../lib/mock";
import { useAuth } from "../../store/useAuth";
import { Invoice } from "../../types/invoice";

export default function FelPage() {
  const { role } = useAuth();
  const toast = useToast();

  const [invoices, setInvoices] = useState(mockInvoices);
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateeTo] = useState("");
  const [showEmitModal, setShowEmitModal] = useState(false);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedSale, setSelectedSale] = useState("");

  const filteredInvoices = invoices.filter((inv) => {
    const matchesStatus = !statusFilter || inv.status === statusFilter;
    const matchesDateFrom = !dateFrom || inv.date >= dateFrom;
    const matchesDateTo = !dateTo || inv.date <= dateTo;
    return matchesStatus && matchesDateFrom && matchesDateTo;
  });

  const invoicesTableData = filteredInvoices.map((inv) => ({
    UUID: inv.uuid.substring(0, 8) + "...",
    Serie: inv.series,
    Número: inv.number,
    Fecha: formatDate(inv.date),
    Total: formatMoney(inv.total),
    Estado: (
      <Badge
        color={inv.status === "certified" ? "green" : inv.status === "voided" ? "red" : "yellow"}
      >
        {inv.status === "certified" ? "Certificada" : inv.status === "voided" ? "Anulada" : "Error"}
      </Badge>
    ),
    Acciones: (
      <div className="flex gap-1">
        <Button variant="ghost" onClick={() => viewPDF(inv)} title="Ver PDF">
          <FileText size={16} />
        </Button>
        <Button variant="ghost" onClick={() => viewXML(inv)} title="Ver XML">
          <Download size={16} />
        </Button>
        {role === "admin" && inv.status === "certified" && (
          <Button
            variant="ghost"
            onClick={() => openVoidDialog(inv)}
            title="Anular"
            className="text-red-600"
          >
            <XCircle size={16} />
          </Button>
        )}
      </div>
    ),
  }));

  const availableSales = mockSales.filter(
    (sale) => sale.status === "completed" && !invoices.some((inv) => inv.saleId === sale.id)
  );

  function viewPDF(invoice: Invoice) {
    toast.add(`Abriendo PDF de factura ${invoice.series}-${invoice.number}`);
  }

  function viewXML(invoice: Invoice) {
    toast.add(`Descargando XML de factura ${invoice.series}-${invoice.number}`);
  }

  function openVoidDialog(invoice: Invoice) {
    setSelectedInvoice(invoice);
    setShowVoidDialog(true);
  }

  function emitInvoice() {
    const sale = mockSales.find((s) => s.id === selectedSale);
    if (!sale) return;

    const newInvoice: Invoice = {
      id: `F${String(invoices.length + 1).padStart(3, "0")}`,
      uuid: `123e4567-e89b-12d3-a456-${Date.now()}`,
      series: "FEL",
      number: String(invoices.length + 1).padStart(6, "0"),
      date: new Date().toISOString().split("T")[0],
      total: sale.total,
      status: "certified",
      saleId: sale.id,
    };

    setInvoices((prev) => [...prev, newInvoice]);
    toast.add(`Factura ${newInvoice.series}-${newInvoice.number} emitida exitosamente`);
    setShowEmitModal(false);
    setSelectedSale("");
  }

  function voidInvoice() {
    if (!selectedInvoice) return;

    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === selectedInvoice.id ? { ...inv, status: "voided" as const } : inv
      )
    );

    toast.add(`Factura ${selectedInvoice.series}-${selectedInvoice.number} anulada`);
    setShowVoidDialog(false);
    setSelectedInvoice(null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-teal-50 to-emerald-50 space-y-6 sm:space-y-8">
      <div className="bg-white/80 dark:bg-slate-900/90 backdrop-blur-sm border-0 shadow-lg rounded-2xl p-6">
        <PageHeader
          title="Facturación Electrónica (FEL)"
          subtitle="Gestión de facturas electrónicas"
        />
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0 shadow-xl rounded-2xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <CheckCircle size={28} className="text-white/80" />
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">
              {invoices.filter((i) => i.status === "certified").length}
            </div>
            <div className="text-emerald-100">Certificadas</div>
          </div>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-500 to-pink-600 text-white border-0 shadow-xl rounded-2xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <XCircle size={28} className="text-white/80" />
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl">❌</span>
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">
              {invoices.filter((i) => i.status === "voided").length}
            </div>
            <div className="text-red-100">Anuladas</div>
          </div>
        </Card>
        
        <Card className="bg-gradient-to-br from-yellow-500 to-amber-600 text-white border-0 shadow-xl rounded-2xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <AlertTriangle size={28} className="text-white/80" />
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl">⚠️</span>
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">
              {invoices.filter((i) => i.status === "error").length}
            </div>
            <div className="text-yellow-100">Con Error</div>
          </div>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-0 shadow-xl rounded-2xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <FileText size={28} className="text-white/80" />
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl">📄</span>
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">{invoices.length}</div>
            <div className="text-blue-100">Total</div>
          </div>
        </Card>
      </div>

      {/* Filtros y acciones */}
      <Card className="mb-6 bg-white/90 dark:bg-slate-900/95 backdrop-blur-sm border-0 shadow-xl rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-600 to-teal-600 p-6 text-white">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-xl font-bold tracking-tight">Facturas Electrónicas</h3>
              <p className="text-cyan-100 mt-1">Gestión completa del régimen FEL</p>
            </div>
            <Button 
              onClick={() => setShowEmitModal(true)} 
              className="w-full sm:w-auto bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-slate-700 border-0 shadow-lg font-semibold transition-all duration-200 hover:scale-105"
            >
              <FileText size={16} className="mr-2" />
              ⚡ Emitir Factura
            </Button>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700">Estado</label>
              <Select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border-2 border-cyan-200 focus:border-cyan-500 rounded-xl shadow-sm"
              >
                <option value="">Todos los estados</option>
                <option value="certified">Certificadas</option>
                <option value="voided">Anuladas</option>
                <option value="error">Con Error</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700">Fecha desde</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="Fecha desde"
                className="border-2 border-cyan-200 focus:border-cyan-500 rounded-xl shadow-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700">Fecha hasta</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateeTo(e.target.value)}
                placeholder="Fecha hasta"
                className="border-2 border-cyan-200 focus:border-cyan-500 rounded-xl shadow-sm"
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setStatusFilter("");
                  setDateFrom("");
                  setDateeTo("");
                }}
                className="w-full bg-gradient-to-r from-slate-100 to-gray-100 hover:from-slate-200 hover:to-gray-200 text-slate-600 border-2 border-slate-200 rounded-xl font-medium transition-all duration-200 hover:scale-105"
              >
                🔄 Limpiar Filtros
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabla de facturas */}
      <Card className="overflow-hidden bg-white/95 dark:bg-slate-900/98 backdrop-blur-sm border-0 shadow-2xl rounded-2xl">
        <div className="overflow-x-auto">
          <Table columns={Object.keys(invoicesTableData[0] || {})} data={invoicesTableData} />
        </div>
      </Card>

      {/* Modal emitir factura */}
      <Modal
        open={showEmitModal}
        onClose={() => setShowEmitModal(false)}
        title="Emitir Factura Electrónica"
      >
        <div className="space-y-6">
          {/* Selección de venta */}
          <div className="bg-gradient-to-r from-cyan-50 to-teal-50 p-6 rounded-xl border border-cyan-200">
            <h4 className="text-lg font-semibold text-cyan-900 mb-4 flex items-center">
              <div className="w-2 h-2 bg-cyan-500 rounded-full mr-3"></div>
              Selección de Venta
            </h4>
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700">
                Seleccionar Venta para Facturar
              </label>
              <Select 
                value={selectedSale} 
                onChange={(e) => setSelectedSale(e.target.value)}
                className="border-2 border-cyan-200 focus:border-cyan-500 rounded-xl shadow-sm"
              >
                <option value="">🔍 Seleccione una venta...</option>
                {availableSales.map((sale) => (
                  <option key={sale.id} value={sale.id}>
                    💰 {sale.id} - {sale.customerName || "Cliente General"} - {formatMoney(sale.total)} - {formatDate(sale.date)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {selectedSale && (
            <div className="bg-gradient-to-r from-emerald-50 to-green-50 p-6 rounded-xl border border-emerald-200">
              <h4 className="text-lg font-semibold text-emerald-900 mb-4 flex items-center">
                <div className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></div>
                📋 Información de la Venta
              </h4>
              {(() => {
                const sale = mockSales.find((s) => s.id === selectedSale);
                return sale ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="bg-white/70 dark:bg-slate-800/70 p-4 rounded-xl">
                      <div className="font-semibold text-emerald-800">🆔 ID: {sale.id}</div>
                      <div className="text-emerald-700">👤 Cliente: {sale.customerName || "Cliente General"}</div>
                      {sale.customerNit && <div className="text-emerald-700">📋 NIT: {sale.customerNit}</div>}
                    </div>
                    <div className="bg-white/70 p-4 rounded-xl">
                      <div className="text-emerald-700">📅 Fecha: {formatDate(sale.date)}</div>
                      <div className="font-semibold text-emerald-800">💰 Total: {formatMoney(sale.total)}</div>
                      <div className="text-emerald-700">📦 Items: {sale.items.length}</div>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          )}

          <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-6 rounded-xl border border-yellow-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-yellow-600 mt-1" size={20} />
              <div className="text-sm">
                <div className="font-semibold text-yellow-900 mb-2">⚠️ Importante:</div>
                <div className="text-yellow-800">Una vez emitida, la factura no puede ser modificada, solo anulada.</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-slate-200">
            <Button 
              variant="ghost" 
              onClick={() => setShowEmitModal(false)}
              className="w-full sm:w-auto px-6 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-all duration-200"
            >
              Cancelar
            </Button>
            <Button 
              onClick={emitInvoice} 
              disabled={!selectedSale}
              className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white rounded-xl font-semibold shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ⚡ Emitir Factura
            </Button>
          </div>
        </div>
      </Modal>

      {/* Dialog confirmar anulación */}
      <ConfirmDialog
        open={showVoidDialog}
        onClose={() => setShowVoidDialog(false)}
        onConfirm={voidInvoice}
        title="Anular Factura Electrónica"
      >
        {selectedInvoice && (
          <div>
            <p className="mb-4">
              ¿Está seguro que desea anular la factura{" "}
              <strong>
                {selectedInvoice.series}-{selectedInvoice.number}
              </strong>
              ?
            </p>
            <div className="bg-red-50 p-3 rounded">
              <div className="flex items-start gap-2">
                <AlertTriangle className="text-red-600 mt-0.5" size={16} />
                <div className="text-sm">
                  <div className="font-medium">Esta acción es irreversible</div>
                  <div>La factura quedará marcada como anulada en el sistema FEL.</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
