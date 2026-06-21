import { toBackendEstado } from "../../utils/estadoReparacion";
import {
  X, Upload, Trash2, AlertCircle, Camera,
  Package, Gift, CreditCard, ChevronRight, Plus, Minus,
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import API_URL from '../../services/config';
import Button from '../ui/Button';
import axios from 'axios';
import { PAYMENT_METHODS, isCardMethod } from '../../constants/paymentMethods';
import { useToast } from '../ui/Toast';

// Payment method value constants for convenience
const PM_EFECTIVO     = 'EFECTIVO';
const PM_TRANSFERENCIA = 'TRANSFERENCIA';
const PM_TARJETA_BAC  = 'TARJETA_BAC';
const PM_TARJETA_NEONET = 'TARJETA_NEONET';
const PM_TARJETA_OTRA = 'TARJETA_OTRA';

interface RepuestoUsado {
  repuestoId: number;
  nombre: string;
  cantidad: number;
  costoUnitario: number;
  subtotal: number;
  stockDisponible: number;
}

interface Regalia {
  itemId: number;
  tipo: 'repuesto' | 'producto';
  nombre: string;
  cantidad: number;
  costoUnitario: number;
  subtotal: number;
  nota: string;
  stockDisponible: number;
}

interface ModalActualizarEstadoProps {
  isOpen: boolean;
  onClose: () => void;
  reparacion: {
    id: string;
    clienteNombre: string;
    estado: string;
    total?: number;
    recepcion?: { montoAnticipo?: number };
    saldoAnticipo?: number;
  };
  onSuccess: () => void;
}

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const fmtQ = (n: number) => `Q${n.toFixed(2)}`;

export default function ModalActualizarEstado({
  isOpen, onClose, reparacion, onSuccess,
}: ModalActualizarEstadoProps) {
  const toast = useToast();
  // ── Base state ───────────────────────────────────────────────────────────────
  const [estado, setEstado]       = useState(reparacion.estado);
  const [nota, setNota]           = useState('');
  const [imagenes, setImagenes]   = useState<File[]>([]);
  const [previews, setPreviews]   = useState<string[]>([]);
  const [saving, setSaving]       = useState(false);

  // ── Pieza / espera ───────────────────────────────────────────────────────────
  const [piezaNecesaria, setPiezaNecesaria] = useState('');
  const [proveedor, setProveedor]           = useState('');
  const [costoRepuesto, setCostoRepuesto]   = useState('');

  // ── Sticker ──────────────────────────────────────────────────────────────────
  const [stickerNumero, setStickerNumero]         = useState('');
  const [stickerUbicacion, setStickerUbicacion]   = useState('');
  const [stickersDisponibles, setStickersDisponibles] = useState<any[]>([]);
  const [stickerSeleccionado, setStickerSeleccionado] = useState<any>(null);

  // ── Repuestos usados ─────────────────────────────────────────────────────────
  const [repuestosInventario, setRepuestosInventario] = useState<any[]>([]);
  const [busRepuesto, setBusRepuesto]               = useState('');
  const [repuestosUsados, setRepuestosUsados]       = useState<RepuestoUsado[]>([]);
  const [cantRepuesto, setCantRepuesto]             = useState(1);
  const [repuestoSel, setRepuestoSel]               = useState<any>(null);

  // ── Regalías ─────────────────────────────────────────────────────────────────
  const [busRegalia, setBusRegalia]               = useState('');
  const [regaliasUsadas, setRegaliasUsadas]       = useState<Regalia[]>([]);
  const [cantRegalia, setCantRegalia]             = useState(1);
  const [regaliaSel, setRegaliaSel]               = useState<any>(null);
  const [notaRegalia, setNotaRegalia]             = useState('');
  const [tipoRegalia, setTipoRegalia]             = useState<'repuesto' | 'producto'>('repuesto');
  const [productosInventario, setProductosInventario] = useState<any[]>([]);
  const busProductoTimerRef                       = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Pago final ───────────────────────────────────────────────────────────────
  const [montoPago, setMontoPago]       = useState('');
  const [metodoPago, setMetodoPago]     = useState(PM_EFECTIVO);
  const [fechaPago, setFechaPago]       = useState(localToday());
  const [observPago, setObservPago]     = useState('');
  const [cuentaBancariaId, setCuentaBancariaId] = useState<string>('');
  const [interesPorcentaje, setInteresPorcentaje] = useState<number>(0);
  const [referenciaPago, setReferenciaPago]       = useState('');
  const [cuentasBancarias, setCuentasBancarias]   = useState<any[]>([]);

  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // ── Computed financials ──────────────────────────────────────────────────────
  const totalRep          = (reparacion as any).total || 0;
  const anticipo          = (reparacion as any).recepcion?.montoAnticipo || 0;
  const saldoPend         = Math.max(0, totalRep - anticipo);
  const costoReps         = repuestosUsados.reduce((s, r) => s + r.subtotal, 0);
  const costoReg          = regaliasUsadas.reduce((s, r) => s + r.subtotal, 0);
  const pagoFinalNum      = parseFloat(montoPago) || 0;
  const interesMontoNum   = isCardMethod(metodoPago) && interesPorcentaje > 0
                              ? pagoFinalNum * interesPorcentaje / 100
                              : 0;
  const pagoConInteres    = pagoFinalNum + interesMontoNum;
  const totalPagado       = anticipo + pagoConInteres;
  const gananciaNeta      = totalRep - costoReps - costoReg;
  const estadoPago        =
    totalPagado >= totalRep && totalRep > 0 ? 'pagado' :
    totalPagado  > 0                         ? 'parcial' : 'pendiente';

  // ── Load data on open ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    loadRepuestos();
    loadStickersDisponibles();
    loadCuentasBancarias();
    // Reset COMPLETADA fields
    setRepuestosUsados([]);
    setRegaliasUsadas([]);
    setMontoPago('');
    setMetodoPago(PM_EFECTIVO);
    setFechaPago(localToday());
    setObservPago('');
    setCuentaBancariaId('');
    setInteresPorcentaje(0);
    setReferenciaPago('');
    setBusRepuesto('');
    setBusRegalia('');
    setRegaliaSel(null);
    setRepuestoSel(null);
    setCantRepuesto(1);
    setCantRegalia(1);
    setNotaRegalia('');
    setStickerSeleccionado(null);
    setStickerNumero('');
    setStickerUbicacion('');
  }, [isOpen]);

  const loadRepuestos = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.get(`${API_URL}/repuestos`, { headers: { Authorization: `Bearer ${token}` } });
      if (Array.isArray(res.data)) setRepuestosInventario(res.data);
    } catch { /* silencioso */ }
  };

  const loadStickersDisponibles = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.get(`${API_URL}/stickers/disponibles`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) setStickersDisponibles(res.data.data);
    } catch { /* silencioso */ }
  };

  const loadCuentasBancarias = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.get(`${API_URL}/caja/bancos`, { headers: { Authorization: `Bearer ${token}` } });
      if (Array.isArray(res.data)) setCuentasBancarias(res.data);
      else if (Array.isArray(res.data?.data)) setCuentasBancarias(res.data.data);
    } catch { /* silencioso */ }
  };

  const buscarProductos = useCallback((q: string) => {
    if (busProductoTimerRef.current) clearTimeout(busProductoTimerRef.current);
    if (!q.trim()) { setProductosInventario([]); return; }
    busProductoTimerRef.current = setTimeout(async () => {
      try {
        const token = sessionStorage.getItem('token');
        const res = await axios.get(
          `${API_URL}/productos?search=${encodeURIComponent(q)}&conStock=true&limit=30`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setProductosInventario(res.data?.data?.productos || res.data?.productos || []);
      } catch { setProductosInventario([]); }
    }, 350);
  }, []);

  // ── Filtered lists ───────────────────────────────────────────────────────────
  const repuestosFiltered = busRepuesto.length >= 1
    ? repuestosInventario.filter(r => r.nombre?.toLowerCase().includes(busRepuesto.toLowerCase())).slice(0, 20)
    : [];

  const regaliasFiltered = tipoRegalia === 'repuesto'
    ? (busRegalia.length >= 1
        ? repuestosInventario.filter(r => r.nombre?.toLowerCase().includes(busRegalia.toLowerCase())).slice(0, 20)
        : [])
    : productosInventario.slice(0, 20);

  // ── Repuesto handlers ────────────────────────────────────────────────────────
  const addRepuestoUsado = () => {
    if (!repuestoSel) return;
    console.log('Repuesto seleccionado:', repuestoSel);
    console.log('precio_costo detectado:', repuestoSel.precio_costo);
    const stock = repuestoSel.stock ?? 0;
    if (cantRepuesto <= 0) { toast.error('Cantidad debe ser mayor a 0'); return; }
    if (cantRepuesto > stock) { toast.error(`Stock insuficiente. Disponible: ${stock}`); return; }
    // precio_costo en repuestos está almacenado en centavos → convertir a quetzales
    const costoUnit = Number(repuestoSel.precio_costo ?? 0) / 100;
    setRepuestosUsados(prev => [...prev, {
      repuestoId: repuestoSel.id, nombre: repuestoSel.nombre,
      cantidad: cantRepuesto, costoUnitario: costoUnit,
      subtotal: costoUnit * cantRepuesto, stockDisponible: stock,
    }]);
    setRepuestoSel(null); setBusRepuesto(''); setCantRepuesto(1);
  };
  const removeRepuesto = (i: number) => setRepuestosUsados(prev => prev.filter((_, j) => j !== i));

  // ── Regalía handlers ─────────────────────────────────────────────────────────
  const addRegalia = () => {
    if (!regaliaSel) return;
    console.log('Producto/repuesto seleccionado para regalía:', regaliaSel);
    console.log('precio_costo detectado:', regaliaSel.precio_costo);
    const stock = regaliaSel.stock ?? 0;
    if (cantRegalia <= 0) { toast.error('Cantidad debe ser mayor a 0'); return; }
    if (cantRegalia > stock) { toast.error(`Stock insuficiente. Disponible: ${stock}`); return; }
    // repuestos: precio_costo en centavos → quetzales; productos: ya en quetzales
    const costoUnit = tipoRegalia === 'repuesto'
      ? Number(regaliaSel.precio_costo ?? 0) / 100
      : Number(regaliaSel.precio_costo ?? 0);
    setRegaliasUsadas(prev => [...prev, {
      itemId: regaliaSel.id, tipo: tipoRegalia, nombre: regaliaSel.nombre,
      cantidad: cantRegalia, costoUnitario: costoUnit,
      subtotal: costoUnit * cantRegalia, nota: notaRegalia, stockDisponible: stock,
    }]);
    setRegaliaSel(null); setBusRegalia(''); setCantRegalia(1); setNotaRegalia('');
  };
  const removeRegalia = (i: number) => setRegaliasUsadas(prev => prev.filter((_, j) => j !== i));

  // ── Image handlers ───────────────────────────────────────────────────────────
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
    e.target.value = '';
    if (!files.length) return;
    const toAdd = files.slice(0, 10 - imagenes.length);
    setImagenes(prev => [...prev, ...toAdd]);
    setPreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))]);
  };
  const removeImage = (i: number) => {
    setImagenes(prev => prev.filter((_, j) => j !== i));
    setPreviews(prev => prev.filter((_, j) => j !== i));
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!nota.trim()) {
      toast.warning('Por favor agrega una nota sobre el cambio de estado');
      return;
    }
    const estadoBackend = toBackendEstado(estado);

    // COMPLETADA → endpoint especial
    if (estadoBackend === 'COMPLETADA') {
      setSaving(true);
      try {
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        const fd = new FormData();
        fd.append('nota', nota);
        if (stickerSeleccionado) {
          fd.append('stickerId', String(stickerSeleccionado.id));
          fd.append('stickerNumero', stickerNumero);
          fd.append('stickerUbicacion', stickerUbicacion || '');
        }
        fd.append('repuestosUsados', JSON.stringify(
          repuestosUsados.map(r => ({ repuesto_id: r.repuestoId, cantidad: r.cantidad }))
        ));
        fd.append('regaliasUsadas', JSON.stringify(
          regaliasUsadas.map(r => ({ id: r.itemId, tipo: r.tipo, cantidad: r.cantidad, nota: r.nota, nombre: r.nombre }))
        ));
        if (pagoFinalNum > 0) {
          const necesitaBanco = metodoPago === PM_TRANSFERENCIA || metodoPago === PM_TARJETA_OTRA;
          if (necesitaBanco && !cuentaBancariaId) {
            toast.error('Debes seleccionar una cuenta bancaria para pagos con transferencia o tarjeta otra');
            setSaving(false);
            return;
          }
          fd.append('pagoFinal', JSON.stringify({
            monto:              pagoFinalNum,
            metodo:             metodoPago,
            fecha:              fechaPago,
            observacion:        observPago,
            cuenta_bancaria_id: cuentaBancariaId || null,
            porcentaje_interes: interesPorcentaje,
            referencia:         referenciaPago || null,
          }));
        }
        imagenes.forEach(img => fd.append('fotos', img));
        const res = await axios.post(
          `${API_URL}/reparaciones/${reparacion.id}/completar`, fd,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data.success) { onSuccess(); onClose(); }
        else throw new Error(res.data.message);
      } catch (err: any) {
        toast.error(err.response?.data?.message || err.message || 'Error al completar la reparación');
      } finally { setSaving(false); }
      return;
    }

    // Otros estados → endpoint existente
    setSaving(true);
    try {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      const fd = new FormData();
      fd.append('estado', estadoBackend);
      fd.append('nota', nota);
      fd.append('imageTipo', estadoBackend === 'ENTREGADA' ? 'final' : 'historial');

      if (repuestosUsados.length > 0) {
        fd.append(
          'repuestosUsados',
          JSON.stringify(
            repuestosUsados.map(r => ({
              repuesto_id: r.repuestoId,
              cantidad: r.cantidad,
            }))
          )
        );
      }

      if (estadoBackend === 'ESPERANDO_PIEZA' && piezaNecesaria) {
        fd.append('piezaNecesaria', piezaNecesaria);
        if (proveedor) fd.append('proveedor', proveedor);
        if (costoRepuesto) fd.append('costoRepuesto', costoRepuesto);
      }
      imagenes.forEach(img => fd.append('fotos', img));
      const res = await axios.post(
        `${API_URL}/reparaciones/${reparacion.id}/estado`, fd,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) { onSuccess(); onClose(); }
      else throw new Error(res.data.message || 'Error al actualizar');
    } catch (err: any) {
      const status = err.response?.status;
      const msg = status === 403
        ? (err.response?.data?.message || 'Sin permisos')
        : (err.response?.data?.message || err.message || 'Error al actualizar estado');
      toast.error(msg);
    } finally { setSaving(false); }
  };

  const getEstadoInfo = () => {
    const m: Record<string, { color: string; mensaje: string }> = {
      EN_DIAGNOSTICO:         { color: 'yellow',  mensaje: 'Agrega notas del diagnóstico y evidencias fotográficas' },
      ESPERANDO_AUTORIZACION: { color: 'yellow',  mensaje: 'Detalla qué se encontró y qué debe autorizar el cliente' },
      EN_REPARACION:          { color: 'blue',    mensaje: 'Documenta el proceso con fotos y notas' },
      ESPERANDO_PIEZA:        { color: 'orange',  mensaje: 'Especifica qué pieza se necesita y de qué proveedor' },
      COMPLETADA:             { color: 'green',   mensaje: 'Registra repuestos usados, regalías, pago final y sticker de garantía' },
      ENTREGADA:              { color: 'green',   mensaje: 'Confirma la entrega al cliente' },
    };
    return m[estado] || { color: 'gray', mensaje: 'Agrega información sobre este cambio' };
  };
  const estadoInfo = getEstadoInfo();

  // CSS helper
  const inputCls = 'w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Actualizar Estado</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{reparacion.id} · {reparacion.clienteNombre}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* ── Estado selector ─────────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nuevo Estado</label>
            <select value={estado} onChange={e => setEstado(e.target.value)} className={inputCls}>
              <option value="RECIBIDA">Recibida</option>
              <option value="EN_DIAGNOSTICO">En Diagnóstico</option>
              <option value="ESPERANDO_AUTORIZACION">Esperando Autorización</option>
              <option value="AUTORIZADA">Autorizada</option>
              <option value="EN_REPARACION">En Reparación</option>
              <option value="ESPERANDO_PIEZA">Esperando Pieza</option>
              <option value="COMPLETADA">Completada</option>
              <option value="ENTREGADA">Entregada</option>
              <option value="CANCELADA">Cancelada</option>
              <option value="STAND_BY">Stand By</option>
            </select>
          </div>

          {/* Estado info banner */}
          <div className={`bg-${estadoInfo.color}-50 dark:bg-${estadoInfo.color}-950/20 border border-${estadoInfo.color}-200 dark:border-${estadoInfo.color}-900/40 rounded-lg p-4 flex items-start gap-3`}>
            <AlertCircle size={18} className={`text-${estadoInfo.color}-600 dark:text-${estadoInfo.color}-400 mt-0.5 shrink-0`} />
            <p className="text-sm text-slate-700 dark:text-slate-300">{estadoInfo.mensaje}</p>
          </div>

          {/* ── Espera pieza ─────────────────────────────────────────────── */}
          {estado === 'ESPERANDO_PIEZA' && (
            <div className="space-y-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 p-4 rounded-xl">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Información de la Pieza</h3>
              <select onChange={e => {
                const r = repuestosInventario.find(x => x.id === parseInt(e.target.value));
                if (r) { setPiezaNecesaria(r.nombre); setProveedor(r.proveedor || ''); setCostoRepuesto(r.precio_venta ? (r.precio_venta / 100).toFixed(2) : ''); }
              }} className={inputCls}>
                <option value="">-- Seleccionar o escribir manualmente --</option>
                {repuestosInventario.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
              <input type="text" value={piezaNecesaria} onChange={e => setPiezaNecesaria(e.target.value)} className={inputCls} placeholder="Pieza Necesaria *" />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={proveedor} onChange={e => setProveedor(e.target.value)} className={inputCls} placeholder="Proveedor" />
                <input type="number" step="0.01" value={costoRepuesto} onChange={e => setCostoRepuesto(e.target.value)} className={inputCls} placeholder="Costo Estimado (Q)" />
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              COMPLETADA
          ════════════════════════════════════════════════════════════════ */}
          {estado === 'COMPLETADA' && (
            <div className="space-y-6">

              {/* Resumen saldo */}
              {totalRep > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total reparación', val: fmtQ(totalRep),  cls: 'slate' },
                    { label: 'Anticipo',          val: fmtQ(anticipo),  cls: 'blue'  },
                    { label: 'Saldo pendiente',   val: fmtQ(saldoPend), cls: saldoPend > 0 ? 'amber' : 'green' },
                  ].map(c => (
                    <div key={c.label} className={`bg-${c.cls}-50 dark:bg-${c.cls}-950/20 border border-${c.cls}-200 dark:border-${c.cls}-900/30 rounded-xl p-3 text-center`}>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{c.label}</p>
                      <p className={`text-lg font-bold text-${c.cls}-700 dark:text-${c.cls}-400`}>{c.val}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Sticker ─────────────────────────────────────────────── */}
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 p-4 rounded-xl space-y-3">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Package size={16} className="text-green-600" /> Sticker de Garantía <span className="text-xs font-normal text-slate-400">(opcional)</span>
                </h3>
                <select onChange={e => {
                  const s = stickersDisponibles.find(x => x.id === parseInt(e.target.value));
                  if (s) { setStickerSeleccionado(s); setStickerNumero(s.numero_sticker); }
                }} className={inputCls}>
                  <option value="">-- Seleccionar sticker --</option>
                  {stickersDisponibles.map(s => <option key={s.id} value={s.id}>{s.numero_sticker}</option>)}
                </select>
                {stickerNumero && (
                  <div className="bg-white dark:bg-slate-800 border border-green-300 dark:border-green-700 rounded-lg p-3 flex items-center gap-2">
                    <span className="text-xs text-slate-500">Seleccionado:</span>
                    <span className="font-mono font-bold text-green-700 dark:text-green-400 text-lg">{stickerNumero}</span>
                  </div>
                )}
                <select value={stickerUbicacion} onChange={e => setStickerUbicacion(e.target.value)} className={inputCls}>
                  <option value="">-- Ubicación del sticker --</option>
                  <option value="chasis">Chasis</option>
                  <option value="bandeja_sim">Bandeja SIM</option>
                  <option value="bateria">Batería</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              {/* ── Repuestos utilizados ─────────────────────────────────── */}
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 p-4 rounded-xl space-y-3">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Package size={16} className="text-blue-600" /> Repuestos Utilizados
                </h3>
                <div className="relative">
                  <input type="text" value={busRepuesto}
                    onChange={e => { setBusRepuesto(e.target.value); setRepuestoSel(null); }}
                    className={inputCls} placeholder="Buscar repuesto por nombre..." />
                  {repuestosFiltered.length > 0 && !repuestoSel && (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {repuestosFiltered.map(r => (
                        <button key={r.id} type="button"
                          onClick={() => { setRepuestoSel(r); setBusRepuesto(r.nombre); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-slate-700 flex justify-between items-center gap-2">
                          <span className="font-medium truncate">{r.nombre}</span>
                          <span className="text-xs text-slate-400 shrink-0">Stock: {r.stock} | {fmtQ((r.precio_costo ?? 0) / 100)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {repuestoSel && (
                  <div className="flex gap-2 items-center">
                    <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
                      <button type="button" onClick={() => setCantRepuesto(c => Math.max(1, c - 1))} className="px-2 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200"><Minus size={14} /></button>
                      <span className="px-3 text-sm font-semibold w-10 text-center">{cantRepuesto}</span>
                      <button type="button" onClick={() => setCantRepuesto(c => c + 1)} className="px-2 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200"><Plus size={14} /></button>
                    </div>
                    <button type="button" onClick={addRepuestoUsado}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5">
                      <Plus size={14} /> Agregar
                    </button>
                  </div>
                )}
                {repuestosUsados.length > 0 && (
                  <div className="rounded-lg border border-blue-200 dark:border-blue-900/40 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-blue-100 dark:bg-blue-900/30">
                        <tr>
                          <th className="px-3 py-2 text-left text-slate-600 dark:text-slate-300">Repuesto</th>
                          <th className="px-2 py-2 text-center text-slate-600 dark:text-slate-300">Cant.</th>
                          <th className="px-2 py-2 text-right text-slate-600 dark:text-slate-300">Subtotal</th>
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-blue-100 dark:divide-blue-900/20">
                        {repuestosUsados.map((r, i) => (
                          <tr key={i} className="bg-white dark:bg-slate-800/50">
                            <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200 truncate max-w-[180px]">{r.nombre}</td>
                            <td className="px-2 py-2 text-center text-slate-600 dark:text-slate-400">{r.cantidad}</td>
                            <td className="px-2 py-2 text-right font-semibold text-blue-700 dark:text-blue-400">{fmtQ(r.subtotal)}</td>
                            <td className="px-1 py-2 text-center">
                              <button type="button" onClick={() => removeRepuesto(i)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-blue-50 dark:bg-blue-900/20">
                          <td colSpan={2} className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300">Total costo repuestos</td>
                          <td className="px-2 py-2 text-right font-bold text-blue-800 dark:text-blue-300">{fmtQ(costoReps)}</td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ── Regalías ─────────────────────────────────────────────── */}
              <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 p-4 rounded-xl space-y-3">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Gift size={16} className="text-purple-600" /> Regalías / Cortesías
                </h3>
                <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden w-fit text-xs">
                  {(['repuesto', 'producto'] as const).map(t => (
                    <button key={t} type="button"
                      onClick={() => { setTipoRegalia(t); setRegaliaSel(null); setBusRegalia(''); setProductosInventario([]); }}
                      className={`px-3 py-1.5 font-medium capitalize transition-colors ${tipoRegalia === t ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-purple-50'}`}>
                      {t === 'repuesto' ? 'Repuesto' : 'Producto'}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <input type="text" value={busRegalia}
                    onChange={e => { setBusRegalia(e.target.value); setRegaliaSel(null); if (tipoRegalia === 'producto') buscarProductos(e.target.value); }}
                    className={inputCls} placeholder={`Buscar ${tipoRegalia === 'repuesto' ? 'repuesto' : 'producto'}...`} />
                  {regaliasFiltered.length > 0 && !regaliaSel && (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {regaliasFiltered.map(r => (
                        <button key={r.id} type="button"
                          onClick={() => { setRegaliaSel(r); setBusRegalia(r.nombre); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 dark:hover:bg-slate-700 flex justify-between items-center gap-2">
                          <span className="font-medium truncate">{r.nombre}</span>
                          <span className="text-xs text-slate-400 shrink-0">Stock: {r.stock}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {regaliaSel && (
                  <div className="space-y-2">
                    <div className="flex gap-2 items-center">
                      <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
                        <button type="button" onClick={() => setCantRegalia(c => Math.max(1, c - 1))} className="px-2 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200"><Minus size={14} /></button>
                        <span className="px-3 text-sm font-semibold w-10 text-center">{cantRegalia}</span>
                        <button type="button" onClick={() => setCantRegalia(c => c + 1)} className="px-2 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200"><Plus size={14} /></button>
                      </div>
                      <input type="text" value={notaRegalia} onChange={e => setNotaRegalia(e.target.value)}
                        className={`${inputCls} flex-1`} placeholder="Nota (ej: cortesía por demora)" />
                    </div>
                    <button type="button" onClick={addRegalia}
                      className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5">
                      <Plus size={14} /> Agregar Regalía
                    </button>
                  </div>
                )}
                {regaliasUsadas.length > 0 && (
                  <div className="rounded-lg border border-purple-200 dark:border-purple-900/40 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-purple-100 dark:bg-purple-900/30">
                        <tr>
                          <th className="px-3 py-2 text-left text-slate-600 dark:text-slate-300">Ítem</th>
                          <th className="px-2 py-2 text-center text-slate-600 dark:text-slate-300">Cant.</th>
                          <th className="px-2 py-2 text-right text-slate-600 dark:text-slate-300">Costo</th>
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-100 dark:divide-purple-900/20">
                        {regaliasUsadas.map((r, i) => (
                          <tr key={i} className="bg-white dark:bg-slate-800/50">
                            <td className="px-3 py-2">
                              <p className="font-medium text-slate-700 dark:text-slate-200 truncate max-w-[160px]">{r.nombre}</p>
                              {r.nota && <p className="text-slate-400 text-[10px] truncate">{r.nota}</p>}
                            </td>
                            <td className="px-2 py-2 text-center">{r.cantidad}</td>
                            <td className="px-2 py-2 text-right font-semibold text-purple-700 dark:text-purple-400">{fmtQ(r.subtotal)}</td>
                            <td className="px-1 py-2 text-center">
                              <button type="button" onClick={() => removeRegalia(i)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-purple-50 dark:bg-purple-900/20">
                          <td colSpan={2} className="px-3 py-2 font-bold text-slate-600 dark:text-slate-300">Total costo regalías</td>
                          <td className="px-2 py-2 text-right font-bold text-purple-800 dark:text-purple-300">{fmtQ(costoReg)}</td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ── Pago final ───────────────────────────────────────────── */}
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 p-4 rounded-xl space-y-3">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <CreditCard size={16} className="text-emerald-600" /> Pago Final
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Monto base (Q)</label>
                    <input type="number" step="0.01" min="0" value={montoPago} onChange={e => setMontoPago(e.target.value)} className={inputCls} placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Método de pago</label>
                    <select value={metodoPago} onChange={e => {
                      setMetodoPago(e.target.value);
                      setCuentaBancariaId('');
                      setInteresPorcentaje(0);
                    }} className={inputCls}>
                      <option value={PM_EFECTIVO}>Efectivo</option>
                      <option value={PM_TRANSFERENCIA}>Transferencia</option>
                      <option value={PM_TARJETA_BAC}>Tarjeta BAC</option>
                      <option value={PM_TARJETA_NEONET}>Tarjeta Neonet</option>
                      <option value={PM_TARJETA_OTRA}>Tarjeta Otra</option>
                    </select>
                  </div>
                </div>

                {/* BAC / NEONET — banco auto, solo badge informativo */}
                {(metodoPago === PM_TARJETA_BAC || metodoPago === PM_TARJETA_NEONET) && (
                  <div className="rounded-lg px-3 py-2 text-xs font-medium border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400">
                    {metodoPago === PM_TARJETA_BAC ? '💳 POS BAC — Cuenta BAC' : '💳 POS NEONET — Banco Industrial'}
                  </div>
                )}

                {/* Selector de cuenta — solo para Transferencia y Tarjeta Otra */}
                {(metodoPago === PM_TRANSFERENCIA || metodoPago === PM_TARJETA_OTRA) && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      {metodoPago === PM_TRANSFERENCIA ? 'Cuenta bancaria destino' : 'POS / Cuenta bancaria'} *
                    </label>
                    <select value={cuentaBancariaId} onChange={e => setCuentaBancariaId(e.target.value)} className={inputCls}>
                      <option value="">-- Seleccionar cuenta --</option>
                      {cuentasBancarias.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.nombre}{c.numero_cuenta ? ` — ${c.numero_cuenta}` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Interés tarjeta */}
                {isCardMethod(metodoPago) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Recargo tarjeta (%)</label>
                      <input type="number" step="0.01" min="0" max="50"
                        value={interesPorcentaje === 0 ? '' : interesPorcentaje}
                        onChange={e => setInteresPorcentaje(parseFloat(e.target.value) || 0)}
                        className={inputCls} placeholder="0.00" />
                    </div>
                    {interesPorcentaje > 0 && pagoFinalNum > 0 && (
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Recargo calculado</label>
                        <div className="px-3 py-2 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/30 rounded-lg text-sm font-semibold text-orange-700 dark:text-orange-400">
                          + {fmtQ(interesMontoNum)} → Total: {fmtQ(pagoConInteres)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Referencia / últimos 4 dígitos */}
                {(metodoPago !== PM_EFECTIVO) && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      {isCardMethod(metodoPago) ? 'Últimos 4 dígitos de la tarjeta' : 'Número de referencia'}
                    </label>
                    <input type="text" value={referenciaPago} onChange={e => setReferenciaPago(e.target.value)}
                      className={inputCls} placeholder={isCardMethod(metodoPago) ? '1234' : 'REF-XXXX'} maxLength={50} />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Fecha de pago</label>
                    <input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Estado de pago</label>
                    <div className={`text-sm font-bold px-3 py-2 rounded-lg text-center ${
                      estadoPago === 'pagado'  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      estadoPago === 'parcial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {estadoPago === 'pagado' ? '✓ Pagado' : estadoPago === 'parcial' ? '⚡ Parcial' : '⏳ Pendiente'}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Observación del pago</label>
                  <input type="text" value={observPago} onChange={e => setObservPago(e.target.value)} className={inputCls} placeholder="Ej: Pago completo al entregar equipo" />
                </div>
              </div>

              {/* ── Resumen financiero ───────────────────────────────────── */}
              {totalRep > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2 text-sm">
                  <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                    <ChevronRight size={16} /> Resumen Financiero
                  </h3>
                  {[
                    { label: 'Total reparación',  val: fmtQ(totalRep),           cls: 'text-slate-700 dark:text-slate-200' },
                    { label: 'Anticipo recibido', val: `+ ${fmtQ(anticipo)}`,     cls: 'text-blue-600 dark:text-blue-400' },
                    { label: 'Pago final (base)', val: `+ ${fmtQ(pagoFinalNum)}`, cls: 'text-emerald-600 dark:text-emerald-400' },
                    ...(interesMontoNum > 0 ? [{ label: `Recargo tarjeta (${interesPorcentaje}%)`, val: `+ ${fmtQ(interesMontoNum)}`, cls: 'text-orange-500 dark:text-orange-400' }] : []),
                    { label: 'Total pagado',      val: fmtQ(totalPagado),         cls: 'font-bold text-slate-700 dark:text-slate-200' },
                    { label: 'Costo repuestos',   val: `- ${fmtQ(costoReps)}`,    cls: 'text-orange-600 dark:text-orange-400' },
                    { label: 'Costo regalías',    val: `- ${fmtQ(costoReg)}`,     cls: 'text-purple-600 dark:text-purple-400' },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">{r.label}</span>
                      <span className={r.cls}>{r.val}</span>
                    </div>
                  ))}
                  <div className="border-t border-slate-300 dark:border-slate-600 pt-2 flex justify-between items-center">
                    <span className="font-bold text-slate-700 dark:text-slate-200">Ganancia neta estimada</span>
                    <span className={`font-bold text-base ${gananciaNeta >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {fmtQ(gananciaNeta)}
                    </span>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ── Notas ────────────────────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Notas / Observaciones *
            </label>
            <textarea
              value={nota}
              onChange={e => setNota(e.target.value)}
              rows={3}
              className={inputCls}
              placeholder="Describe los detalles del estado actual, trabajo realizado, etc."
            />
          </div>

          {/* ── Imágenes ─────────────────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {(estado === 'COMPLETADA' || estado === 'ENTREGADA') ? 'Fotos del equipo terminado' : 'Imágenes de Evidencia'}
            </label>
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-5 text-center">
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageChange} className="sr-only" />
              <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handleImageChange} className="sr-only" />
              <Upload size={36} className="text-slate-400 mb-2 mx-auto" />
              <p className="text-xs text-slate-500 mb-3">Máximo 10 imágenes</p>
              <div className="flex gap-2 justify-center flex-wrap">
                <button type="button" onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium">
                  <Camera size={15} /> Tomar foto
                </button>
                <button type="button" onClick={() => galleryInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium">
                  <Upload size={15} /> Galería
                </button>
              </div>
            </div>
            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mt-4">
                {previews.map((p, i) => (
                  <div key={i} className="relative group">
                    <img src={p} alt="" className="w-full h-28 object-cover rounded-lg" />
                    <button type="button" onClick={() => removeImage(i)}
                      className="absolute top-1.5 right-1.5 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="sticky bottom-0 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando...' : estado === 'COMPLETADA' ? 'Completar Reparación' : 'Guardar Cambios'}
          </Button>
        </div>

      </div>
    </div>
  );
}
