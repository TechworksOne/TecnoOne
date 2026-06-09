'use strict';

const path = require('path');
const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const CONTRATOS_DIR = path.join(__dirname, '..', 'uploads', 'contratos');
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 54;
const COLOR_TEXT = rgb(0.08, 0.09, 0.11);
const COLOR_MUTED = rgb(0.35, 0.38, 0.42);
const COLOR_LINE = rgb(0.82, 0.84, 0.87);
const COLOR_ACCENT_FALLBACK = rgb(0.15, 0.39, 0.92);

const FONT_SMALL = 8;
const FONT_NORMAL = 10;
const FONT_MEDIUM = 11;
const FONT_TITLE = 18;
const FONT_BUSINESS = 22;

const FIRMA_CLIENTE_X = 186;
const FIRMA_CLIENTE_Y = 158;
const FIRMA_CLIENTE_W = 240;
const FIRMA_CLIENTE_H = 78;

const EMPTY_VALUES = new Set(['', 'ninguno', 'n/a', 'none', 'null', 'undefined', '-', '—']);

const CONDICIONES_SERVICIO = [
  'El cliente declara que la información proporcionada sobre el equipo, accesorios entregados y datos de contacto es correcta.',
  'El equipo se recibe para revisión técnica inicial. El costo final de reparación será informado posteriormente, según diagnóstico, repuestos requeridos y autorización del cliente.',
  'El precio de revisión o diagnóstico, si aplica, no representa el costo final de reparación.',
  'Cualquier reparación, repuesto o costo adicional deberá ser autorizado por el cliente antes de continuar con el servicio.',
  'El negocio no se responsabiliza por información, accesorios, tarjetas SIM, memorias, cuentas, bloqueos, contraseñas o componentes no declarados al momento de la recepción.',
  'El cliente es responsable de respaldar su información antes de entregar el equipo. El negocio no garantiza la conservación de datos si el daño, bloqueo o procedimiento técnico impide su recuperación.',
  'Los tiempos de entrega son estimados y pueden variar según disponibilidad de repuestos, pruebas técnicas, autorización del cliente o complejidad del diagnóstico.',
  'El retiro del equipo requiere identificación, comprobante o autorización del titular registrado.',
];

function isEmpty(val) {
  if (val == null) return true;
  return EMPTY_VALUES.has(String(val).trim().toLowerCase());
}

function hexToRgb(hex) {
  if (isEmpty(hex)) return COLOR_ACCENT_FALLBACK;

  const clean = String(hex).trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return COLOR_ACCENT_FALLBACK;

  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

function drawSafeText(page, value, x, y, opts = {}) {
  if (isEmpty(value)) return;

  page.drawText(String(value).trim(), {
    x,
    y,
    size: opts.size || FONT_NORMAL,
    font: opts.bold ? opts._fontBold : opts._font,
    color: opts.color || COLOR_TEXT,
    maxWidth: opts.maxWidth,
  });
}

function drawWrappedText(page, value, x, y, maxWidth, lineHeight, fontSize, fontObj, colorObj) {
  if (isEmpty(value)) return y;

  const words = String(value).trim().split(/\s+/);
  const lines = [];
  let line = '';

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    const width = fontObj.widthOfTextAtSize(test, fontSize);

    if (width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }

  if (line) {
    lines.push(line);
  }

  let curY = y;
  for (const currentLine of lines) {
    page.drawText(currentLine, {
      x,
      y: curY,
      size: fontSize,
      font: fontObj,
      color: colorObj,
    });
    curY -= lineHeight;
  }

  return curY;
}

function drawSectionTitle(page, title, x, y, fonts, accentColor) {
  page.drawText(title, {
    x,
    y,
    size: FONT_MEDIUM,
    font: fonts.bold,
    color: accentColor,
  });
  drawLine(page, x, y - 7, PAGE_WIDTH - MARGIN_X, y - 7, COLOR_LINE);
}

function drawLine(page, x1, y1, x2, y2, color = COLOR_LINE) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness: 0.8,
    color,
  });
}

function drawLabelValue(page, label, value, x, y, fonts, opts = {}) {
  if (isEmpty(value)) return y;

  const labelText = `${label}:`;
  const labelWidth = fonts.bold.widthOfTextAtSize(labelText, FONT_NORMAL);

  page.drawText(labelText, {
    x,
    y,
    size: FONT_NORMAL,
    font: fonts.bold,
    color: COLOR_TEXT,
  });

  if (opts.wrap) {
    return drawWrappedText(
      page,
      value,
      x + labelWidth + 6,
      y,
      opts.maxWidth || 360,
      opts.lineHeight || 13,
      FONT_NORMAL,
      fonts.normal,
      COLOR_TEXT
    );
  }

  drawSafeText(page, value, x + labelWidth + 6, y, {
    _font: fonts.normal,
    _fontBold: fonts.bold,
    size: FONT_NORMAL,
    maxWidth: opts.maxWidth || 360,
  });

  return y - (opts.lineHeight || 17);
}

function drawFooter(page, pageNumber, fonts) {
  drawLine(page, MARGIN_X, 42, PAGE_WIDTH - MARGIN_X, 42, COLOR_LINE);
  page.drawText('Documento generado mediante TecnoOne', {
    x: MARGIN_X,
    y: 26,
    size: FONT_SMALL,
    font: fonts.normal,
    color: COLOR_MUTED,
  });
  page.drawText(`Pagina ${pageNumber} de 2`, {
    x: PAGE_WIDTH - MARGIN_X - 60,
    y: 26,
    size: FONT_SMALL,
    font: fonts.normal,
    color: COLOR_MUTED,
  });
}

function resolveFirmaPath(firmaClienteUrl) {
  if (!firmaClienteUrl) return null;

  const raw = String(firmaClienteUrl).trim();

  if (raw.startsWith('/uploads/')) return path.join('/app', raw);
  if (raw.startsWith('uploads/')) return path.join('/app', raw);
  if (raw.startsWith('/app/uploads/')) return raw;
  if (path.isAbsolute(raw)) return raw;

  return path.join('/app/uploads', raw);
}

async function insertarFirmaCliente(pdfDoc, page2, firmaClienteUrl, font, colorObj) {
  console.log('[ContratoPDF] firma_cliente_url:', firmaClienteUrl);

  const firmaPath = resolveFirmaPath(firmaClienteUrl);
  console.log('[ContratoPDF] firmaPath:', firmaPath);
  console.log('[ContratoPDF] existe firma:', firmaPath ? fs.existsSync(firmaPath) : false);

  if (!firmaPath || !fs.existsSync(firmaPath)) {
    console.warn('[ContratoPDF] Firma no encontrada. PDF generado sin firma.');
    return;
  }

  try {
    const firmaBytes = fs.readFileSync(firmaPath);
    const firmaImage = await pdfDoc.embedPng(firmaBytes);

    page2.drawImage(firmaImage, {
      x: FIRMA_CLIENTE_X,
      y: FIRMA_CLIENTE_Y,
      width: FIRMA_CLIENTE_W,
      height: FIRMA_CLIENTE_H,
    });

    console.log('[ContratoPDF] firma insertada correctamente');
  } catch (err) {
    console.error('[ContratoPDF] Error insertando firma:', err.message);
  }
}

function normalizeNegocio(negocio = {}) {
  return {
    nombre: negocio.nombre || 'Negocio',
    razonSocial: negocio.razonSocial || null,
    nit: negocio.nit || null,
    telefono: negocio.telefono || null,
    email: negocio.email || null,
    direccion: negocio.direccion || null,
    logoUrl: negocio.logoUrl || null,
    colorPrimario: negocio.colorPrimario || null,
  };
}

function buildCompactInfo(negocio) {
  return [
    negocio.nit ? `NIT: ${negocio.nit}` : null,
    negocio.telefono ? `Tel: ${negocio.telefono}` : null,
    negocio.email ? `Email: ${negocio.email}` : null,
    negocio.direccion,
  ].filter((item) => !isEmpty(item)).join('  |  ');
}

function normalizeAccesoTipo(accesoTipo) {
  if (isEmpty(accesoTipo)) return 'ninguno';
  return String(accesoTipo).trim().toLowerCase();
}

function getAccesoLabel(accesoTipo) {
  const normalized = normalizeAccesoTipo(accesoTipo);
  const labels = {
    pin: 'PIN',
    patron: 'Patrón',
    patrón: 'Patrón',
    pattern: 'Patrón',
    password: 'Contraseña',
    contrasena: 'Contraseña',
    contraseña: 'Contraseña',
    clave: 'Contraseña',
  };

  return labels[normalized] || String(accesoTipo).trim();
}

function drawAccesoEquipo(page, datos, x, y, fonts) {
  const accesoTipo = normalizeAccesoTipo(datos.accesoTipo);
  const tieneAccesoTipo = !isEmpty(datos.accesoTipo);

  if (tieneAccesoTipo && accesoTipo === 'ninguno') {
    drawSafeText(page, 'No registrado / no aplica', x, y, {
      _font: fonts.normal,
      _fontBold: fonts.bold,
      size: FONT_NORMAL,
    });
    return y - 17;
  }

  if (tieneAccesoTipo) {
    const valor = datos.mostrarValorAcceso !== false && !isEmpty(datos.accesoValor)
      ? datos.accesoValor
      : 'no especificado';
    return drawLabelValue(page, getAccesoLabel(datos.accesoTipo), valor, x, y, fonts);
  }

  if (!isEmpty(datos.acceso)) {
    return drawLabelValue(page, 'Acceso', datos.acceso, x, y, fonts);
  }

  drawSafeText(page, 'No registrado / no aplica', x, y, {
    _font: fonts.normal,
    _fontBold: fonts.bold,
    size: FONT_NORMAL,
  });
  return y - 17;
}

async function generarContrato(datos) {
  const {
    reparacionId,
    fecha = new Date().toLocaleDateString('es-GT'),
    clienteNombre = '',
    clienteTel = '',
    clienteEmail = '',
    tipoEquipo = '',
    marca = '',
    modelo = '',
    color = '',
    imei = '',
    acceso = '',
    accesoTipo = '',
    accesoValor = '',
    mostrarValorAcceso = false,
    descripcion = '',
    precioRevision = null,
    montoEstimadoInicial = null,
    costoTotal = 0,
    anticipo = 0,
    anticipoRecibido = null,
    firmaClienteUrl = null,
  } = datos;

  const negocio = normalizeNegocio(datos.negocio);
  const accentColor = hexToRgb(negocio.colorPrimario);
  const pdfDoc = await PDFDocument.create();
  const page1 = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const page2 = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const fonts = {
    normal: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };

  const dt = (page, value, x, y, opts = {}) =>
    drawSafeText(page, value, x, y, {
      ...opts,
      _font: fonts.normal,
      _fontBold: fonts.bold,
    });

  const fmtQ = (n) => `Q ${Number(n || 0).toFixed(2)}`;
  const montoRevision = precioRevision ?? montoEstimadoInicial ?? costoTotal;
  const montoAnticipoRecibido = anticipoRecibido ?? anticipo;

  console.log('[ContratoPDF] generando contrato desde codigo:', reparacionId);

  page1.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 104,
    width: PAGE_WIDTH,
    height: 104,
    color: rgb(0.97, 0.98, 1),
  });
  page1.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 108,
    width: PAGE_WIDTH,
    height: 4,
    color: accentColor,
  });

  dt(page1, negocio.nombre, MARGIN_X, 734, {
    bold: true,
    size: FONT_BUSINESS,
    color: accentColor,
    maxWidth: 360,
  });
  dt(page1, negocio.razonSocial, MARGIN_X, 716, {
    size: FONT_NORMAL,
    color: COLOR_MUTED,
    maxWidth: 360,
  });

  const negocioInfo = buildCompactInfo(negocio);
  drawWrappedText(page1, negocioInfo, MARGIN_X, 699, 440, 11, FONT_SMALL, fonts.normal, COLOR_MUTED);
  dt(page1, 'Documento generado mediante TecnoOne', 398, 740, {
    size: FONT_SMALL,
    color: COLOR_MUTED,
  });

  dt(page1, 'Contrato de recepcion de equipo', MARGIN_X, 646, {
    bold: true,
    size: FONT_TITLE,
    color: COLOR_TEXT,
  });
  drawLine(page1, MARGIN_X, 633, PAGE_WIDTH - MARGIN_X, 633, COLOR_LINE);

  let y = 604;
  drawSectionTitle(page1, 'Datos de la reparacion', MARGIN_X, y, fonts, accentColor);
  y -= 26;
  y = drawLabelValue(page1, 'Numero de reparacion', reparacionId, MARGIN_X, y, fonts);
  y = drawLabelValue(page1, 'Fecha', fecha, MARGIN_X, y, fonts);

  y -= 8;
  drawSectionTitle(page1, 'Cliente', MARGIN_X, y, fonts, accentColor);
  y -= 26;
  y = drawLabelValue(page1, 'Nombre', clienteNombre, MARGIN_X, y, fonts);
  y = drawLabelValue(page1, 'Telefono', clienteTel, MARGIN_X, y, fonts);
  y = drawLabelValue(page1, 'Email', clienteEmail, MARGIN_X, y, fonts);

  y -= 8;
  drawSectionTitle(page1, 'Equipo', MARGIN_X, y, fonts, accentColor);
  y -= 26;
  y = drawLabelValue(page1, 'Tipo', tipoEquipo, MARGIN_X, y, fonts);
  y = drawLabelValue(page1, 'Marca', marca, MARGIN_X, y, fonts);
  y = drawLabelValue(page1, 'Modelo', modelo, MARGIN_X, y, fonts);
  y = drawLabelValue(page1, 'Color', color, MARGIN_X, y, fonts);
  y = drawLabelValue(page1, 'IMEI/serie', imei, MARGIN_X, y, fonts);

  y -= 8;
  drawSectionTitle(page1, 'Acceso al equipo', MARGIN_X, y, fonts, accentColor);
  y -= 26;
  y = drawAccesoEquipo(page1, { acceso, accesoTipo, accesoValor, mostrarValorAcceso }, MARGIN_X, y, fonts);

  y -= 8;
  drawSectionTitle(page1, 'Diagnostico inicial / descripcion', MARGIN_X, y, fonts, accentColor);
  y -= 26;
  y = drawWrappedText(page1, descripcion, MARGIN_X, y, PAGE_WIDTH - (MARGIN_X * 2), 13, FONT_NORMAL, fonts.normal, COLOR_TEXT);

  y = Math.min(y - 18, 155);
  drawSectionTitle(page1, 'Recepcion y revision', MARGIN_X, y, fonts, accentColor);
  y -= 26;
  y = drawLabelValue(page1, 'Precio de revision / diagnostico', fmtQ(montoRevision), MARGIN_X, y, fonts);
  if (Number(montoAnticipoRecibido || 0) > 0) {
    y = drawLabelValue(page1, 'Anticipo recibido', fmtQ(montoAnticipoRecibido), MARGIN_X, y, fonts);
  }
  drawWrappedText(
    page1,
    'Nota: El costo final de reparación será informado después del diagnóstico técnico y requerirá autorización del cliente.',
    MARGIN_X,
    y,
    PAGE_WIDTH - (MARGIN_X * 2),
    12,
    FONT_SMALL,
    fonts.normal,
    COLOR_MUTED
  );
  drawFooter(page1, 1, fonts);

  dt(page2, 'Condiciones del servicio', MARGIN_X, 724, {
    bold: true,
    size: FONT_TITLE,
    color: COLOR_TEXT,
  });
  drawLine(page2, MARGIN_X, 711, PAGE_WIDTH - MARGIN_X, 711, COLOR_LINE);

  let conditionY = 674;
  CONDICIONES_SERVICIO.forEach((condicion, index) => {
    dt(page2, `${index + 1}.`, MARGIN_X, conditionY, {
      bold: true,
      size: FONT_NORMAL,
      color: accentColor,
    });
    conditionY = drawWrappedText(
      page2,
      condicion,
      MARGIN_X + 24,
      conditionY,
      PAGE_WIDTH - (MARGIN_X * 2) - 24,
      15,
      FONT_NORMAL,
      fonts.normal,
      COLOR_TEXT
    ) - 9;
  });

  drawSectionTitle(page2, 'Firma del cliente', MARGIN_X, 286, fonts, accentColor);
  page2.drawRectangle({
    x: FIRMA_CLIENTE_X - 12,
    y: FIRMA_CLIENTE_Y - 8,
    width: FIRMA_CLIENTE_W + 24,
    height: FIRMA_CLIENTE_H + 24,
    borderColor: COLOR_LINE,
    borderWidth: 1,
  });
  await insertarFirmaCliente(pdfDoc, page2, firmaClienteUrl, fonts.normal, COLOR_TEXT);
  drawLine(page2, 172, 134, 440, 134, COLOR_TEXT);
  dt(page2, clienteNombre || 'Cliente', 198, 116, {
    size: FONT_NORMAL,
    color: COLOR_TEXT,
    maxWidth: 220,
  });
  dt(page2, 'Nombre y firma del cliente', 222, 101, {
    size: FONT_SMALL,
    color: COLOR_MUTED,
  });
  drawFooter(page2, 2, fonts);

  const outputDir = path.join(CONTRATOS_DIR, reparacionId);
  const outputFile = path.join(outputDir, `contrato_reparacion_${reparacionId}.pdf`);
  fs.mkdirSync(outputDir, { recursive: true });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputFile, pdfBytes);

  const relativePath = `/uploads/contratos/${reparacionId}/contrato_reparacion_${reparacionId}.pdf`;
  console.log(`[ContratoPDF] PDF guardado: ${outputFile}`);
  return { absolutePath: outputFile, relativePath };
}

module.exports = { generarContrato };
