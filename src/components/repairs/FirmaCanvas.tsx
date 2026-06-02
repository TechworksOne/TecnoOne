import { useRef, useEffect, useCallback, useState } from 'react';
import { Check, RotateCcw, PenLine, Maximize2, X } from 'lucide-react';

interface FirmaCanvasProps {
  /** Se llama con base64 PNG cuando el cliente confirma la firma, o null al limpiar */
  onChange: (base64: string | null) => void;
}

// ── Canvas helpers ────────────────────────────────────────────────────────────

function setupCanvas(canvas: HTMLCanvasElement, lineWidth = 2.5) {
  const dpr  = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  canvas.width  = Math.round(rect.width  * dpr);
  canvas.height = Math.round(rect.height * dpr);

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.fillStyle   = '#ffffff';
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth   = lineWidth;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
}

function resetCanvas(canvas: HTMLCanvasElement, lineWidth = 2.5) {
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle   = '#ffffff';
  ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth   = lineWidth;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
}

function getCoords(e: PointerEvent, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

// ─────────────────────────────────────────────────────────────────────────────

export default function FirmaCanvas({ onChange }: FirmaCanvasProps) {
  // ── Refs ───────────────────────────────────────────────────────────────────
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const fsCanvasRef   = useRef<HTMLCanvasElement>(null);
  const mainDrawing   = useRef(false);
  const mainHasStroke = useRef(false);
  const fsDrawing     = useRef(false);
  const fsHasStroke   = useRef(false);

  // ── State ──────────────────────────────────────────────────────────────────
  const [mainIsEmpty,     setMainIsEmpty]     = useState(true);
  const [fsIsEmpty,       setFsIsEmpty]       = useState(true);
  const [confirmedBase64, setConfirmedBase64] = useState<string | null>(null);
  const [showFullscreen,  setShowFullscreen]  = useState(false);

  // ── Init main canvas ───────────────────────────────────────────────────────
  const initMain = useCallback(() => {
    if (mainCanvasRef.current) setupCanvas(mainCanvasRef.current, 2.5);
  }, []);

  useEffect(() => {
    initMain();
    const ro = new ResizeObserver(() => {
      if (!mainHasStroke.current) initMain();
    });
    if (mainCanvasRef.current) ro.observe(mainCanvasRef.current);
    return () => ro.disconnect();
  }, [initMain]);

  // ── Init fullscreen canvas cuando el modal abre ────────────────────────────
  useEffect(() => {
    if (!showFullscreen) return;
    const t = setTimeout(() => {
      fsHasStroke.current = false;
      setFsIsEmpty(true);
      if (fsCanvasRef.current) setupCanvas(fsCanvasRef.current, 3);
    }, 60);
    return () => clearTimeout(t);
  }, [showFullscreen]);

  // ── Pointer events: canvas inline ─────────────────────────────────────────
  const mainDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const c = mainCanvasRef.current!;
    c.setPointerCapture(e.pointerId);
    const { x, y } = getCoords(e.nativeEvent, c);
    const ctx = c.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(x, y);
    mainDrawing.current   = true;
    mainHasStroke.current = true;
    setMainIsEmpty(false);
    if (confirmedBase64) { setConfirmedBase64(null); onChange(null); }
  };

  const mainMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!mainDrawing.current) return;
    e.preventDefault();
    const c = mainCanvasRef.current!;
    const { x, y } = getCoords(e.nativeEvent, c);
    const ctx = c.getContext('2d')!;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const mainUp = () => { mainDrawing.current = false; };

  // ── Pointer events: canvas fullscreen ─────────────────────────────────────
  const fsDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const c = fsCanvasRef.current!;
    c.setPointerCapture(e.pointerId);
    const { x, y } = getCoords(e.nativeEvent, c);
    const ctx = c.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(x, y);
    fsDrawing.current   = true;
    fsHasStroke.current = true;
    setFsIsEmpty(false);
  };

  const fsMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!fsDrawing.current) return;
    e.preventDefault();
    const c = fsCanvasRef.current!;
    const { x, y } = getCoords(e.nativeEvent, c);
    const ctx = c.getContext('2d')!;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const fsUp = () => { fsDrawing.current = false; };

  // ── Acciones: canvas inline ────────────────────────────────────────────────
  const mainClear = () => {
    if (mainCanvasRef.current) resetCanvas(mainCanvasRef.current, 2.5);
    mainHasStroke.current = false;
    setMainIsEmpty(true);
    setConfirmedBase64(null);
    onChange(null);
  };

  const mainConfirm = () => {
    if (mainIsEmpty) return;
    const b64 = mainCanvasRef.current!.toDataURL('image/png');
    setConfirmedBase64(b64);
    onChange(b64);
  };

  // ── Acciones: fullscreen ───────────────────────────────────────────────────
  const fsClear = () => {
    if (fsCanvasRef.current) resetCanvas(fsCanvasRef.current, 3);
    fsHasStroke.current = false;
    setFsIsEmpty(true);
  };

  const fsCancel = () => setShowFullscreen(false);

  const fsUsarFirma = () => {
    if (fsIsEmpty) return;
    const b64 = fsCanvasRef.current!.toDataURL('image/png');
    setConfirmedBase64(b64);
    onChange(b64);
    setShowFullscreen(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-3">

        {confirmedBase64 ? (
          /* ── Vista previa de la firma capturada ── */
          <div className="rounded-xl border-2 border-green-500 overflow-hidden">
            <div style={{ background: '#ffffff', padding: '10px 16px' }}>
              <img
                src={confirmedBase64}
                alt="Firma del cliente"
                className="w-full mx-auto"
                style={{ maxHeight: 90, objectFit: 'contain', display: 'block' }}
              />
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 dark:bg-green-950/20 border-t border-green-200 dark:border-green-900/30">
              <Check size={14} className="text-green-600 dark:text-green-400 shrink-0" />
              <span className="text-xs font-semibold text-green-700 dark:text-green-400 flex-1">
                Firma capturada correctamente
              </span>
              <button
                type="button"
                onClick={mainClear}
                className="text-xs text-slate-400 hover:text-red-500 transition-colors underline underline-offset-2"
              >
                Cambiar firma
              </button>
            </div>
          </div>

        ) : (
          /* ── Canvas inline ── */
          <>
            <div
              className={`relative overflow-hidden border-2 transition-colors ${
                mainIsEmpty
                  ? 'border-dashed border-slate-300 dark:border-slate-600'
                  : 'border-slate-400 dark:border-slate-500'
              }`}
              style={{ borderRadius: 12 }}
            >
              <canvas
                ref={mainCanvasRef}
                className="w-full touch-none cursor-crosshair block"
                style={{ height: 260, background: '#ffffff', touchAction: 'none', display: 'block' }}
                onPointerDown={mainDown}
                onPointerMove={mainMove}
                onPointerUp={mainUp}
                onPointerLeave={mainUp}
                onPointerCancel={mainUp}
              />
              {mainIsEmpty && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-2">
                  <PenLine size={24} className="text-slate-300" />
                  <p className="text-slate-300 text-sm font-medium select-none">
                    Firma aquí con el dedo
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={mainClear}
                disabled={mainIsEmpty}
                className="flex items-center justify-center gap-1 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                <RotateCcw size={13} /> Limpiar
              </button>
              <button
                type="button"
                onClick={() => setShowFullscreen(true)}
                className="flex items-center justify-center gap-1 py-2.5 text-xs font-semibold rounded-xl border border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors"
              >
                <Maximize2 size={13} /> Pantalla completa
              </button>
              <button
                type="button"
                onClick={mainConfirm}
                disabled={mainIsEmpty}
                className="flex items-center justify-center gap-1 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition-colors"
              >
                <Check size={13} /> Confirmar
              </button>
            </div>
          </>
        )}

      </div>

      {/* ── Modal pantalla completa ────────────────────────────────────────── */}
      {showFullscreen && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-slate-900"
          style={{ touchAction: 'none' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                <PenLine size={16} className="text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">
                  Firma del cliente
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                  Firme con el dedo en el área de abajo
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={fsCancel}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Canvas */}
          <div className="px-4 pt-4 pb-2 shrink-0">
            <div
              className={`relative overflow-hidden border-2 transition-colors ${
                fsIsEmpty
                  ? 'border-dashed border-slate-300 dark:border-slate-600'
                  : 'border-slate-400 dark:border-slate-500'
              }`}
              style={{ borderRadius: 16 }}
            >
              <canvas
                ref={fsCanvasRef}
                className="w-full touch-none cursor-crosshair block"
                style={{ height: '65vh', background: '#ffffff', touchAction: 'none', display: 'block' }}
                onPointerDown={fsDown}
                onPointerMove={fsMove}
                onPointerUp={fsUp}
                onPointerLeave={fsUp}
                onPointerCancel={fsUp}
              />
              {fsIsEmpty && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-3">
                  <PenLine size={44} className="text-slate-200" />
                  <p className="text-slate-300 text-base font-medium select-none">
                    Firma aquí con el dedo
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Botones */}
          <div
            className="px-4 pt-3 grid grid-cols-3 gap-3 shrink-0 border-t border-slate-200 dark:border-slate-700 mt-auto"
            style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}
          >
            <button
              type="button"
              onClick={fsClear}
              disabled={fsIsEmpty}
              className="flex items-center justify-center gap-1.5 py-4 text-sm font-semibold rounded-2xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              <RotateCcw size={16} /> Limpiar
            </button>
            <button
              type="button"
              onClick={fsCancel}
              className="flex items-center justify-center gap-1.5 py-4 text-sm font-semibold rounded-2xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={16} /> Cancelar
            </button>
            <button
              type="button"
              onClick={fsUsarFirma}
              disabled={fsIsEmpty}
              className="flex items-center justify-center gap-1.5 py-4 text-sm font-semibold rounded-2xl bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white transition-colors"
            >
              <Check size={16} /> Usar firma
            </button>
          </div>
        </div>
      )}
    </>
  );
}
