import React, { useState, useEffect, useCallback } from 'react';
import {
  X, User, Smartphone, FileText, Save, Printer,
  ArrowLeft, ChevronRight, AlertCircle, CheckCircle2,
  Eye, EyeOff, RotateCcw,
} from 'lucide-react';
import { Customer } from '../../types/customer';
import { RepairFormData } from '../../types/repair';
import CustomerPicker from '../customers/CustomerPicker';
import Input from '../ui/Input';
import Select from '../ui/Select';
import equipoService from '../../services/equipoService';
import type { EquipoMarca, EquipoModelo, TipoEquipo } from '../../types/equipo';
import { generarPDFRecepcion } from '../../lib/pdfGenerator';
import { createReparacion } from '../../services/repairService';
import { useAuth } from '../../store/useAuth';
import PatternLock from './PatternLock';
import FirmaCanvas from './FirmaCanvas';
import ConfirmModal from '../ui/ConfirmModal';

// ── Types ────────────────────────────────────────────────────────────────────
type Step = 'cliente' | 'equipo' | 'resumen';

interface EquipmentData {
  tipo: string;
  marca: string;
  modelo: string;
  color: string;
  imei: string;
  accesoTipo: 'ninguno' | 'pin' | 'patron';
  accesoValor: string;
  diagnostico: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

// Returns today's date as YYYY-MM-DD in local timezone (avoids UTC offset issue)
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const INITIAL_EQUIPMENT: EquipmentData = {
  tipo: 'Telefono',
  marca: '',
  modelo: '',
  color: '',
  imei: '',
  accesoTipo: 'ninguno',
  accesoValor: '',
  diagnostico: '',
};

function hasDirtyData(
  customer: Customer | undefined,
  equip: EquipmentData,
): boolean {
  return (
    !!customer ||
    equip.marca !== '' ||
    equip.modelo !== '' ||
    equip.diagnostico !== ''
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function NuevaReparacionModal({ isOpen, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const authUserName = user?.username || user?.name || 'Sistema';
  const [currentStep, setCurrentStep] = useState<Step>('cliente');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>();
  const [equipmentData, setEquipmentData] = useState<EquipmentData>(INITIAL_EQUIPMENT);
  const [fechaRecepcion, setFechaRecepcion] = useState<string>(localToday());
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  // Marcas / modelos
  const [marcas, setMarcas] = useState<EquipoMarca[]>([]);
  const [modelos, setModelos] = useState<EquipoModelo[]>([]);
  const [loadingMarcas, setLoadingMarcas] = useState(false);
  const [loadingModelos, setLoadingModelos] = useState(false);
  const [showNuevaMarca, setShowNuevaMarca] = useState(false);
  const [nuevaMarca, setNuevaMarca] = useState('');
  const [showNuevoModelo, setShowNuevoModelo] = useState(false);
  const [nuevoModelo, setNuevoModelo] = useState('');
  const [marcaError, setMarcaError] = useState<string | null>(null);
  const [modeloError, setModeloError] = useState<string | null>(null);
  const [patternArr, setPatternArr]   = useState<number[]>([]);
  const [showPin, setShowPin]         = useState(false);

  // ── Firma del cliente ──────────────────────────────────────────────────────
  const [firmaBase64, setFirmaBase64] = useState<string | null>(null);

  // ── Reset on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('cliente');
      setSelectedCustomer(undefined);
      setEquipmentData(INITIAL_EQUIPMENT);
      setFechaRecepcion(localToday());
      setIsCreating(false);
      setErrorMsg(null);
      setShowNuevaMarca(false);
      setNuevaMarca('');
      setShowNuevoModelo(false);
      setNuevoModelo('');
      setPatternArr([]);
      setShowPin(false);
      setFirmaBase64(null);
    }
  }, [isOpen]);

  // ── Load marcas on tipo change ─────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    loadMarcas(equipmentData.tipo as TipoEquipo);
  }, [equipmentData.tipo, isOpen]);

  // ── Load modelos on marca change ───────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !equipmentData.marca) { setModelos([]); return; }
    const m = marcas.find(x => x.nombre === equipmentData.marca);
    if (m) loadModelos(m.id);
  }, [equipmentData.marca, marcas, isOpen]);

  // ── ESC to close ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, selectedCustomer, equipmentData]);

  // ── Body scroll lock ───────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // ── API helpers ────────────────────────────────────────────────────────────
  const loadMarcas = async (tipo: TipoEquipo) => {
    setLoadingMarcas(true);
    try { setMarcas(await equipoService.getAllMarcas(tipo)); }
    catch { console.error('Error loading marcas'); }
    finally { setLoadingMarcas(false); }
  };

  const loadModelos = async (marcaId: number) => {
    setLoadingModelos(true);
    try { setModelos(await equipoService.getModelosByMarca(marcaId)); }
    catch { console.error('Error loading modelos'); }
    finally { setLoadingModelos(false); }
  };

  const handleCrearMarca = async () => {
    if (!nuevaMarca.trim()) return;
    setMarcaError(null);
    try {
      const created = await equipoService.createMarca({
        nombre: nuevaMarca,
        tipo_equipo: equipmentData.tipo as TipoEquipo,
      });
      await loadMarcas(equipmentData.tipo as TipoEquipo);
      setEquipmentData(prev => ({ ...prev, marca: created.nombre, modelo: '' }));
      setShowNuevaMarca(false);
      setNuevaMarca('');
    } catch {
      setMarcaError('No se pudo crear la marca. Puede que ya exista.');
    }
  };

  const handleCrearModelo = async () => {
    if (!nuevoModelo.trim()) return;
    const marcaSel = marcas.find(m => m.nombre === equipmentData.marca);
    if (!marcaSel) return;
    setModeloError(null);
    try {
      const created = await equipoService.createModelo({
        marca_id: marcaSel.id,
        nombre: nuevoModelo,
      });
      await loadModelos(marcaSel.id);
      setEquipmentData(prev => ({ ...prev, modelo: created.nombre }));
      setShowNuevoModelo(false);
      setNuevoModelo('');
    } catch {
      setModeloError('No se pudo crear el modelo. Puede que ya exista.');
    }
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  const canContinue = useCallback((): boolean => {
    if (currentStep === 'cliente') return !!selectedCustomer;
    if (currentStep === 'equipo') {
      if (!equipmentData.marca.trim() || !equipmentData.modelo.trim()) return false;
      if (equipmentData.accesoTipo === 'pin' && !equipmentData.accesoValor.trim()) return false;
      if (equipmentData.accesoTipo === 'patron' && patternArr.length < 4) return false;
      return true;
    }
    return true;
  }, [currentStep, selectedCustomer, equipmentData, patternArr]);

  const handleNext = () => {
    if (currentStep === 'cliente') setCurrentStep('equipo');
    else if (currentStep === 'equipo') setCurrentStep('resumen');
  };

  const handleBack = () => {
    if (currentStep === 'equipo') setCurrentStep('cliente');
    else if (currentStep === 'resumen') setCurrentStep('equipo');
  };

  const handleClose = () => {
    if (hasDirtyData(selectedCustomer, equipmentData)) {
      setConfirmClose(true);
      return;
    }
    onClose();
  };

  // ── PDF ────────────────────────────────────────────────────────────────────
  const handleGenerarPDF = () => {
    if (!selectedCustomer) return;
    const numeroReparacion = `REP${String(Date.now()).slice(-6)}`;
    const [y, m, d] = fechaRecepcion.split('-');
    generarPDFRecepcion({
      numeroReparacion,
      fecha: `${d}/${m}/${y}`,
      cliente: {
        nombre: selectedCustomer.nombre
          ? `${selectedCustomer.nombre}${selectedCustomer.apellido ? ' ' + selectedCustomer.apellido : ''}`.trim()
          : `${selectedCustomer.firstName || ''} ${selectedCustomer.lastName || ''}`.trim(),
        telefono: selectedCustomer.telefono || selectedCustomer.phone || '',
        email: selectedCustomer.correo || selectedCustomer.email,
      },
      equipo: {
        tipo: equipmentData.tipo,
        marca: equipmentData.marca,
        modelo: equipmentData.modelo,
        color: equipmentData.color,
        imei: equipmentData.imei,
        accesoTipo: equipmentData.accesoTipo,
        accesoValor: equipmentData.accesoTipo === 'patron'
          ? patternArr.join('-')
          : equipmentData.accesoTipo === 'pin'
          ? equipmentData.accesoValor
          : undefined,
        diagnostico: equipmentData.diagnostico,
      },
    }, false);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedCustomer) return;
    setIsCreating(true);
    setErrorMsg(null);
    try {
      const customerName = selectedCustomer.nombre
        ? `${selectedCustomer.nombre}${selectedCustomer.apellido ? ' ' + selectedCustomer.apellido : ''}`.trim()
        : `${selectedCustomer.firstName || ''} ${selectedCustomer.lastName || ''}`.trim();

      const repairData: RepairFormData = {
        clienteNombre: customerName,
        clienteTelefono: selectedCustomer.telefono || selectedCustomer.phone || '',
        clienteEmail: selectedCustomer.correo || selectedCustomer.email || '',
        clienteId: selectedCustomer.id?.toString(),
        clienteFrecuente: !!(selectedCustomer.frecuente || (selectedCustomer.loyaltyPoints && selectedCustomer.loyaltyPoints > 100)),
        recepcion: {
          tipoEquipo: equipmentData.tipo as any,
          marca: equipmentData.marca,
          modelo: equipmentData.modelo,
          color: equipmentData.color,
          imeiSerie: equipmentData.imei || undefined,
          patronContraseña: equipmentData.accesoTipo !== 'ninguno'
            ? (equipmentData.accesoTipo === 'patron' ? patternArr.join('-') : equipmentData.accesoValor) || undefined
            : undefined,
          accesoTipo: equipmentData.accesoTipo,
          accesoValor: equipmentData.accesoTipo === 'pin'
            ? equipmentData.accesoValor || undefined
            : equipmentData.accesoTipo === 'patron' && patternArr.length >= 4
            ? patternArr.join('-')
            : undefined,
          diagnosticoInicial: equipmentData.diagnostico || undefined,
          estadoFisico: 'Pendiente revisión física',
          accesoriosRecibidos: { chip: false, estuche: false, memoriaSD: false, cargador: false },
          fotosRecepcion: [],
          fechaRecepcion,
          userRecepcion: authUserName,
        },
        estado: 'RECIBIDA',
        prioridad: 'MEDIA',
        garantiaMeses: 1,
        items: [],
        manoDeObra: 0,
        fotosFinales: [],
        historialEstados: [{
          id: `hist-${Date.now()}`,
          estado: 'RECIBIDA',
          nota: 'Equipo recibido para diagnóstico',
          fotos: [],
          timestamp: new Date().toISOString(),
          user: authUserName,
        }],
      };

      await createReparacion({ ...repairData, firma_cliente_base64: firmaBase64 } as any);
      onCreated();
      onClose();
    } catch (err: any) {
      console.error('Error creating repair:', err);
      setErrorMsg(err?.response?.data?.message || err?.message || 'Error al crear la reparación');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  // ── Customer display helpers ───────────────────────────────────────────────
  const customerName = selectedCustomer
    ? (selectedCustomer.nombre
        ? `${selectedCustomer.nombre}${selectedCustomer.apellido ? ' ' + selectedCustomer.apellido : ''}`.trim()
        : `${selectedCustomer.firstName || ''} ${selectedCustomer.lastName || ''}`.trim())
    : '';

  const STEPS: { key: Step; label: string; icon: React.ReactNode }[] = [
    { key: 'cliente', label: 'Cliente', icon: <User size={14} /> },
    { key: 'equipo', label: 'Equipo', icon: <Smartphone size={14} /> },
    { key: 'resumen', label: 'Resumen', icon: <FileText size={14} /> },
  ];
  const stepIndex = (s: Step) => STEPS.findIndex(x => x.key === s);
  const currentIndex = stepIndex(currentStep);

  // ── Input class helpers ────────────────────────────────────────────────────
  const inputCls = 'w-full px-3 py-2 rounded-xl text-sm border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition';
  const labelCls = 'block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide';

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
    {/* Overlay */}
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Nueva Reparación"
    >
      {/* Modal box */}
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
              Nueva Reparación
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Crear una nueva orden de reparación
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Stepper ────────────────────────────────────────────────────── */}
        <div className="flex items-center px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 shrink-0 gap-0">
          {STEPS.map((s, i) => {
            const done = i < currentIndex;
            const active = i === currentIndex;
            return (
              <React.Fragment key={s.key}>
                <div className="flex items-center gap-2 shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    active
                      ? 'bg-blue-600 text-white'
                      : done
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}>
                    {done ? <CheckCircle2 size={14} /> : i + 1}
                  </div>
                  <span className={`text-xs font-semibold hidden sm:inline transition-colors ${
                    active
                      ? 'text-blue-600 dark:text-blue-400'
                      : done
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-3 rounded transition-colors ${
                    done ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Error banner */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 rounded-xl p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ── Step 1: Cliente ─────────────────────────────────────────── */}
          {currentStep === 'cliente' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                  <User size={15} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Datos del Cliente</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Selecciona el cliente para esta reparación</p>
                </div>
              </div>
              <CustomerPicker
                value={selectedCustomer}
                onChange={setSelectedCustomer}
                allowCreate={true}
                placeholder="Buscar cliente por nombre, teléfono o email..."
              />
              {!selectedCustomer && (
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-2">
                  Selecciona un cliente para continuar
                </p>
              )}
            </div>
          )}

          {/* ── Step 2: Equipo ──────────────────────────────────────────── */}
          {currentStep === 'equipo' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <Smartphone size={15} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Datos del Equipo</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Información del dispositivo a reparar</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tipo */}
                <div>
                  <label className={labelCls}>Tipo de Equipo</label>
                  <select
                    value={equipmentData.tipo}
                    onChange={e => setEquipmentData({ ...equipmentData, tipo: e.target.value, marca: '', modelo: '' })}
                    className={inputCls}
                  >
                    <option value="Telefono">Teléfono</option>
                    <option value="Tablet">Tablet</option>
                    <option value="Laptop">Laptop</option>
                    <option value="Consola">Consola</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                {/* Marca */}
                <div>
                  <label className={labelCls}>Marca <span className="text-red-500">*</span></label>
                  {!showNuevaMarca ? (
                    <select
                      value={equipmentData.marca}
                      onChange={e => {
                        if (e.target.value === '__nueva__') { setShowNuevaMarca(true); return; }
                        setEquipmentData({ ...equipmentData, marca: e.target.value, modelo: '' });
                      }}
                      className={inputCls}
                      disabled={loadingMarcas}
                    >
                      <option value="">{loadingMarcas ? 'Cargando...' : 'Seleccionar marca...'}</option>
                      {marcas.map(m => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                      <option value="__nueva__">+ Crear nueva marca</option>
                    </select>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex gap-2">
                        <input
                          value={nuevaMarca}
                          onChange={e => setNuevaMarca(e.target.value)}
                          placeholder="Nombre de la marca..."
                          className={inputCls}
                          autoFocus
                          onKeyDown={e => e.key === 'Enter' && handleCrearMarca()}
                        />
                        <button onClick={handleCrearMarca} disabled={!nuevaMarca.trim()} className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors whitespace-nowrap">Crear</button>
                        <button onClick={() => { setShowNuevaMarca(false); setNuevaMarca(''); }} className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors">✕</button>
                      </div>
                      {marcaError && <p className="text-xs text-red-500">{marcaError}</p>}
                    </div>
                  )}
                </div>

                {/* Modelo */}
                <div>
                  <label className={labelCls}>Modelo <span className="text-red-500">*</span></label>
                  {!showNuevoModelo ? (
                    <div className="space-y-1">
                      <select
                        value={equipmentData.modelo}
                        onChange={e => {
                          if (e.target.value === '__nuevo__') { setShowNuevoModelo(true); return; }
                          setEquipmentData({ ...equipmentData, modelo: e.target.value });
                        }}
                        className={inputCls}
                        disabled={!equipmentData.marca || loadingModelos}
                      >
                        <option value="">
                          {!equipmentData.marca ? 'Selecciona una marca primero' : loadingModelos ? 'Cargando...' : 'Seleccionar modelo...'}
                        </option>
                        {modelos.map(m => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                        {equipmentData.marca && <option value="__nuevo__">+ Crear nuevo modelo</option>}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex gap-2">
                        <input
                          value={nuevoModelo}
                          onChange={e => setNuevoModelo(e.target.value)}
                          placeholder="Nombre del modelo..."
                          className={inputCls}
                          autoFocus
                          onKeyDown={e => e.key === 'Enter' && handleCrearModelo()}
                        />
                        <button onClick={handleCrearModelo} disabled={!nuevoModelo.trim()} className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors whitespace-nowrap">Crear</button>
                        <button onClick={() => { setShowNuevoModelo(false); setNuevoModelo(''); }} className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors">✕</button>
                      </div>
                      {modeloError && <p className="text-xs text-red-500">{modeloError}</p>}
                    </div>
                  )}
                </div>

                {/* Color */}
                <div>
                  <label className={labelCls}>Color</label>
                  <input
                    value={equipmentData.color}
                    onChange={e => setEquipmentData({ ...equipmentData, color: e.target.value })}
                    placeholder="Ej: Negro, Blanco, Azul"
                    className={inputCls}
                  />
                </div>

                {/* IMEI */}
                <div>
                  <label className={labelCls}>IMEI / N° de Serie <span className="text-slate-400 dark:text-slate-500 font-normal normal-case">(opcional)</span></label>
                  <input
                    value={equipmentData.imei}
                    onChange={e => setEquipmentData({ ...equipmentData, imei: e.target.value })}
                    placeholder="IMEI o número de serie"
                    className={inputCls}
                  />
                </div>

                {/* Método de acceso */}
                <div>
                  <label className={labelCls}>Método de acceso</label>
                  <select
                    value={equipmentData.accesoTipo}
                    onChange={e => {
                      setEquipmentData({ ...equipmentData, accesoTipo: e.target.value as 'ninguno' | 'pin' | 'patron', accesoValor: '' });
                      setPatternArr([]);
                    }}
                    className={inputCls}
                  >
                    <option value="ninguno">Ninguno</option>
                    <option value="pin">PIN / Contraseña</option>
                    <option value="patron">Patrón</option>
                  </select>
                </div>
              </div>

              {/* PIN input (conditional) */}
              {equipmentData.accesoTipo === 'pin' && (
                <div>
                  <label className={labelCls}>PIN / Contraseña del equipo <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      type={showPin ? 'text' : 'password'}
                      value={equipmentData.accesoValor}
                      onChange={e => setEquipmentData({ ...equipmentData, accesoValor: e.target.value })}
                      placeholder="Ingresa el PIN o contraseña del equipo"
                      className={`${inputCls} pr-10`}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                    >
                      {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Pattern lock (conditional) */}
              {equipmentData.accesoTipo === 'patron' && (
                <div>
                  <label className={labelCls}>
                    Patrón de desbloqueo <span className="text-red-500">*</span>{' '}
                    <span className="text-slate-400 dark:text-slate-500 font-normal normal-case">(mín. 4 puntos)</span>
                  </label>
                  <div className="flex flex-col items-center py-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
                    <PatternLock
                      pattern={patternArr}
                      onChange={setPatternArr}
                      minPoints={4}
                    />
                    {patternArr.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setPatternArr([])}
                        className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      >
                        <RotateCcw size={11} /> Limpiar patrón
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Diagnóstico */}
              <div>
                <label className={labelCls}>Diagnóstico Inicial</label>
                <textarea
                  value={equipmentData.diagnostico}
                  onChange={e => setEquipmentData({ ...equipmentData, diagnostico: e.target.value })}
                  placeholder="Describe el problema reportado por el cliente..."
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>
          )}

          {/* ── Step 3: Resumen ─────────────────────────────────────────── */}
          {currentStep === 'resumen' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                  <FileText size={15} className="text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Resumen de la Reparación</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Revisa los datos antes de crear la orden</p>
                </div>
              </div>

              {/* Cliente card */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                    <User size={11} /> Cliente
                  </p>
                </div>
                <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">Nombre</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{customerName || 'No registrado'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">Teléfono</p>
                    <p className="text-slate-700 dark:text-slate-200">{selectedCustomer?.telefono || selectedCustomer?.phone || 'No registrado'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">Email</p>
                    <p className="text-slate-700 dark:text-slate-200 truncate">{selectedCustomer?.correo || selectedCustomer?.email || 'No registrado'}</p>
                  </div>
                </div>
              </div>

              {/* Equipo card */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                    <Smartphone size={11} /> Equipo
                  </p>
                </div>
                <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">Tipo</p>
                    <p className="text-slate-700 dark:text-slate-200">{equipmentData.tipo || 'No registrado'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">Marca</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{equipmentData.marca || 'No registrado'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">Modelo</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{equipmentData.modelo || 'No registrado'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">Color</p>
                    <p className="text-slate-700 dark:text-slate-200">{equipmentData.color || 'No registrado'}</p>
                  </div>
                  {equipmentData.imei && (
                    <div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">IMEI/Serie</p>
                      <p className="text-slate-700 dark:text-slate-200 font-mono text-xs">{equipmentData.imei}</p>
                    </div>
                  )}
                  {equipmentData.accesoTipo !== 'ninguno' && (
                    <div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">Acceso</p>
                      <p className="text-slate-700 dark:text-slate-200">
                        {equipmentData.accesoTipo === 'pin' ? 'PIN registrado' : `Patrón: ${patternArr.join('-')}`}
                      </p>
                    </div>
                  )}
                </div>
                {equipmentData.diagnostico && (
                  <div className="px-4 pb-3 border-t border-slate-100 dark:border-slate-800 pt-2">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Diagnóstico Inicial</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 italic">{equipmentData.diagnostico}</p>
                  </div>
                )}
              </div>

              {/* ── Firma del cliente ───────────────────────────────── */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-2.5 bg-violet-50 dark:bg-violet-950/20 border-b border-violet-100 dark:border-violet-900/30 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-violet-600 dark:text-violet-400">
                      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-violet-700 dark:text-violet-300">Firma del Cliente</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Opcional — el cliente firma con el dedo</p>
                  </div>
                  {firmaBase64 && (
                    <span className="ml-auto text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-semibold px-2 py-0.5 rounded-full">✓ Firmado</span>
                  )}
                </div>
                <div className="p-4">
                  <FirmaCanvas onChange={setFirmaBase64} />
                </div>
              </div>

              {/* Fecha + PDF */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Fecha de Recepción</label>
                  <input
                    type="date"
                    value={fechaRecepcion}
                    onChange={e => setFechaRecepcion(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleGenerarPDF}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold transition-colors"
                  >
                    <Printer size={14} />
                    Imprimir Comprobante
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer / Actions ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 shrink-0">
          {/* Left: back button */}
          <div>
            {currentStep !== 'cliente' && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-colors"
              >
                <ArrowLeft size={14} /> Atrás
              </button>
            )}
          </div>

          {/* Right: cancel + next/create */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold transition-colors"
            >
              Cancelar
            </button>

            {currentStep === 'resumen' ? (
              <button
                onClick={handleSubmit}
                disabled={isCreating}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                {isCreating ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Save size={14} /> Crear Reparación
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!canContinue()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                Continuar <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    <ConfirmModal
      isOpen={confirmClose}
      title="Cerrar formulario"
      message="Hay datos sin guardar. ¿Deseas cerrar el formulario?"
      confirmLabel="Cerrar"
      variant="danger"
      onConfirm={() => { setConfirmClose(false); onClose(); }}
      onCancel={() => setConfirmClose(false)}
    />
    </>
  );
}
