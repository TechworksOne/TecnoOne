import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Check, Save, AlertCircle, Loader2 } from 'lucide-react';
import API_URL from '../../services/config';
import axios from 'axios';
import ConfirmModal from '../ui/ConfirmModal';

// ── Types ─────────────────────────────────────────────────────────────────────
interface CheckItem { id: string; label: string; checked: boolean; }
interface ChecksGenerales {
  enciende: boolean;
  tactilFunciona: boolean;
  pantallaOk: boolean;
  bateriaOk: boolean;
  cargaOk: boolean;
}

export interface ChecklistIngresoModalProps {
  isOpen: boolean;
  repair: any | null;
  onClose: () => void;
  onCompleted: () => void;
}

// ── Check item lists ──────────────────────────────────────────────────────────
const CHECKS_TELEFONO_DEFAULT: CheckItem[] = [
  { id: 'senal',               label: 'Señal de red / Antena',            checked: true },
  { id: 'wifi',                label: 'WiFi',                             checked: true },
  { id: 'bluetooth',           label: 'Bluetooth',                        checked: true },
  { id: 'gps',                 label: 'GPS / Ubicación',                  checked: true },
  { id: 'datos',               label: 'Datos móviles / 4G/5G',            checked: true },
  { id: 'camaraTrasera',       label: 'Cámara trasera',                   checked: true },
  { id: 'camaraFrontal',       label: 'Cámara frontal / Selfie',          checked: true },
  { id: 'flash',               label: 'Flash / Linterna',                 checked: true },
  { id: 'zoom',                label: 'Zoom de cámara',                   checked: true },
  { id: 'bocina',              label: 'Bocina / Altavoz',                 checked: true },
  { id: 'auricular',           label: 'Auricular / Altavoz de llamadas',  checked: true },
  { id: 'microfono',           label: 'Micrófono principal',              checked: true },
  { id: 'microfonoLlamadas',   label: 'Micrófono de llamadas',            checked: true },
  { id: 'vibrador',            label: 'Vibrador / Motor de vibración',    checked: true },
  { id: 'botonesVolumen',      label: 'Botones de volumen',               checked: true },
  { id: 'botonEncendido',      label: 'Botón de encendido / Power',       checked: true },
  { id: 'botonHome',           label: 'Botón Home / Inicio',              checked: true },
  { id: 'sensorHuella',        label: 'Sensor de huella dactilar',        checked: true },
  { id: 'faceId',              label: 'Face ID / Reconocimiento facial',  checked: true },
  { id: 'sensorProximidad',    label: 'Sensor de proximidad',             checked: true },
  { id: 'sensorLuz',           label: 'Sensor de luz ambiental',          checked: true },
  { id: 'nfc',                 label: 'NFC / Pagos móviles',              checked: true },
  { id: 'infrarrojo',          label: 'Infrarrojo / Control remoto',      checked: true },
  { id: 'jackAudifonos',       label: 'Jack de audífonos 3.5mm',          checked: true },
  { id: 'puertoCarga',         label: 'Puerto de carga',                  checked: true },
  { id: 'cargaRapida',         label: 'Carga rápida',                     checked: true },
  { id: 'cargaInalambrica',    label: 'Carga inalámbrica',                checked: true },
  { id: 'simCard',             label: 'Lector de SIM / Bandeja',          checked: true },
  { id: 'sdCard',              label: 'Lector de tarjeta SD',             checked: true },
  { id: 'rotation',            label: 'Rotación automática de pantalla',  checked: true },
  { id: 'notificaciones',      label: 'LED de notificaciones',            checked: true },
];

const CHECKS_TABLET_DEFAULT: CheckItem[] = [
  { id: 'wifi',            label: 'WiFi',                       checked: true },
  { id: 'bluetooth',       label: 'Bluetooth',                  checked: true },
  { id: 'gps',             label: 'GPS',                        checked: true },
  { id: 'camaraTrasera',   label: 'Cámara trasera',             checked: true },
  { id: 'camaraFrontal',   label: 'Cámara frontal',             checked: true },
  { id: 'flash',           label: 'Flash',                      checked: true },
  { id: 'bocinas',         label: 'Bocinas / Altavoces',        checked: true },
  { id: 'microfono',       label: 'Micrófono',                  checked: true },
  { id: 'acelerometro',    label: 'Acelerómetro',               checked: true },
  { id: 'giroscopio',      label: 'Giroscopio',                 checked: true },
  { id: 'sensorLuz',       label: 'Sensor de luz',              checked: true },
  { id: 'puertoCarga',     label: 'Puerto de carga',            checked: true },
  { id: 'jackAudifonos',   label: 'Jack de audífonos',          checked: true },
  { id: 'botonesVolumen',  label: 'Botones de volumen',         checked: true },
  { id: 'botonEncendido',  label: 'Botón de encendido',         checked: true },
  { id: 'simCard',         label: 'Lector de SIM (si aplica)',  checked: true },
  { id: 'sdCard',          label: 'Lector de tarjeta SD',       checked: true },
  { id: 'rotation',        label: 'Rotación de pantalla',       checked: true },
];

const CHECKS_COMPUTADORA_DEFAULT: CheckItem[] = [
  { id: 'teclado',            label: 'Teclado completo',                checked: true },
  { id: 'teclasFuncion',      label: 'Teclas de función (F1-F12)',      checked: true },
  { id: 'touchpad',           label: 'Touchpad / Mouse táctil',         checked: true },
  { id: 'clickTouchpad',      label: 'Click del touchpad',              checked: true },
  { id: 'puertosUsb',         label: 'Puertos USB',                     checked: true },
  { id: 'usbC',               label: 'Puerto USB-C',                    checked: true },
  { id: 'puertoHdmi',         label: 'Puerto HDMI',                     checked: true },
  { id: 'puertoVga',          label: 'Puerto VGA',                      checked: true },
  { id: 'ethernet',           label: 'Puerto Ethernet / RJ45',          checked: true },
  { id: 'lectorSd',           label: 'Lector de tarjetas SD',           checked: true },
  { id: 'webcam',             label: 'Webcam / Cámara',                 checked: true },
  { id: 'microfono',          label: 'Micrófono integrado',             checked: true },
  { id: 'bocinas',            label: 'Bocinas / Altavoces',             checked: true },
  { id: 'jackAudifonos',      label: 'Jack de audífonos',               checked: true },
  { id: 'wifi',               label: 'WiFi',                            checked: true },
  { id: 'bluetooth',          label: 'Bluetooth',                       checked: true },
  { id: 'lectorHuella',       label: 'Lector de huella',                checked: true },
  { id: 'retroiluminacion',   label: 'Retroiluminación de teclado',     checked: true },
  { id: 'ventilador',         label: 'Ventilador / Cooling',            checked: true },
  { id: 'bisagras',           label: 'Bisagras de la pantalla',         checked: true },
  { id: 'unidadOptica',       label: 'Unidad óptica (CD/DVD)',          checked: true },
];

// ── Small helpers ─────────────────────────────────────────────────────────────
const EXCLUDED = ['CANCELADA', 'ANULADA', 'CANCELADO'];
function isRepairCancelled(rep: any) {
  return EXCLUDED.includes(String(rep?.estado).toUpperCase());
}

const GENERALES_LABELS: Record<string, string> = {
  enciende: 'Enciende',
  tactilFunciona: 'Táctil funciona',
  pantallaOk: 'Pantalla OK',
  bateriaOk: 'Batería OK',
  cargaOk: 'Carga OK',
};

// ── Shared input class ────────────────────────────────────────────────────────
const inputCls = [
  'w-full px-3 py-2 rounded-xl text-sm',
  'bg-white dark:bg-slate-800',
  'text-slate-800 dark:text-slate-100',
  'border border-slate-300 dark:border-slate-600',
  'placeholder:text-slate-400 dark:placeholder:text-slate-500',
  'focus:outline-none focus:ring-2 focus:ring-blue-500/40',
  'disabled:opacity-50 disabled:cursor-not-allowed',
  'transition',
].join(' ');

// ── Component ─────────────────────────────────────────────────────────────────
export default function ChecklistIngresoModal({
  isOpen, repair, onClose, onCompleted,
}: ChecklistIngresoModalProps) {
  // ── Internal state ────────────────────────────────────────────────────────
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [existeCheck, setExisteCheck] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const [checksGenerales, setChecksGenerales] = useState<ChecksGenerales>({
    enciende: true, tactilFunciona: true, pantallaOk: true, bateriaOk: true, cargaOk: true,
  });
  const [checksTelefono,     setChecksTelefono]     = useState<CheckItem[]>(CHECKS_TELEFONO_DEFAULT);
  const [checksTablet,       setChecksTablet]       = useState<CheckItem[]>(CHECKS_TABLET_DEFAULT);
  const [checksComputadora,  setChecksComputadora]  = useState<CheckItem[]>(CHECKS_COMPUTADORA_DEFAULT);
  const [observaciones,      setObservaciones]      = useState('');

  const bodyScrollLock = useRef(false);

  // ── Reset state when modal opens/closes ───────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      // Reset everything when closed
      setErrorMsg(null);
      setIsDirty(false);
      setExisteCheck(false);
      setSaving(false);
      setChecksGenerales({ enciende: true, tactilFunciona: true, pantallaOk: true, bateriaOk: true, cargaOk: true });
      setChecksTelefono(CHECKS_TELEFONO_DEFAULT);
      setChecksTablet(CHECKS_TABLET_DEFAULT);
      setChecksComputadora(CHECKS_COMPUTADORA_DEFAULT);
      setObservaciones('');
      return;
    }

    // Lock body scroll
    document.body.style.overflow = 'hidden';
    bodyScrollLock.current = true;

    // Load existing checklist
    if (repair) {
      loadChecklistExistente(repair.id);
    }

    return () => {
      if (bodyScrollLock.current) {
        document.body.style.overflow = '';
        bodyScrollLock.current = false;
      }
    };
  }, [isOpen, repair?.id]);

  // ── ESC key to close ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, isDirty]);

  // ── Load existing checklist ───────────────────────────────────────────────
  const loadChecklistExistente = async (repId: string) => {
    setLoadingChecklist(true);
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.get(`${API_URL}/check-equipo/reparacion/${repId}`, {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: s => s < 500,
      });
      if (res.data.success && res.data.data) {
        const c = res.data.data;
        setExisteCheck(true);
        setChecksGenerales({
          enciende: c.enciende,
          tactilFunciona: c.tactil_funciona,
          pantallaOk: c.pantalla_ok,
          bateriaOk: c.bateria_ok,
          cargaOk: c.carga_ok,
        });
        if (c.telefono_checks) {
          setChecksTelefono(prev => prev.map(it => ({ ...it, checked: c.telefono_checks[it.id] ?? it.checked })));
        }
        if (c.tablet_checks) {
          setChecksTablet(prev => prev.map(it => ({ ...it, checked: c.tablet_checks[it.id] ?? it.checked })));
        }
        if (c.computadora_checks) {
          setChecksComputadora(prev => prev.map(it => ({ ...it, checked: c.computadora_checks[it.id] ?? it.checked })));
        }
        setObservaciones(c.observaciones || '');
      }
    } catch {
      // no checklist yet — that's fine
    } finally {
      setLoadingChecklist(false);
    }
  };

  // ── Dirty tracking ────────────────────────────────────────────────────────
  const markDirty = useCallback(() => setIsDirty(true), []);

  // ── Close with confirmation ───────────────────────────────────────────────
  const handleClose = useCallback(() => {
    if (isDirty) {
      setConfirmClose(true);
      return;
    }
    onClose();
  }, [isDirty, onClose]);

  // ── Toggle handlers ───────────────────────────────────────────────────────
  const toggleGeneral = (key: keyof ChecksGenerales) => {
    setChecksGenerales(prev => ({ ...prev, [key]: !prev[key] }));
    markDirty();
  };

  const toggleEspecifico = (tipo: 'telefono' | 'tablet' | 'computadora', id: string) => {
    markDirty();
    if (tipo === 'telefono') {
      setChecksTelefono(prev => prev.map(it => it.id === id ? { ...it, checked: !it.checked } : it));
    } else if (tipo === 'tablet') {
      setChecksTablet(prev => prev.map(it => it.id === id ? { ...it, checked: !it.checked } : it));
    } else {
      setChecksComputadora(prev => prev.map(it => it.id === id ? { ...it, checked: !it.checked } : it));
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!repair) return;
    setErrorMsg(null);

    if (isRepairCancelled(repair)) {
      setErrorMsg('No se puede guardar el checklist para una reparación cancelada o anulada.');
      return;
    }
    setSaving(true);
    try {
      const token = sessionStorage.getItem('token');
      const tipoEquipo = repair.recepcion?.tipoEquipo;

      let checksEspecificos: Record<string, boolean> = {};
      if (tipoEquipo === 'Telefono') {
        checksEspecificos = Object.fromEntries(checksTelefono.map(it => [it.id, it.checked]));
      } else if (tipoEquipo === 'Tablet') {
        checksEspecificos = Object.fromEntries(checksTablet.map(it => [it.id, it.checked]));
      } else if (tipoEquipo === 'Laptop' || tipoEquipo === 'Computadora') {
        checksEspecificos = Object.fromEntries(checksComputadora.map(it => [it.id, it.checked]));
      }

      await axios.post(
        `${API_URL}/check-equipo`,
        {
          reparacionId: repair.id,
          tipoEquipo,
          checksGenerales,
          checksEspecificos,
          observaciones,
          fotosChecklist: [],
          realizadoPor: 'Usuario',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setIsDirty(false);
      onCompleted();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Error al guardar el checklist. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!isOpen) return null;
  if (!repair) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70">
        <div className="bg-white dark:bg-slate-950 rounded-2xl p-8 text-center max-w-sm w-full mx-4 border border-slate-200 dark:border-slate-700">
          <AlertCircle size={40} className="text-red-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            No se pudo cargar la reparación.
          </p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const tipoEquipo = repair.recepcion?.tipoEquipo;
  const isCancelled = isRepairCancelled(repair);

  const checksToRender: CheckItem[] =
    tipoEquipo === 'Telefono'    ? checksTelefono    :
    tipoEquipo === 'Tablet'      ? checksTablet      :
    (tipoEquipo === 'Laptop' || tipoEquipo === 'Computadora') ? checksComputadora : [];

  const todosEspecificosMarcados =
    checksToRender.length > 0 &&
    checksToRender.every(item => item.checked);

  const toggleTodosEspecificos = () => {
    if (isCancelled || checksToRender.length === 0) return;

    const nuevoEstado = !todosEspecificosMarcados;
    markDirty();

    if (tipoEquipo === 'Telefono') {
      setChecksTelefono(prev =>
        prev.map(item => ({ ...item, checked: nuevoEstado }))
      );
    } else if (tipoEquipo === 'Tablet') {
      setChecksTablet(prev =>
        prev.map(item => ({ ...item, checked: nuevoEstado }))
      );
    } else if (
      tipoEquipo === 'Laptop' ||
      tipoEquipo === 'Computadora'
    ) {
      setChecksComputadora(prev =>
        prev.map(item => ({ ...item, checked: nuevoEstado }))
      );
    }
  };

  const tipoLabel =
    tipoEquipo === 'Telefono'    ? 'Teléfono'        :
    tipoEquipo === 'Tablet'      ? 'Tablet'          :
    tipoEquipo === 'Laptop'      ? 'Laptop'          :
    tipoEquipo === 'Computadora' ? 'Computadora'     :
    tipoEquipo || 'Equipo';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Checklist de Ingreso"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 dark:bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">

        {/* ── MODAL HEADER ── */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
              <Check size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Checklist de Ingreso
                </h2>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {repair.id}
                </span>
                {existeCheck && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                    Editando existente
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Revisión inicial del equipo — {repair.clienteNombre || '—'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            title="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── MODAL BODY (scrollable) ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50 dark:bg-slate-900/50">

          {/* Loading spinner */}
          {loadingChecklist && (
            <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
              <Loader2 size={24} className="animate-spin" />
              <span className="text-sm">Cargando checklist...</span>
            </div>
          )}

          {/* Cancelled repair warning */}
          {isCancelled && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
              <AlertCircle size={15} className="shrink-0" />
              <span>Esta reparación está <strong>{repair.estado}</strong> y no puede modificarse.</span>
            </div>
          )}

          {/* Error banner */}
          {errorMsg && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!loadingChecklist && (
            <>
              {/* ── 1. INFO DEL EQUIPO ─────────────────────────────────────── */}
              <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Información del Equipo
                  </h3>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                  {[
                    { label: 'Cliente',          value: repair.clienteNombre },
                    { label: 'Teléfono',         value: repair.clienteTelefono },
                    { label: 'Tipo de equipo',   value: tipoLabel },
                    { label: 'Marca / Modelo',   value: [repair.recepcion?.marca, repair.recepcion?.modelo].filter(Boolean).join(' ') },
                    { label: 'Color',            value: repair.recepcion?.color },
                    { label: 'IMEI / Serie',     value: repair.recepcion?.imei },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-0.5">{label}</p>
                      <p className={`font-medium leading-snug ${value ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500 italic'}`}>
                        {value || 'No registrado'}
                      </p>
                    </div>
                  ))}
                  {repair.recepcion?.diagnosticoInicial && (
                    <div className="sm:col-span-2 lg:col-span-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-0.5">Diagnóstico inicial</p>
                      <p className="text-slate-600 dark:text-slate-300 leading-snug">{repair.recepcion.diagnosticoInicial}</p>
                    </div>
                  )}
                </div>
              </section>

              {/* ── 2. CHECKS GENERALES ──────────────────────────────────────── */}
              <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Checks Generales</h3>
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {(Object.keys(checksGenerales) as (keyof ChecksGenerales)[]).map(key => {
                    const checked = checksGenerales[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={isCancelled}
                        onClick={() => toggleGeneral(key)}
                        className={[
                          'p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 text-center transition-all active:scale-95',
                          'disabled:opacity-40 disabled:cursor-not-allowed',
                          checked
                            ? 'border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600',
                        ].join(' ')}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${checked ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                          {checked
                            ? <Check size={14} className="text-white" />
                            : <X size={12} className="text-slate-400 dark:text-slate-500" />
                          }
                        </div>
                        <span className={`text-[11px] font-semibold leading-tight ${checked ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'}`}>
                          {GENERALES_LABELS[key]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* ── 3. CHECKS ESPECÍFICOS ─────────────────────────────────── */}
              {checksToRender.length > 0 && (
                <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        Checks Específicos
                      </h3>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                        {tipoLabel}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isCancelled}
                      onClick={toggleTodosEspecificos}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {todosEspecificosMarcados
                        ? 'Desmarcar todos'
                        : 'Marcar todos'}
                    </button>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {checksToRender.map(item => {
                      const tipo =
                        tipoEquipo === 'Telefono' ? 'telefono'
                        : tipoEquipo === 'Tablet' ? 'tablet'
                        : 'computadora';
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={isCancelled}
                          onClick={() => toggleEspecifico(tipo, item.id)}
                          className={[
                            'flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-all active:scale-[0.98]',
                            'disabled:opacity-40 disabled:cursor-not-allowed',
                            item.checked
                              ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600',
                          ].join(' ')}
                        >
                          <span className={`text-[11px] font-medium leading-snug ${item.checked ? 'text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400'}`}>
                            {item.label}
                          </span>
                          {item.checked
                            ? <Check size={14} className="text-blue-500 dark:text-blue-400 shrink-0" />
                            : <X size={13} className="text-slate-300 dark:text-slate-600 shrink-0" />
                          }
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ── 4. OBSERVACIONES ──────────────────────────────────────── */}
              <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Observaciones</h3>
                </div>
                <div className="p-4">
                  <textarea
                    value={observaciones}
                    disabled={isCancelled}
                    onChange={e => { setObservaciones(e.target.value); markDirty(); }}
                    placeholder="Escribe cualquier observación sobre el estado físico o condición del equipo..."
                    rows={3}
                    className={inputCls + ' resize-none'}
                  />
                </div>
              </section>

            </>
          )}
        </div>

        {/* ── MODAL FOOTER ── */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end items-stretch sm:items-center gap-2 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loadingChecklist || isCancelled}
            className="flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Guardando...</>
              : isCancelled
                ? 'Checklist no disponible'
                : <><Save size={14} /> {existeCheck ? 'Actualizar Checklist' : 'Guardar Checklist'}</>
            }
          </button>
        </div>
      </div>
    </div>
    <ConfirmModal
      isOpen={confirmClose}
      title="Cambios sin guardar"
      message="Hay cambios sin guardar. ¿Deseas salir de todos modos?"
      confirmLabel="Salir"
      variant="danger"
      onConfirm={() => { setConfirmClose(false); onClose(); }}
      onCancel={() => setConfirmClose(false)}
    />
    </>
  );
}
