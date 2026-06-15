import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, ShoppingBag, User, Package, DollarSign, Banknote, CreditCard, ArrowLeftRight, Plus, FileText, Search, Trash2, X } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import PaymentRow from '../../components/sales/PaymentRow';
import QuotePicker from '../../components/sales/QuotePicker';
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

interface PaymentRowData {
  id: string;
  metodo: Exclude<PaymentMethod, 'MIXTO'>;
  monto: number;
  referencia?: string;
  comprobanteUrl?: string;
}

export default function SaleNewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const { getQuoteById, updateQuoteStatus } = useQuotesStore();
  const { upsertSale } = useSales();

  // Tipo de origen: cotización o directa
  const [origenVenta, setOrigenVenta] = useState<'COTIZACION' | 'DIRECTA' | null>(null);
  const [showQuotePicker, setShowQuotePicker] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [cliente, setCliente] = useState<any>(null);
  const [subtotal, setSubtotal] = useState(0);
  const [impuestos, setImpuestos] = useState(0);
  const [total, setTotal] = useState(0);

  // Búsqueda de productos/repuestos
  const [tipoItem, setTipoItem] = useState<'PRODUCTO' | 'REPUESTO'>('PRODUCTO');
  const [searchTerm, setSearchTerm] = useState('');
  const [productos, setProductos] = useState<any[]>([]);
  const [repuestos, setRepuestos] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Búsqueda de clientes
  const [searchCliente, setSearchCliente] = useState('');
  const [clientes, setClientes] = useState<any[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);

  // Estados de pago
  const [metodo, setMetodo] = useState<PaymentMethod>('EFECTIVO');
  const [montoRecibido, setMontoRecibido] = useState(0);
  const [referencia, setReferencia] = useState('');
  const [comprobanteUrl, setComprobanteUrl] = useState('');
  const [pagosMixtos, setPagosMixtos] = useState<PaymentRowData[]>([
    { id: '1', metodo: 'EFECTIVO', monto: 0, referencia: '', comprobanteUrl: '' },
  ]);
  const [observaciones, setObservaciones] = useState('');

  // Nuevos estados para caja y bancos
  const [interesTarjeta, setInteresTarjeta] = useState(0); // Interés/recargo de POS
  const [bancoSeleccionado, setBancoSeleccionado] = useState(''); // Para transferencia/depósito
  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([]); // Lista de bancos
  const [montoEfectivo, setMontoEfectivo] = useState(0); // Para pago mixto
  const [montoBanco, setMontoBanco] = useState(0); // Para pago mixto

  const [confirmarPago, setConfirmarPago] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Cargar desde URL si viene from=quoteId
  useEffect(() => {
    const fromQuoteId = searchParams.get('from');
    if (fromQuoteId) {
      const quote = getQuoteById(fromQuoteId);
      console.log('Cotización cargada:', quote);
      
      // Verificar que la cotización esté en estado válido para conversión
      if (quote && quote.estado === 'ABIERTA') {
        setOrigenVenta('COTIZACION');
        setQuoteId(fromQuoteId);
        setCliente(quote.cliente || null);
        
        // Asegurar que items sea un array válido
        const itemsArray = Array.isArray(quote.items) ? quote.items : [];
        console.log('Items procesados:', itemsArray);
        setItems(itemsArray);
        
        setSubtotal(quote.subtotal || 0);
        setImpuestos(quote.impuestos || 0);
        setTotal(quote.total || 0);
        setMontoRecibido(quote.total || 0);
      } else {
        toast.add('Cotización no disponible para venta', 'error');
        navigate('/ventas');
      }
    }
  }, [searchParams, getQuoteById, navigate, toast]);

  // Cargar cuentas bancarias al inicio
  useEffect(() => {
    const loadCuentasBancarias = async () => {
      try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_URL}/caja/bancos`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
          setCuentasBancarias(data.data);
        }
      } catch (error) {
        console.error('Error cargando bancos:', error);
      }
    };
    loadCuentasBancarias();
  }, []);

  // Cargar productos/repuestos cuando se abre el selector o cambia la búsqueda
  useEffect(() => {
    if (!showProductSearch) return;
    loadItemsFromInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showProductSearch, searchTerm, tipoItem]);

  // Cargar clientes cuando se abre el selector o cambia la búsqueda
  useEffect(() => {
    if (!showCustomerPicker) return;
    loadClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCustomerPicker, searchCliente]);

  // Recalcular totales cuando cambien items
  useEffect(() => {
    const newSubtotal = items.reduce((sum, item) => sum + Number(item.subtotal), 0);
    const newImpuestos = 0; // Puedes agregar lógica de impuestos aquí
    const newTotal = newSubtotal + newImpuestos;
    
    setSubtotal(newSubtotal);
    setImpuestos(newImpuestos);
    setTotal(newTotal);
    setMontoRecibido(newTotal);
  }, [items]);

  // Cargar clientes desde la base de datos
  const loadClientes = async () => {
    setLoadingClientes(true);
    try {
      const query = searchCliente.trim();
      const limit = query ? 20 : 5;
      const response = await customerService.searchCustomers(query);
      console.log('Response completo:', response);
      
      // El backend devuelve { success: true, data: [...] }
      const clientesData = response.data || response.customers || response || [];
      console.log('Clientes procesados:', clientesData);
      setClientes(Array.isArray(clientesData) ? clientesData.slice(0, limit) : []);
    } catch (error) {
      console.error('Error cargando clientes:', error);
      toast.add('Error al cargar clientes', 'error');
      setClientes([]);
    } finally {
      setLoadingClientes(false);
    }
  };

  // Cargar items desde inventario
  const loadItemsFromInventory = async () => {
    setLoadingItems(true);
    try {
      const query = searchTerm.trim();
      const limit = query ? 20 : 5;

      if (tipoItem === 'PRODUCTO') {
        const response = await productService.getAllProducts({ 
          search: query,
          activo: true,
          limit 
        });
        console.log('Productos response:', response);
        // Backend devuelve { success: true, data: [...] }
        const productosData = response.data || response.productos || response || [];
        console.log('Productos procesados:', productosData);
        setProductos(Array.isArray(productosData) ? productosData.slice(0, limit) : []);
      } else {
        const response = await repuestoService.getAllRepuestos({ 
          searchTerm: query,
          activo: true,
          limit 
        });
        console.log('Repuestos response:', response);
        // Backend devuelve array directo
        setRepuestos(Array.isArray(response) ? response.slice(0, limit) : []);
      }
    } catch (error) {
      console.error('Error cargando items:', error);
      toast.add('Error al cargar items', 'error');
      setProductos([]);
      setRepuestos([]);
    } finally {
      setLoadingItems(false);
    }
  };

  // Calcular cambio
  const cambio = montoRecibido - total;

  // Calcular suma de pagos mixtos
  const sumaPagosMixtos = pagosMixtos.reduce((sum, p) => sum + Number(p.monto), 0);
  const restanteMixto = total - sumaPagosMixtos;

  // Handlers
  const handleSelectQuote = (quote: any) => {
    setOrigenVenta('COTIZACION');
    setQuoteId(quote.id);
    setCliente(quote.cliente);
    setItems(quote.items);
    setSubtotal(quote.subtotal);
    setImpuestos(quote.impuestos || 0);
    setTotal(quote.total);
    setMontoRecibido(quote.total);
    navigate(`/ventas/nueva?from=${quote.id}`, { replace: true });
  };

  const handleSelectCliente = (clienteSeleccionado: any) => {
    setCliente({
      id: clienteSeleccionado.id?.toString() || '',
      name: clienteSeleccionado.nombre
        ? `${clienteSeleccionado.nombre}${clienteSeleccionado.apellido ? ' ' + clienteSeleccionado.apellido : ''}`.trim()
        : `${clienteSeleccionado.firstName || ''} ${clienteSeleccionado.lastName || ''}`.trim(),
      phone: clienteSeleccionado.telefono || clienteSeleccionado.phone || '',
      email: clienteSeleccionado.correo || clienteSeleccionado.email || '',
      nit: clienteSeleccionado.nit || '',
      address: clienteSeleccionado.direccion || clienteSeleccionado.address || '',
    });
    setShowCustomerPicker(false);
    setSearchCliente('');
    setClientes([]);
    const _nombreToast = clienteSeleccionado.nombre
      ? `${clienteSeleccionado.nombre}${clienteSeleccionado.apellido ? ' ' + clienteSeleccionado.apellido : ''}`.trim()
      : `${clienteSeleccionado.firstName || ''} ${clienteSeleccionado.lastName || ''}`.trim();
    toast.add(`Cliente ${_nombreToast} seleccionado`, 'success');
  };

  const handleAddItem = (item: any) => {
    // Verificar si el item ya existe
    const existeItem = items.find(i => i.refId === item.id?.toString() && i.source === tipoItem);
    
    if (existeItem) {
      // Si ya existe, incrementar cantidad
      const newItems = items.map(i => {
        if (i.refId === item.id?.toString() && i.source === tipoItem) {
          const nuevaCantidad = i.cantidad + 1;
          return {
            ...i,
            cantidad: nuevaCantidad,
            subtotal: nuevaCantidad * i.precioUnit
          };
        }
        return i;
      });
      setItems(newItems);
      toast.add(`Cantidad de ${item.nombre} incrementada`, 'success');
    } else {
      // Si no existe, agregar nuevo item con ID único
      const precio = tipoItem === 'PRODUCTO' 
        ? Number(item.precio_venta) 
        : Number(repuestoService.centavosAQuetzales(item.precio_publico));
      
      const newItem: SaleItem = {
        id: `${tipoItem}-${item.id}-${Date.now()}`, // ID único
        refId: item.id?.toString() || item.sku,
        source: tipoItem,
        nombre: item.nombre,
        cantidad: 1,
        precioUnit: precio,
        subtotal: precio,
      };

      setItems([...items, newItem]);
      toast.add(`${item.nombre} agregado`, 'success');
    }
    
    setShowProductSearch(false);
    setSearchTerm('');
    setProductos([]);
    setRepuestos([]);
  };

  const handleUpdateCantidad = (index: number, cantidad: number) => {
    if (cantidad <= 0) return;
    
    const newItems = [...items];
    newItems[index].cantidad = Number(cantidad);
    newItems[index].subtotal = Number(cantidad) * Number(newItems[index].precioUnit);
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const handleMetodoChange = (newMetodo: PaymentMethod) => {
    setMetodo(newMetodo);
    setReferencia('');
    setComprobanteUrl('');
    
    setInteresTarjeta(0);
    if (newMetodo === 'MIXTO') {
      setPagosMixtos([
        { id: '1', metodo: 'EFECTIVO', monto: 0, referencia: '', comprobanteUrl: '' },
      ]);
    } else {
      setMontoRecibido(total);
    }
  };

  const handleComprobanteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setComprobanteUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Pagos mixtos
  const handleAddPago = () => {
    setPagosMixtos([
      ...pagosMixtos,
      {
        id: `${Date.now()}`,
        metodo: 'EFECTIVO',
        monto: restanteMixto > 0 ? restanteMixto : 0,
        referencia: '',
        comprobanteUrl: '',
      },
    ]);
  };

  const handleUpdatePago = (id: string, updates: Partial<PaymentRowData>) => {
    setPagosMixtos(pagosMixtos.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const handleRemovePago = (id: string) => {
    setPagosMixtos(pagosMixtos.filter(p => p.id !== id));
  };

  // Validación
  const validateSale = (): boolean => {
    // Validar que haya cliente (solo para ventas directas)
    if (origenVenta === 'DIRECTA' && !cliente) {
      toast.add('Debes seleccionar un cliente', 'error');
      return false;
    }

    // Validar que haya cotización (solo para ventas desde cotización)
    if (origenVenta === 'COTIZACION' && !quoteId) {
      toast.add('Debes seleccionar una cotización', 'error');
      return false;
    }

    if (items.length === 0) {
      toast.add('No hay items en la venta', 'error');
      return false;
    }

    if (!confirmarPago) {
      toast.add('Debes confirmar que has recibido el pago', 'error');
      return false;
    }

    // Validar según método
    if (metodo === 'EFECTIVO') {
      if (montoRecibido < total) {
        toast.add('El monto recibido debe ser mayor o igual al total', 'error');
        return false;
      }
    } else if (metodo === 'TRANSFERENCIA') {
      if (!referencia) {
        toast.add('Debes ingresar la referencia de la transferencia', 'error');
        return false;
      }
      if (!comprobanteUrl) {
        toast.add('Debes cargar el comprobante de transferencia', 'error');
        return false;
      }
    } else if (isCardMethod(metodo)) {
      if (!referencia || referencia.length < 4) {
        toast.add('Debes ingresar los últimos 4 dígitos de la tarjeta', 'error');
        return false;
      }
    } else if (metodo === 'MIXTO') {
      if (Math.abs(sumaPagosMixtos - total) > 0.01) {
        toast.add(`La suma de pagos (${formatMoney(sumaPagosMixtos)}) debe ser igual al total (${formatMoney(total)})`, 'error');
        return false;
      }

      // Validar campos según método de cada pago
      for (const pago of pagosMixtos) {
        if (pago.metodo === 'TRANSFERENCIA' && (!pago.referencia || !pago.comprobanteUrl)) {
          toast.add('Completa todos los campos de las transferencias', 'error');
          return false;
        }
        if (isCardMethod(pago.metodo) && (!pago.referencia || pago.referencia.length < 4)) {
          toast.add('Completa los últimos 4 dígitos de todas las tarjetas', 'error');
          return false;
        }
      }
    }

    return true;
  };

  // Concluir venta
  const handleConcluirVenta = async () => {
    if (!validateSale()) return;

    setIsLoading(true);
    try {
      // Calcular el total final considerando interés de tarjeta
      const interesMontoTarjeta = isCardMethod(metodo) && interesTarjeta > 0 
        ? total * (interesTarjeta / 100) 
        : 0;
      
      const totalConInteres = total + interesMontoTarjeta;

      // Preparar pagos
      let pagosArray: any[] = [];
      const now = new Date().toISOString();

      if (metodo === 'MIXTO') {
        pagosArray = pagosMixtos.map(p => ({
          metodo: p.metodo,
          monto: ventaService.quetzalesACentavos(p.monto),
          referencia: p.referencia || null,
          comprobante_url: p.comprobanteUrl || null,
          fecha: now,
          pos_seleccionado: getPosFromMethod(p.metodo),
          banco_id: p.metodo === 'TRANSFERENCIA' ? bancoSeleccionado : null,
        }));
      } else {
        // El banco recibe solo el monto base (sin el interés/recargo, que se lo queda el banco)
        const montoPago = metodo === 'EFECTIVO' ? montoRecibido : total;
        pagosArray = [{
          metodo,
          monto: ventaService.quetzalesACentavos(montoPago),
          referencia: referencia || null,
          comprobante_url: comprobanteUrl || null,
          fecha: now,
          pos_seleccionado: getPosFromMethod(metodo),
          banco_id: metodo === 'TRANSFERENCIA' ? bancoSeleccionado : null,
          interes_porcentaje: isCardMethod(metodo) ? interesTarjeta : null,
          interes_monto: isCardMethod(metodo) ? interesMontoTarjeta : null,
        }];
      }

      let ventaCreada;

      if (origenVenta === 'COTIZACION' && quoteId) {
        // Crear venta desde cotización (el backend actualiza automáticamente la cotización)
        console.log('Creando venta desde cotización:', quoteId);
        
        ventaCreada = await ventaService.createVentaFromQuote(
          parseInt(quoteId),
          {
            pagos: pagosArray,
            metodo_pago: pagosArray.length === 1 ? pagosArray[0].metodo : 'MIXTO',
            observaciones: observaciones || null
          }
        );
        
        // Actualizar estado local de la cotización
        updateQuoteStatus(quoteId, 'CERRADA');
        
        toast.add('✅ Venta creada exitosamente desde cotización', 'success');
      } else {
        // Crear venta directa
        console.log('Creando venta directa');
        
        // Preparar items para el backend
        const itemsParaBackend = items.map(item => ({
          source: item.source,
          ref_id: parseInt(item.refId),
          nombre: item.nombre,
          cantidad: item.cantidad,
          precio_unitario: ventaService.quetzalesACentavos(item.precioUnit),
          subtotal: ventaService.quetzalesACentavos(item.subtotal),
        }));

        ventaCreada = await ventaService.createVenta({
          cliente_id: cliente.id ? parseInt(cliente.id) : null,
          cliente_nombre: cliente.name,
          cliente_telefono: cliente.phone || null,
          cliente_email: cliente.email || null,
          cliente_nit: cliente.nit || null,
          items: itemsParaBackend,
          subtotal: ventaService.quetzalesACentavos(subtotal),
          impuestos: ventaService.quetzalesACentavos(impuestos || 0),
          total: ventaService.quetzalesACentavos(totalConInteres), // Total con interés incluido
          monto_pagado: ventaService.quetzalesACentavos(totalConInteres), // Venta pagada al momento
          metodo_pago: pagosArray.length === 1 ? pagosArray[0].metodo : 'MIXTO',
          pagos: pagosArray,
          interes_tarjeta: isCardMethod(metodo) ? interesMontoTarjeta : 0,
        });
        
        toast.add('✅ Venta directa creada exitosamente', 'success');
      }

      console.log('Venta creada:', ventaCreada);

      // Actualizar store local también
      const payments: Payment[] = pagosArray.map(p => ({
        metodo: p.metodo,
        monto: ventaService.centavosAQuetzales(p.monto),
        referencia: p.referencia,
        comprobanteUrl: p.comprobante_url,
        fecha: p.fecha,
      }));

      upsertSale({
        quoteId: origenVenta === 'COTIZACION' ? quoteId! : undefined,
        cliente,
        items,
        subtotal,
        impuestos,
        total,
        payments,
        estado: 'PAGADA',
      });

      // Navegar a la lista de ventas
      setTimeout(() => {
        navigate('/ventas');
      }, 1500);
    } catch (error: any) {
      console.error('Error al registrar la venta:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Error al registrar la venta';
      toast.add(`❌ ${errorMsg}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Si no hay origen seleccionado, mostrar opciones
  if (!origenVenta && !searchParams.get('from')) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-6">
          <Card className="max-w-3xl mx-auto p-12">
            <ShoppingBag size={64} className="mx-auto text-green-600 mb-4" />
            <h2 className="text-2xl font-bold mb-2 text-center">Nueva Venta</h2>
            <p className="text-gray-600 dark:text-slate-400 mb-8 text-center">
              Selecciona cómo deseas crear la venta
            </p>
            
            <div className="grid grid-cols-2 gap-6">
              <button
                onClick={() => {
                  setOrigenVenta('DIRECTA');
                  setShowCustomerPicker(true);
                }}
                className="p-8 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all group"
              >
                <Package size={48} className="mx-auto text-gray-400 group-hover:text-green-600 mb-4" />
                <h3 className="font-semibold text-lg mb-2">Venta Directa</h3>
                <p className="text-sm text-gray-600">
                  Selecciona productos o repuestos del inventario
                </p>
              </button>

              <button
                onClick={() => {
                  setOrigenVenta('COTIZACION');
                  setShowQuotePicker(true);
                }}
                className="p-8 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                <FileText size={48} className="mx-auto text-gray-400 group-hover:text-blue-600 mb-4" />
                <h3 className="font-semibold text-lg mb-2">Desde Cotización</h3>
                <p className="text-sm text-gray-600">
                  Convierte una cotización existente en venta
                </p>
              </button>
            </div>
          </Card>
        </div>

        <QuotePicker
          open={showQuotePicker}
          onClose={() => {
            setShowQuotePicker(false);
            setOrigenVenta(null);
          }}
          onSelect={handleSelectQuote}
          allowedType="VENTA"
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/ventas')}>
              <ArrowLeft size={20} />
            </Button>
            <PageHeader
              title="Nueva Venta"
              subtitle="Concluir venta desde cotización"
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Banner origen */}
        {quoteId && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="text-blue-600" size={24} />
              <div>
                <p className="font-semibold text-blue-900">
                  Venta basada en cotización
                </p>
                <p className="text-sm text-blue-700">
                  Al concluir, la cotización se cerrará automáticamente
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/cotizaciones/${quoteId}`)}
            >
              Ver Cotización
            </Button>
          </div>
        )}

        {/* A) Cliente */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <User className="text-green-600" size={24} />
              <h3 className="text-xl font-bold">Cliente</h3>
            </div>
            
            {origenVenta === 'DIRECTA' && (
              <Button 
                onClick={() => setShowCustomerPicker(true)} 
                size="sm"
                variant="ghost"
              >
                <Search size={16} />
                {cliente ? 'Cambiar Cliente' : 'Seleccionar Cliente'}
              </Button>
            )}
          </div>
          
          {!cliente ? (
            <div className="text-center py-8 text-gray-500">
              <User size={48} className="mx-auto mb-3 opacity-30" />
              <p>No hay cliente seleccionado</p>
              {origenVenta === 'DIRECTA' && (
                <Button onClick={() => setShowCustomerPicker(true)} variant="ghost" className="mt-4">
                  Seleccionar Cliente
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Nombre</p>
                <p className="font-semibold">{cliente?.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Teléfono</p>
                <p className="font-semibold">{cliente?.phone}</p>
              </div>
              {cliente?.email && (
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-semibold">{cliente.email}</p>
                </div>
              )}
              {cliente?.nit && (
                <div>
                  <p className="text-sm text-gray-500">NIT</p>
                  <p className="font-semibold">{cliente.nit}</p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* B) Items de la venta */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Package className="text-green-600" size={24} />
              <h3 className="text-xl font-bold">Items de la Venta</h3>
            </div>
            
            {origenVenta === 'DIRECTA' && (
              <Button onClick={() => setShowProductSearch(true)} size="sm">
                <Plus size={16} />
                Agregar Item
              </Button>
            )}
          </div>

          {!Array.isArray(items) || items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package size={48} className="mx-auto mb-3 opacity-30" />
              <p>No hay items agregados</p>
              {origenVenta === 'DIRECTA' && (
                <Button onClick={() => setShowProductSearch(true)} variant="ghost" className="mt-4">
                  Agregar primer item
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 text-sm font-semibold">Cant.</th>
                    <th className="text-left p-3 text-sm font-semibold">Descripción</th>
                    <th className="text-right p-3 text-sm font-semibold">P. Unit.</th>
                    <th className="text-right p-3 text-sm font-semibold">Subtotal</th>
                    {origenVenta === 'DIRECTA' && (
                      <th className="text-center p-3 text-sm font-semibold">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td className="p-3">
                        {origenVenta === 'DIRECTA' ? (
                          <Input
                            type="number"
                            min="1"
                            value={item.cantidad}
                            onChange={(e) => handleUpdateCantidad(index, parseInt(e.target.value) || 1)}
                            className="w-20 text-center"
                          />
                        ) : (
                          <span className="text-center font-medium block">{item.cantidad}</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{item.nombre}</p>
                          <Badge color={item.source === 'PRODUCTO' ? 'blue' : 'purple'} className="mt-1">
                            {item.source}
                          </Badge>
                        </div>
                      </td>
                      <td className="p-3 text-right">{formatMoney(item.precioUnit)}</td>
                      <td className="p-3 text-right font-semibold">{formatMoney(item.subtotal)}</td>
                      {origenVenta === 'DIRECTA' && (
                        <td className="p-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* C) Totales */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="text-green-600" size={24} />
            <h3 className="text-xl font-bold">Totales</h3>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-lg">
              <span>Subtotal:</span>
              <span className="font-semibold">{formatMoney(subtotal)}</span>
            </div>
            {impuestos > 0 && (
              <div className="flex justify-between text-lg text-orange-600">
                <span>Impuestos:</span>
                <span className="font-semibold">{formatMoney(impuestos)}</span>
              </div>
            )}
            <div className="flex justify-between text-2xl font-bold text-green-600 pt-2 border-t">
              <span>TOTAL:</span>
              <span>{formatMoney(total)}</span>
            </div>
          </div>
        </Card>

        {/* D) Pago */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Banknote className="text-green-600" size={24} />
            <h3 className="text-xl font-bold">Método de Pago</h3>
          </div>

          {/* Selector de método */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <button
              onClick={() => handleMetodoChange('EFECTIVO')}
              className={`p-4 rounded-lg border-2 transition-all ${
                metodo === 'EFECTIVO'
                  ? 'border-green-600 bg-green-50'
                  : 'border-gray-200 hover:border-green-300'
              }`}
            >
              <Banknote size={24} className={`mx-auto mb-2 ${metodo === 'EFECTIVO' ? 'text-green-600' : 'text-gray-400'}`} />
              <p className="font-bold text-sm">Efectivo</p>
            </button>

            <button
              onClick={() => handleMetodoChange('TARJETA_BAC')}
              className={`p-4 rounded-lg border-2 transition-all ${
                metodo === 'TARJETA_BAC'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <CreditCard size={24} className={`mx-auto mb-2 ${metodo === 'TARJETA_BAC' ? 'text-blue-600' : 'text-gray-400'}`} />
              <p className="font-bold text-sm">Tarjeta BAC</p>
            </button>

            <button
              onClick={() => handleMetodoChange('TARJETA_NEONET')}
              className={`p-4 rounded-lg border-2 transition-all ${
                metodo === 'TARJETA_NEONET'
                  ? 'border-cyan-600 bg-cyan-50'
                  : 'border-gray-200 hover:border-cyan-300'
              }`}
            >
              <CreditCard size={24} className={`mx-auto mb-2 ${metodo === 'TARJETA_NEONET' ? 'text-cyan-600' : 'text-gray-400'}`} />
              <p className="font-bold text-sm">Tarjeta Neonet</p>
            </button>

            <button
              onClick={() => handleMetodoChange('TRANSFERENCIA')}
              className={`p-4 rounded-lg border-2 transition-all ${
                metodo === 'TRANSFERENCIA'
                  ? 'border-purple-600 bg-purple-50'
                  : 'border-gray-200 hover:border-purple-300'
              }`}
            >
              <ArrowLeftRight size={24} className={`mx-auto mb-2 ${metodo === 'TRANSFERENCIA' ? 'text-purple-600' : 'text-gray-400'}`} />
              <p className="font-bold text-sm">Transferencia</p>
            </button>

            <button
              onClick={() => handleMetodoChange('MIXTO')}
              className={`p-4 rounded-lg border-2 transition-all ${
                metodo === 'MIXTO'
                  ? 'border-orange-600 bg-orange-50'
                  : 'border-gray-200 hover:border-orange-300'
              }`}
            >
              <div className="flex gap-1 justify-center mb-2">
                <Banknote size={18} className={metodo === 'MIXTO' ? 'text-orange-600' : 'text-gray-400'} />
                <CreditCard size={18} className={metodo === 'MIXTO' ? 'text-orange-600' : 'text-gray-400'} />
              </div>
              <p className="font-bold text-sm">Mixto</p>
            </button>
          </div>

          {/* Campos según método */}
          {metodo === 'EFECTIVO' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monto Recibido <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min={total}
                    step="0.01"
                    value={montoRecibido}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMontoRecibido(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cambio
                  </label>
                  <div className={`px-4 py-2 rounded-lg border-2 ${cambio >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <p className={`text-xl font-bold ${cambio >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatMoney(cambio)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {metodo === 'TRANSFERENCIA' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monto
                </label>
                <Input
                  type="number"
                  value={total}
                  disabled
                  className="bg-gray-100"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Banco de Destino <span className="text-red-500">*</span>
                </label>
                <Select
                  value={bancoSeleccionado}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBancoSeleccionado(e.target.value)}
                >
                  <option value="">Seleccione un banco...</option>
                  {cuentasBancarias.map((banco) => (
                    <option key={banco.id} value={banco.id}>
                      {banco.nombre}
                    </option>
                  ))}
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de Voucher / Referencia <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={referencia}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReferencia(e.target.value)}
                  placeholder="Ej: TRF123456789"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comprobante (Imagen)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleComprobanteChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />
              </div>
              
              {comprobanteUrl && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Vista previa:</p>
                  <img
                    src={comprobanteUrl}
                    alt="Comprobante"
                    className="h-40 rounded border"
                  />
                </div>
              )}
              
              {bancoSeleccionado && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <p className="text-sm text-purple-800">
                    ℹ️ El monto se registrará en la cuenta: <strong>{cuentasBancarias.find(b => b.id === parseInt(bancoSeleccionado))?.nombre}</strong>
                  </p>
                </div>
              )}
            </div>
          )}

          {isCardMethod(metodo) && (
            <div className="space-y-4">
              <div className={`rounded-lg p-3 border ${metodo === 'TARJETA_BAC' ? 'bg-blue-50 border-blue-200' : 'bg-cyan-50 border-cyan-200'}`}>
                <p className={`text-sm font-semibold ${metodo === 'TARJETA_BAC' ? 'text-blue-800' : 'text-cyan-800'}`}>
                  💳 {metodo === 'TARJETA_BAC' ? 'POS BAC — Cuenta BAC' : metodo === 'TARJETA_NEONET' ? 'POS NEONET — Banco Industrial' : 'Tarjeta — cuenta por confirmar'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Interés/Recargo del POS (%)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={interesTarjeta}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInteresTarjeta(Number(e.target.value))}
                  placeholder="Ej: 3.5"
                />
                <p className="text-xs text-gray-500 mt-1">Recargo que cobra el banco. Se sumará al total.</p>
              </div>

              {interesTarjeta > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Subtotal</label>
                    <div className="px-4 py-2 bg-gray-100 rounded-lg">
                      <p className="text-lg font-bold text-gray-700">{formatMoney(total)}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Interés ({interesTarjeta}%)</label>
                    <div className="px-4 py-2 bg-orange-50 rounded-lg border border-orange-200">
                      <p className="text-lg font-bold text-orange-600">+{formatMoney(total * (interesTarjeta / 100))}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-blue-100 border-2 border-blue-300 rounded-lg p-4">
                <label className="block text-sm font-medium text-blue-900 mb-1">Total a Cobrar (con interés)</label>
                <p className="text-3xl font-bold text-blue-700">{formatMoney(total + (total * (interesTarjeta / 100)))}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Últimos 4 dígitos / Referencia <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  maxLength={20}
                  value={referencia}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReferencia(e.target.value)}
                  placeholder="1234"
                />
              </div>
            </div>
          )}

          {metodo === 'MIXTO' && (
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-orange-800 font-semibold">
                  Total a pagar: {formatMoney(total)}
                </p>
              </div>

              {/* Monto en efectivo */}
              <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Banknote className="text-green-600" size={20} />
                  <h4 className="font-bold text-green-800">Efectivo</h4>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monto en efectivo
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max={total}
                    step="0.01"
                    value={montoEfectivo}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const valor = Number(e.target.value);
                      setMontoEfectivo(valor);
                      setMontoBanco(total - valor);
                    }}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Monto en banco */}
              <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="text-blue-600" size={20} />
                  <h4 className="font-bold text-blue-800">Banco / Tarjeta</h4>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monto en banco
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max={total}
                      step="0.01"
                      value={montoBanco}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const valor = Number(e.target.value);
                        setMontoBanco(valor);
                        setMontoEfectivo(total - valor);
                      }}
                      placeholder="0.00"
                    />
                  </div>
                  
                  {montoBanco > 0 && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Seleccione cuenta bancaria / POS <span className="text-red-500">*</span>
                        </label>
                        <Select
                          value={bancoSeleccionado}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBancoSeleccionado(e.target.value)}
                        >
                          <option value="">Seleccione...</option>
                          <optgroup label="POS">
                            <option value="pos_bac">POS BAC (BAC)</option>
                            <option value="pos_neonet">POS NEONET (Banco Industrial)</option>
                          </optgroup>
                          <optgroup label="Transferencias/Depósitos">
                            {cuentasBancarias.map((banco) => (
                              <option key={banco.id} value={banco.id}>
                                {banco.nombre}
                              </option>
                            ))}
                          </optgroup>
                        </Select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Referencia / Voucher
                        </label>
                        <Input
                          type="text"
                          value={referencia}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReferencia(e.target.value)}
                          placeholder="Número de referencia"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Resumen */}
              <div className="bg-gray-100 rounded-lg p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Efectivo:</span>
                  <span className="font-semibold text-green-600">{formatMoney(montoEfectivo)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Banco:</span>
                  <span className="font-semibold text-blue-600">{formatMoney(montoBanco)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2 pb-2 border-b">
                  <span>Suma:</span>
                  <span className="font-semibold">{formatMoney(montoEfectivo + montoBanco)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2">
                  <span>Total a pagar:</span>
                  <span className={Math.abs((montoEfectivo + montoBanco) - total) < 0.01 ? 'text-green-600' : 'text-red-600'}>
                    {formatMoney(total)}
                  </span>
                </div>
                {Math.abs((montoEfectivo + montoBanco) - total) >= 0.01 && (
                  <p className="text-xs text-red-600 mt-2">
                    ⚠️ La suma de efectivo + banco debe ser igual al total
                  </p>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* E) Confirmación */}
        <Card className="p-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmarPago}
              onChange={(e) => setConfirmarPago(e.target.checked)}
              className="mt-1 rounded"
            />
            <div>
              <p className="font-semibold">Confirmo que he recibido el pago total</p>
              <p className="text-sm text-gray-600">
                Al marcar esta casilla y concluir, se creará la venta y se cerrará la cotización
              </p>
            </div>
          </label>
        </Card>

        {/* Footer */}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => navigate('/ventas')}>
            Cancelar
          </Button>
          <Button
            onClick={handleConcluirVenta}
            disabled={isLoading || !confirmarPago}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save size={16} />
            {isLoading ? 'Procesando...' : 'Concluir Venta'}
          </Button>
        </div>
      </div>

      {/* Modal de búsqueda de productos/repuestos */}
      <Modal
        open={showProductSearch}
        onClose={() => {
          setShowProductSearch(false);
          setSearchTerm('');
          setProductos([]);
          setRepuestos([]);
        }}
        title="Agregar Item"
      >
        <div className="space-y-4">
          {/* Selector de tipo */}
          <div className="flex gap-2">
            <Button
              variant={tipoItem === 'PRODUCTO' ? 'default' : 'ghost'}
              onClick={() => setTipoItem('PRODUCTO')}
              className="flex-1"
            >
              <Package size={16} />
              Productos
            </Button>
            <Button
              variant={tipoItem === 'REPUESTO' ? 'default' : 'ghost'}
              onClick={() => setTipoItem('REPUESTO')}
              className="flex-1"
            >
              <Package size={16} />
              Repuestos
            </Button>
          </div>

          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={20} />
            <Input
              placeholder={`Buscar ${tipoItem === 'PRODUCTO' ? 'producto' : 'repuesto'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Resultados */}
          {loadingItems && (
            <div className="text-center py-8 text-gray-500">
              Buscando...
            </div>
          )}

          {!loadingItems && (
            <div className="max-h-96 overflow-y-auto space-y-2">
              {tipoItem === 'PRODUCTO' && productos.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No se encontraron productos
                </div>
              )}
              
              {tipoItem === 'PRODUCTO' && productos.map((producto) => (
                <button
                  key={producto.id}
                  onClick={() => handleAddItem(producto)}
                  className="w-full p-4 border rounded-lg hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-semibold">{producto.nombre}</p>
                      <p className="text-sm text-gray-600">{producto.sku}</p>
                      {producto.categoria && (
                        <Badge color="blue" className="mt-1">{producto.categoria}</Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{formatMoney(producto.precio_venta)}</p>
                      <p className="text-xs text-gray-500">Stock: {producto.stock || 0}</p>
                    </div>
                  </div>
                </button>
              ))}

              {tipoItem === 'REPUESTO' && repuestos.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No se encontraron repuestos
                </div>
              )}

              {tipoItem === 'REPUESTO' && repuestos.map((repuesto) => (
                <button
                  key={repuesto.id}
                  onClick={() => handleAddItem(repuesto)}
                  className="w-full p-4 border rounded-lg hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-semibold">{repuesto.nombre}</p>
                      <p className="text-sm text-gray-600">{repuesto.marca} - {repuesto.tipo}</p>
                      {repuesto.linea && (
                        <Badge color="purple" className="mt-1">{repuesto.linea}</Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">
                        {repuestoService.formatearPrecio(repuesto.precio_publico)}
                      </p>
                      <p className="text-xs text-gray-500">Stock: {repuesto.stock || 0}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

        </div>
      </Modal>

      {/* Modal de selección de cliente */}
      <Modal
        open={showCustomerPicker}
        onClose={() => {
          setShowCustomerPicker(false);
          setSearchCliente('');
          setClientes([]);
        }}
        title="Seleccionar Cliente"
      >
        <div className="space-y-4">
          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={20} />
            <Input
              placeholder="Buscar por nombre, teléfono, NIT o correo..."
              value={searchCliente}
              onChange={(e) => setSearchCliente(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Resultados */}
          {loadingClientes && (
            <div className="text-center py-8 text-gray-500">
              Buscando clientes...
            </div>
          )}

          {!loadingClientes && (
            <div className="max-h-96 overflow-y-auto space-y-2">
              {clientes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <User size={48} className="mx-auto mb-3 opacity-30" />
                  <p>No se encontraron clientes</p>
                </div>
              ) : (
                clientes.map((clienteItem) => (
                  <button
                    key={clienteItem.id}
                    onClick={() => handleSelectCliente(clienteItem)}
                    className="w-full p-4 border rounded-lg hover:bg-gray-50 text-left transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold">
                          {clienteItem.nombre
                            ? `${clienteItem.nombre}${clienteItem.apellido ? ' ' + clienteItem.apellido : ''}`.trim()
                            : `${clienteItem.firstName || ''} ${clienteItem.lastName || ''}`.trim()}
                        </p>
                        <div className="text-sm text-gray-600 space-y-1 mt-1">
                          {(clienteItem.telefono || clienteItem.phone) && (
                            <p>📱 {clienteItem.telefono || clienteItem.phone}</p>
                          )}
                          {(clienteItem.correo || clienteItem.email) && (
                            <p>📧 {clienteItem.correo || clienteItem.email}</p>
                          )}
                          {clienteItem.nit && (
                            <p>🆔 NIT: {clienteItem.nit}</p>
                          )}
                        </div>
                        {clienteItem.frecuente && (
                          <Badge color="yellow" className="mt-2">Cliente Frecuente</Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

        </div>
      </Modal>
    </div>
  );
}
