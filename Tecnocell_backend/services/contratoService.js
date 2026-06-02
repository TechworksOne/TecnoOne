/**
 * contratoService.js
 * ──────────────────────────────────────────────────────────────────────────
 * Rellena la plantilla `contrato_tecnocell_oficial_v2.pdf` con los datos
 * dinámicos de la reparación y la firma del cliente.
 *
 * REGLA: NO se genera diseño desde cero. Solo se escriben textos e imagen
 * de firma encima de la plantilla existente.
 *
 * Dependencia:  pdf-lib  (ya instalado)
 * ──────────────────────────────────────────────────────────────────────────
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

// ── Rutas ────────────────────────────────────────────────────────────────────
const TEMPLATE_PATH = path.join(
  __dirname, '..', 'templates', 'contrato_tecnocell_oficial_v2.pdf'
);
const CONTRATOS_DIR = path.join(__dirname, '..', 'uploads', 'contratos');

// ══════════════════════════════════════════════════════════════════════════════
// TAMAÑOS DE FUENTE
// ══════════════════════════════════════════════════════════════════════════════
const FONT_SMALL  = 8;
const FONT_NORMAL = 9;
const FONT_MEDIUM = 10;
const FONT_BOLD   = 11;

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 1 — CABECERA (superior derecha)
// ══════════════════════════════════════════════════════════════════════════════
const TOP_DATE_X = 505;
const TOP_DATE_Y = 712;

const REP_ID_X = 478;
const REP_ID_Y = 699;

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 1 — DATOS CLIENTE
// ══════════════════════════════════════════════════════════════════════════════
const NOMBRE_X = 118;
const NOMBRE_Y = 667;

const TELEFONO_X = 123;
const TELEFONO_Y = 647;

const FECHA_X = 455;
const FECHA_Y = 647;

const MARCA_MODELO_X = 140;
const MARCA_MODELO_Y = 628;

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 1 — RECUADRO DESCRIPCIÓN
// ══════════════════════════════════════════════════════════════════════════════
const DESCRIPCION_X           = 145;
const DESCRIPCION_Y           = 530;
const DESCRIPCION_MAX_WIDTH   = 285;
const DESCRIPCION_FONT_SIZE   = 9;
const DESCRIPCION_LINE_HEIGHT = 11;

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 2 — CUADROS DE COSTOS (inferior)
// ══════════════════════════════════════════════════════════════════════════════
const COSTO_X      = 150;
const COSTO_Y      = 58;

const ANTICIPO_X   = 315;
const ANTICIPO_Y   = 58;

const DIFERENCIA_X = 480;
const DIFERENCIA_Y = 58;

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 2 — FIRMA DEL CLIENTE (inferior derecha, línea "Cliente:")
// ══════════════════════════════════════════════════════════════════════════════
const FIRMA_CLIENTE_X = 440;
const FIRMA_CLIENTE_Y = 8;
const FIRMA_CLIENTE_W = 130;
const FIRMA_CLIENTE_H = 38;

const NOMBRE_FIRMA_X = 452;
const NOMBRE_FIRMA_Y = 2;

// ─────────────────────────────────────────────────────────────────────────────
// VALORES VACÍOS — no se dibujan
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_VALUES = new Set(['', 'ninguno', 'n/a', 'none', 'null', 'undefined', '-', '—']);

function isEmpty(val) {
  if (val == null) return true;
  return EMPTY_VALUES.has(String(val).trim().toLowerCase());
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Dibuja texto solo si el valor no está vacío / es "ninguno" / null.
 */
function drawSafeText(page, value, x, y, opts = {}) {
  if (isEmpty(value)) return;
  page.drawText(String(value).trim(), {
    x,
    y,
    size:     opts.size  || FONT_NORMAL,
    font:     opts.bold  ? opts._fontBold : opts._font,
    color:    opts.color || rgb(0.05, 0.05, 0.05),
    maxWidth: opts.maxWidth,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Dibuja texto con wrap manual (divide en líneas por espacios).
 * Cada línea ocupa `lineHeight` puntos hacia abajo (Y decrece).
 */
function drawWrappedText(page, value, x, y, maxWidth, lineHeight, fontSize, fontObj, colorObj) {
  if (isEmpty(value)) return;
  const words   = String(value).trim().split(/\s+/);
  const avgChar = fontSize * 0.55; // estimación ancho carácter Helvetica
  const maxChars = Math.floor(maxWidth / avgChar);

  let line = '';
  let curY = y;

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (test.length > maxChars && line) {
      page.drawText(line, { x, y: curY, size: fontSize, font: fontObj, color: colorObj });
      curY -= lineHeight;
      line  = word;
    } else {
      line = test;
    }
  }
  if (line) {
    page.drawText(line, { x, y: curY, size: fontSize, font: fontObj, color: colorObj });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Convierte la URL relativa guardada en BD a ruta física absoluta.
 */
function resolveFirmaPath(firmaClienteUrl) {
  if (!firmaClienteUrl) return null;

  const raw = String(firmaClienteUrl).trim();

  if (raw.startsWith('/uploads/'))     return path.join('/app', raw);
  if (raw.startsWith('uploads/'))      return path.join('/app', raw);
  if (raw.startsWith('/app/uploads/')) return raw;
  if (path.isAbsolute(raw))            return raw;

  return path.join('/app/uploads', raw);
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Embebe la imagen de firma en la página 2.
 * No lanza excepción si la firma no existe — el PDF se genera igual.
 */
async function insertarFirmaCliente(pdfDoc, page2, firmaClienteUrl, font, colorObj) {
  console.log('[ContratoPDF] firma_cliente_url:', firmaClienteUrl);

  const firmaPath = resolveFirmaPath(firmaClienteUrl);
  console.log('[ContratoPDF] firmaPath:', firmaPath);
  console.log('[ContratoPDF] existe firma:', firmaPath ? fs.existsSync(firmaPath) : false);

  if (!firmaPath || !fs.existsSync(firmaPath)) {
    console.warn('[ContratoPDF] ⚠️  Firma no encontrada — PDF generado sin firma.');
    return;
  }

  try {
    const firmaBytes = fs.readFileSync(firmaPath);
    const firmaImage = await pdfDoc.embedPng(firmaBytes);

    page2.drawImage(firmaImage, {
      x:      FIRMA_CLIENTE_X,
      y:      FIRMA_CLIENTE_Y,
      width:  FIRMA_CLIENTE_W,
      height: FIRMA_CLIENTE_H,
    });

    console.log('[ContratoPDF] firma insertada correctamente');
  } catch (err) {
    console.error('[ContratoPDF] ❌ Error insertando firma:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Genera el contrato PDF rellenando la plantilla con los datos de la reparación.
 *
 * @param {object}      datos
 * @param {string}      datos.reparacionId
 * @param {string}      datos.fecha             DD/MM/YYYY
 * @param {string}      datos.clienteNombre
 * @param {string}      datos.clienteTel
 * @param {string}      datos.tipoEquipo
 * @param {string}      datos.marca
 * @param {string}      datos.modelo
 * @param {string}      datos.acceso            contraseña/patrón (omitido si "ninguno")
 * @param {string}      datos.descripcion
 * @param {number}      datos.costoTotal        En quetzales
 * @param {number}      datos.anticipo          En quetzales
 * @param {number}      datos.saldo             En quetzales
 * @param {string|null} datos.firmaClienteUrl   URL relativa guardada en BD
 *
 * @returns {Promise<{absolutePath: string, relativePath: string}>}
 */
async function generarContrato(datos) {
  const {
    reparacionId,
    fecha           = new Date().toLocaleDateString('es-GT'),
    clienteNombre   = '',
    clienteTel      = '',
    marca           = '',
    modelo          = '',
    acceso          = '',
    descripcion     = '',
    costoTotal      = 0,
    anticipo        = 0,
    saldo           = 0,
    firmaClienteUrl = null,
  } = datos;

  // ── 1. Cargar plantilla ───────────────────────────────────────────────────
  console.log('[ContratoPDF] templatePath:', TEMPLATE_PATH);

  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`[ContratoPDF] Plantilla oficial no encontrada: ${TEMPLATE_PATH}`);
  }

  const existingPdfBytes = fs.readFileSync(TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);

  console.log('[ContratoPDF] páginas:', pdfDoc.getPageCount());

  // ── 2. Asegurar exactamente 2 páginas ────────────────────────────────────
  while (pdfDoc.getPageCount() > 2) {
    pdfDoc.removePage(2);
  }

  const pages = pdfDoc.getPages();
  const page1 = pages[0];
  const page2 = pages[1];

  // ── 3. Fuentes ────────────────────────────────────────────────────────────
  const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const COLOR      = rgb(0.05, 0.05, 0.05);

  // Closure que inyecta fuentes en drawSafeText
  const dt = (page, value, x, y, opts = {}) =>
    drawSafeText(page, value, x, y, {
      ...opts,
      _font:     fontNormal,
      _fontBold: fontBold,
      color:     COLOR,
    });

  const fmtQ = (n) => `Q ${Number(n).toFixed(2)}`;

  // ── 4. Página 1 — cabecera ────────────────────────────────────────────────
  dt(page1, fecha,        TOP_DATE_X, TOP_DATE_Y, { bold: true, size: FONT_NORMAL });
  dt(page1, reparacionId, REP_ID_X,   REP_ID_Y,   { bold: true, size: FONT_SMALL  });

  // ── 5. Página 1 — datos del cliente ──────────────────────────────────────
  dt(page1, clienteNombre, NOMBRE_X,   NOMBRE_Y,   { size: FONT_NORMAL });
  dt(page1, clienteTel,    TELEFONO_X, TELEFONO_Y, { size: FONT_NORMAL });
  dt(page1, fecha,         FECHA_X,    FECHA_Y,    { size: FONT_NORMAL });

  // Marca + Modelo en una sola línea
  const marcaModelo = [marca, modelo].filter(v => !isEmpty(v)).join(' / ');
  dt(page1, marcaModelo, MARCA_MODELO_X, MARCA_MODELO_Y, { size: FONT_NORMAL });

  // ── 6. Página 1 — descripción del equipo (con wrap) ──────────────────────
  drawWrappedText(
    page1, descripcion,
    DESCRIPCION_X, DESCRIPCION_Y,
    DESCRIPCION_MAX_WIDTH, DESCRIPCION_LINE_HEIGHT, DESCRIPCION_FONT_SIZE,
    fontNormal, COLOR
  );

  // ── 7. Página 2 — costos en cuadros inferiores ───────────────────────────
  dt(page2, fmtQ(costoTotal), COSTO_X,      COSTO_Y,      { bold: true, size: FONT_NORMAL });
  dt(page2, fmtQ(anticipo),   ANTICIPO_X,   ANTICIPO_Y,   { size: FONT_NORMAL });
  dt(page2, fmtQ(saldo),      DIFERENCIA_X, DIFERENCIA_Y, { size: FONT_NORMAL });

  // ── 8. Página 2 — firma del cliente ──────────────────────────────────────
  await insertarFirmaCliente(pdfDoc, page2, firmaClienteUrl, fontNormal, COLOR);

  // ── 9. Guardar PDF ────────────────────────────────────────────────────────
  const outputDir  = path.join(CONTRATOS_DIR, reparacionId);
  const outputFile = path.join(outputDir, `contrato_reparacion_${reparacionId}.pdf`);
  fs.mkdirSync(outputDir, { recursive: true });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputFile, pdfBytes);

  const relativePath = `/uploads/contratos/${reparacionId}/contrato_reparacion_${reparacionId}.pdf`;
  console.log(`[ContratoPDF] ✅ PDF guardado: ${outputFile}`);
  return { absolutePath: outputFile, relativePath };
}

module.exports = { generarContrato };
