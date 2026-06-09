'use strict';

const path = require('path');
const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const BACKEND_DIR = path.join(__dirname, '..');
const UPLOADS_DIR = path.join(BACKEND_DIR, 'uploads');
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

const LOGO_MAX_W = 75;
const LOGO_MAX_H = 55;
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const FIRMA_CLIENTE_X = 78;
const FIRMA_CLIENTE_Y = 158;
const FIRMA_CLIENTE_W = 190;
const FIRMA_CLIENTE_H = 62;
const FIRMA_RECEPTOR_X = 344;
const FIRMA_RECEPTOR_Y = 158;
const FIRMA_RECEPTOR_W = 190;
const FIRMA_RECEPTOR_H = 62;

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

function sanitizePdfText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\uFFFD/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[•]/g, '-')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '');
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
  const safeValue = sanitizePdfText(value).trim();
  if (isEmpty(safeValue)) return;

  page.drawText(safeValue, {
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

  const safeValue = sanitizePdfText(value).trim();
  if (isEmpty(safeValue)) return y;

  const words = safeValue.split(/\s+/);
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
  page.drawText(sanitizePdfText(title), {
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

  const labelText = `${sanitizePdfText(label)}:`;
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
  page.drawText(sanitizePdfText('Documento generado mediante TecnoOne'), {
    x: MARGIN_X,
    y: 26,
    size: FONT_SMALL,
    font: fonts.normal,
    color: COLOR_MUTED,
  });
  page.drawText(sanitizePdfText(`Pagina ${pageNumber} de 2`), {
    x: PAGE_WIDTH - MARGIN_X - 60,
    y: 26,
    size: FONT_SMALL,
    font: fonts.normal,
    color: COLOR_MUTED,
  });
}

function isPathInside(parentPath, childPath) {
  const relativePath = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function resolveLocalLogoPath(logoUrl) {
  const raw = String(logoUrl || '').trim();
  const normalized = raw.replace(/\\/g, '/');

  if (normalized.startsWith('/uploads/')) {
    const logoPath = path.resolve(UPLOADS_DIR, normalized.slice('/uploads/'.length));
    return isPathInside(UPLOADS_DIR, logoPath) ? logoPath : null;
  }

  if (normalized.startsWith('uploads/')) {
    const logoPath = path.resolve(UPLOADS_DIR, normalized.slice('uploads/'.length));
    return isPathInside(UPLOADS_DIR, logoPath) ? logoPath : null;
  }

  if (path.isAbsolute(raw)) {
    const logoPath = path.resolve(raw);
    return isPathInside(BACKEND_DIR, logoPath) ? logoPath : null;
  }

  return null;
}

async function tryLoadLogo(pdfDoc, logoUrl) {
  let logoPath = null;

  try {
    console.log('[ContratoPDF] logo_url:', logoUrl || null);

    if (isEmpty(logoUrl)) {
      console.log('[ContratoPDF] logoPath:', null);
      console.log('[ContratoPDF] logo cargado:', false);
      return null;
    }

    const raw = String(logoUrl).trim();
    if (/^https?:\/\//i.test(raw)) {
      console.log('[ContratoPDF] logoPath:', null);
      console.log('[ContratoPDF] logo cargado:', false);
      return null;
    }

    logoPath = resolveLocalLogoPath(raw);
    console.log('[ContratoPDF] logoPath:', logoPath || null);

    if (!logoPath || !fs.existsSync(logoPath)) {
      console.log('[ContratoPDF] logo cargado:', false);
      return null;
    }

    const stats = fs.statSync(logoPath);
    if (!stats.isFile() || stats.size > LOGO_MAX_BYTES) {
      console.warn(`[ContratoPDF] Logo rechazado por tamano o tipo de archivo: ${logoPath}`);
      console.log('[ContratoPDF] logo cargado:', false);
      return null;
    }

    const ext = path.extname(logoPath).toLowerCase();
    if (ext === '.png') {
      console.warn('[ContratoPDF] logo PNG ignorado temporalmente para evitar bloqueo en pdf-lib:', logoPath);
      console.log('[ContratoPDF] logo cargado:', false);
      return null;
    }

    if (!['.jpg', '.jpeg'].includes(ext)) {
      console.warn('[ContratoPDF] formato de logo no soportado:', ext);
      console.log('[ContratoPDF] logo cargado:', false);
      return null;
    }

    const logoBytes = fs.readFileSync(logoPath);
    const logoImage = await pdfDoc.embedJpg(logoBytes);

    console.log('[ContratoPDF] logo cargado:', Boolean(logoImage));
    return logoImage || null;
  } catch (err) {
    console.warn('[ContratoPDF] No se pudo cargar el logo del negocio:', err.message);
    console.log('[ContratoPDF] logoPath:', logoPath || null);
    console.log('[ContratoPDF] logo cargado:', false);
    return null;
  }
}

async function drawHeader(pdfDoc, page, negocio, fonts, accentColor) {
  const logoImage = await tryLoadLogo(pdfDoc, negocio.logoUrl);
  const hasLogo = Boolean(logoImage);
  const logoX = MARGIN_X;
  const logoTopY = 767;
  let textX = MARGIN_X;
  let textMaxWidth = 360;

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 104,
    width: PAGE_WIDTH,
    height: 104,
    color: rgb(0.97, 0.98, 1),
  });
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 108,
    width: PAGE_WIDTH,
    height: 4,
    color: accentColor,
  });

  if (hasLogo) {
    const scale = Math.min(LOGO_MAX_W / logoImage.width, LOGO_MAX_H / logoImage.height, 1);
    const logoWidth = logoImage.width * scale;
    const logoHeight = logoImage.height * scale;

    page.drawImage(logoImage, {
      x: logoX,
      y: logoTopY - logoHeight,
      width: logoWidth,
      height: logoHeight,
    });

    textX = logoX + LOGO_MAX_W + 15;
    textMaxWidth = PAGE_WIDTH - MARGIN_X - textX;
  }

  drawSafeText(page, negocio.nombre, textX, 740, {
    _font: fonts.normal,
    _fontBold: fonts.bold,
    bold: true,
    size: hasLogo ? FONT_TITLE : FONT_BUSINESS,
    color: accentColor,
    maxWidth: textMaxWidth,
  });
  drawSafeText(page, negocio.razonSocial, textX, 722, {
    _font: fonts.normal,
    _fontBold: fonts.bold,
    size: FONT_NORMAL,
    color: COLOR_MUTED,
    maxWidth: textMaxWidth,
  });

  const negocioInfo = buildCompactInfo(negocio);
  drawWrappedText(page, negocioInfo, textX, 705, textMaxWidth, 11, FONT_SMALL, fonts.normal, COLOR_MUTED);
  drawSafeText(page, 'Documento generado mediante TecnoOne', textX, 690, {
    _font: fonts.normal,
    _fontBold: fonts.bold,
    size: FONT_SMALL,
    color: COLOR_MUTED,
    maxWidth: textMaxWidth,
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

async function insertarFirmaImagen(pdfDoc, page, firmaUrl, x, y, width, height, label) {
  console.log(`[ContratoPDF] ${label}:`, firmaUrl);

  const firmaPath = resolveFirmaPath(firmaUrl);
  console.log(`[ContratoPDF] ${label} path:`, firmaPath);
  console.log(`[ContratoPDF] existe ${label}:`, firmaPath ? fs.existsSync(firmaPath) : false);

  if (!firmaPath || !fs.existsSync(firmaPath)) {
    console.warn(`[ContratoPDF] ${label} no encontrada. PDF generado con linea manual.`);
    return false;
  }

  try {
    const firmaBytes = fs.readFileSync(firmaPath);
    const lowerPath = firmaPath.toLowerCase();
    const firmaImage = lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')
      ? await pdfDoc.embedJpg(firmaBytes)
      : await pdfDoc.embedPng(firmaBytes);

    page.drawImage(firmaImage, {
      x,
      y,
      width,
      height,
    });

    console.log(`[ContratoPDF] ${label} insertada correctamente`);
    return true;
  } catch (err) {
    console.error(`[ContratoPDF] Error insertando ${label}:`, err.message);
    return false;
  }
}

async function insertarFirmaCliente(pdfDoc, page2, firmaClienteUrl) {
  return insertarFirmaImagen(
    pdfDoc,
    page2,
    firmaClienteUrl,
    FIRMA_CLIENTE_X,
    FIRMA_CLIENTE_Y,
    FIRMA_CLIENTE_W,
    FIRMA_CLIENTE_H,
    'firma_cliente_url'
  );
}

async function insertarFirmaReceptor(pdfDoc, page2, firmaReceptorUrl) {
  return insertarFirmaImagen(
    pdfDoc,
    page2,
    firmaReceptorUrl,
    FIRMA_RECEPTOR_X,
    FIRMA_RECEPTOR_Y,
    FIRMA_RECEPTOR_W,
    FIRMA_RECEPTOR_H,
    'firma_receptor_url'
  );
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
    receptorNombre = '',
    receptorUsuario = '',
    firmaReceptorUrl = null,
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

  await drawHeader(pdfDoc, page1, negocio, fonts, accentColor);

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

  drawSectionTitle(page2, 'Firmas de recepcion', MARGIN_X, 286, fonts, accentColor);
  dt(page2, 'Firma del cliente', 104, 260, {
    bold: true,
    size: FONT_NORMAL,
    color: COLOR_TEXT,
  });
  dt(page2, 'Firma de quien recibe', 366, 260, {
    bold: true,
    size: FONT_NORMAL,
    color: COLOR_TEXT,
  });
  page2.drawRectangle({
    x: FIRMA_CLIENTE_X - 12,
    y: FIRMA_CLIENTE_Y - 8,
    width: FIRMA_CLIENTE_W + 24,
    height: FIRMA_CLIENTE_H + 24,
    borderColor: COLOR_LINE,
    borderWidth: 1,
  });
  page2.drawRectangle({
    x: FIRMA_RECEPTOR_X - 12,
    y: FIRMA_RECEPTOR_Y - 8,
    width: FIRMA_RECEPTOR_W + 24,
    height: FIRMA_RECEPTOR_H + 24,
    borderColor: COLOR_LINE,
    borderWidth: 1,
  });
  await insertarFirmaCliente(pdfDoc, page2, firmaClienteUrl);
  await insertarFirmaReceptor(pdfDoc, page2, firmaReceptorUrl);
  drawLine(page2, 70, 134, 282, 134, COLOR_TEXT);
  drawLine(page2, 336, 134, 548, 134, COLOR_TEXT);
  dt(page2, clienteNombre || 'Cliente', 86, 116, {
    size: FONT_NORMAL,
    color: COLOR_TEXT,
    maxWidth: 180,
  });
  dt(page2, 'Nombre y firma del cliente', 108, 101, {
    size: FONT_SMALL,
    color: COLOR_MUTED,
  });
  dt(page2, `Recibido por: ${receptorNombre || 'Usuario receptor'}`, 336, 116, {
    size: FONT_NORMAL,
    color: COLOR_TEXT,
    maxWidth: 210,
  });
  dt(page2, `Usuario: ${receptorUsuario || 'no especificado'}`, 336, 101, {
    size: FONT_SMALL,
    color: COLOR_MUTED,
    maxWidth: 210,
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
