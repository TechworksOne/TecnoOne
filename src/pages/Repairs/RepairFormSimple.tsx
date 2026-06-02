import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Smartphone, FileText, Printer, Plus, X } from 'lucide-react';
import { Customer } from '../../types/customer';
import { RepairFormData } from '../../types/repair';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import CustomerPicker from '../../components/customers/CustomerPicker';
import {
  getRepuestoTipos,
  getRepuestoMarcas,
  getRepuestoModelos,
  createRepuestoTipo,
  createRepuestoMarca,
  createRepuestoModelo,
  type RepuestoTipo,
  type RepuestoMarca,
  type RepuestoModelo,
} from '../../services/marcaLineaService';
import { generarPDFRecepcion } from '../../lib/pdfGenerator';
import { createReparacion } from '../../services/repairService';
import { useAuth } from '../../store/useAuth';
import { useToast } from '../../components/ui/Toast';

type Step = 'cliente' | 'equipo' | 'resumen';

interface EquipmentData {
  tipo: string;
  tipoId: number | null;
  marca: string;
  marcaId: number | null;
  modelo: string;
  color: string;
  imei: string;
  contrasena: string;
  diagnostico: string;
  estadoFisico: string;
  observaciones: string;
}

interface Accesorios {
  chip: boolean;
  estuche: boolean;
  memoriaSD: boolean;
  cargador: boolean;
  otros: string;
}

export default function RepairFormSimple() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const authUserName = user?.username || user?.name || 'Sistema';
  const [currentStep, setCurrentStep] = useState<Step>('cliente');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>();
  const [equipmentData, setEquipmentData] = useState<EquipmentData>({
    tipo: '', tipoId: null, marca: '', marcaId: null, modelo: '',
    color: '', imei: '', contrasena: '', diagnostico: '', estadoFisico: '', observaciones: '',
  });
  const [accesorios, setAccesorios] = useState<Accesorios>({
    chip: false, estuche: false, memoriaSD: false, cargador: false, otros: '',
  });
  const [tecnicoAsignado, setTecnicoAsignado] = useState('');
  const [isCreatingRepair, setIsCreatingRepair] = useState(false);
  const [fechaRecepcion, setFechaRecepcion] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Catalog
  const [tipos, setTipos] = useState<RepuestoTipo[]>([]);
  const [marcas, setMarcas] = useState<RepuestoMarca[]>([]);
  const [modelos, setModelos] = useState<RepuestoModelo[]>([]);
  const [loadingTipos, setLoadingTipos] = useState(false);
  const [loadingMarcas, setLoadingMarcas] = useState(false);
  const [loadingModelos, setLoadingModelos] = useState(false);

  // Inline creation
  const [showNuevoTipoInput, setShowNuevoTipoInput] = useState(false);
  const [nuevoTipo, setNuevoTipo] = useState('');
  const [creatingTipo, setCreatingTipo] = useState(false);
  const [showNuevaMarcaInput, setShowNuevaMarcaInput] = useState(false);
  const [nuevaMarca, setNuevaMarca] = useState('');
  const [creatingMarca, setCreatingMarca] = useState(false);
  const [showNuevoModeloInput, setShowNuevoModeloInput] = useState(false);
  const [nuevoModelo, setNuevoModelo] = useState('');
  const [creatingModelo, setCreatingModelo] = useState(false);

  useEffect(() => { loadTipos(); }, []);

  useEffect(() => {
    if (equipmentData.tipoId) {
      loadMarcas(equipmentData.tipoId);
    } else {
      setMarcas([]);
    }
  }, [equipmentData.tipoId]);

  useEffect(() => {
    if (equipmentData.tipoId && equipmentData.marcaId) {
      loadModelos(equipmentData.tipoId, equipmentData.marcaId);
    } else {
      setModelos([]);
    }
  }, [equipmentData.tipoId, equipmentData.marcaId]);

  const loadTipos = async () => {
    setLoadingTipos(true);
    try { setTipos(await getRepuestoTipos()); } catch { /* ignore */ }
    finally { setLoadingTipos(false); }
  };

  const loadMarcas = async (tipoId: number) => {
    setLoadingMarcas(true);
    try { setMarcas(await getRepuestoMarcas(tipoId)); } catch { setMarcas([]); }
    finally { setLoadingMarcas(false); }
  };

  const loadModelos = async (tipoId: number, marcaId: number) => {
    setLoadingModelos(true);
    try { setModelos(await getRepuestoModelos(tipoId, marcaId)); } catch { setModelos([]); }
    finally { setLoadingModelos(false); }
  };

  const handleTipoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tipoId = Number(e.target.value) || null;
    const tipoNombre = tipos.find(t => t.id === tipoId)?.nombre || '';
    setEquipmentData(prev => ({ ...prev, tipo: tipoNombre, tipoId, marca: '', marcaId: null, modelo: '' }));
    setShowNuevaMarcaInput(false);
    setShowNuevoModeloInput(false);
  };

  const handleMarcaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const marcaId = Number(e.target.value) || null;
    const marcaNombre = marcas.find(m => m.id === marcaId)?.nombre || '';
    setEquipmentData(prev => ({ ...prev, marca: marcaNombre, marcaId, modelo: '' }));
    setShowNuevoModeloInput(false);
  };

  const handleModeloChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const modeloId = Number(e.target.value) || null;
    const modeloNombre = modelos.find(m => m.id === modeloId)?.nombre || '';
    setEquipmentData(prev => ({ ...prev, modelo: modeloNombre }));
  };

  const handleCrearNuevoTipo = async () => {
    if (!nuevoTipo.trim() || creatingTipo) return;
    setCreatingTipo(true);
    try {
      const created = await createRepuestoTipo({ nombre: nuevoTipo.trim() });
      await loadTipos();
      setEquipmentData(prev => ({ ...prev, tipo: created.nombre, tipoId: created.id, marca: '', marcaId: null, modelo: '' }));
      setShowNuevoTipoInput(false); setNuevoTipo('');
    } catch { toast.error('Error al crear el tipo. Puede que ya exista.'); }
    finally { setCreatingTipo(false); }
  };

  const handleCrearNuevaMarca = async () => {
    if (!nuevaMarca.trim() || !equipmentData.tipoId || creatingMarca) return;
    setCreatingMarca(true);
    try {
      const created = await createRepuestoMarca({ tipo_id: equipmentData.tipoId, nombre: nuevaMarca.trim() });
      await loadMarcas(equipmentData.tipoId);
      setEquipmentData(prev => ({ ...prev, marca: created.nombre, marcaId: created.id, modelo: '' }));
      setShowNuevaMarcaInput(false); setNuevaMarca('');
    } catch { toast.error('Error al crear la marca. Puede que ya exista.'); }
    finally { setCreatingMarca(false); }
  };

  const handleCrearNuevoModelo = async () => {
    if (!nuevoModelo.trim() || !equipmentData.tipoId || !equipmentData.marcaId || creatingModelo) return;
    setCreatingModelo(true);
    try {
      const created = await createRepuestoModelo({
        tipo_id: equipmentData.tipoId,
        marca_id: equipmentData.marcaId,
        nombre: nuevoModelo.trim(),
      });
      await loadModelos(equipmentData.tipoId, equipmentData.marcaId);
      setEquipmentData(prev => ({ ...prev, modelo: created.nombre }));
      setShowNuevoModeloInput(false); setNuevoModelo('');
    } catch { toast.error('Error al crear el modelo. Puede que ya exista.'); }
    finally { setCreatingModelo(false); }
  };

  const handleNext = () => {
    if (currentStep === 'cliente' && selectedCustomer) setCurrentStep('equipo');
    else if (currentStep === 'equipo') setCurrentStep('resumen');
  };
  const handleBack = () => {
    if (currentStep === 'equipo') setCurrentStep('cliente');
    else if (currentStep === 'resumen') setCurrentStep('equipo');
  };
  const handleSubmit = () => { createRepair(); };

  const isStepCompleted = (step: Step) => {
    if (step === 'cliente') return !!selectedCustomer;
    if (step === 'equipo') return !!(equipmentData.tipo && equipmentData.marca && equipmentData.modelo);
    return true;
  };

  const canContinue = () => {
    if (currentStep === 'cliente') return !!selectedCustomer;
    if (currentStep === 'equipo')
      return !!(equipmentData.tipo && equipmentData.marca && equipmentData.modelo && equipmentData.diagnostico.trim());
    return true;
  };

  const handleGenerarPDF = () => {
    if (!selectedCustomer) { toast.error('Debe seleccionar un cliente primero'); return; }
    const numeroReparacion = `REP${String(Date.now()).slice(-6)}`;
    const [anio, mes, dia] = fechaRecepcion.split('-');
    generarPDFRecepcion({
      numeroReparacion,
      fecha: `${dia}/${mes}/${anio}`,
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
        accesoTipo: 'ninguno',
        contraseña: equipmentData.contrasena || undefined,
        diagnostico: equipmentData.diagnostico,
      },
    }, false);
  };

  const createRepair = async () => {
    if (!selectedCustomer) return;
    setIsCreatingRepair(true);
    try {
      const customerName = selectedCustomer.nombre
        ? `${selectedCustomer.nombre}${selectedCustomer.apellido ? ' ' + selectedCustomer.apellido : ''}`.trim()
        : `${selectedCustomer.firstName || ''} ${selectedCustomer.lastName || ''}`.trim();
      const isFrequent = selectedCustomer.frecuente
        || !!(selectedCustomer.loyaltyPoints && selectedCustomer.loyaltyPoints > 100);

      const repairData: RepairFormData = {
        clienteNombre: customerName,
        clienteTelefono: selectedCustomer.telefono || selectedCustomer.phone || '',
        clienteEmail: selectedCustomer.correo || selectedCustomer.email || '',
        clienteId: selectedCustomer.id?.toString(),
        clienteFrecuente: isFrequent,
        recepcion: {
          tipoEquipo: equipmentData.tipo as any,
          marca: equipmentData.marca,
          modelo: equipmentData.modelo,
          color: equipmentData.color,
          imeiSerie: equipmentData.imei,
          patronContraseña: equipmentData.contrasena,
          diagnosticoInicial: equipmentData.diagnostico,
          estadoFisico: equipmentData.estadoFisico || 'Sin observaciones',
          accesoriosRecibidos: {
            chip: accesorios.chip,
            estuche: accesorios.estuche,
            memoriaSD: accesorios.memoriaSD,
            cargador: accesorios.cargador,
            otrosAccesorios: accesorios.otros,
          },
          fotosRecepcion: [],
          fechaRecepcion,
          userRecepcion: authUserName,
        },
        estado: 'RECIBIDA',
        prioridad: 'MEDIA',
        garantiaMeses: 1,
        observaciones: equipmentData.observaciones || undefined,
        tecnicoAsignado: tecnicoAsignado || undefined,
        items: [],
        manoDeObra: 0,
        fotosFinales: [],
        historialEstados: [{
          id: `hist-${Date.now()}`,
          estado: 'RECIBIDA',
          nota: 'Equipo recibido para diagnostico',
          fotos: [],
          timestamp: new Date().toISOString(),
          user: authUserName,
        }],
      };

      const response = await createReparacion(repairData);
      toast.success(`Reparacion ${response.id} creada exitosamente`);
      navigate('/reparaciones');
    } catch (error) {
      console.error('Error creating repair:', error);
      toast.error('Error al crear la reparacion');
    } finally {
      setIsCreatingRepair(false);
    }
  };

  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';
  const inlineBoxCls = 'mt-2 flex gap-2 items-center p-2 bg-blue-50 rounded-lg border border-blue-200';
  const btnInlineCls = 'shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50 hover:bg-blue-700 transition-colors';

  const STEPS: Step[] = ['cliente', 'equipo', 'resumen'];
  const STEP_LABELS: Record<Step, string> = { cliente: 'Cliente', equipo: 'Equipo', resumen: 'Resumen' };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/reparaciones')} className="text-gray-600 dark:text-slate-400">
            <ArrowLeft size={20} className="mr-2" />
            Volver
          </Button>
          <PageHeader title="Nueva Reparacion" subtitle="Crear una nueva orden de reparacion" />
        </div>

        {/* Progress Steps */}
        <Card className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => {
              const isActive = currentStep === step;
              const isDone = isStepCompleted(step) && !isActive;
              return (
                <React.Fragment key={step}>
                  {idx > 0 && (
                    <div className={`flex-1 h-0.5 mx-4 ${isStepCompleted(STEPS[idx - 1]) ? 'bg-green-500' : 'bg-gray-200'}`} />
                  )}
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      isActive ? 'bg-blue-500 text-white' : isDone ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {isDone ? '✓' : idx + 1}
                    </div>
                    <span className={`font-medium ${isActive ? 'text-blue-600' : isDone ? 'text-green-600' : 'text-gray-500'}`}>
                      {STEP_LABELS[step]}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </Card>

        {/* STEP 1: Cliente */}
        {currentStep === 'cliente' && (
          <Card className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <User size={16} className="text-blue-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900">Datos del Cliente</h4>
              <span className="text-sm text-gray-500">Selecciona el cliente para esta reparacion</span>
            </div>
            <CustomerPicker
              value={selectedCustomer}
              onChange={setSelectedCustomer}
              allowCreate={true}
              placeholder="Buscar cliente por nombre, telefono o email..."
            />
          </Card>
        )}

        {/* STEP 2: Equipo */}
        {currentStep === 'equipo' && (
          <Card className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <Smartphone size={16} className="text-green-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900">Datos del Equipo</h4>
              <span className="text-sm text-gray-500">Informacion del dispositivo a reparar</span>
            </div>

            {/* Tipo > Marca > Modelo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Tipo de equipo */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-gray-700">Tipo de equipo *</label>
                  <button
                    type="button"
                    onClick={() => { setShowNuevoTipoInput(v => !v); setNuevoTipo(''); }}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <Plus size={12} /> Tipo
                  </button>
                </div>
                <Select
                  value={equipmentData.tipoId?.toString() || ''}
                  onChange={handleTipoChange}
                  disabled={loadingTipos}
                  className="w-full"
                >
                  <option value="">{loadingTipos ? 'Cargando...' : 'Seleccionar tipo...'}</option>
                  {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </Select>
                {showNuevoTipoInput && (
                  <div className={inlineBoxCls}>
                    <Input
                      value={nuevoTipo}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevoTipo(e.target.value)}
                      placeholder="Ej: Laptop, Consola..."
                      className="flex-1 text-sm"
                      autoFocus
                      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); handleCrearNuevoTipo(); } }}
                    />
                    <button type="button" onClick={handleCrearNuevoTipo} disabled={!nuevoTipo.trim() || creatingTipo} className={btnInlineCls}>
                      {creatingTipo ? '...' : 'Crear'}
                    </button>
                    <button type="button" onClick={() => setShowNuevoTipoInput(false)} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300">
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Marca */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-gray-700">Marca *</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!equipmentData.tipoId) { toast.error('Selecciona un tipo primero'); return; }
                      setShowNuevaMarcaInput(v => !v); setNuevaMarca('');
                    }}
                    className={`flex items-center gap-1 text-xs font-semibold transition-colors ${equipmentData.tipoId ? 'text-blue-600 hover:text-blue-800' : 'text-gray-300 cursor-not-allowed'}`}
                  >
                    <Plus size={12} /> Marca
                  </button>
                </div>
                <Select
                  value={equipmentData.marcaId?.toString() || ''}
                  onChange={handleMarcaChange}
                  disabled={!equipmentData.tipoId || loadingMarcas}
                  className="w-full"
                >
                  <option value="">{loadingMarcas ? 'Cargando...' : 'Seleccionar marca...'}</option>
                  {marcas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </Select>
                {!equipmentData.tipoId && <p className="text-xs text-gray-400 mt-1">Selecciona un tipo primero</p>}
                {showNuevaMarcaInput && (
                  <div className={inlineBoxCls}>
                    <Input
                      value={nuevaMarca}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevaMarca(e.target.value)}
                      placeholder="Nombre de la marca..."
                      className="flex-1 text-sm"
                      autoFocus
                      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); handleCrearNuevaMarca(); } }}
                    />
                    <button type="button" onClick={handleCrearNuevaMarca} disabled={!nuevaMarca.trim() || creatingMarca} className={btnInlineCls}>
                      {creatingMarca ? '...' : 'Crear'}
                    </button>
                    <button type="button" onClick={() => setShowNuevaMarcaInput(false)} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300">
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Modelo */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-gray-700">Modelo *</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!equipmentData.marcaId) { toast.error('Selecciona una marca primero'); return; }
                      setShowNuevoModeloInput(v => !v); setNuevoModelo('');
                    }}
                    className={`flex items-center gap-1 text-xs font-semibold transition-colors ${equipmentData.marcaId ? 'text-blue-600 hover:text-blue-800' : 'text-gray-300 cursor-not-allowed'}`}
                  >
                    <Plus size={12} /> Modelo
                  </button>
                </div>
                <Select
                  value={equipmentData.modelo}
                  onChange={handleModeloChange}
                  disabled={!equipmentData.marcaId || loadingModelos}
                  className="w-full"
                >
                  <option value="">{loadingModelos ? 'Cargando...' : 'Seleccionar modelo...'}</option>
                  {modelos.map(m => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                </Select>
                {!equipmentData.marcaId && <p className="text-xs text-gray-400 mt-1">Selecciona una marca primero</p>}
                {showNuevoModeloInput && (
                  <div className={inlineBoxCls}>
                    <Input
                      value={nuevoModelo}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevoModelo(e.target.value)}
                      placeholder="Ej: iPhone 16, Pavilion 15..."
                      className="flex-1 text-sm"
                      autoFocus
                      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); handleCrearNuevoModelo(); } }}
                    />
                    <button type="button" onClick={handleCrearNuevoModelo} disabled={!nuevoModelo.trim() || creatingModelo} className={btnInlineCls}>
                      {creatingModelo ? '...' : 'Crear'}
                    </button>
                    <button type="button" onClick={() => setShowNuevoModeloInput(false)} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300">
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Serie/IMEI + Color */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Serie / IMEI <span className="text-gray-400 dark:text-slate-500 font-normal">(opcional)</span></label>
                <Input
                  value={equipmentData.imei}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEquipmentData(prev => ({ ...prev, imei: e.target.value }))}
                  placeholder="Ingresa IMEI o numero de serie"
                  className="w-full"
                />
              </div>
              <div>
                <label className={labelCls}>Color <span className="text-gray-400 dark:text-slate-500 font-normal">(opcional)</span></label>
                <Input
                  value={equipmentData.color}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEquipmentData(prev => ({ ...prev, color: e.target.value }))}
                  placeholder="Ej: Negro, Blanco, Azul"
                  className="w-full"
                />
              </div>
            </div>

            {/* Problema reportado */}
            <div>
              <label className={labelCls}>Problema reportado *</label>
              <textarea
                value={equipmentData.diagnostico}
                onChange={e => setEquipmentData(prev => ({ ...prev, diagnostico: e.target.value }))}
                placeholder="Describe el problema reportado por el cliente..."
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
              />
            </div>

            {/* Estado fisico */}
            <div>
              <label className={labelCls}>Estado fisico</label>
              <Select
                value={equipmentData.estadoFisico}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEquipmentData(prev => ({ ...prev, estadoFisico: e.target.value }))}
                className="w-full"
              >
                <option value="">Sin observaciones</option>
                <option value="Buenas condiciones">Buenas condiciones</option>
                <option value="Pantalla rayada">Pantalla rayada</option>
                <option value="Pantalla fisurada">Pantalla fisurada</option>
                <option value="Carcasa danada">Carcasa danada</option>
                <option value="Danio por agua">Danio por agua</option>
                <option value="Golpeado">Golpeado</option>
                <option value="Sin evaluar">Sin evaluar</option>
              </Select>
            </div>

            {/* Accesorios recibidos */}
            <div>
              <label className={labelCls}>Accesorios recibidos</label>
              <div className="flex flex-wrap gap-4 mb-3">
                {([
                  ['chip', 'Chip / SIM'],
                  ['estuche', 'Estuche / Funda'],
                  ['memoriaSD', 'Memoria SD'],
                  ['cargador', 'Cargador'],
                ] as [keyof Accesorios, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={accesorios[key] as boolean}
                      onChange={e => setAccesorios(prev => ({ ...prev, [key]: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <Input
                value={accesorios.otros}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAccesorios(prev => ({ ...prev, otros: e.target.value }))}
                placeholder="Otros accesorios (ej: auriculares, caja original...)"
                className="w-full text-sm"
              />
            </div>

            {/* Contrasena */}
            <div>
              <label className={labelCls}>Contrasena / Patron <span className="text-gray-400 dark:text-slate-500 font-normal">(opcional)</span></label>
              <Input
                type="text"
                value={equipmentData.contrasena}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEquipmentData(prev => ({ ...prev, contrasena: e.target.value }))}
                placeholder="Contrasena o patron del equipo"
                className="w-full"
              />
              <p className="text-xs text-gray-400 mt-1">Para acceder al equipo durante la reparacion</p>
            </div>

            {/* Observaciones */}
            <div>
              <label className={labelCls}>Observaciones <span className="text-gray-400 dark:text-slate-500 font-normal">(opcional)</span></label>
              <textarea
                value={equipmentData.observaciones}
                onChange={e => setEquipmentData(prev => ({ ...prev, observaciones: e.target.value }))}
                placeholder="Notas adicionales sobre la reparacion..."
                rows={2}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
              />
            </div>

            {/* Tecnico asignado */}
            <div>
              <label className={labelCls}>Tecnico asignado <span className="text-gray-400 dark:text-slate-500 font-normal">(opcional)</span></label>
              <Input
                value={tecnicoAsignado}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTecnicoAsignado(e.target.value)}
                placeholder="Nombre del tecnico responsable..."
                className="w-full"
              />
            </div>
          </Card>
        )}

        {/* STEP 3: Resumen */}
        {currentStep === 'resumen' && (
          <Card className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <FileText size={16} className="text-purple-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900">Resumen de la Reparacion</h4>
              <span className="text-sm text-gray-500">Revisa los datos antes de crear la orden</span>
            </div>

            <div className="space-y-5">
              {/* Cliente */}
              <div>
                <h5 className="font-medium text-gray-700 mb-2">Cliente</h5>
                <div className="bg-blue-50 rounded-lg p-4 flex items-center gap-3">
                  <User size={20} className="text-blue-600 shrink-0" />
                  <div>
                    <p className="font-medium text-blue-900">
                      {selectedCustomer?.nombre
                        ? `${selectedCustomer.nombre}${selectedCustomer.apellido ? ' ' + selectedCustomer.apellido : ''}`.trim()
                        : `${selectedCustomer?.firstName || ''} ${selectedCustomer?.lastName || ''}`.trim()}
                    </p>
                    <div className="flex gap-4 text-sm text-blue-700 mt-0.5">
                      {(selectedCustomer?.telefono || selectedCustomer?.phone) && <span>{selectedCustomer?.telefono || selectedCustomer?.phone}</span>}
                      {(selectedCustomer?.correo || selectedCustomer?.email) && <span>{selectedCustomer?.correo || selectedCustomer?.email}</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Equipo */}
              <div>
                <h5 className="font-medium text-gray-700 mb-2">Equipo</h5>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Smartphone size={20} className="text-green-600 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-sm">
                      <p className="font-semibold text-green-900 text-base">
                        {equipmentData.tipo} &middot; {equipmentData.marca} &middot; {equipmentData.modelo}
                      </p>
                      {equipmentData.color && <p className="text-green-700">Color: {equipmentData.color}</p>}
                      {equipmentData.imei && <p className="text-green-700">IMEI/Serie: {equipmentData.imei}</p>}
                      {equipmentData.estadoFisico && <p className="text-green-700">Estado fisico: {equipmentData.estadoFisico}</p>}
                      <p className="text-green-700"><strong>Problema:</strong> {equipmentData.diagnostico}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Accesorios */}
              {(accesorios.chip || accesorios.estuche || accesorios.memoriaSD || accesorios.cargador || accesorios.otros) && (
                <div>
                  <h5 className="font-medium text-gray-700 mb-2">Accesorios recibidos</h5>
                  <div className="bg-gray-50 rounded-lg p-3 flex flex-wrap gap-2 text-sm">
                    {accesorios.chip && <span className="px-2 py-0.5 bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-600">Chip/SIM</span>}
                    {accesorios.estuche && <span className="px-2 py-0.5 bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-600">Estuche</span>}
                    {accesorios.memoriaSD && <span className="px-2 py-0.5 bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-600">Memoria SD</span>}
                    {accesorios.cargador && <span className="px-2 py-0.5 bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-600">Cargador</span>}
                    {accesorios.otros && <span className="px-2 py-0.5 bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-600">{accesorios.otros}</span>}
                  </div>
                </div>
              )}

              {/* Tecnico + Observaciones */}
              {(tecnicoAsignado || equipmentData.observaciones) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tecnicoAsignado && (
                    <div>
                      <h5 className="font-medium text-gray-700 mb-2">Tecnico asignado</h5>
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{tecnicoAsignado}</p>
                    </div>
                  )}
                  {equipmentData.observaciones && (
                    <div>
                      <h5 className="font-medium text-gray-700 mb-2">Observaciones</h5>
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{equipmentData.observaciones}</p>
                    </div>
                  )}
                </div>
              )}

              {/* PDF */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border-2 border-dashed border-purple-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Printer size={24} className="text-purple-600" />
                    <div>
                      <p className="font-medium text-gray-900">Comprobante de Recepcion</p>
                      <p className="text-sm text-gray-600">Genera el PDF con los terminos y condiciones</p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={handleGenerarPDF} className="bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-slate-700 text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-700">
                    <Printer size={16} className="mr-2" />
                    Generar PDF
                  </Button>
                </div>
              </div>

              {/* Fecha */}
              <div>
                <h5 className="font-medium text-gray-700 mb-2">Fecha de Recepcion</h5>
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Selecciona la fecha de ingreso del equipo
                  </label>
                  <input
                    type="date"
                    value={fechaRecepcion}
                    onChange={e => setFechaRecepcion(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between">
          <div>
            {currentStep !== 'cliente' && (
              <Button variant="ghost" onClick={handleBack} className="text-gray-600 dark:text-slate-400">
                <ArrowLeft size={16} className="mr-2" />
                Anterior
              </Button>
            )}
          </div>
          <div className="flex gap-4">
            <Button variant="ghost" onClick={() => navigate('/reparaciones')}>
              Cancelar
            </Button>
            {currentStep === 'resumen' ? (
              <Button
                disabled={isCreatingRepair}
                onClick={handleSubmit}
                className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
              >
                {isCreatingRepair
                  ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />Creando...</>
                  : <>Crear Reparacion</>
                }
              </Button>
            ) : (
              <Button
                disabled={!canContinue()}
                onClick={handleNext}
                className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
              >
                Siguiente
              </Button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
