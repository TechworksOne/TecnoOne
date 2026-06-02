import { useState } from 'react';
import {
  X, Layers, Eye, Save, ChevronRight, AlertTriangle,
  Hash, Shuffle, AlignLeft, Tag, Clock, FileText, Info,
} from 'lucide-react';
import * as stickerService from '../../services/stickerGarantiaService';
import type { TipoGeneracion, LoteConfig } from '../../services/stickerGarantiaService';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'config' | 'preview';

const TIPOS: { value: TipoGeneracion; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'correlativo',  label: 'Correlativo simple',     icon: <Hash size={16} />,      desc: '0001, 0002, 0003…' },
  { value: 'con_prefijo',  label: 'Con prefijo',            icon: <Tag size={16} />,       desc: 'TC-0001, TC-0002…' },
  { value: 'estructura',   label: 'Estructura personalizada', icon: <AlignLeft size={16} />, desc: 'TC-GAR-202605-0001' },
  { value: 'aleatorio',    label: 'Aleatorio',               icon: <Shuffle size={16} />,   desc: 'K7XN-M3QA…' },
  { value: 'manual',       label: 'Manual múltiple',         icon: <FileText size={16} />,  desc: 'Pegar lista de códigos' },
];

const TIPOS_GARANTIA = ['Reparación', 'Venta', 'Producto', 'Equipo', 'Otro'];

const DEFAULT_FORM: LoteConfig = {
  tipo: 'correlativo',
  cantidad: 10,
  numeroInicial: 1,
  digitos: 4,
  prefijo: '',
  estructura: 'TC-GAR-{YYYY}{MM}-{####}',
  codigosManual: '',
  diasGarantia: 90,
  tipoGarantia: 'Reparación',
  notas: '',
  guardarComoDisponibles: true,
};

// ─── Componente ───────────────────────────────────────────────────────────────

export default function GenerarLoteModal({ open, onClose, onSuccess }: Props) {
  const [step, setStep]               = useState<Step>('config');
  const [form, setForm]               = useState<LoteConfig>(DEFAULT_FORM);
  const [preview, setPreview]         = useState<string[]>([]);
  const [duplicados, setDuplicados]   = useState<string[]>([]);
  const [errorMsg, setErrorMsg]       = useState('');
  const [loading, setLoading]         = useState(false);

  if (!open) return null;

  // ── helpers ──────────────────────────────────────────────────────────────

  function set<K extends keyof LoteConfig>(key: K, value: LoteConfig[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrorMsg('');
  }

  const handleClose = () => {
    setStep('config');
    setForm(DEFAULT_FORM);
    setPreview([]);
    setDuplicados([]);
    setErrorMsg('');
    onClose();
  };

  // ── preview ──────────────────────────────────────────────────────────────

  const handlePreview = async () => {
    setErrorMsg('');
    setDuplicados([]);

    if (form.tipo !== 'manual' && (form.cantidad <= 0 || form.cantidad > 500)) {
      setErrorMsg('La cantidad debe estar entre 1 y 500 stickers.');
      return;
    }

    setLoading(true);
    try {
      const result = await stickerService.previewLote(form);
      if (!result.success) {
        setErrorMsg(result.message ?? 'Error al generar vista previa');
        if (result.duplicados?.length) setDuplicados(result.duplicados);
        return;
      }
      setPreview(result.codigos);
      setStep('preview');
    } catch (err: any) {
      const data = err?.response?.data;
      setErrorMsg(data?.message ?? 'Error al conectar con el servidor');
      if (data?.duplicados?.length) setDuplicados(data.duplicados);
    } finally {
      setLoading(false);
    }
  };

  // ── guardar ──────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setLoading(true);
    try {
      const result = await stickerService.createLote(form);
      if (!result.success) {
        setErrorMsg(result.message ?? 'Error al guardar el lote');
        return;
      }
      onSuccess();
      handleClose();
    } catch (err: any) {
      const data = err?.response?.data;
      setErrorMsg(data?.message ?? 'Error al guardar el lote');
      if (data?.duplicados?.length) {
        setDuplicados(data.duplicados);
        setStep('config');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── shared styles ─────────────────────────────────────────────────────────

  const inputCls =
    'w-full px-3 py-2 text-sm rounded-xl border outline-none focus:ring-2 transition-colors';
  const inputStyle = {
    background: 'var(--color-input-bg)',
    borderColor: 'var(--color-border)',
    color: 'var(--color-text)',
  };
  const labelCls =
    'block text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5';
  const sectionCls =
    'rounded-2xl border p-4 space-y-4';
  const sectionStyle = {
    borderColor: 'var(--color-border)',
    background: 'var(--color-surface)',
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: 'rgba(72,185,230,0.12)' }}>
              <Layers size={18} className="text-[var(--color-primary)]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--color-text)]">Generar lote de stickers</h2>
              <p className="text-xs text-[var(--color-text-muted)]">
                {step === 'config' ? 'Configura la generación' : `${preview.length} códigos listos`}
              </p>
            </div>
          </div>

          {/* Steps indicator */}
          <div className="flex items-center gap-2 mr-6">
            {(['config', 'preview'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                  step === s
                    ? 'bg-[var(--color-primary)] text-white'
                    : i < (['config', 'preview'] as Step[]).indexOf(step)
                      ? 'bg-emerald-500 text-white'
                      : 'text-[var(--color-text-muted)]'
                  }`}
                  style={step !== s && i >= (['config','preview'] as Step[]).indexOf(step)
                    ? { background: 'var(--color-surface-soft)', border: '1px solid var(--color-border)' }
                    : {}}>
                  {i + 1}
                </div>
                {i < 1 && <ChevronRight size={12} className="text-[var(--color-text-muted)]" />}
              </div>
            ))}
          </div>

          <button onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-[var(--color-row-hover)] transition-colors text-[var(--color-text-muted)]">
            <X size={18} />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Error banner */}
          {errorMsg && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl border"
              style={{ borderColor: 'rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)' }}>
              <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-600">{errorMsg}</p>
                {duplicados.length > 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    Duplicados: {duplicados.slice(0, 8).join(', ')}{duplicados.length > 8 ? `… +${duplicados.length - 8}` : ''}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── STEP: Config ─────────────────────────────────────────────── */}
          {step === 'config' && (
            <>
              {/* Tipo de generación */}
              <div className={sectionCls} style={sectionStyle}>
                <p className={labelCls}>Tipo de generación</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TIPOS.map((t) => (
                    <button key={t.value} onClick={() => set('tipo', t.value)}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                        form.tipo === t.value
                          ? 'border-[var(--color-primary)] bg-[rgba(72,185,230,0.08)]'
                          : 'hover:bg-[var(--color-row-hover)]'
                      }`}
                      style={form.tipo !== t.value ? { borderColor: 'var(--color-border)' } : {}}>
                      <span className={`mt-0.5 ${form.tipo === t.value ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                        {t.icon}
                      </span>
                      <div>
                        <p className={`text-xs font-semibold ${form.tipo === t.value ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
                          {t.label}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-muted)]">{t.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Campos según tipo */}
              {form.tipo !== 'manual' && (
                <div className={sectionCls} style={sectionStyle}>
                  <p className={labelCls}>Parámetros de generación</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Cantidad <span className="text-red-400">*</span></label>
                      <input type="number" min={1} max={500} value={form.cantidad}
                        onChange={(e) => set('cantidad', Math.max(1, Math.min(500, Number(e.target.value))))}
                        className={inputCls} style={inputStyle} />
                    </div>
                    {(form.tipo === 'correlativo' || form.tipo === 'con_prefijo' || form.tipo === 'estructura') && (
                      <div>
                        <label className={labelCls}>Número inicial</label>
                        <input type="number" min={0} value={form.numeroInicial}
                          onChange={(e) => set('numeroInicial', Math.max(0, Number(e.target.value)))}
                          className={inputCls} style={inputStyle} />
                      </div>
                    )}
                    {(form.tipo !== 'estructura') && (
                      <div>
                        <label className={labelCls}>Dígitos / longitud</label>
                        <input type="number" min={1} max={20} value={form.digitos}
                          onChange={(e) => set('digitos', Math.max(1, Number(e.target.value)))}
                          className={inputCls} style={inputStyle} />
                      </div>
                    )}
                    {(form.tipo === 'con_prefijo' || form.tipo === 'estructura' || form.tipo === 'aleatorio') && (
                      <div>
                        <label className={labelCls}>Prefijo</label>
                        <input type="text" value={form.prefijo} placeholder="TC"
                          onChange={(e) => set('prefijo', e.target.value)}
                          className={inputCls} style={inputStyle} />
                      </div>
                    )}
                  </div>

                  {form.tipo === 'estructura' && (
                    <div>
                      <label className={labelCls}>Estructura personalizada</label>
                      <input type="text" value={form.estructura}
                        onChange={(e) => set('estructura', e.target.value)}
                        placeholder="TC-GAR-{YYYY}{MM}-{####}"
                        className={inputCls} style={inputStyle} />
                      <div className="mt-2 p-3 rounded-xl text-xs space-y-1"
                        style={{ background: 'rgba(72,185,230,0.06)', border: '1px solid rgba(72,185,230,0.2)' }}>
                        <p className="flex items-center gap-1.5 font-semibold text-[var(--color-primary)]">
                          <Info size={12} /> Variables disponibles:
                        </p>
                        {[
                          ['{YYYY}', 'Año completo (2026)'],
                          ['{YY}', 'Año corto (26)'],
                          ['{MM}', 'Mes (05)'],
                          ['{DD}', 'Día (28)'],
                          ['{PREFIX}', 'Prefijo escrito arriba'],
                          ['{####}', 'Número correlativo (la cantidad de # define los dígitos)'],
                        ].map(([v, d]) => (
                          <p key={v} className="text-[var(--color-text-sec)]">
                            <span className="font-mono text-[var(--color-primary)]">{v}</span> — {d}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {form.tipo === 'manual' && (
                <div className={sectionCls} style={sectionStyle}>
                  <label className={labelCls}>Códigos (uno por línea)</label>
                  <textarea rows={8} value={form.codigosManual}
                    onChange={(e) => set('codigosManual', e.target.value)}
                    placeholder={'TC-GAR-0001\nTC-GAR-0002\nTC-GAR-0003'}
                    className={`${inputCls} resize-none font-mono`} style={inputStyle} />
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {form.codigosManual.split('\n').filter((l) => l.trim()).length} códigos detectados
                    {form.codigosManual.split('\n').filter((l) => l.trim()).length > 500 && (
                      <span className="text-red-500 ml-1">— máximo 500</span>
                    )}
                  </p>
                </div>
              )}

              {/* Garantía y opciones */}
              <div className={sectionCls} style={sectionStyle}>
                <p className={labelCls}>Configuración de garantía</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Días de garantía</label>
                    <div className="relative">
                      <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                      <input type="number" min={0} value={form.diasGarantia}
                        onChange={(e) => set('diasGarantia', Math.max(0, Number(e.target.value)))}
                        className={`${inputCls} pl-8`} style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Tipo de garantía</label>
                    <select value={form.tipoGarantia}
                      onChange={(e) => set('tipoGarantia', e.target.value)}
                      className={inputCls}
                      style={{ ...inputStyle, cursor: 'pointer' }}>
                      {TIPOS_GARANTIA.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Notas opcionales</label>
                  <textarea rows={2} value={form.notas} placeholder="Ej: Lote mayo 2026, cliente corporativo…"
                    onChange={(e) => set('notas', e.target.value)}
                    className={`${inputCls} resize-none`} style={inputStyle} />
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={form.guardarComoDisponibles}
                      onChange={(e) => set('guardarComoDisponibles', e.target.checked)}
                      className="w-4 h-4 rounded accent-[var(--color-primary)]" />
                    <span className="text-sm text-[var(--color-text)]">Guardar como disponibles</span>
                  </label>
                </div>
              </div>
            </>
          )}

          {/* ── STEP: Preview ────────────────────────────────────────────── */}
          {step === 'preview' && (
            <>
              <div className="flex items-start gap-3 p-4 rounded-xl border"
                style={{ borderColor: 'rgba(72,185,230,0.3)', background: 'rgba(72,185,230,0.06)' }}>
                <Eye size={16} className="text-[var(--color-primary)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text)]">
                    Vista previa — {preview.length} sticker{preview.length !== 1 ? 's' : ''} a generar
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    Tipo: <strong>{TIPOS.find((t) => t.value === form.tipo)?.label}</strong>
                    {form.diasGarantia > 0 && <> · Garantía: <strong>{form.diasGarantia} días</strong></>}
                    {form.tipoGarantia && <> · <strong>{form.tipoGarantia}</strong></>}
                  </p>
                </div>
              </div>

              <div className={`${sectionCls} space-y-0`} style={sectionStyle}>
                <p className={`${labelCls} mb-3`}>Primeros {Math.min(preview.length, 20)} códigos</p>
                <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
                  {preview.slice(0, 20).map((code, i) => (
                    <div key={i}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-soft)' }}>
                      <span className="text-[10px] font-bold text-[var(--color-text-muted)] w-5 shrink-0">{i + 1}</span>
                      <span className="font-mono text-xs text-[var(--color-primary)] font-semibold truncate">{code}</span>
                    </div>
                  ))}
                </div>
                {preview.length > 20 && (
                  <p className="text-xs text-[var(--color-text-muted)] pt-2">
                    … y {preview.length - 20} sticker{preview.length - 20 !== 1 ? 's' : ''} más
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-xl border"
                style={{ borderColor: 'rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.06)' }}>
                <p className="text-xs text-emerald-600 font-semibold">
                  ✓ Sin duplicados en la base de datos. Todos los códigos son únicos.
                </p>
              </div>
            </>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t shrink-0"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <button onClick={step === 'config' ? handleClose : () => setStep('config')}
            className="px-4 py-2 rounded-xl text-sm font-medium border transition-colors hover:bg-[var(--color-row-hover)]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-sec)' }}>
            {step === 'config' ? 'Cancelar' : '← Editar configuración'}
          </button>

          {step === 'config' && (
            <button onClick={handlePreview} disabled={loading}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
              style={{ background: 'var(--color-primary)', color: '#fff' }}>
              {loading ? (
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <Eye size={16} />
              )}
              Vista previa
            </button>
          )}

          {step === 'preview' && (
            <button onClick={handleSave} disabled={loading}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
              style={{ background: 'var(--color-primary)', color: '#fff' }}>
              {loading ? (
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Guardar {preview.length} sticker{preview.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
