import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Save, Printer, User, Package, FileText, Wrench, ShoppingBag, X, Plus, Edit, Trash2 } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import ProductoPicker from '../../components/quotes/ProductoPicker';
import RepuestoPicker from '../../components/repuestos/RepuestoPicker';
import QuotePrintView from '../../components/quotes/QuotePrintView';
import { useQuotesStore } from '../../store/useQuotesStore';
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

export default function QuoteFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { upsertQuote, getQuoteById } = useQuotesStore();
  const { customers, loadCustomers, isLoading: isLoadingCustomers } = useCustomers();

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [showProductoPicker, setShowProductoPicker] = useState(false);
  const [showRepuestoPicker, setShowRepuestoPicker] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [formState, setFormState] = useState<FormState>({
    tipo: 'VENTA',
    cliente: null,
    vigenciaDias: 15,
    items: [],
    manoDeObra: 0,
    observaciones: '',
    aplicarImpuestos: false,
  });

  const [manualItem, setManualItem] = useState({
    nombre: '',
    cantidad: 1,
    precioUnit: 0,
    aplicarImpuestos: false,
    notas: '',
  });

  const [showManualItemForm, setShowManualItemForm] = useState(false);
  const [searchCliente, setSearchCliente] = useState('');

  // Cargar clientes al montar el componente
  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Cargar cotización si estamos editando
  useEffect(() => {
    if (id) {
      // Cargar desde backend
      const loadCotizacion = async () => {
        try {
          const cotizacion = await cotizacionService.getCotizacionById(Number(id));
          
          // Mapear datos del backend al formState
          setFormState({
            tipo: cotizacion.tipo as QuoteType,
            cliente: {
              id: String(cotizacion.cliente_id),
              name: cotizacion.cliente_nombre,
              phone: cotizacion.cliente_telefono || '',
              email: cotizacion.cliente_email || '',
              nit: cotizacion.cliente_nit || '',
              address: cotizacion.cliente_direccion || '',
            },
            vigenciaDias: cotizacion.vigencia_dias || 15,
            items: cotizacion.items,
            manoDeObra: cotizacion.mano_de_obra || 0,
            observaciones: cotizacion.observaciones || '',
            aplicarImpuestos: cotizacion.aplicar_impuestos || false,
          });
        } catch (error) {
          console.error('Error al cargar cotización:', error);
          toast.add('Error al cargar cotización', 'error');
          navigate('/cotizaciones');
        }
      };
      
      loadCotizacion();
    }
  }, [id, navigate, toast]);

  // Filtrar clientes
  const filteredCustomers = customers.filter(c => {
    if (searchCliente === '') return true; // Mostrar todos si no hay búsqueda
    
    const searchLower = searchCliente.toLowerCase();
    const nombreCompleto = `${c.firstName} ${c.lastName}`.toLowerCase();
    const telefono = c.phone || '';
    const nit = c.nit || '';
    const email = (c.email || '').toLowerCase();
    
    return nombreCompleto.includes(searchLower) ||
           telefono.includes(searchCliente) ||
           nit.includes(searchCliente) ||
           email.includes(searchLower);
  });

  // Calcular subtotal
  const calcSubtotal = () => {
    // TODO: conectar con backend - recalcular en servidor
    const subtotal = formState.items.reduce((sum, item) => {
      const itemSubtotal = Number(item.subtotal) || 0;
      return sum + itemSubtotal;
    }, 0);
    return Number(subtotal.toFixed(2));
  };

  // Calcular impuestos (solo para items con aplicarImpuestos en VENTA)
  const calcImpuestos = () => {
    // TODO: conectar con backend - calcular IVA en servidor
    if (formState.tipo !== 'VENTA') return 0;
    
    const impuestos = formState.items.reduce((sum, item) => {
      if ((item as any).aplicarImpuestos) {
        return sum + (Number(item.subtotal) * 0.12);
      }
      return sum;
    }, 0);
    return Number(impuestos.toFixed(2));
  };

  // Calcular total
  const calcTotal = () => {
    // TODO: conectar con backend - calcular total en servidor
    const subtotal = calcSubtotal();
    const impuestos = calcImpuestos();
    const manoObra = formState.tipo === 'REPARACION' ? Number(formState.manoDeObra) : 0;
    return Number((subtotal + impuestos + manoObra).toFixed(2));
  };

  // Validaciones por paso
  const validateStep = (step: Step): boolean => {
    if (step === 1) {
      if (!formState.cliente) {
        toast.add('Debes seleccionar un cliente', 'error');
        return false;
      }
    }
    if (step === 2) {
      if (formState.items.length === 0) {
        toast.add('Debes agregar al menos un ítem', 'error');
        return false;
      }
    }
    return true;
  };

  // Navegar entre pasos
  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(3, prev + 1) as Step);
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1) as Step);
  };

  // Seleccionar cliente
  const handleSelectCliente = (customer: typeof customers[0]) => {
    const fullName = (
      customer.nombre_completo ||
      `${customer.firstName || ''} ${customer.lastName || ''}`
    ).replace(/\s+/g, ' ').trim();
    setFormState({
      ...formState,
      cliente: {
        id: customer.id,
        name: fullName,
        phone: customer.phone,
        email: customer.email,
        nit: customer.nit,
        address: customer.address,
      },
    });
    setSearchCliente('');
  };

  // Agregar items desde pickers
  const handleAddProductos = (items: any[]) => {
    // TODO: conectar con backend - validar precios y stock en servidor
    const newItems: QuoteItem[] = items.map(item => {
      const cantidad = Number(item.cantidad) || 1;
      const precioUnit = Number(item.precioUnit) || 0;
      const subtotal = Number((cantidad * precioUnit).toFixed(2));
      
      return {
        id: `${Date.now()}-${Math.random()}`,
        source: 'PRODUCTO',
        refId: item.refId,
        nombre: item.nombre,
        cantidad,
        precioUnit,
        subtotal,
        aplicarImpuestos: item.aplicarImpuestos || false,
      } as any;
    });

    console.log('✅ Productos agregados a cotización:', newItems); // Debug

    setFormState({
      ...formState,
      items: [...formState.items, ...newItems],
    });
    setShowProductoPicker(false);
    
    toast.add(`${newItems.length} producto${newItems.length !== 1 ? 's' : ''} agregado${newItems.length !== 1 ? 's' : ''}`, 'success');
  };

  const handleAddRepuestos = (items: any[]) => {
    // TODO: conectar con backend - validar precios y stock en servidor
    // RepuestoPicker retorna: { id, nombre, cantidad, precioUnit, subtotal }
    const newItems: QuoteItem[] = items.map(item => {
      const cantidad = Number(item.cantidad) || 1;
      const precioUnit = Number(item.precioUnit) || 0;
      const subtotal = Number((cantidad * precioUnit).toFixed(2));
      
      return {
        id: `${Date.now()}-${Math.random()}`,
        source: 'REPUESTO',
        refId: item.id,
        nombre: item.nombre,
        cantidad,
        precioUnit,
        subtotal,
        notas: item.notas,
      };
    });

    console.log('✅ Repuestos agregados a cotización:', newItems); // Debug

    setFormState({
      ...formState,
      items: [...formState.items, ...newItems],
    });
    setShowRepuestoPicker(false);
    
    toast.add(`${newItems.length} repuesto${newItems.length !== 1 ? 's' : ''} agregado${newItems.length !== 1 ? 's' : ''}`, 'success');
  };

  // Agregar item manual
  const handleAddManualItem = () => {
    if (!manualItem.nombre || manualItem.cantidad <= 0 || manualItem.precioUnit < 0) {
      toast.add('Completa todos los campos correctamente', 'error');
      return;
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

    setFormState({
      ...formState,
      items: [...formState.items, newItem],
    });

    setManualItem({
      nombre: '',
      cantidad: 1,
      precioUnit: 0,
      aplicarImpuestos: false,
      notas: '',
    });
    setShowManualItemForm(false);
  };

  // Eliminar item
  const handleRemoveItem = (id: string) => {
    setFormState({
      ...formState,
      items: formState.items.filter(item => item.id !== id),
    });
  };

  // Actualizar cantidad de item
  const handleUpdateItemCantidad = (id: string, cantidad: number) => {
    if (isNaN(cantidad) || cantidad <= 0) return;
    
    setFormState({
      ...formState,
      items: formState.items.map(item =>
        item.id === id
          ? { ...item, cantidad, subtotal: Number((cantidad * item.precioUnit).toFixed(2)) }
          : item
      ),
    });
  };

  // Actualizar precio de item
  const handleUpdateItemPrecio = (id: string, precio: number) => {
    if (isNaN(precio) || precio < 0) return;
    
    setFormState({
      ...formState,
      items: formState.items.map(item =>
        item.id === id
          ? { ...item, precioUnit: precio, subtotal: Number((item.cantidad * precio).toFixed(2)) }
          : item
      ),
    });
  };

  // Toggle impuestos de item
  const handleToggleItemImpuestos = (id: string) => {
    setFormState({
      ...formState,
      items: formState.items.map(item =>
        item.id === id
          ? { ...item, aplicarImpuestos: !(item as any).aplicarImpuestos } as any
          : item
      ),
    });
  };

  // Guardar cotización
  const handleSave = async (andPrint = false) => {
    if (!validateStep(1) || !validateStep(2)) return;

    setIsLoading(true);
    try {
      const subtotal = calcSubtotal();
      const impuestos = calcImpuestos();
      const total = calcTotal();

      // Preparar datos para el backend
      const cotizacionData: cotizacionService.CotizacionData = {
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

      let savedCotizacion;
      
      if (id) {
        // Actualizar cotización existente
        savedCotizacion = await cotizacionService.updateCotizacion(Number(id), cotizacionData);
        toast.add('Cotización actualizada exitosamente', 'success');
      } else {
        // Crear nueva cotización
        savedCotizacion = await cotizacionService.createCotizacion(cotizacionData);
        toast.add('Cotización creada exitosamente', 'success');
        
        // Crear interacción de tipo cotización
        try {
          await interactionService.createInteraction({
            cliente_id: Number(formState.cliente!.id),
            tipo: 'cotizacion',
            referencia_id: String(savedCotizacion.id),
            monto: total,
            notas: `Cotización ${savedCotizacion.numero_cotizacion} - ${formState.tipo}`,
          });
        } catch (error) {
          console.warn('No se pudo registrar la interacción:', error);
        }
      }
      
      // Navegar al detalle de la cotización guardada
      if (savedCotizacion && savedCotizacion.id) {
        navigate(`/cotizaciones/${savedCotizacion.id}`);
      } else {
        navigate('/cotizaciones');
      }
    } catch (error: any) {
      console.error('Error al guardar cotización:', error);
      toast.add(error.response?.data?.message || 'Error al guardar la cotización', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Convertir a reparación
  const handleConvertToRepair = () => {
    if (formState.tipo !== 'REPARACION') {
      toast.add('Solo se pueden convertir cotizaciones de reparación', 'error');
      return;
    }

    const repairItems = formState.items.filter(item => item.source === 'REPUESTO');
    
    // TODO: conectar API real
    navigate('/reparaciones/nueva', {
      state: {
        fromQuote: true,
        cliente: formState.cliente,
        repuestos: repairItems,
        manoDeObra: formState.manoDeObra,
      },
    });
    
    toast.add('Redirigiendo a crear reparación...', 'success');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Print View */}
      {showPrintView && formState.cliente && (
        <div className="fixed inset-0 bg-white dark:bg-slate-950 z-50 overflow-auto">
          <div className="no-print p-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-bold">Vista de Impresión</h2>
            <Button variant="ghost" onClick={() => setShowPrintView(false)}>
              <X size={20} />
              Cerrar
            </Button>
          </div>
          <QuotePrintView
            quote={{
              id: id || 'new',
              numero: 'PREVIEW',
              tipo: formState.tipo,
              cliente: formState.cliente,
              vigenciaDias: formState.vigenciaDias,
              items: formState.items,
              manoDeObra: formState.manoDeObra,
              subtotal: calcSubtotal(),
              impuestos: calcImpuestos(),
              total: calcTotal(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              estado: 'ABIERTA',
              observaciones: formState.observaciones,
            }}
          />
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/cotizaciones')}>
                <ArrowLeft size={20} />
              </Button>
              <PageHeader
                title={id ? 'Editar Cotización' : 'Nueva Cotización'}
                subtitle="Crea cotizaciones para ventas o reparaciones"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stepper */}
        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Datos del Cliente', icon: User },
              { num: 2, label: 'Tipo y Productos', icon: Package },
              { num: 3, label: 'Resumen', icon: FileText },
            ].map((step, index) => (
              <React.Fragment key={step.num}>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all ${
                      currentStep >= step.num
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    <step.icon size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Paso {step.num}</p>
                    <p className="font-semibold">{step.label}</p>
                  </div>
                </div>
                {index < 2 && (
                  <div
                    className={`flex-1 h-1 mx-4 rounded transition-all ${
                      currentStep > step.num ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </Card>

        {/* Paso 1: Datos del Cliente */}
        {currentStep === 1 && (
          <Card className="p-6">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <User size={24} className="text-blue-600" />
              Datos del Cliente
            </h3>

            <div className="space-y-6">
              {/* Cliente seleccionado */}
              {formState.cliente ? (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-lg">{formState.cliente.name}</p>
                      <p className="text-gray-600 dark:text-slate-400">{formState.cliente.phone}</p>
                      {formState.cliente.email && (
                        <p className="text-gray-600 dark:text-slate-400 text-sm">{formState.cliente.email}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => setFormState({ ...formState, cliente: null })}
                    >
                      Cambiar
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Seleccionar cliente registrado <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="Buscar por nombre, teléfono, NIT o email..."
                    value={searchCliente}
                    onChange={(e: any) => setSearchCliente(e.target.value)}
                    className="mb-3"
                  />
                  
                  {isLoadingCustomers ? (
                    <div className="text-center py-4 text-gray-500">
                      Cargando clientes...
                    </div>
                  ) : filteredCustomers.length > 0 ? (
                    <div className="border rounded-lg max-h-60 overflow-y-auto">
                      {filteredCustomers.map((customer) => (
                        <div
                          key={customer.id}
                          onClick={() => handleSelectCliente(customer)}
                          className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                        >
                          <p className="font-medium">
                            {customer.nombre_completo || `${customer.firstName} ${customer.lastName}`.trim()}
                          </p>
                          <div className="flex gap-4 text-sm text-gray-600">
                            <span>📱 {customer.phone || 'Sin teléfono'}</span>
                            {customer.nit && <span>🆔 {customer.nit}</span>}
                            {customer.email && <span>📧 {customer.email}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 border rounded-lg">
                      {searchCliente ? 'No se encontraron clientes con ese criterio' : 'No hay clientes registrados'}
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    className="mt-3"
                    onClick={() => toast.add('Funcionalidad de registro pendiente', 'info')}
                  >
                    <Plus size={16} />
                    Registrar nuevo cliente
                  </Button>
                </div>
              )}

              {/* Vigencia */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Válida por (días)
                </label>
                <Input
                  type="number"
                  min="1"
                  value={formState.vigenciaDias}
                  onChange={(e: any) =>
                    setFormState({ ...formState, vigenciaDias: Number(e.target.value) })
                  }
                  className="w-32"
                />
              </div>
            </div>

            <div className="flex justify-end mt-8">
              <Button onClick={handleNext}>
                Siguiente
                <ArrowRight size={16} />
              </Button>
            </div>
          </Card>
        )}

        {/* Paso 2: Tipo y Productos */}
        {currentStep === 2 && (
          <div className="space-y-6">
            {/* Selector de tipo */}
            <Card className="p-6">
              <h3 className="text-xl font-bold mb-4">Tipo de Cotización</h3>
              <div className="flex gap-4">
                <button
                  onClick={() => setFormState({ ...formState, tipo: 'VENTA', items: [], manoDeObra: 0 })}
                  className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                    formState.tipo === 'VENTA'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <ShoppingBag size={32} className={`mx-auto mb-2 ${formState.tipo === 'VENTA' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <p className="font-bold">Venta</p>
                  <p className="text-sm text-gray-600">Productos del inventario</p>
                </button>

                <button
                  onClick={() => setFormState({ ...formState, tipo: 'REPARACION', items: [] })}
                  className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                    formState.tipo === 'REPARACION'
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <Wrench size={32} className={`mx-auto mb-2 ${formState.tipo === 'REPARACION' ? 'text-purple-600' : 'text-gray-400'}`} />
                  <p className="font-bold">Reparación</p>
                  <p className="text-sm text-gray-600">Repuestos + Mano de obra</p>
                </button>
              </div>
            </Card>

            {/* Items */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">
                  {formState.tipo === 'VENTA' ? 'Productos' : 'Repuestos'} de la cotización
                </h3>
                <div className="flex gap-2">
                  {formState.tipo === 'VENTA' ? (
                    <Button onClick={() => setShowProductoPicker(true)}>
                      <ShoppingBag size={16} />
                      Agregar Producto
                    </Button>
                  ) : (
                    <Button onClick={() => setShowRepuestoPicker(true)} className="bg-purple-600 hover:bg-purple-700">
                      <Package size={16} />
                      Desde Repuestos
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => setShowManualItemForm(true)}>
                    <Plus size={16} />
                    Línea Manual
                  </Button>
                </div>
              </div>

              {/* Formulario de línea manual */}
              {showManualItemForm && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <h4 className="font-semibold mb-3">Agregar Línea Manual</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Input
                      placeholder="Nombre del producto/servicio"
                      value={manualItem.nombre}
                      onChange={(e: any) => setManualItem({ ...manualItem, nombre: e.target.value })}
                    />
                    <Input
                      type="number"
                      placeholder="Cantidad"
                      min="1"
                      value={manualItem.cantidad}
                      onChange={(e: any) => setManualItem({ ...manualItem, cantidad: Number(e.target.value) })}
                    />
                    <Input
                      type="number"
                      placeholder="Precio unitario"
                      min="0"
                      step="0.01"
                      value={manualItem.precioUnit}
                      onChange={(e: any) => setManualItem({ ...manualItem, precioUnit: Number(e.target.value) })}
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleAddManualItem} size="sm">
                        Agregar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowManualItemForm(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                  {formState.tipo === 'VENTA' && (
                    <label className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        checked={manualItem.aplicarImpuestos}
                        onChange={(e) => setManualItem({ ...manualItem, aplicarImpuestos: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Aplicar impuestos (IVA 12%)</span>
                    </label>
                  )}
                </div>
              )}

              {/* Tabla de items */}
              {formState.items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3 text-sm font-semibold">Nombre</th>
                        <th className="text-center p-3 text-sm font-semibold">Cantidad</th>
                        <th className="text-right p-3 text-sm font-semibold">Precio Unit.</th>
                        <th className="text-right p-3 text-sm font-semibold">Subtotal</th>
                        {formState.tipo === 'VENTA' && <th className="text-center p-3 text-sm font-semibold">IVA</th>}
                        <th className="text-center p-3 text-sm font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {formState.items.map((item) => (
                        <tr key={item.id}>
                          <td className="p-3">
                            <div>
                              <p className="font-medium">{item.nombre}</p>
                              <Badge color={item.source === 'PRODUCTO' ? 'blue' : 'purple'} className="mt-1">
                                {item.source}
                              </Badge>
                            </div>
                          </td>
                          <td className="p-3">
                            <Input
                              type="number"
                              min="1"
                              value={item.cantidad}
                              onChange={(e: any) => handleUpdateItemCantidad(item.id!, Number(e.target.value))}
                              className="w-20 text-center"
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.precioUnit}
                              onChange={(e: any) => handleUpdateItemPrecio(item.id!, Number(e.target.value))}
                              className="w-28 text-right"
                            />
                          </td>
                          <td className="p-3 text-right font-semibold">{formatMoney(item.subtotal)}</td>
                          {formState.tipo === 'VENTA' && (
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={(item as any).aplicarImpuestos || false}
                                onChange={() => handleToggleItemImpuestos(item.id!)}
                                className="rounded"
                              />
                            </td>
                          )}
                          <td className="p-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveItem(item.id!)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Package size={64} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 dark:text-slate-400 mb-4">No hay productos agregados</p>
                  <p className="text-sm text-gray-500">
                    Agrega productos del catálogo o crea líneas manuales
                  </p>
                </div>
              )}

              {/* Mano de obra (solo para reparación) */}
              {formState.tipo === 'REPARACION' && (
                <div className="mt-6 p-4 bg-purple-50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mano de Obra (opcional)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.manoDeObra}
                    onChange={(e: any) => setFormState({ ...formState, manoDeObra: Number(e.target.value) })}
                    className="w-48"
                    placeholder="0.00"
                  />
                </div>
              )}
            </Card>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={handlePrev}>
                <ArrowLeft size={16} />
                Anterior
              </Button>
              <Button onClick={handleNext}>
                Siguiente
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Paso 3: Resumen */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-xl font-bold mb-6">Resumen de la Cotización</h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Cliente</p>
                    <p className="font-semibold">{formState.cliente?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Tipo</p>
                    <Badge color={formState.tipo === 'VENTA' ? 'blue' : 'purple'}>
                      {formState.tipo}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total de Items</p>
                    <p className="font-semibold">{formState.items.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Vigencia</p>
                    <p className="font-semibold">{formState.vigenciaDias} días</p>
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-semibold">{formatMoney(calcSubtotal())}</span>
                    </div>
                    {formState.tipo === 'REPARACION' && formState.manoDeObra > 0 && (
                      <div className="flex justify-between">
                        <span>Mano de Obra:</span>
                        <span className="font-semibold">{formatMoney(formState.manoDeObra)}</span>
                      </div>
                    )}
                    {calcImpuestos() > 0 && (
                      <div className="flex justify-between text-orange-600">
                        <span>Impuestos (IVA 12%):</span>
                        <span className="font-semibold">{formatMoney(calcImpuestos())}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-2xl font-bold text-blue-600 pt-2 border-t">
                      <span>TOTAL:</span>
                      <span>{formatMoney(calcTotal())}</span>
                    </div>
                  </div>
                </div>

                {/* Observaciones */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observaciones
                  </label>
                  <textarea
                    value={formState.observaciones}
                    onChange={(e) => setFormState({ ...formState, observaciones: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    rows={3}
                    placeholder="Notas adicionales sobre la cotización..."
                  />
                </div>
              </div>
            </Card>

            <div className="flex justify-between">
              <div className="flex gap-2">
                <Button variant="ghost" onClick={handlePrev}>
                  <ArrowLeft size={16} />
                  Anterior
                </Button>
                {formState.tipo === 'REPARACION' && (
                  <Button
                    variant="ghost"
                    onClick={handleConvertToRepair}
                    className="text-purple-600 hover:text-purple-700"
                  >
                    <Wrench size={16} />
                    Convertir a Reparación
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => navigate('/cotizaciones')}>
                  Cancelar
                </Button>
                <Button variant="ghost" onClick={() => handleSave(false)} disabled={isLoading}>
                  <Save size={16} />
                  Solo Guardar
                </Button>
                <Button onClick={() => handleSave(true)} disabled={isLoading}>
                  <Printer size={16} />
                  Guardar y Generar PDF
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modales */}
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
    </div>
  );
}
