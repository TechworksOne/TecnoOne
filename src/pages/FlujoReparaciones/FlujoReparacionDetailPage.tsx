import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, Camera, Save, CalendarDays, Clock, UserCheck, UserX, RefreshCw, AlertCircle } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { getAllReparaciones } from '../../services/repairService';
import { patchFechaEntrega, deleteFechaEntrega } from '../../services/agendaService';
import { getTecnicos, asignarTecnico } from '../../services/otService';
import type { Tecnico } from '../../types/ot';
import { useAuth } from '../../store/useAuth';
import { isAdmin } from '../../lib/permissions';
import API_URL from '../../services/config';
import axios from 'axios';
import { useToast } from '../../components/ui/Toast';
import ConfirmModal from '../../components/ui/ConfirmModal';

interface CheckItem {
  id: string;
  label: string;
  checked: boolean;
}

interface ChecksGenerales {
  enciende: boolean;
  tactilFunciona: boolean;
  pantallaOk: boolean;
  bateriaOk: boolean;
  cargaOk: boolean;
}

interface CuentaBancaria {
  id: number;
  nombre: string;
  numero_cuenta: string;
  tipo_cuenta: string;
}

export default function FlujoReparacionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [reparacion, setReparacion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const userIsAdmin = isAdmin(user?.roles);

  // OT: técnico asignado
  const [tecnicos,       setTecnicos]       = useState<Tecnico[]>([]);
  const [showOTModal,    setShowOTModal]     = useState(false);
  const [otSelectedId,   setOtSelectedId]   = useState<number | ''>('');
  const [otSaving,       setOtSaving]        = useState(false);
  const [otError,        setOtError]         = useState('');

  // ─── Entrega programada ─────────────────────────────────────────────────
  const [showEntregaModal, setShowEntregaModal] = useState(false);
  const [entregaFecha, setEntregaFecha] = useState('');
  const [entregaHora, setEntregaHora] = useState('');
  const [entregaNota, setEntregaNota] = useState('');
  const [savingEntrega, setSavingEntrega] = useState(false);
  const [confirmQuitarEntrega, setConfirmQuitarEntrega] = useState(false);

  const abrirEntregaModal = () => {
    if (reparacion?.fechaEntregaProgramada) {
      const d = new Date(String(reparacion.fechaEntregaProgramada).replace(' ', 'T'));
      setEntregaFecha(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
      setEntregaHora(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`);
    } else {
      setEntregaFecha('');
      setEntregaHora('');
    }
    setEntregaNota(reparacion?.notaEntregaProgramada ?? '');
    setShowEntregaModal(true);
  };

  const guardarEntrega = async () => {
    if (!reparacion || !entregaFecha) return;
    setSavingEntrega(true);
    try {
      const datetime = entregaHora ? `${entregaFecha}T${entregaHora}:00` : `${entregaFecha}T00:00:00`;
      await patchFechaEntrega(reparacion.id, {
        fecha_entrega_programada: datetime,
        nota_entrega_programada: entregaNota || undefined,
      });
      // Refrescar datos
      const updated = (await getAllReparaciones()).find((r: any) => r.id === reparacion.id);
      if (updated) setReparacion(updated);
      setShowEntregaModal(false);
    } catch (e) {
      toast.error('Error al guardar fecha de entrega');
    } finally {
      setSavingEntrega(false);
    }
  };

  const quitarEntrega = async () => {
    if (!reparacion) return;
    setSavingEntrega(true);
    setConfirmQuitarEntrega(false);
    try {
      await deleteFechaEntrega(reparacion.id);
      const updated = (await getAllReparaciones()).find((r: any) => r.id === reparacion.id);
      if (updated) setReparacion(updated);
      setShowEntregaModal(false);
    } catch { toast.error('Error al eliminar'); } finally { setSavingEntrega(false); }
  };
  
  // Checks generales
  const [checksGenerales, setChecksGenerales] = useState<ChecksGenerales>({
    enciende: true,
    tactilFunciona: true,
    pantallaOk: true,
    bateriaOk: true,
    cargaOk: true
  });

  // Checks específicos según tipo de equipo
  const [checksTelefono, setChecksTelefono] = useState<CheckItem[]>([
    { id: 'senal', label: 'Señal de red / Antena', checked: true },
    { id: 'wifi', label: 'WiFi', checked: true },
    { id: 'bluetooth', label: 'Bluetooth', checked: true },
    { id: 'gps', label: 'GPS / Ubicación', checked: true },
    { id: 'datos', label: 'Datos móviles / 4G/5G', checked: true },
    { id: 'camaraTrasera', label: 'Cámara trasera', checked: true },
    { id: 'camaraFrontal', label: 'Cámara frontal / Selfie', checked: true },
    { id: 'flash', label: 'Flash / Linterna', checked: true },
    { id: 'zoom', label: 'Zoom de cámara', checked: true },
    { id: 'bocina', label: 'Bocina / Altavoz', checked: true },
    { id: 'auricular', label: 'Auricular / Altavoz de llamadas', checked: true },
    { id: 'microfono', label: 'Micrófono principal', checked: true },
    { id: 'microfonoLlamadas', label: 'Micrófono de llamadas', checked: true },
    { id: 'vibrador', label: 'Vibrador / Motor de vibración', checked: true },
    { id: 'botonesVolumen', label: 'Botones de volumen', checked: true },
    { id: 'botonEncendido', label: 'Botón de encendido / Power', checked: true },
    { id: 'botonHome', label: 'Botón Home / Inicio', checked: true },
    { id: 'sensorHuella', label: 'Sensor de huella dactilar', checked: true },
    { id: 'faceId', label: 'Face ID / Reconocimiento facial', checked: true },
    { id: 'sensorProximidad', label: 'Sensor de proximidad', checked: true },
    { id: 'sensorLuz', label: 'Sensor de luz ambiental', checked: true },
    { id: 'nfc', label: 'NFC / Pagos móviles', checked: true },
    { id: 'infrarrojo', label: 'Infrarrojo / Control remoto', checked: true },
    { id: 'jackAudifonos', label: 'Jack de audífonos 3.5mm', checked: true },
    { id: 'puertoCarga', label: 'Puerto de carga', checked: true },
    { id: 'cargaRapida', label: 'Carga rápida', checked: true },
    { id: 'cargaInalambrica', label: 'Carga inalámbrica', checked: true },
    { id: 'simCard', label: 'Lector de SIM / Bandeja', checked: true },
    { id: 'sdCard', label: 'Lector de tarjeta SD', checked: true },
    { id: 'rotation', label: 'Rotación automática de pantalla', checked: true },
    { id: 'notificaciones', label: 'LED de notificaciones', checked: true }
  ]);

  const [checksTablet, setChecksTablet] = useState<CheckItem[]>([
    { id: 'wifi', label: 'WiFi', checked: true },
    { id: 'bluetooth', label: 'Bluetooth', checked: true },
    { id: 'gps', label: 'GPS', checked: true },
    { id: 'camaraTrasera', label: 'Cámara trasera', checked: true },
    { id: 'camaraFrontal', label: 'Cámara frontal', checked: true },
    { id: 'flash', label: 'Flash', checked: true },
    { id: 'bocinas', label: 'Bocinas / Altavoces', checked: true },
    { id: 'microfono', label: 'Micrófono', checked: true },
    { id: 'acelerometro', label: 'Acelerómetro', checked: true },
    { id: 'giroscopio', label: 'Giroscopio', checked: true },
    { id: 'sensorLuz', label: 'Sensor de luz', checked: true },
    { id: 'puertoCarga', label: 'Puerto de carga', checked: true },
    { id: 'jackAudifonos', label: 'Jack de audífonos', checked: true },
    { id: 'botonesVolumen', label: 'Botones de volumen', checked: true },
    { id: 'botonEncendido', label: 'Botón de encendido', checked: true },
    { id: 'simCard', label: 'Lector de SIM (si aplica)', checked: true },
    { id: 'sdCard', label: 'Lector de tarjeta SD', checked: true },
    { id: 'rotation', label: 'Rotación de pantalla', checked: true }
  ]);

  const [checksComputadora, setChecksComputadora] = useState<CheckItem[]>([
    { id: 'teclado', label: 'Teclado completo', checked: true },
    { id: 'teclasFuncion', label: 'Teclas de función (F1-F12)', checked: true },
    { id: 'touchpad', label: 'Touchpad / Mouse táctil', checked: true },
    { id: 'clickTouchpad', label: 'Click del touchpad', checked: true },
    { id: 'puertosUsb', label: 'Puertos USB', checked: true },
    { id: 'usbC', label: 'Puerto USB-C', checked: true },
    { id: 'puertoHdmi', label: 'Puerto HDMI', checked: true },
    { id: 'puertoVga', label: 'Puerto VGA', checked: true },
    { id: 'ethernet', label: 'Puerto Ethernet / RJ45', checked: true },
    { id: 'lectorSd', label: 'Lector de tarjetas SD', checked: true },
    { id: 'webcam', label: 'Webcam / Cámara', checked: true },
    { id: 'microfono', label: 'Micrófono integrado', checked: true },
    { id: 'bocinas', label: 'Bocinas / Altavoces', checked: true },
    { id: 'jackAudifonos', label: 'Jack de audífonos', checked: true },
    { id: 'wifi', label: 'WiFi', checked: true },
    { id: 'bluetooth', label: 'Bluetooth', checked: true },
    { id: 'lectorHuella', label: 'Lector de huella', checked: true },
    { id: 'retroiluminacion', label: 'Retroiluminación de teclado', checked: true },
    { id: 'ventilador', label: 'Ventilador / Cooling', checked: true },
    { id: 'bisagras', label: 'Bisagras de la pantalla', checked: true },
    { id: 'unidadOptica', label: 'Unidad óptica (CD/DVD)', checked: true }
  ]);

  const [observaciones, setObservaciones] = useState('');
  const [existeCheck, setExisteCheck] = useState(false);
  
  // Estados para anticipo
  const [dejoAnticipo, setDejoAnticipo] = useState(false);
  const [montoAnticipo, setMontoAnticipo] = useState('');
  const [metodoAnticipo, setMetodoAnticipo] = useState<'efectivo' | 'transferencia'>('efectivo');
  const [cuentaBancariaId, setCuentaBancariaId] = useState<string>('');
  const [cuentasBancarias, setCuentasBancarias] = useState<CuentaBancaria[]>([]);
  const [anticipo_confirmado, setAnticipoConfirmado] = useState(false);

  useEffect(() => {
    loadReparacion();
  }, [id]);

  useEffect(() => {
    if (userIsAdmin) {
      getTecnicos().then(setTecnicos).catch(() => {});
    }
  }, [userIsAdmin]);

  // Cargar cuentas bancarias para selector de transferencia
  useEffect(() => {
    const loadBancos = async () => {
      try {
        const token = sessionStorage.getItem('token');
        const response = await axios.get(`${API_URL}/caja/bancos`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data.success) {
          setCuentasBancarias(response.data.data);
        }
      } catch (error) {
        console.error('Error cargando cuentas bancarias:', error);
      }
    };
    loadBancos();
  }, []);

  const loadReparacion = async () => {
    try {
      setLoading(true);
      const response = await getAllReparaciones();
      const data = Array.isArray(response) ? response : (response as any).data || [];
      const rep = data.find((r: any) => r.id === id);
      
      if (rep) {
        console.log('Reparación cargada:', rep);
        console.log('Tipo de equipo:', rep.recepcion?.tipoEquipo);
        console.log('Checks telefono length:', checksTelefono.length);
        setReparacion(rep);
        // Verificar si ya existe un checklist
        await loadChecklistExistente(id!);
      }
    } catch (error) {
      console.error('Error loading reparacion:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChecklistExistente = async (reparacionId: string) => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/check-equipo/reparacion/${reparacionId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          validateStatus: (status) => status < 500 // No lanzar error en 404
        }
      );

      if (response.data.success && response.data.data) {
        const check = response.data.data;
        setExisteCheck(true);
        
        // Cargar checks generales
        setChecksGenerales({
          enciende: check.enciende,
          tactilFunciona: check.tactil_funciona,
          pantallaOk: check.pantalla_ok,
          bateriaOk: check.bateria_ok,
          cargaOk: check.carga_ok
        });

        // Cargar checks específicos según tipo
        if (check.telefono_checks) {
          const telefonoData = check.telefono_checks;
          setChecksTelefono(prev => prev.map(item => ({
            ...item,
            checked: telefonoData[item.id] || false
          })));
        }
        if (check.tablet_checks) {
          const tabletData = check.tablet_checks;
          setChecksTablet(prev => prev.map(item => ({
            ...item,
            checked: tabletData[item.id] || false
          })));
        }
        if (check.computadora_checks) {
          const computadoraData = check.computadora_checks;
          setChecksComputadora(prev => prev.map(item => ({
            ...item,
            checked: computadoraData[item.id] || false
          })));
        }

        setObservaciones(check.observaciones || '');
        
        // Cargar datos de anticipo si existen
        if (check.monto_anticipo && check.monto_anticipo > 0) {
          setDejoAnticipo(true);
          setMontoAnticipo((check.monto_anticipo / 100).toFixed(2));
          setMetodoAnticipo(check.metodo_anticipo || 'efectivo');
          if (check.cuenta_bancaria_anticipo_id) {
            setCuentaBancariaId(check.cuenta_bancaria_anticipo_id.toString());
          }
        }
        setAnticipoConfirmado(check.anticipo_confirmado || false);
      }
    } catch (error) {
      // No existe checklist aún, está bien
      setExisteCheck(false);
    }
  };

  const handleSaveChecklist = async () => {
    if (!reparacion) return;

    // Validación de anticipo
    if (dejoAnticipo && (!montoAnticipo || parseFloat(montoAnticipo) <= 0)) {
      toast.warning('Por favor ingresa el monto del anticipo');
      return;
    }
    if (dejoAnticipo && metodoAnticipo === 'transferencia' && !cuentaBancariaId) {
      toast.warning('Selecciona una cuenta bancaria para el anticipo por transferencia');
      return;
    }

    setSaving(true);
    try {
      const token = sessionStorage.getItem('token');
      
      // Preparar checks específicos según tipo de equipo
      let checksEspecificos = {};
      const tipoEquipo = reparacion.recepcion?.tipoEquipo;
      
      if (tipoEquipo === 'Telefono') {
        checksEspecificos = checksTelefono.reduce((acc, item) => ({
          ...acc,
          [item.id]: item.checked
        }), {});
      } else if (tipoEquipo === 'Tablet') {
        checksEspecificos = checksTablet.reduce((acc, item) => ({
          ...acc,
          [item.id]: item.checked
        }), {});
      } else if (tipoEquipo === 'Laptop' || tipoEquipo === 'Computadora') {
        checksEspecificos = checksComputadora.reduce((acc, item) => ({
          ...acc,
          [item.id]: item.checked
        }), {});
      }

      const data = {
        reparacionId: reparacion.id,
        tipoEquipo: tipoEquipo,
        checksGenerales,
        checksEspecificos,
        observaciones,
        fotosChecklist: [],
        realizadoPor: 'Usuario', // TODO: Obtener del contexto de autenticación
        dejoAnticipo,
        montoAnticipo: dejoAnticipo ? Math.round(parseFloat(montoAnticipo) * 100) : 0, // Convertir a centavos
        metodoAnticipo: dejoAnticipo ? metodoAnticipo : null,
        cuentaBancariaId: dejoAnticipo && metodoAnticipo === 'transferencia' ? parseInt(cuentaBancariaId) : null
      };

      await axios.post(
        `${API_URL}/check-equipo`,
        data,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const mensaje = existeCheck
        ? 'Checklist actualizado exitosamente.'
        : 'Checklist guardado exitosamente. Estado de reparación actualizado a RECIBIDA.';
      if (dejoAnticipo) {
        const metodoLabel = metodoAnticipo === 'efectivo' ? 'Efectivo' : 'Transferencia';
        toast.success(`${mensaje} Anticipo Q${montoAnticipo} (${metodoLabel}) registrado como PENDIENTE.`);
      } else {
        toast.success(mensaje);
      }
      navigate('/flujo-reparaciones');

    } catch (error: any) {
      console.error('Error saving checklist:', error);
      if (error.response?.status === 409) {
        toast.error('No se puede modificar el anticipo: ya fue confirmado en Caja/Bancos.');
        setAnticipoConfirmado(true);
      } else {
        toast.error('Error al guardar el checklist');
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleCheckGeneral = (key: keyof ChecksGenerales) => {
    setChecksGenerales(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleCheckEspecifico = (tipo: 'telefono' | 'tablet' | 'computadora', id: string) => {
    if (tipo === 'telefono') {
      setChecksTelefono(prev => prev.map(item =>
        item.id === id ? { ...item, checked: !item.checked } : item
      ));
    } else if (tipo === 'tablet') {
      setChecksTablet(prev => prev.map(item =>
        item.id === id ? { ...item, checked: !item.checked } : item
      ));
    } else {
      setChecksComputadora(prev => prev.map(item =>
        item.id === id ? { ...item, checked: !item.checked } : item
      ));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 ml-0 md:ml-64 p-4 md:p-8">
        <div className="text-center py-12">Cargando...</div>
      </div>
    );
  }

  if (!reparacion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 ml-0 md:ml-64 p-4 md:p-8">
        <div className="text-center py-12">Reparación no encontrada</div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 ml-0 md:ml-64 p-4 md:p-8">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/flujo-reparaciones')}
          className="mb-4"
        >
          <ArrowLeft size={20} className="mr-2" />
          Volver
        </Button>

        <PageHeader
          title={`Reparación ${reparacion.id}`}
          subtitle="Checklist de ingreso de equipo"
        />
      </div>

      {/* Información de la reparación */}
      <Card className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Información del Equipo</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-slate-600">Cliente</p>
            <p className="font-semibold">{reparacion.cliente_nombre}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Teléfono</p>
            <p className="font-semibold">{reparacion.cliente_telefono}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Tipo de Equipo</p>
            <p className="font-semibold">{reparacion.recepcion?.tipoEquipo}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Marca / Modelo</p>
            <p className="font-semibold">{reparacion.recepcion?.marca} {reparacion.recepcion?.modelo}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Color</p>
            <p className="font-semibold">{reparacion.recepcion?.color}</p>
          </div>
          {reparacion.recepcion?.imei && (
            <div>
              <p className="text-sm text-slate-600">IMEI/Serie</p>
              <p className="font-semibold">{reparacion.recepcion.imei}</p>
            </div>
          )}
        </div>
        {reparacion.recepcion?.diagnosticoInicial && (
          <div className="mt-4">
            <p className="text-sm text-slate-600">Diagnóstico Inicial</p>
            <p className="text-slate-800">{reparacion.recepcion.diagnosticoInicial}</p>
          </div>
        )}
      </Card>

      {/* ── Entrega programada ── */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-sky-400" />
            <h3 className="text-base font-semibold">Entrega programada</h3>
          </div>
          <button
            onClick={abrirEntregaModal}
            className="text-sm px-3 py-1.5 rounded-xl font-medium text-white"
            style={{ background: '#48B9E6' }}
          >
            {reparacion.fechaEntregaProgramada ? 'Editar fecha' : 'Programar entrega'}
          </button>
        </div>
        {reparacion.fechaEntregaProgramada ? (
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <CalendarDays size={14} className="text-slate-400" />
              <span className="font-semibold">
                {new Date(String(reparacion.fechaEntregaProgramada).replace(' ','T')).toLocaleDateString('es-GT',{day:'2-digit',month:'long',year:'numeric'})}
              </span>
            </div>
            {(() => {
              const d = new Date(String(reparacion.fechaEntregaProgramada).replace(' ','T'));
              const h = d.getHours(), m = d.getMinutes();
              return (h !== 0 || m !== 0) ? (
                <div className="flex items-center gap-1.5">
                  <Clock size={14} className="text-slate-400" />
                  <span>{d.toLocaleTimeString('es-GT',{hour:'2-digit',minute:'2-digit',hour12:true})}</span>
                </div>
              ) : null;
            })()}
            {reparacion.notaEntregaProgramada && (
              <p className="text-slate-500 italic">{reparacion.notaEntregaProgramada}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">Sin fecha de entrega programada</p>
        )}
      </Card>

      {/* ── Orden de Trabajo ── */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <UserCheck size={18} className="text-blue-500" />
            <h3 className="text-base font-semibold">Orden de Trabajo</h3>
          </div>
          {userIsAdmin && reparacion.estado !== 'CANCELADA' && (
            <button
              onClick={() => { setOtSelectedId(reparacion.tecnicoAsignadoId ?? ''); setOtError(''); setShowOTModal(true); }}
              className="text-sm px-3 py-1.5 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              {reparacion.tecnicoAsignadoId ? 'Cambiar técnico' : 'Asignar técnico'}
            </button>
          )}
        </div>
        {reparacion.tecnicoAsignadoId ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-0.5">Técnico asignado</p>
              <p className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                <UserCheck size={14} />
                {reparacion.tecnicoNombre?.trim() && reparacion.tecnicoNombre !== ' '
                  ? reparacion.tecnicoNombre
                  : reparacion.tecnicoUsername}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-0.5">Asignado por</p>
              <p className="font-medium text-slate-700 dark:text-slate-300">
                {reparacion.asignadoPorNombre?.trim() && reparacion.asignadoPorNombre !== ' '
                  ? reparacion.asignadoPorNombre
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-0.5">Fecha asignación</p>
              <p className="font-medium text-slate-700 dark:text-slate-300">
                {reparacion.asignadoEn
                  ? new Date(reparacion.asignadoEn).toLocaleString('es-GT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : '—'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <UserX size={15} />
            <span>Sin técnico asignado</span>
          </div>
        )}
      </Card>

      {/* Modal asignar técnico (OT) */}
      {showOTModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl shadow-2xl bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <p className="font-semibold flex items-center gap-2"><UserCheck size={16} className="text-blue-500" /> Asignar Técnico</p>
              <button onClick={() => setShowOTModal(false)}><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <select
                value={otSelectedId}
                onChange={e => { setOtSelectedId(e.target.value ? Number(e.target.value) : ''); setOtError(''); }}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="">— Seleccionar técnico —</option>
                {tecnicos.map(t => (
                  <option key={t.id} value={t.id}>
                    {(t.nombre_completo?.trim() && t.nombre_completo !== ' ') ? t.nombre_completo : t.username}
                    {t.id === user?.id ? ' (yo)' : ''} — {t.roles.join(', ')}
                  </option>
                ))}
              </select>
              {otError && (
                <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
                  <AlertCircle size={12} /> {otError}
                </div>
              )}
            </div>
            <div className="flex gap-2 p-4 border-t border-slate-200 dark:border-slate-700 justify-end">
              <button
                onClick={() => setShowOTModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >Cancelar</button>
              <button
                disabled={otSaving || !otSelectedId}
                onClick={async () => {
                  if (!otSelectedId) { setOtError('Selecciona un técnico'); return; }
                  try {
                    setOtSaving(true); setOtError('');
                    await asignarTecnico(reparacion.id, { tecnico_id: otSelectedId as number });
                    const updated = (await getAllReparaciones()).find((r: any) => r.id === reparacion.id);
                    if (updated) setReparacion(updated);
                    setShowOTModal(false);
                  } catch (e: any) {
                    setOtError(e?.response?.data?.message || 'Error al asignar técnico');
                  } finally { setOtSaving(false); }
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {otSaving ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                {otSaving ? 'Asignando…' : 'Asignar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal programar entrega */}
      {showEntregaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl shadow-2xl bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <p className="font-semibold flex items-center gap-2"><CalendarDays size={16} className="text-sky-400" /> Programar entrega</p>
              <button onClick={() => setShowEntregaModal(false)}><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-600">Fecha *</label>
                <input type="date" value={entregaFecha} onChange={e => setEntregaFecha(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-600">Hora (opcional)</label>
                <input type="time" value={entregaHora} onChange={e => setEntregaHora(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-600">Nota (opcional)</label>
                <textarea value={entregaNota} onChange={e => setEntregaNota(e.target.value)} rows={2}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400 resize-none" />
              </div>
            </div>
            <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-700 gap-2">
              {reparacion.fechaEntregaProgramada && (
                <button onClick={() => setConfirmQuitarEntrega(true)} disabled={savingEntrega}
                  className="text-sm text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50">
                  Quitar
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button onClick={() => setShowEntregaModal(false)}
                  className="px-3 py-1.5 text-sm rounded-xl border border-slate-300 text-slate-600">
                  Cancelar
                </button>
                <button onClick={guardarEntrega} disabled={savingEntrega || !entregaFecha}
                  className="px-4 py-1.5 text-sm rounded-xl font-medium text-white disabled:opacity-50"
                  style={{ background: '#48B9E6' }}>
                  {savingEntrega ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checks Generales */}
      <Card className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Checks Generales</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(checksGenerales).map(([key, value]) => (
            <button
              key={key}
              onClick={() => toggleCheckGeneral(key as keyof ChecksGenerales)}
              className={`p-3 md:p-4 rounded-lg border-2 transition-all active:scale-95 ${
                value
                  ? 'border-green-500 bg-green-50'
                  : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-slate-400'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm md:text-base">
                  {key === 'enciende' && 'Enciende'}
                  {key === 'tactilFunciona' && 'Táctil Funciona'}
                  {key === 'pantallaOk' && 'Pantalla OK'}
                  {key === 'bateriaOk' && 'Batería OK'}
                  {key === 'cargaOk' && 'Carga OK'}
                </span>
                {value ? (
                  <Check className="text-green-600" size={20} />
                ) : (
                  <X className="text-slate-400" size={20} />
                )}
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Checks Específicos */}
      <Card className="mb-6">
        <h3 className="text-lg font-semibold mb-4">
          Checks Específicos — {reparacion.recepcion?.tipoEquipo}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {reparacion.recepcion?.tipoEquipo === 'Telefono' &&
            checksTelefono.map(item => (
              <button
                key={item.id}
                onClick={() => toggleCheckEspecifico('telefono', item.id)}
                className={`p-3 md:p-4 rounded-lg border-2 transition-all active:scale-95 ${
                  item.checked
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-xs md:text-sm leading-snug text-left">{item.label}</span>
                  {item.checked ? (
                    <Check className="text-blue-600 shrink-0" size={16} />
                  ) : (
                    <X className="text-slate-400 shrink-0" size={16} />
                  )}
                </div>
              </button>
            ))}

          {reparacion.recepcion?.tipoEquipo === 'Tablet' &&
            checksTablet.map(item => (
              <button
                key={item.id}
                onClick={() => toggleCheckEspecifico('tablet', item.id)}
                className={`p-3 md:p-4 rounded-lg border-2 transition-all active:scale-95 ${
                  item.checked
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-xs md:text-sm leading-snug text-left">{item.label}</span>
                  {item.checked ? (
                    <Check className="text-blue-600 shrink-0" size={16} />
                  ) : (
                    <X className="text-slate-400 shrink-0" size={16} />
                  )}
                </div>
              </button>
            ))}

          {(reparacion.recepcion?.tipoEquipo === 'Laptop' || reparacion.recepcion?.tipoEquipo === 'Computadora') &&
            checksComputadora.map(item => (
              <button
                key={item.id}
                onClick={() => toggleCheckEspecifico('computadora', item.id)}
                className={`p-3 md:p-4 rounded-lg border-2 transition-all active:scale-95 ${
                  item.checked
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-xs md:text-sm leading-snug text-left">{item.label}</span>
                  {item.checked ? (
                    <Check className="text-blue-600 shrink-0" size={16} />
                  ) : (
                    <X className="text-slate-400 shrink-0" size={16} />
                  )}
                </div>
              </button>
            ))}
        </div>
      </Card>

      {/* Observaciones */}
      <Card className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Observaciones</h3>
        <textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={4}
          placeholder="Escribe cualquier observación adicional sobre el estado del equipo..."
        />
      </Card>

      {/* Anticipo del Cliente */}
      <Card className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Anticipo del Cliente</h3>

        {anticipo_confirmado && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-800 text-sm">
            ⚠️ Este anticipo ya fue <strong>confirmado</strong> en Caja/Bancos y no puede modificarse desde aquí.
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dejoAnticipo}
                disabled={anticipo_confirmado}
                onChange={(e) => {
                  setDejoAnticipo(e.target.checked);
                  if (!e.target.checked) {
                    setMontoAnticipo('');
                    setCuentaBancariaId('');
                  }
                }}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <span className="text-sm font-medium">¿El cliente dejó anticipo?</span>
            </label>
          </div>

          {dejoAnticipo && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Monto del Anticipo (Q)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={montoAnticipo}
                  disabled={anticipo_confirmado}
                  onChange={(e) => setMontoAnticipo(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:text-slate-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Método de Pago
                </label>
                <select
                  value={metodoAnticipo}
                  disabled={anticipo_confirmado}
                  onChange={(e) => {
                    setMetodoAnticipo(e.target.value as 'efectivo' | 'transferencia');
                    setCuentaBancariaId('');
                  }}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="efectivo">Efectivo 💵</option>
                  <option value="transferencia">Transferencia 🏦</option>
                </select>
              </div>

              {metodoAnticipo === 'transferencia' && (
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Cuenta Bancaria de Destino <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={cuentaBancariaId}
                    disabled={anticipo_confirmado}
                    onChange={(e) => setCuentaBancariaId(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="">-- Selecciona una cuenta bancaria --</option>
                    {cuentasBancarias.map((cuenta) => (
                      <option key={cuenta.id} value={cuenta.id.toString()}>
                        {cuenta.nombre} — {cuenta.tipo_cuenta} ({cuenta.numero_cuenta})
                      </option>
                    ))}
                  </select>
                  {cuentasBancarias.length === 0 && (
                    <p className="text-xs text-slate-500 mt-1">No hay cuentas bancarias activas registradas.</p>
                  )}
                </div>
              )}

              {!anticipo_confirmado && dejoAnticipo && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-500">
                    El anticipo se registrará como <strong>PENDIENTE</strong>. Confírmalo desde{' '}
                    <a href="/caja-bancos" className="text-blue-600 underline">Caja / Bancos</a> para
                    que afecte el saldo.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Botón Guardar */}
      <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
        <Button
          variant="ghost"
          onClick={() => navigate('/flujo-reparaciones')}
          className="w-full sm:w-auto"
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSaveChecklist}
          disabled={saving}
          className="w-full sm:w-auto"
        >
          <Save size={20} className="mr-2" />
          {saving ? 'Guardando...' : existeCheck ? 'Actualizar Checklist' : 'Guardar Checklist y Actualizar Estado'}
        </Button>
      </div>
    </div>
    <ConfirmModal
      isOpen={confirmQuitarEntrega}
      title="Quitar fecha de entrega"
      message="\u00bfEliminar la fecha de entrega programada?"
      confirmLabel="Quitar"
      variant="danger"
      onConfirm={quitarEntrega}
      onCancel={() => setConfirmQuitarEntrega(false)}
    />    </>  );
}
