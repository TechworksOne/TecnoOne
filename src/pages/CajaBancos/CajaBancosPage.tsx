import { useState, useEffect, useCallback } from 'react';
import {
  Wallet, Building2, Plus, Check, Clock, X,
  ArrowUpCircle, ArrowDownCircle, ArrowRightLeft,
  RefreshCw, AlertCircle, TrendingUp, TrendingDown,
  CreditCard, Banknote, Search, Filter, ChevronDown,
  ShieldCheck, Landmark, FileText, Pencil, Trash2, Eye
} from 'lucide-react';
import API_URL from '../../services/config';
import { useAuth } from '../../store/useAuth';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import axios from 'axios';
import { useToast } from '../../components/ui/Toast';
import * as TarjetaService from '../../services/tarjetaCreditoService';
import type { TarjetaCredito, TarjetaMovimiento, TarjetaForm, PagoTarjetaForm } from '../../services/tarjetaCreditoService';

interface CuentaBancaria {
  id: number;
  nombre: string;
  numero_cuenta: string;
  tipo_cuenta: string;
  saldo_actual?: number;
  pos_asociado: string | null;
  activa: boolean;
}

interface Movimiento {
  id: number;
  cuenta_id?: number;
  tipo_movimiento: 'INGRESO' | 'EGRESO';
  monto: number;
  concepto: string;
  categoria: string;
  estado: 'PENDIENTE' | 'CONFIRMADO' | 'ANULADO';
  referencia_tipo?: string;
  referencia_id?: string;
  fecha_movimiento: string;
  realizado_por: string;
  cuenta_nombre?: string;
  venta_id?: string;
  numero_referencia?: string;
  confirmado_en?: string;
  confirmado_por_nombre?: string;
}

export default function CajaBancosPage() {
  const toast = useToast();
  const [saldoCajaChica, setSaldoCajaChica] = useState({ saldo: 0, ingresos: 0, egresos: 0, pendientes: 0 });
  const [cuentasBancarias, setCuentasBancarias] = useState<CuentaBancaria[]>([]);
  const [movimientosCaja, setMovimientosCaja] = useState<Movimiento[]>([]);
  const [movimientosBancos, setMovimientosBancos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vistaActual, setVistaActual] = useState<'caja' | 'bancos' | 'tarjetas'>('caja');

  // ── Tarjetas de Crédito ─────────────────────────────────────────────────
  const [tarjetas, setTarjetas] = useState<TarjetaCredito[]>([]);
  const [loadingTarjetas, setLoadingTarjetas] = useState(false);
  const [showTarjetaModal, setShowTarjetaModal] = useState(false);
  const [tarjetaEditando, setTarjetaEditando] = useState<TarjetaCredito | null>(null);
  const [tarjetaForm, setTarjetaForm] = useState<TarjetaForm>({
    banco: '', alias: '', ultimos4: '', tasa_interes: 0,
    dia_corte: 1, dia_pago: 15, limite_credito: 0, moneda: 'GTQ', notas: ''
  });
  const [savingTarjeta, setSavingTarjeta] = useState(false);
  const [tarjetaDetalle, setTarjetaDetalle] = useState<TarjetaCredito | null>(null);
  const [movsTarjeta, setMovsTarjeta] = useState<TarjetaMovimiento[]>([]);
  const [loadingMovsTarjeta, setLoadingMovsTarjeta] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [tarjetaAPagar, setTarjetaAPagar] = useState<TarjetaCredito | null>(null);
  const [pagoForm, setPagoForm] = useState<PagoTarjetaForm>({ tipo_cuenta_origen: 'caja', monto: 0 });
  const [savingPago, setSavingPago] = useState(false);
  const [estadoFiltro, setEstadoFiltro] = useState<'PENDIENTE' | 'CONFIRMADO' | 'ANULADO'>('PENDIENTE');

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<'TODOS' | 'INGRESO' | 'EGRESO'>('TODOS');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  // Modal registrar movimiento
  const [showModal, setShowModal] = useState(false);
  const [tipoMovimiento, setTipoMovimiento] = useState<'GASTO' | 'RETIRO' | 'DEPOSITO' | 'TRANSFERENCIA' | 'INGRESO_MANUAL' | 'RETIRO_BANCO'>('GASTO');
  const [monto, setMonto] = useState('');
  const [concepto, setConcepto] = useState('');
  const [cuentaDestino, setCuentaDestino] = useState('');
  const [cuentaOrigen, setCuentaOrigen] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [aCajaChica, setACajaChica] = useState(false);

  // Banco CRUD (admin)
  const [showBancoModal, setShowBancoModal] = useState(false);
  const [bancoEditando, setBancoEditando] = useState<CuentaBancaria | null>(null);
  const [bancoForm, setBancoForm] = useState({ nombre: '', numero_cuenta: '', tipo_cuenta: 'Corriente', pos_asociado: '' });
  const [savingBanco, setSavingBanco] = useState(false);
  const [showDesactivarModal, setShowDesactivarModal] = useState(false);
  const [bancoADesactivar, setBancoADesactivar] = useState<CuentaBancaria | null>(null);

  // Modal confirmación
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [movimientoAConfirmar, setMovimientoAConfirmar] = useState<{ id: number; tipo: 'caja' | 'banco'; mov: Movimiento } | null>(null);

  // Destino del ingreso manual
  const [ingresoDestino, setIngresoDestino] = useState<'caja' | 'banco'>('caja');

  // Historial por cuenta bancaria
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<CuentaBancaria | null>(null);
  const [cuentaStats, setCuentaStats] = useState<{ ingresos: number; egresos: number; saldo: number } | null>(null);
  const [periodoHistorial, setPeriodoHistorial] = useState<'mes' | 'mes_anterior' | 'todo'>('todo');
  const [loadingCuentaStats, setLoadingCuentaStats] = useState(false);
  const [movsHistorial, setMovsHistorial] = useState<Movimiento[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Auth – definir antes de loadData para que el closure lo capture
  const { user, hasModule } = useAuth();
  const hasTarjetasModule = hasModule('tarjetas');
  const isAdmin = user?.role === 'admin' || user?.rol === 'admin' ||
    user?.role === 'ADMIN' || user?.rol === 'ADMIN' ||
    (Array.isArray((user as any)?.roles) && ((user as any).roles.includes('ADMINISTRADOR') || (user as any).roles.includes('admin') || (user as any).roles.includes('ADMIN')));

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!hasTarjetasModule && vistaActual === 'tarjetas') {
      setVistaActual('caja');
      setTarjetas([]);
      setTarjetaDetalle(null);
      setMovsTarjeta([]);
      setShowTarjetaModal(false);
      setShowPagoModal(false);
    }
  }, [hasTarjetasModule, vistaActual]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = sessionStorage.getItem('token');

      if (!token) {
        window.location.href = '/login';
        return;
      }

      const config = { headers: { Authorization: `Bearer ${token}` } };

      const cajaSaldo = await axios.get(`${API_URL}/caja/caja-chica/saldo`, config);
      setSaldoCajaChica(cajaSaldo.data.data);

      const cajaMovs = await axios.get(`${API_URL}/caja/caja-chica/movimientos`, config);
      setMovimientosCaja(cajaMovs.data.data);

      // Cargar cuentas bancarias para todos los usuarios (no admin recibe datos sin saldo)
      const bancos = await axios.get(`${API_URL}/caja/bancos`, config);
      setCuentasBancarias(bancos.data.data);

      if (isAdmin) {
        const bancosMovs = await axios.get(`${API_URL}/caja/bancos/movimientos`, config);
        setMovimientosBancos(bancosMovs.data.data);
      }

    } catch (err: any) {
      console.error('Error loading data:', err);
      if (err.response?.status === 401) {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        window.location.href = '/login';
      } else {
        setError('Error al cargar los datos. Intenta actualizar la página.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Tarjetas helpers ─────────────────────────────────────────────────────
  const cargarTarjetas = useCallback(async () => {
    if (!hasTarjetasModule) {
      setTarjetas([]);
      return;
    }

    setLoadingTarjetas(true);
    try { setTarjetas(await TarjetaService.getTarjetas()); } catch { toast.error('Error al cargar tarjetas'); }
    finally { setLoadingTarjetas(false); }
  }, [hasTarjetasModule, toast]);

  const handleGuardarTarjeta = async () => {
    setSavingTarjeta(true);
    try {
      const payload: TarjetaForm = {
        ...tarjetaForm,
        limite_credito: Math.round((Number(tarjetaForm.limite_credito) || 0) * 100),
      };
      if (tarjetaEditando) await TarjetaService.updateTarjeta(tarjetaEditando.id, payload);
      else await TarjetaService.createTarjeta(payload);
      toast.success(tarjetaEditando ? 'Tarjeta actualizada' : 'Tarjeta creada');
      setShowTarjetaModal(false);
      cargarTarjetas();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Error al guardar tarjeta');
    } finally { setSavingTarjeta(false); }
  };

  const handlePagarTarjeta = async () => {
    if (!tarjetaAPagar) return;
    setSavingPago(true);
    try {
      const payload: PagoTarjetaForm = {
        ...pagoForm,
        monto: Math.round((Number(pagoForm.monto) || 0) * 100),
      };
      await TarjetaService.registrarPago(tarjetaAPagar.id, payload);
      toast.success('Pago registrado exitosamente');
      setShowPagoModal(false);
      cargarTarjetas();
      if (tarjetaDetalle?.id === tarjetaAPagar.id) {
        setMovsTarjeta(await TarjetaService.getMovimientos(tarjetaAPagar.id));
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Error al registrar pago');
    } finally { setSavingPago(false); }
  };

  const abrirModalBanco = (cuenta?: CuentaBancaria) => {
    if (cuenta) {
      setBancoEditando(cuenta);
      setBancoForm({
        nombre: cuenta.nombre,
        numero_cuenta: cuenta.numero_cuenta || '',
        tipo_cuenta: cuenta.tipo_cuenta || 'Corriente',
        pos_asociado: cuenta.pos_asociado || '',
      });
    } else {
      setBancoEditando(null);
      setBancoForm({ nombre: '', numero_cuenta: '', tipo_cuenta: 'Corriente', pos_asociado: '' });
    }
    setShowBancoModal(true);
  };

  const handleGuardarBanco = async () => {
    if (!bancoForm.nombre.trim()) { toast.error('El nombre es requerido'); return; }
    try {
      setSavingBanco(true);
      const token = sessionStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      if (bancoEditando) {
        await axios.put(`${API_URL}/caja/bancos/${bancoEditando.id}`, bancoForm, config);
      } else {
        await axios.post(`${API_URL}/caja/bancos`, bancoForm, config);
      }
      setShowBancoModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al guardar banco');
    } finally {
      setSavingBanco(false);
    }
  };

  const handleDesactivarBanco = async () => {
    if (!bancoADesactivar) return;
    try {
      const token = sessionStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`${API_URL}/caja/bancos/${bancoADesactivar.id}`, config);
      setShowDesactivarModal(false);
      setBancoADesactivar(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al desactivar banco');
    }
  };

  const confirmarMovimientoCaja = async (id: number) => {
    try {
      const token = sessionStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.put(`${API_URL}/caja/caja-chica/confirmar/${id}`, {}, config);
      setShowConfirmModal(false);
      setMovimientoAConfirmar(null);
      loadData();
    } catch (error: any) {
      console.error('Error confirmando movimiento:', error);
      if (error.response?.status === 401) {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
  };

  const confirmarMovimientoBanco = async (id: number) => {
    try {
      const token = sessionStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.put(`${API_URL}/caja/bancos/confirmar/${id}`, {}, config);
      setShowConfirmModal(false);
      setMovimientoAConfirmar(null);
      loadData();
    } catch (error: any) {
      console.error('Error confirmando movimiento:', error);
      if (error.response?.status === 401) {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
  };

  const solicitarConfirmacion = (id: number, tipo: 'caja' | 'banco', mov: Movimiento) => {
    setMovimientoAConfirmar({ id, tipo, mov });
    setShowConfirmModal(true);
  };

  const ejecutarConfirmacion = () => {
    if (!movimientoAConfirmar) return;
    if (movimientoAConfirmar.tipo === 'caja') {
      confirmarMovimientoCaja(movimientoAConfirmar.id);
    } else {
      confirmarMovimientoBanco(movimientoAConfirmar.id);
    }
  };

  const handleRegistrarMovimiento = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const montoNum = parseFloat(monto);

      if (!montoNum || montoNum <= 0) {
        toast.error('Ingresa un monto válido');
        return;
      }

      if (!concepto.trim()) {
        toast.error('Ingresa un concepto');
        return;
      }

      const usuario = sessionStorage.getItem('userName') || 'Usuario';

      if (tipoMovimiento === 'GASTO' || tipoMovimiento === 'RETIRO') {
        await axios.post(`${API_URL}/caja/caja-chica/movimiento`, {
          tipo_movimiento: 'EGRESO',
          monto: montoNum,
          concepto,
          categoria: tipoMovimiento === 'GASTO' ? 'Gasto' : 'Retiro',
          realizado_por: usuario,
          observaciones: observaciones || null
        }, config);
      } else if (tipoMovimiento === 'INGRESO_MANUAL') {
        if (ingresoDestino === 'banco') {
          if (!cuentaDestino) { toast.error('Selecciona una cuenta bancaria'); return; }
          await axios.post(`${API_URL}/caja/ingreso-banco`, {
            cuenta_id: parseInt(cuentaDestino),
            monto: montoNum,
            concepto,
            categoria: 'Ingreso Manual',
            realizado_por: usuario,
            observaciones: observaciones || null
          }, config);
        } else {
          await axios.post(`${API_URL}/caja/caja-chica/movimiento`, {
            tipo_movimiento: 'INGRESO',
            monto: montoNum,
            concepto,
            categoria: 'Ingreso Manual',
            realizado_por: usuario,
            observaciones: observaciones || null
          }, config);
        }
      } else if (tipoMovimiento === 'RETIRO_BANCO') {
        if (!cuentaOrigen) { toast.error('Selecciona la cuenta bancaria'); return; }
        await axios.post(`${API_URL}/caja/retiro-banco`, {
          cuenta_id: parseInt(cuentaOrigen),
          monto: montoNum,
          concepto,
          a_caja_chica: aCajaChica,
          realizado_por: usuario,
          observaciones: observaciones || null
        }, config);
      } else if (tipoMovimiento === 'DEPOSITO') {
        if (!cuentaDestino) { toast.error('Selecciona una cuenta bancaria de destino'); return; }
        await axios.post(`${API_URL}/caja/depositar-banco`, {
          cuenta_id: parseInt(cuentaDestino),
          monto: montoNum,
          concepto,
          realizado_por: usuario,
          observaciones: observaciones || null
        }, config);
      } else if (tipoMovimiento === 'TRANSFERENCIA') {
        if (!cuentaOrigen || !cuentaDestino) { toast.error('Selecciona ambas cuentas bancarias'); return; }
        if (cuentaOrigen === cuentaDestino) { toast.error('La cuenta de origen y destino deben ser diferentes'); return; }
        await axios.post(`${API_URL}/caja/transferencia-bancos`, {
          cuenta_origen_id: parseInt(cuentaOrigen),
          cuenta_destino_id: parseInt(cuentaDestino),
          monto: montoNum,
          concepto,
          realizado_por: usuario,
          observaciones: observaciones || null
        }, config);
      }

      setShowModal(false);
      setMonto(''); setConcepto(''); setObservaciones('');
      setCuentaDestino(''); setCuentaOrigen(''); setACajaChica(false);
      setIngresoDestino('caja');
      await loadData();
      if (cuentaSeleccionada) {
        await seleccionarCuenta(cuentaSeleccionada);
      }
    } catch (error: any) {
      console.error('Error registrando movimiento:', error);
      if (error.response?.status === 401) {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        window.location.href = '/login';
      } else if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Error al registrar movimiento');
      }
    }
  };

  const totalBancos = cuentasBancarias.reduce((sum, c) => sum + Number(c.saldo_actual || 0), 0);

  const pendientesCaja = movimientosCaja.filter(m => m.estado === 'PENDIENTE').length;
  const pendientesBancos = movimientosBancos.filter(m => m.estado === 'PENDIENTE').length;
  const anuladosCaja = movimientosCaja.filter(m => m.estado === 'ANULADO').length;
  const anuladosBancos = movimientosBancos.filter(m => m.estado === 'ANULADO').length;

  const aplicarFiltros = (movs: Movimiento[]) =>
    movs.filter(m => {
      const matchEstado = m.estado === estadoFiltro;
      const matchTipo = tipoFiltro === 'TODOS' || m.tipo_movimiento === tipoFiltro;
      const matchBusqueda = !busqueda || m.concepto.toLowerCase().includes(busqueda.toLowerCase());
      return matchEstado && matchTipo && matchBusqueda;
    });

  const movsCajaFiltrados = aplicarFiltros(movimientosCaja);
  const movsBancosFiltrados = aplicarFiltros(movimientosBancos);

  // Movimientos del historial filtrados por período (los datos vienen del endpoint dedicado)
  const movsHistorialFiltrados = (() => {
    if (!movsHistorial.length) return [];
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const anioActual = hoy.getFullYear();
    return movsHistorial.filter(m => {
      if (periodoHistorial === 'mes') {
        const d = new Date(m.fecha_movimiento);
        return d.getMonth() === mesActual && d.getFullYear() === anioActual;
      }
      if (periodoHistorial === 'mes_anterior') {
        const d = new Date(m.fecha_movimiento);
        const mesPrev = mesActual === 0 ? 11 : mesActual - 1;
        const anioPrev = mesActual === 0 ? anioActual - 1 : anioActual;
        return d.getMonth() === mesPrev && d.getFullYear() === anioPrev;
      }
      return true; // todo
    });
  })();

  const seleccionarCuenta = async (cuenta: CuentaBancaria) => {
    setCuentaSeleccionada(cuenta);
    setPeriodoHistorial('todo');
    setMovsHistorial([]);
    const token = sessionStorage.getItem('token');
    const config = { headers: { Authorization: `Bearer ${token}` } };
    // Fetch stats y movimientos en paralelo
    setLoadingCuentaStats(true);
    setLoadingHistorial(true);
    try {
      const [statsResp, movsResp] = await Promise.all([
        axios.get(`${API_URL}/caja/bancos/${cuenta.id}/saldo`, config),
        axios.get(`${API_URL}/caja/bancos/${cuenta.id}/movimientos`, config),
      ]);
      setCuentaStats({
        ingresos: statsResp.data.data.ingresos,
        egresos:  statsResp.data.data.egresos,
        saldo:    statsResp.data.data.saldo,
      });
      setMovsHistorial(movsResp.data.data || []);
    } catch {
      setCuentaStats(null);
      setMovsHistorial([]);
    } finally {
      setLoadingCuentaStats(false);
      setLoadingHistorial(false);
    }
  };

  const cerrarHistorial = () => {
    setCuentaSeleccionada(null);
    setCuentaStats(null);
    setMovsHistorial([]);
  };

  const abrirModal = (tipo: typeof tipoMovimiento) => {
    setTipoMovimiento(tipo);
    setMonto(''); setConcepto(''); setObservaciones('');
    setCuentaDestino(''); setCuentaOrigen(''); setACajaChica(false);
    setIngresoDestino('caja');
    setShowModal(true);
  };

  // ─── Loading skeleton ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-16 bg-slate-200 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-200 rounded-xl" />)}
        </div>
        <div className="h-64 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  // ─── Error state ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <AlertCircle size={48} className="text-red-400" />
        <p className="text-slate-600">{error}</p>
        <Button onClick={loadData}><RefreshCw size={16} className="mr-2" />Reintentar</Button>
      </div>
    );
  }

  // ─── JSX ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">Caja y Bancos</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Control de efectivo, cuentas bancarias y movimientos financieros</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={loadData} className="text-sm bg-white text-slate-700 border-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800">
              <RefreshCw size={15} className="mr-1.5" />Actualizar
            </Button>
            <Button
              onClick={() => abrirModal('GASTO')}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-sm"
            >
              <Plus size={16} className="mr-1.5" />Registrar movimiento
            </Button>
          </div>
        </div>

        {/* ── TARJETAS RESUMEN ───────────────────────────────────────────── */}
        <div className={`grid gap-3 md:gap-4 ${isAdmin ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2'}`}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 md:p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Caja Chica</p>
                <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                  Q{Number(saldoCajaChica.saldo || 0).toFixed(2)}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Saldo confirmado</p>
              </div>
              <div className="bg-emerald-50 p-2 rounded-xl">
                <Wallet size={20} className="text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 md:p-5 border border-amber-200 dark:border-amber-900/60 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">Pendientes Caja</p>
                <p className="text-xl md:text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">{pendientesCaja}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Por confirmar</p>
              </div>
              <div className="bg-amber-50 p-2 rounded-xl">
                <Clock size={20} className="text-amber-500" />
              </div>
            </div>
          </div>

          {isAdmin && (
            <>
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 md:p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Bancos</p>
                    <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">Q{totalBancos.toFixed(2)}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{cuentasBancarias.length} cuenta{cuentasBancarias.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="bg-blue-50 p-2 rounded-xl">
                    <Landmark size={20} className="text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 md:p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Pendientes Bancos</p>
                    <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{pendientesBancos}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Por confirmar</p>
                  </div>
                  <div className="bg-violet-50 p-2 rounded-xl">
                    <Clock size={20} className="text-violet-500" />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── ACCIONES RÁPIDAS ──────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Acciones rápidas</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {[
              { label: 'Registrar gasto', icon: <ArrowDownCircle size={18} />, color: 'hover:bg-red-50 hover:border-red-200 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:border-red-800 dark:hover:text-red-300', tipo: 'GASTO' as const },
              { label: 'Registrar retiro', icon: <TrendingDown size={18} />, color: 'hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700 dark:hover:bg-orange-950/40 dark:hover:border-orange-800 dark:hover:text-orange-300', tipo: 'RETIRO' as const },
              { label: 'Retiro de banco', icon: <Building2 size={18} />, color: 'hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:border-rose-800 dark:hover:text-rose-300', tipo: 'RETIRO_BANCO' as const },
              { label: 'Depósito a banco', icon: <ArrowUpCircle size={18} />, color: 'hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 dark:hover:bg-blue-950/40 dark:hover:border-blue-800 dark:hover:text-blue-300', tipo: 'DEPOSITO' as const },
              { label: 'Transferencia', icon: <ArrowRightLeft size={18} />, color: 'hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700 dark:hover:bg-violet-950/40 dark:hover:border-violet-800 dark:hover:text-violet-300', tipo: 'TRANSFERENCIA' as const },
              { label: 'Ingreso manual', icon: <Banknote size={18} />, color: 'hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:border-emerald-800 dark:hover:text-emerald-300', tipo: 'INGRESO_MANUAL' as const },
            ].filter(item => !['RETIRO_BANCO', 'TRANSFERENCIA'].includes(item.tipo) || isAdmin).map(({ label, icon, color, tipo }) => (
              <button
                key={tipo}
                onClick={() => abrirModal(tipo)}
                className={`flex flex-col items-center gap-1.5 p-3 h-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 text-xs font-medium transition-all ${color} active:scale-95`}
              >
                {icon}
                <span className="text-center leading-tight">{label}</span>
              </button>
            ))}

          </div>
        </div>

        {/* ── NAVEGACIÓN PRINCIPAL ──────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Pestañas principales */}
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            {[
              { key: 'caja', label: 'Caja Chica', icon: <Wallet size={16} />, badge: pendientesCaja },
              ...(isAdmin ? [{ key: 'bancos', label: 'Bancos', icon: <Landmark size={16} />, badge: pendientesBancos }] : []),
              ...(isAdmin && hasTarjetasModule ? [{ key: 'tarjetas', label: 'Tarjetas de Crédito', icon: <CreditCard size={16} />, badge: 0 }] : []),
            ].map(({ key, label, icon, badge }) => (
              <button
                key={key}
                onClick={() => {
                  setVistaActual(key as 'caja' | 'bancos' | 'tarjetas');
                  if (key === 'tarjetas' && hasTarjetasModule && tarjetas.length === 0) cargarTarjetas();
                }}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors flex-1 sm:flex-none justify-center sm:justify-start ${
                  vistaActual === key
                    ? 'border-blue-600 text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-950'
                    // eslint-disable-next-line no-constant-binary-expression
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                {icon}
                {label}
                {badge > 0 && (
                  <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Sub-pestañas estado — solo para caja y bancos */}
          {vistaActual !== 'tarjetas' && <div className="flex gap-1 p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex-wrap">
            {([
              { key: 'PENDIENTE', label: 'Pendientes de confirmar', icon: <Clock size={14} />, activeClass: 'bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-800', count: vistaActual === 'caja' ? pendientesCaja : pendientesBancos },
              { key: 'CONFIRMADO', label: 'Confirmados', icon: <ShieldCheck size={14} />, activeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800', count: null },
              { key: 'ANULADO', label: 'Anulados', icon: <X size={14} />, activeClass: 'bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700', count: vistaActual === 'caja' ? anuladosCaja : anuladosBancos },
            ] as const).map(({ key, label, icon, activeClass, count }) => (
              <button
                key={key}
                onClick={() => setEstadoFiltro(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  estadoFiltro === key
                    ? activeClass
                    : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                }`}
              >
                {icon}{label}
                {count != null && count > 0 && (
                  <span className="ml-1 font-bold">({count})</span>
                )}
              </button>
            ))}

            {/* Filtros */}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setMostrarFiltros(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all"
              >
                <Filter size={13} />Filtros
                <ChevronDown size={13} className={`transition-transform ${mostrarFiltros ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>}

          {/* Barra de filtros expandible */}
          {vistaActual !== 'tarjetas' && mostrarFiltros && (
            <div className="flex flex-col sm:flex-row gap-2 p-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar por concepto..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/40 focus:border-transparent outline-none"
                />
              </div>
              <select
                value={tipoFiltro}
                onChange={e => setTipoFiltro(e.target.value as typeof tipoFiltro)}
                className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500/40 outline-none"
              >
                <option value="TODOS">Todos los tipos</option>
                <option value="INGRESO">Solo ingresos</option>
                <option value="EGRESO">Solo egresos</option>
              </select>
              {(busqueda || tipoFiltro !== 'TODOS') && (
                <button
                  onClick={() => { setBusqueda(''); setTipoFiltro('TODOS'); }}
                  className="flex items-center gap-1 px-3 py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <X size={13} />Limpiar
                </button>
              )}
            </div>
          )}

          {/* ── VISTA CAJA CHICA ─────────────────────────────────────── */}
          {vistaActual === 'caja' && (
            <MovimientosPanel
              movimientos={movsCajaFiltrados}
              estadoFiltro={estadoFiltro}
              onConfirmar={(mov) => solicitarConfirmacion(mov.id, 'caja', mov)}
            />
          )}

          {/* ── VISTA TARJETAS DE CRÉDITO ────────────────────────────── */}
          {hasTarjetasModule && vistaActual === 'tarjetas' && (
            <TarjetasCreditoPanel
              tarjetas={tarjetas}
              loading={loadingTarjetas}
              cuentasBancarias={cuentasBancarias}
              tarjetaDetalle={tarjetaDetalle}
              movsTarjeta={movsTarjeta}
              loadingMovs={loadingMovsTarjeta}
              onVerDetalle={async (t) => {
                setTarjetaDetalle(t);
                setLoadingMovsTarjeta(true);
                try { setMovsTarjeta(await TarjetaService.getMovimientos(t.id)); } catch { setMovsTarjeta([]); }
                finally { setLoadingMovsTarjeta(false); }
              }}
              onCerrarDetalle={() => { setTarjetaDetalle(null); setMovsTarjeta([]); }}
              onNueva={() => {
                setTarjetaEditando(null);
                setTarjetaForm({ banco: '', alias: '', ultimos4: '', tasa_interes: 0, dia_corte: 1, dia_pago: 15, limite_credito: 0, moneda: 'GTQ', notas: '' });
                setShowTarjetaModal(true);
              }}
              onEditar={(t) => {
                setTarjetaEditando(t);
                setTarjetaForm({
                  banco: t.banco, alias: t.alias || '', ultimos4: t.ultimos4,
                  tasa_interes: t.tasa_interes, dia_corte: t.dia_corte, dia_pago: t.dia_pago,
                  limite_credito: TarjetaService.centsToQ(t.limite_credito),
                  moneda: t.moneda, notas: t.notas || ''
                });
                setShowTarjetaModal(true);
              }}
              onPagar={(t) => {
                setTarjetaAPagar(t);
                setPagoForm({ tipo_cuenta_origen: 'caja', monto: 0 });
                setShowPagoModal(true);
              }}
              onDesactivar={async (t) => {
                if (!confirm(`¿Desactivar tarjeta ${TarjetaService.formatTarjeta(t)}?`)) return;
                try {
                  await TarjetaService.desactivarTarjeta(t.id);
                  toast.success('Tarjeta desactivada');
                  cargarTarjetas();
                  if (tarjetaDetalle?.id === t.id) { setTarjetaDetalle(null); setMovsTarjeta([]); }
                } catch { toast.error('Error al desactivar tarjeta'); }
              }}
            />
          )}

          {/* ── VISTA BANCOS ─────────────────────────────────────────── */}
          {vistaActual === 'bancos' && (
            <div>

              {/* ── HISTORIAL DE CUENTA SELECCIONADA ── */}
              {cuentaSeleccionada ? (
                <div>
                  {/* Header historial */}
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 mb-4">
                      <button
                        onClick={cerrarHistorial}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <ArrowDownCircle size={13} className="rotate-90" /> Volver
                      </button>
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide">Historial</p>
                        <p className="text-base font-bold text-slate-900 dark:text-slate-100">{cuentaSeleccionada.nombre}</p>
                      </div>
                    </div>

                    {/* Stats totales (all-time) */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 p-3 text-center">
                        <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">Total ingresos</p>
                        {loadingCuentaStats ? <div className="h-5 w-16 mx-auto bg-emerald-200 dark:bg-emerald-900/40 rounded animate-pulse" /> : (
                          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Q{Number(cuentaStats?.ingresos || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</p>
                        )}
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Confirmados · total</p>
                      </div>
                      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-3 text-center">
                        <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-1">Total egresos</p>
                        {loadingCuentaStats ? <div className="h-5 w-16 mx-auto bg-red-200 dark:bg-red-900/40 rounded animate-pulse" /> : (
                          <p className="text-sm font-bold text-red-700 dark:text-red-300">Q{Number(cuentaStats?.egresos || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</p>
                        )}
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Confirmados · total</p>
                      </div>
                      <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/20 p-3 text-center">
                        <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">Saldo actual</p>
                        {loadingCuentaStats ? <div className="h-5 w-20 mx-auto bg-blue-200 dark:bg-blue-900/40 rounded animate-pulse" /> : (
                          <p className="text-sm font-bold text-blue-700 dark:text-blue-300">Q{Number(cuentaStats?.saldo ?? cuentaSeleccionada.saldo_actual ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</p>
                        )}
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Confirmado</p>
                      </div>
                    </div>

                    {/* Filtro período */}
                    <div className="flex gap-1.5">
                      {([['mes', 'Este mes'], ['mes_anterior', 'Mes anterior'], ['todo', 'Todo']] as const).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => setPeriodoHistorial(key)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            periodoHistorial === key
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                      <span className="ml-auto text-xs text-slate-400 dark:text-slate-500 self-center">
                        {loadingHistorial ? '...' : `${movsHistorialFiltrados.length} movimiento${movsHistorialFiltrados.length !== 1 ? 's' : ''}`}
                      </span>
                    </div>
                  </div>

                  {/* Tabla de movimientos del historial */}
                  {loadingHistorial ? (
                    <div className="flex items-center justify-center py-14">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="ml-3 text-sm text-slate-400 dark:text-slate-500">Cargando movimientos...</span>
                    </div>
                  ) : movsHistorialFiltrados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
                      <FileText size={40} className="text-slate-300 mb-3" />
                      <p className="text-slate-500 dark:text-slate-400 font-medium">
                        {movsHistorial.length === 0
                          ? 'Esta cuenta aún no tiene movimientos registrados.'
                          : 'No hay movimientos en el período seleccionado.'}
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop: tabla */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                              <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase">Fecha</th>
                              <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase">Tipo</th>
                              <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase">Concepto</th>
                              <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase">Categoría</th>
                              <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase">Estado</th>
                              <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase">Referencia</th>
                              <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase">Realizado por</th>
                              <th className="text-right px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400 text-xs uppercase">Ingreso</th>
                              <th className="text-right px-4 py-3 font-semibold text-red-600 dark:text-red-400 text-xs uppercase">Egreso</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {movsHistorialFiltrados.map(mov => (
                              <tr key={mov.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                  {new Date(mov.fecha_movimiento).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                    mov.tipo_movimiento === 'INGRESO'
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                      : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                  }`}>
                                    {mov.tipo_movimiento === 'INGRESO' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                    {mov.tipo_movimiento}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-slate-800 dark:text-slate-200 max-w-[200px] truncate">{mov.concepto || '—'}</td>
                                <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{mov.categoria || '—'}</td>
                                <td className="px-4 py-3">
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                    mov.estado === 'CONFIRMADO' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                    : mov.estado === 'PENDIENTE' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                  }`}>{mov.estado}</span>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{mov.numero_referencia || '—'}</td>
                                <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{mov.realizado_por || '—'}</td>
                                <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                  {mov.tipo_movimiento === 'INGRESO' ? `Q${Number(mov.monto).toFixed(2)}` : ''}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-red-600 dark:text-red-400">
                                  {mov.tipo_movimiento === 'EGRESO' ? `Q${Number(mov.monto).toFixed(2)}` : ''}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* Mobile: tarjetas */}
                      <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                        {movsHistorialFiltrados.map(mov => (
                          <div key={mov.id} className="p-4 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                mov.tipo_movimiento === 'INGRESO'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                              }`}>
                                {mov.tipo_movimiento === 'INGRESO' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                {mov.tipo_movimiento}
                              </span>
                              <span className={`font-bold text-base ${
                                mov.tipo_movimiento === 'INGRESO' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                              }`}>
                                {mov.tipo_movimiento === 'INGRESO' ? '+' : '-'}Q{Number(mov.monto).toFixed(2)}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{mov.concepto || '—'}</p>
                            <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                              <span>{new Date(mov.fecha_movimiento).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                              <span className={`px-2 py-0.5 rounded-full font-medium ${
                                mov.estado === 'CONFIRMADO' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                : mov.estado === 'PENDIENTE' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-500'
                              }`}>{mov.estado}</span>
                            </div>
                            {mov.numero_referencia && <p className="text-xs text-slate-400 dark:text-slate-500">Ref: {mov.numero_referencia}</p>}
                            {mov.realizado_por && <p className="text-xs text-slate-400 dark:text-slate-500">Por: {mov.realizado_por}</p>}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
              <div>
              {/* ── Cards de cuentas bancarias ── */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Cuentas bancarias</p>
                  {isAdmin && (
                    <button
                      onClick={() => abrirModalBanco()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                    >
                      <Plus size={13} /> Agregar banco
                    </button>
                  )}
                </div>
                {cuentasBancarias.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">No hay cuentas bancarias registradas.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {cuentasBancarias.map(cuenta => (
                      <div key={cuenta.id} className={`rounded-xl border p-4 ${cuenta.activa ? 'border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20' : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50 opacity-60'}`}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="bg-blue-100 dark:bg-blue-950/60 p-1.5 rounded-lg">
                              <CreditCard size={16} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{cuenta.nombre}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{cuenta.tipo_cuenta}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {cuenta.activa ? (
                              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded-full">Activa</span>
                            ) : (
                              <span className="text-[10px] font-semibold bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-full">Inactiva</span>
                            )}
                            {isAdmin && cuenta.activa && (
                              <>
                                <button
                                  onClick={() => abrirModalBanco(cuenta)}
                                  className="p-1 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 transition-colors"
                                  title="Editar banco"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={() => { setBancoADesactivar(cuenta); setShowDesactivarModal(true); }}
                                  className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/50 text-red-500 dark:text-red-400 transition-colors"
                                  title="Desactivar banco"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {cuenta.numero_cuenta && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">N°: {cuenta.numero_cuenta}</p>
                        )}
                        {cuenta.pos_asociado && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">POS: {cuenta.pos_asociado}</p>
                        )}
                        <div className="border-t border-blue-200 dark:border-blue-900/50 pt-2 mt-2">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Saldo confirmado</p>
                          <p className="text-lg font-bold text-blue-700 dark:text-blue-400">Q{Number(cuenta.saldo_actual || 0).toFixed(2)}</p>
                          {(() => {
                            const pendMonto = movimientosBancos
                              .filter(m => m.cuenta_id === cuenta.id && m.estado === 'PENDIENTE' && m.tipo_movimiento === 'INGRESO')
                              .reduce((sum, m) => sum + Number(m.monto || 0), 0);
                            return pendMonto > 0 ? (
                              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-0.5">+ Q{pendMonto.toFixed(2)} pendiente por confirmar</p>
                            ) : null;
                          })()}
                        </div>
                        <button
                          onClick={() => seleccionarCuenta(cuenta)}
                          className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-colors"
                        >
                          <FileText size={12} /> Ver historial
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Movimientos bancos */}
              <MovimientosPanel
                movimientos={movsBancosFiltrados}
                estadoFiltro={estadoFiltro}
                onConfirmar={(mov) => solicitarConfirmacion(mov.id, 'banco', mov)}
                mostrarBanco
              />
            </div>
            )}
            </div>
          )}
        </div>

      {/* ── MODAL REGISTRAR MOVIMIENTO ──────────────────────────────────────── */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={
          tipoMovimiento === 'GASTO' ? 'Registrar Gasto' :
          tipoMovimiento === 'RETIRO' ? 'Registrar Retiro de Caja' :
          tipoMovimiento === 'RETIRO_BANCO' ? 'Retiro de Banco' :
          tipoMovimiento === 'DEPOSITO' ? 'Depósito de Caja a Banco' :
          tipoMovimiento === 'TRANSFERENCIA' ? 'Transferencia entre Bancos' :
          'Ingreso Manual'
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Monto (Q)</label>
            <Input type="number" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0.00" className="w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Concepto</label>
            <Input type="text" value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Descripción del movimiento" className="w-full" />
          </div>

          {tipoMovimiento === 'INGRESO_MANUAL' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Destino del ingreso</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setIngresoDestino('caja'); setCuentaDestino(''); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                    ingresoDestino === 'caja'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-300'
                      : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Wallet size={14} className="inline mr-1" />Caja chica
                </button>
                <button
                  type="button"
                  onClick={() => setIngresoDestino('banco')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                    ingresoDestino === 'banco'
                      ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/40 dark:border-blue-700 dark:text-blue-300'
                      : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Landmark size={14} className="inline mr-1" />Banco
                </button>
              </div>
              {ingresoDestino === 'banco' && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cuenta bancaria destino</label>
                  <Select value={cuentaDestino} onChange={e => setCuentaDestino(e.target.value)} className="w-full">
                    <option value="">Seleccione una cuenta...</option>
                    {cuentasBancarias.filter(c => c.activa).map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}{c.pos_asociado ? ` (${c.pos_asociado})` : ''}</option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          )}

          {tipoMovimiento === 'DEPOSITO' && (
            <>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                Saldo caja chica disponible: <span className="font-bold">Q{Number(saldoCajaChica.saldo || 0).toFixed(2)}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cuenta bancaria de destino</label>
                <Select value={cuentaDestino} onChange={e => setCuentaDestino(e.target.value)} className="w-full">
                  <option value="">Seleccione una cuenta...</option>
                  {cuentasBancarias.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.pos_asociado ? `(${c.pos_asociado})` : ''}</option>)}
                </Select>
              </div>
            </>
          )}

          {tipoMovimiento === 'RETIRO_BANCO' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cuenta bancaria</label>
                <Select value={cuentaOrigen} onChange={e => setCuentaOrigen(e.target.value)} className="w-full">
                  <option value="">Seleccione una cuenta...</option>
                  {cuentasBancarias.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}{c.saldo_actual != null ? ` — Q${Number(c.saldo_actual).toFixed(2)}` : ''}
                    </option>
                  ))}
                </Select>
              </div>
              {cuentaOrigen && (() => {
                const cuenta = cuentasBancarias.find(c => c.id === parseInt(cuentaOrigen));
                return cuenta?.saldo_actual != null ? (
                  <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2 text-sm text-blue-700 dark:text-blue-300 font-medium">
                    Saldo disponible: <span className="font-bold">Q{Number(cuenta.saldo_actual).toFixed(2)}</span>
                  </div>
                ) : null;
              })()}
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300 font-medium select-none">
                <input
                  type="checkbox"
                  checked={aCajaChica}
                  onChange={e => setACajaChica(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600"
                />
                Ingresar monto a caja chica
              </label>
            </>
          )}

          {tipoMovimiento === 'TRANSFERENCIA' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cuenta de origen</label>
                <Select value={cuentaOrigen} onChange={e => setCuentaOrigen(e.target.value)} className="w-full">
                  <option value="">Seleccione cuenta origen...</option>
                  {cuentasBancarias.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.saldo_actual != null ? ` — Q${Number(c.saldo_actual).toFixed(2)}` : ''}</option>)}
                </Select>
              </div>
              <div className="flex items-center justify-center text-slate-400"><ArrowRightLeft size={20} /></div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cuenta de destino</label>
                <Select value={cuentaDestino} onChange={e => setCuentaDestino(e.target.value)} className="w-full">
                  <option value="">Seleccione cuenta destino...</option>
                  {cuentasBancarias.filter(c => c.id.toString() !== cuentaOrigen).map(c => <option key={c.id} value={c.id}>{c.nombre}{c.saldo_actual != null ? ` — Q${Number(c.saldo_actual).toFixed(2)}` : ''}</option>)}
                </Select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Observaciones (opcional)</label>
            <textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              placeholder="Notas adicionales..."
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/40 outline-none text-sm"
              rows={2}
            />
          </div>

          {/* Resumen */}
          {monto && parseFloat(monto) > 0 && (
            <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3 border border-slate-200 dark:border-slate-800 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Tipo</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {tipoMovimiento === 'GASTO' && 'Gasto de Caja Chica'}
                  {tipoMovimiento === 'RETIRO' && 'Retiro de Caja Chica'}
                  {tipoMovimiento === 'RETIRO_BANCO' && 'Retiro de Banco'}
                  {tipoMovimiento === 'DEPOSITO' && 'Depósito a Banco'}
                  {tipoMovimiento === 'TRANSFERENCIA' && 'Transferencia Bancaria'}
                  {tipoMovimiento === 'INGRESO_MANUAL' && 'Ingreso Manual'}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-700 pt-1 mt-1">
                <span className="text-slate-500 dark:text-slate-400">Monto</span>
                <span className="font-bold text-lg text-slate-900 dark:text-slate-100">Q{parseFloat(monto).toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">Cancelar</Button>
            <Button
              onClick={handleRegistrarMovimiento}
              className={`flex-1 ${
                tipoMovimiento === 'GASTO' ? 'bg-red-600 hover:bg-red-700' :
                tipoMovimiento === 'RETIRO' ? 'bg-orange-600 hover:bg-orange-700' :
                tipoMovimiento === 'RETIRO_BANCO' ? 'bg-rose-600 hover:bg-rose-700' :
                tipoMovimiento === 'DEPOSITO' ? 'bg-blue-600 hover:bg-blue-700' :
                tipoMovimiento === 'TRANSFERENCIA' ? 'bg-violet-600 hover:bg-violet-700' :
                'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              Confirmar registro
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL BANCO (CREAR / EDITAR) ────────────────────────────────────── */}
      <Modal
        isOpen={showBancoModal}
        onClose={() => setShowBancoModal(false)}
        title={bancoEditando ? 'Editar cuenta bancaria' : 'Agregar cuenta bancaria'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre <span className="text-red-500">*</span></label>
            <Input
              type="text"
              value={bancoForm.nombre}
              onChange={e => setBancoForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: Banco Industrial"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Número de cuenta</label>
            <Input
              type="text"
              value={bancoForm.numero_cuenta}
              onChange={e => setBancoForm(f => ({ ...f, numero_cuenta: e.target.value }))}
              placeholder="Ej: 0123456789"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de cuenta</label>
            <Select value={bancoForm.tipo_cuenta} onChange={e => setBancoForm(f => ({ ...f, tipo_cuenta: e.target.value }))} className="w-full">
              <option value="Corriente">Corriente</option>
              <option value="Ahorro">Ahorro</option>
              <option value="Monetaria">Monetaria</option>
              <option value="Inversión">Inversión</option>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">POS asociado (opcional)</label>
            <Input
              type="text"
              value={bancoForm.pos_asociado}
              onChange={e => setBancoForm(f => ({ ...f, pos_asociado: e.target.value }))}
              placeholder="Ej: Visa POS #1"
              className="w-full"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowBancoModal(false)} className="flex-1">Cancelar</Button>
            <Button
              onClick={handleGuardarBanco}
              disabled={savingBanco}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {savingBanco ? 'Guardando...' : bancoEditando ? 'Guardar cambios' : 'Crear banco'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL DESACTIVAR BANCO ──────────────────────────────────────────── */}
      <Modal
        isOpen={showDesactivarModal}
        onClose={() => { setShowDesactivarModal(false); setBancoADesactivar(null); }}
        title="¿Desactivar esta cuenta?"
      >
        {bancoADesactivar && (
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-800 dark:text-red-300">
              Esta acción desactivará la cuenta <span className="font-bold">{bancoADesactivar.nombre}</span>. Ya no aparecerá en nuevos movimientos, pero su historial se conservará.
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setShowDesactivarModal(false); setBancoADesactivar(null); }} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleDesactivarBanco} className="flex-1 bg-red-600 hover:bg-red-700">
                <Trash2 size={15} className="mr-1.5" />Desactivar cuenta
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL CONFIRMAR MOVIMIENTO ──────────────────────────────────────── */}      <Modal
        isOpen={showConfirmModal}
        onClose={() => { setShowConfirmModal(false); setMovimientoAConfirmar(null); }}
        title="¿Confirmar este movimiento?"
      >
        {movimientoAConfirmar && (
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
              Al confirmar, el monto afectará el saldo disponible y no podrá revertirse desde esta pantalla.
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Concepto</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 text-right max-w-[60%]">{movimientoAConfirmar.mov.concepto}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Tipo</span>
                <span className={`font-semibold ${movimientoAConfirmar.mov.tipo_movimiento === 'INGRESO' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {movimientoAConfirmar.mov.tipo_movimiento}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-800 pt-2">
                <span className="text-slate-500 dark:text-slate-400">Monto</span>
                <span className="font-bold text-lg text-slate-900 dark:text-slate-100">Q{Number(movimientoAConfirmar.mov.monto || 0).toFixed(2)}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setShowConfirmModal(false); setMovimientoAConfirmar(null); }} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={ejecutarConfirmacion} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                <Check size={16} className="mr-1.5" />Confirmar movimiento
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL TARJETA CRÉDITO: CREAR / EDITAR ─────────────────────────── */}
      <Modal
        isOpen={showTarjetaModal}
        onClose={() => setShowTarjetaModal(false)}
        title={tarjetaEditando ? 'Editar tarjeta' : 'Nueva tarjeta de crédito'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Banco *</label>
              <input
                type="text"
                value={tarjetaForm.banco}
                onChange={e => setTarjetaForm(f => ({ ...f, banco: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/40 outline-none"
                placeholder="Ej: Banrural"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Alias (opcional)</label>
              <input
                type="text"
                value={tarjetaForm.alias || ''}
                onChange={e => setTarjetaForm(f => ({ ...f, alias: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/40 outline-none"
                placeholder="Ej: Visa Empresarial"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Últimos 4 dígitos *</label>
              <input
                type="text"
                maxLength={4}
                value={tarjetaForm.ultimos4}
                onChange={e => setTarjetaForm(f => ({ ...f, ultimos4: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/40 outline-none"
                placeholder="1234"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Tasa de interés (%)</label>
              <input
                type="number" min="0" step="0.01"
                value={tarjetaForm.tasa_interes}
                onChange={e => setTarjetaForm(f => ({ ...f, tasa_interes: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/40 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Día de corte *</label>
              <input
                type="number" min="1" max="31"
                value={tarjetaForm.dia_corte}
                onChange={e => setTarjetaForm(f => ({ ...f, dia_corte: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/40 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Día de pago *</label>
              <input
                type="number" min="1" max="31"
                value={tarjetaForm.dia_pago}
                onChange={e => setTarjetaForm(f => ({ ...f, dia_pago: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/40 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Límite de crédito (Q)</label>
              <input
                type="number" min="0" step="0.01"
                value={tarjetaForm.limite_credito || 0}
                onChange={e => setTarjetaForm(f => ({ ...f, limite_credito: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/40 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Moneda</label>
              <select
                value={tarjetaForm.moneda || 'GTQ'}
                onChange={e => setTarjetaForm(f => ({ ...f, moneda: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500/40 outline-none"
              >
                <option value="GTQ">GTQ</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Notas</label>
              <textarea
                rows={2}
                value={tarjetaForm.notas || ''}
                onChange={e => setTarjetaForm(f => ({ ...f, notas: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/40 outline-none resize-none"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowTarjetaModal(false)} className="flex-1">Cancelar</Button>
            <Button
              onClick={handleGuardarTarjeta}
              disabled={savingTarjeta}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {savingTarjeta ? 'Guardando...' : tarjetaEditando ? 'Guardar cambios' : 'Crear tarjeta'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL PAGAR TARJETA ────────────────────────────────────────────── */}
      <Modal
        isOpen={showPagoModal}
        onClose={() => setShowPagoModal(false)}
        title={`Pagar tarjeta${tarjetaAPagar ? ` — ${TarjetaService.formatTarjeta(tarjetaAPagar)}` : ''}`}
      >
        {tarjetaAPagar && (
          <div className="space-y-4">
            {/* Saldo actual */}
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-center justify-between">
              <span className="text-sm text-red-700 dark:text-red-300 font-medium">Saldo pendiente</span>
              <span className="text-base font-bold text-red-700 dark:text-red-300">
                Q{TarjetaService.centsToQ(tarjetaAPagar.saldo_centavos).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Origen del pago *</label>
              <select
                value={pagoForm.tipo_cuenta_origen}
                onChange={e => setPagoForm(f => ({ ...f, tipo_cuenta_origen: e.target.value as 'banco' | 'caja', cuenta_origen_id: undefined }))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500/40 outline-none"
              >
                <option value="caja">Caja Chica</option>
                <option value="banco">Banco</option>
              </select>
            </div>

            {pagoForm.tipo_cuenta_origen === 'banco' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Cuenta bancaria *</label>
                <select
                  value={pagoForm.cuenta_origen_id ?? ''}
                  onChange={e => setPagoForm(f => ({ ...f, cuenta_origen_id: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500/40 outline-none"
                >
                  <option value="">— Seleccionar —</option>
                  {cuentasBancarias.filter(c => c.activa).map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Monto a pagar (Q) *</label>
              <input
                type="number" min="0.01" step="0.01"
                value={pagoForm.monto || ''}
                onChange={e => setPagoForm(f => ({ ...f, monto: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/40 outline-none"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Observaciones</label>
              <input
                type="text"
                value={pagoForm.observaciones || ''}
                onChange={e => setPagoForm(f => ({ ...f, observaciones: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/40 outline-none"
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowPagoModal(false)} className="flex-1">Cancelar</Button>
              <Button
                onClick={handlePagarTarjeta}
                disabled={savingPago}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {savingPago ? 'Registrando...' : 'Registrar pago'}
              </Button>
            </div>
          </div>
        )}
      </Modal>


    </div>
  );
}

// ─── Subcomponente: Tarjetas de Crédito ──────────────────────────────────────
interface TarjetasCreditoPanelProps {
  tarjetas: TarjetaCredito[];
  loading: boolean;
  cuentasBancarias: { id: number; nombre: string; activa: boolean }[];
  tarjetaDetalle: TarjetaCredito | null;
  movsTarjeta: TarjetaMovimiento[];
  loadingMovs: boolean;
  onVerDetalle: (t: TarjetaCredito) => void;
  onCerrarDetalle: () => void;
  onNueva: () => void;
  onEditar: (t: TarjetaCredito) => void;
  onPagar: (t: TarjetaCredito) => void;
  onDesactivar: (t: TarjetaCredito) => void;
}

function TarjetasCreditoPanel({
  tarjetas, loading, tarjetaDetalle, movsTarjeta, loadingMovs,
  onVerDetalle, onCerrarDetalle, onNueva, onEditar, onPagar, onDesactivar
}: TarjetasCreditoPanelProps) {
  const fmtQ = (cents: number) =>
    `Q${TarjetaService.centsToQ(cents).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
  const fmtFecha = (d: string) =>
    new Date(d).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
  const tipoColor = (tipo: TarjetaMovimiento['tipo']) => {
    if (tipo === 'compra') return 'text-red-600 dark:text-red-400';
    if (tipo === 'pago') return 'text-emerald-600 dark:text-emerald-400';
    return 'text-slate-600 dark:text-slate-400';
  };
  const totalSaldo = tarjetas.reduce((s, t) => s + Number(t.saldo_centavos || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-14">
        <RefreshCw size={28} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (tarjetaDetalle) {
    return (
      <div>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 flex-wrap">
          <button
            onClick={onCerrarDetalle}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowDownCircle size={13} className="rotate-90" /> Volver
          </button>
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide">Movimientos</p>
            <p className="text-base font-bold text-slate-900 dark:text-slate-100">{TarjetaService.formatTarjeta(tarjetaDetalle)}</p>
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={() => onPagar(tarjetaDetalle)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors">
              <Banknote size={13} /> Pagar
            </button>
            <button onClick={() => onEditar(tarjetaDetalle)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <Pencil size={13} /> Editar
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-slate-100 dark:border-slate-800">
          {[
            { label: 'Saldo pendiente', value: fmtQ(tarjetaDetalle.saldo_centavos), color: 'text-red-600 dark:text-red-400' },
            { label: 'Límite', value: fmtQ(tarjetaDetalle.limite_credito), color: 'text-slate-800 dark:text-slate-200' },
            { label: 'Día de corte', value: `Día ${tarjetaDetalle.dia_corte}`, color: 'text-slate-800 dark:text-slate-200' },
            { label: 'Día de pago', value: `Día ${tarjetaDetalle.dia_pago}`, color: 'text-slate-800 dark:text-slate-200' },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3">
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">{stat.label}</p>
              <p className={`text-sm font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
        {loadingMovs ? (
          <div className="flex justify-center py-8"><RefreshCw size={22} className="animate-spin text-blue-500" /></div>
        ) : movsTarjeta.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText size={36} className="text-slate-300 mb-2" />
            <p className="text-slate-500 font-medium">Sin movimientos registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Descripción</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {movsTarjeta.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtFecha(m.fecha_movimiento)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold capitalize px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 ${tipoColor(m.tipo)}`}>{m.tipo}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-xs truncate">{m.descripcion || '—'}</td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${tipoColor(m.tipo)}`}>
                      {m.tipo === 'pago' ? '+' : '−'}{fmtQ(m.monto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-semibold">Total pendiente</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">Q{TarjetaService.centsToQ(totalSaldo).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</p>
        </div>
        <button onClick={onNueva} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors">
          <Plus size={16} /> Nueva tarjeta
        </button>
      </div>
      {tarjetas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
          <CreditCard size={40} className="text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No hay tarjetas de crédito registradas</p>
          <p className="text-slate-400 text-sm mt-1">Registra una nueva tarjeta para comenzar.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tarjetas.map(t => {
            const saldoQ = TarjetaService.centsToQ(t.saldo_centavos);
            const limiteQ = TarjetaService.centsToQ(t.limite_credito);
            const usoPct = limiteQ > 0 ? Math.min(100, (saldoQ / limiteQ) * 100) : 0;
            return (
              <div key={t.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{TarjetaService.formatTarjeta(t)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t.moneda} · Corte día {t.dia_corte} · Pago día {t.dia_pago}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${t.activo ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                    {t.activo ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500 dark:text-slate-400">Saldo pendiente</span>
                    <span className="font-bold text-red-600 dark:text-red-400">Q{saldoQ.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {limiteQ > 0 && (
                    <>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${usoPct > 80 ? 'bg-red-500' : usoPct > 50 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${usoPct}%` }} />
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 text-right">Límite: Q{limiteQ.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</p>
                    </>
                  )}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={() => onVerDetalle(t)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <Eye size={11} /> Movimientos
                  </button>
                  <button onClick={() => onPagar(t)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors">
                    <Banknote size={11} /> Pagar
                  </button>
                  <button onClick={() => onEditar(t)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <Pencil size={11} /> Editar
                  </button>
                  {t.activo === 1 && (
                    <button onClick={() => onDesactivar(t)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                      <Trash2 size={11} /> Desactivar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Subcomponente: panel de movimientos (tabla en desktop, cards en móvil) ───
interface MovimientosPanelProps {
  movimientos: Movimiento[];
  estadoFiltro: 'PENDIENTE' | 'CONFIRMADO' | 'ANULADO';
  onConfirmar: (mov: Movimiento) => void;
  mostrarBanco?: boolean;
}

function MovimientosPanel({ movimientos, estadoFiltro, onConfirmar, mostrarBanco }: MovimientosPanelProps) {
  const fmtFecha = (fecha: string) => new Date(fecha).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtFechaHora = (fecha: string) => new Date(fecha).toLocaleString('es-GT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (movimientos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
        <FileText size={40} className="text-slate-300 mb-3" />
        <p className="text-slate-500 font-medium">
          {estadoFiltro === 'PENDIENTE'
            ? 'No hay movimientos pendientes de confirmar'
            : estadoFiltro === 'ANULADO'
            ? 'No hay movimientos anulados'
            : 'No hay movimientos confirmados'}
        </p>
        <p className="text-slate-400 text-sm mt-1">Los movimientos aparecerán aquí cuando se registren.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop: tabla */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
              <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase">Fecha</th>
              {mostrarBanco && <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase">Banco</th>}
              <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase">Concepto</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase">Categoría</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase">Tipo</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase">Monto</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase">Estado</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase">Realizado por</th>
              {estadoFiltro === 'CONFIRMADO' && <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase">Confirmado</th>}
              {estadoFiltro === 'PENDIENTE' && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {movimientos.map(mov => (
              <tr key={mov.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtFecha(mov.fecha_movimiento)}</td>
                {mostrarBanco && <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{mov.cuenta_nombre || '—'}</td>}
                <td className="px-4 py-3 max-w-xs">
                  <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{mov.concepto}</p>
                  {mov.venta_id && <p className="text-xs text-slate-400 dark:text-slate-500">Venta #{mov.venta_id}</p>}
                  {mov.numero_referencia && <p className="text-xs text-slate-400 dark:text-slate-500">Ref: {mov.numero_referencia}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md">{mov.categoria || '—'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md ${
                    mov.tipo_movimiento === 'INGRESO'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                  }`}>
                    {mov.tipo_movimiento === 'INGRESO' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {mov.tipo_movimiento}
                  </span>
                </td>
                <td className={`px-4 py-3 text-right font-bold tabular-nums ${
                  mov.tipo_movimiento === 'INGRESO' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {mov.tipo_movimiento === 'INGRESO' ? '+' : '−'}Q{Number(mov.monto || 0).toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                    mov.estado === 'PENDIENTE'
                      ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300'
                      : mov.estado === 'ANULADO'
                      ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  }`}>
                    {mov.estado}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{mov.realizado_por || '—'}</td>
                {estadoFiltro === 'CONFIRMADO' && (
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {mov.confirmado_en
                      ? <><div className="whitespace-nowrap">{fmtFechaHora(mov.confirmado_en)}</div>{mov.confirmado_por_nombre && <div className="text-slate-400 dark:text-slate-500">por {mov.confirmado_por_nombre}</div>}</>
                      : '—'}
                  </td>
                )}
                {estadoFiltro === 'PENDIENTE' && (
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onConfirmar(mov)}
                      className="flex items-center gap-1 px-3 h-9 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors"
                    >
                      <Check size={13} />Confirmar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
        {movimientos.map(mov => (
          <div key={mov.id} className="p-4 space-y-2 bg-white dark:bg-slate-900">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">{mov.concepto}</p>
                {mostrarBanco && mov.cuenta_nombre && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{mov.cuenta_nombre}</p>
                )}
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{fmtFecha(mov.fecha_movimiento)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-bold text-base tabular-nums ${mov.tipo_movimiento === 'INGRESO' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {mov.tipo_movimiento === 'INGRESO' ? '+' : '−'}Q{Number(mov.monto || 0).toFixed(2)}
                </p>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                  mov.estado === 'PENDIENTE' ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300' : mov.estado === 'ANULADO' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                }`}>
                  {mov.estado}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                mov.tipo_movimiento === 'INGRESO' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
              }`}>
                {mov.tipo_movimiento === 'INGRESO' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {mov.tipo_movimiento}
              </span>
              {mov.categoria && (
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md">{mov.categoria}</span>
              )}
              {mov.realizado_por && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500">{mov.realizado_por}</span>
              )}
            </div>
            {estadoFiltro === 'CONFIRMADO' && mov.confirmado_en && (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Confirmado: {fmtFechaHora(mov.confirmado_en)}{mov.confirmado_por_nombre ? ` por ${mov.confirmado_por_nombre}` : ''}
              </p>
            )}
            {estadoFiltro === 'PENDIENTE' && (
              <button
                onClick={() => onConfirmar(mov)}
                className="w-full flex items-center justify-center gap-1.5 h-9 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors active:scale-95"
              >
                <Check size={14} />Confirmar movimiento
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

