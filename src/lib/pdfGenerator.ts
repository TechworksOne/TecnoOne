import jsPDF from 'jspdf';
import logoUrl from '../assets/tecnocell-logo.png';

interface RecepcionEquipoData {
  cliente: {
    nombre: string;
    telefono: string;
    email?: string;
  };
  equipo: {
    tipo: string;
    marca: string;
    modelo: string;
    color: string;
    imei?: string;
    contraseña?: string;
    accesoTipo?: 'ninguno' | 'pin' | 'patron';
    accesoValor?: string;
    diagnostico: string;
  };
  numeroReparacion: string;
  fecha: string;
}

/**
 * Draws a 3×3 pattern grid using jsPDF primitives.
 * @param doc - jsPDF instance
 * @param cx - center X of the grid (mm)
 * @param cy - center Y of the grid (mm)
 * @param size - total size of the grid (mm)
 * @param pattern - array of node numbers 1-9 in order
 */
function drawPatternGrid(doc: jsPDF, cx: number, cy: number, size: number, pattern: number[]) {
  const cellSize = size / 2; // distance between dot centers
  const dotR = 1.5;
  const lineR = 0.8; // "active" dot radius

  // Dot centers: node 1=top-left, 2=top-center, ... 9=bottom-right
  const getDotPos = (n: number): [number, number] => {
    const col = (n - 1) % 3;
    const row = Math.floor((n - 1) / 3);
    return [cx - cellSize + col * cellSize, cy - cellSize + row * cellSize];
  };

  // Draw connecting lines first (behind dots)
  if (pattern.length >= 2) {
    doc.setDrawColor(0, 100, 200);
    doc.setLineWidth(0.7);
    for (let i = 0; i < pattern.length - 1; i++) {
      const [x1, y1] = getDotPos(pattern[i]);
      const [x2, y2] = getDotPos(pattern[i + 1]);
      doc.line(x1, y1, x2, y2);
    }
  }

  // Draw all 9 dots
  for (let n = 1; n <= 9; n++) {
    const [x, y] = getDotPos(n);
    const isActive = pattern.includes(n);
    if (isActive) {
      doc.setFillColor(0, 100, 200);
      doc.setDrawColor(0, 100, 200);
      doc.circle(x, y, lineR, 'FD');
    } else {
      doc.setFillColor(180, 180, 180);
      doc.setDrawColor(100, 100, 100);
      doc.circle(x, y, dotR, 'FD');
    }
  }
}

/**
 * Formats a date string (ISO, yyyy-mm-dd, or dd/mm/yyyy) to dd/mm/yyyy.
 */
function formatFechaPDF(fecha: string): string {
  if (!fecha) return '';
  if (fecha.includes('T') || fecha.includes('Z')) {
    const d = new Date(fecha);
    if (!isNaN(d.getTime())) {
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const year = d.getUTCFullYear();
      return `${day}/${month}/${year}`;
    }
  }
  if (fecha.includes('/')) return fecha;
  const parts = fecha.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return fecha;
}

/**
 * Sanitizes a string to be safe for use in a file name.
 */
function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

export const generarPDFRecepcion = (data: RecepcionEquipoData, preview: boolean = false) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;

  // ── Top-right logo box constants (same position on every page) ─────────
  const hdrBoxX = pageWidth - margin - 45;
  const hdrBoxY = margin - 5;
  const hdrBoxW = 45;
  const hdrBoxH = 25;
  const logoWidth  = 30;
  const logoHeight = 15;
  const logoX = hdrBoxX + (hdrBoxW - logoWidth)  / 2;
  const logoY = hdrBoxY + (hdrBoxH - logoHeight) / 2;

  function renderHeader() {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(hdrBoxX, hdrBoxY, hdrBoxW, hdrBoxH);
    doc.addImage(logoUrl, 'PNG', logoX, logoY, logoWidth, logoHeight);
  }

  function renderFooter() {
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('TECNOCELL - Soluciones Tecnológicas Profesionales',
      pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text(`No. Reparación: ${data.numeroReparacion}`,
      pageWidth / 2, pageHeight - 6,  { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }

  // ── Two-column layout constants for the bottom section of the blue box ──────
  const boxPad   = 5;                              // inner padding from box edges
  const diagColX = margin + Math.round(contentWidth * 0.42); // right col X
  const diagColW = contentWidth - Math.round(contentWidth * 0.42) - boxPad; // right col width

  // Pre-compute diag lines with the right-column width
  doc.setFontSize(10);
  const diagLines = doc.splitTextToSize(data.equipo.diagnostico || '', diagColW);

  // ── Calculate blue box height using two-column bottom section ────────────
  function calcBlueBoxHeight(): number {
    let h = boxPad;   // top padding
    h += 6;           // DATOS DEL CLIENTE title + gap
    h += 5;           // nombre / teléfono row
    if (data.cliente.email) h += 5;
    h += 3;           // gap before DATOS DEL EQUIPO
    h += 6;           // DATOS DEL EQUIPO title + gap
    h += 5;           // tipo / marca / modelo row
    h += 5;           // color / imei row
    h += 4;           // gap before two-column section

    // Left column height
    const tipo  = data.equipo.accesoTipo;
    const valor = data.equipo.accesoValor;
    let leftH = 0;
    if (tipo === 'patron' && valor) leftH = 5 + 16 + 4; // label + grid + gap
    else if (tipo === 'pin' || tipo === 'ninguno')  leftH = 5;
    else if (!tipo && data.equipo.contraseña)       leftH = 5; // legacy

    // Right column height
    const rightH = 5 + diagLines.length * 5; // "Diagnóstico:" label + lines

    h += Math.max(leftH, rightH);
    h += boxPad + 4;  // bottom padding + safety
    return h;
  }

  const blueBoxHeight = calcBlueBoxHeight();

  // ══════════════════════════════════════════════════════════════════════
  // PÁGINA 1
  // ══════════════════════════════════════════════════════════════════════
  let yPos = margin;

  renderHeader();
  yPos += 5;

  // Heading
  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.text('TECNOCELL', pageWidth / 2, yPos, { align: 'center' });
  yPos += 6;
  doc.setFont('times', 'italic');
  doc.setFontSize(10);
  doc.text('nosotros te lo reparamos', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  doc.setLineWidth(0.3);
  doc.line(margin, yPos, pageWidth - margin - 50, yPos);
  yPos += 8;

  // ── Blue box ──────────────────────────────────────────────────────────
  const blueBoxY = yPos;
  doc.setFillColor(173, 216, 230);
  doc.setDrawColor(0, 100, 150);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, blueBoxY, contentWidth, blueBoxHeight, 3, 3, 'FD');

  yPos += 6;
  doc.setTextColor(0, 0, 0);

  // DATOS DEL CLIENTE
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.text('DATOS DEL CLIENTE', margin + 3, yPos);
  yPos += 6;
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.text(`Nombre: ${data.cliente.nombre}`,       margin + 3,  yPos);
  doc.text(`Teléfono: ${data.cliente.telefono}`,   margin + 90, yPos);
  yPos += 5;
  if (data.cliente.email) {
    doc.text(`Email: ${data.cliente.email}`, margin + 3, yPos);
    yPos += 5;
  }

  yPos += 3;

  // DATOS DEL EQUIPO
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.text('DATOS DEL EQUIPO', margin + 3, yPos);
  yPos += 6;
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.text(`Tipo: ${data.equipo.tipo}`,       margin + 3,   yPos);
  doc.text(`Marca: ${data.equipo.marca}`,     margin + 50,  yPos);
  doc.text(`Modelo: ${data.equipo.modelo}`,   margin + 100, yPos);
  yPos += 5;
  doc.text(`Color: ${data.equipo.color}`, margin + 3, yPos);
  if (data.equipo.imei) doc.text(`IMEI/Serie: ${data.equipo.imei}`, margin + 50, yPos);
  yPos += 5;

  yPos += 4; // gap before two-column section

  // ── Left column: Acceso ────────────────────────────────────────────────
  {
    const tipo  = data.equipo.accesoTipo;
    const valor = data.equipo.accesoValor;
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    if (tipo === 'patron' && valor) {
      doc.text('Acceso: Patrón', margin + boxPad, yPos);
      const patternY = yPos + 5;
      const gridSize = 18;
      drawPatternGrid(doc, margin + boxPad + 12, patternY + gridSize / 2, gridSize, valor.split('-').map(Number).filter(n => n >= 1 && n <= 9));
    } else if (tipo === 'pin') {
      doc.text('Acceso: PIN registrado', margin + boxPad, yPos);
    } else if (tipo === 'ninguno') {
      doc.setFont('times', 'italic');
      doc.text('Sin acceso registrado', margin + boxPad, yPos);
      doc.setFont('times', 'normal');
    } else if (!tipo && data.equipo.contraseña) {
      doc.text(`Acceso: ${data.equipo.contraseña}`, margin + boxPad, yPos);
    }
  }

  // ── Right column: Diagnóstico Inicial ──────────────────────────────
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.text('Diagnóstico Inicial:', diagColX, yPos);
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.text(diagLines, diagColX, yPos + 5, { maxWidth: diagColW, align: 'justify' });

  // Jump to just after the blue box
  yPos = blueBoxY + blueBoxHeight + 8;

  // ── Política de Garantía ──────────────────────────────────────────────
  doc.setLineWidth(0.3);
  doc.line(margin, yPos - 4, pageWidth - margin, yPos - 4);

  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text('POLÍTICA DE GARANTÍA – TECNOCELL', margin, yPos);
  yPos += 8;

  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.text(
    'TECNOCELL ofrece una garantía de 5 meses para los siguientes servicios de reparación:',
    margin, yPos, { maxWidth: contentWidth - 50, align: 'justify' }
  );
  yPos += 8;

  const servicios = [
    'Reparación y cambio de hardware (celulares, laptops, tablets, consolas, impresoras, etc.)',
    'Servicios de soldadura y micro-soldadura (componentes SMD, puertos, líneas de alimentación, conectores, filtros, bobinas, etc.)',
    'Reparaciones y mantenimiento técnico en impresoras (sistemas de tinta, placas, motores, sensores, engranajes, equipos de inyección, láser o térmicos)',
  ];
  servicios.forEach(s => {
    doc.text('•', margin + 3, yPos);
    const ls = doc.splitTextToSize(s, contentWidth - 12);
    doc.text(ls, margin + 8, yPos, { maxWidth: contentWidth - 12, align: 'justify' });
    yPos += ls.length * 5 + 2;
  });

  yPos += 5;
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.text('COBERTURA DE LA GARANTÍA', margin, yPos);
  yPos += 7;

  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  const introLines = doc.splitTextToSize(
    'La garantía aplica únicamente a defectos relacionados con la intervención realizada, siempre que se cumpla lo siguiente:',
    contentWidth
  );
  doc.text(introLines, margin, yPos, { maxWidth: contentWidth, align: 'justify' });
  yPos += introLines.length * 5.5 + 5;

  const coberturaItems = [
    'El dispositivo no presente humedad, corrosión o daño por líquidos.',
    'El equipo no haya sido manipulado por terceros después de la reparación.',
    'No existan daños físicos (golpes, caídas, quiebres, presión excesiva).',
    'No se hayan realizado modificaciones de software que afecten el funcionamiento del componente reparado.',
    'En reparaciones de impresoras, la garantía no aplica para:',
  ];
  coberturaItems.forEach(item => {
    doc.text('•', margin + 5, yPos);
    const ls = doc.splitTextToSize(item, contentWidth - 15);
    doc.text(ls, margin + 10, yPos, { maxWidth: contentWidth - 15, align: 'justify' });
    yPos += ls.length * 5.5 + 2;
  });

  const subItems = [
    'Líneas de impresión defectuosas causadas por aire en mangueras, dampers o el sistema continuo de tinta.',
    'Obstrucciones por tinta de baja calidad, uso incorrecto o falta de mantenimiento.',
  ];
  subItems.forEach(item => {
    doc.circle(margin + 12, yPos - 1.5, 1, 'S');
    const ls = doc.splitTextToSize(item, contentWidth - 25);
    doc.text(ls, margin + 17, yPos, { maxWidth: contentWidth - 25, align: 'justify' });
    yPos += ls.length * 5.5 + 2;
  });

  yPos += 5;
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.text('HALLAZGOS ADICIONALES DURANTE EL SERVICIO', margin, yPos);
  yPos += 7;

  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  const hallazgosLines = doc.splitTextToSize(
    'Durante la revisión o reparación, TECNOCELL puede descubrir daños adicionales que no podían detectarse al momento de recibir el equipo. Estos problemas no están cubiertos por la garantía inicial y podrían requerir reparaciones extra.',
    contentWidth
  );
  doc.text(hallazgosLines, margin, yPos, { maxWidth: contentWidth, align: 'justify' });
  yPos += hallazgosLines.length * 5.5 + 8;

  doc.setFont('times', 'bold');
  doc.text('Ejemplos en computadoras y laptops:', margin, yPos);
  yPos += 6;
  doc.setFont('times', 'normal');
  [
    'Se cambia la memoria RAM porque estaba fallando, y al encender nuevamente se detecta que el disco duro también está dañado o tiene problemas de lectura.',
    'Se limpia el equipo o se revisa por lentitud, y se descubre que el ventilador o el disco duro ya no funciona bien, lo cual provoca sobrecalentamiento.',
  ].forEach(ej => {
    doc.text('•', margin + 5, yPos);
    const ls = doc.splitTextToSize(ej, contentWidth - 15);
    doc.text(ls, margin + 10, yPos, { maxWidth: contentWidth - 15, align: 'justify' });
    yPos += ls.length * 5.5 + 2;
  });

  yPos += 5;
  doc.setFont('times', 'bold');
  doc.text('Ejemplos en teléfonos celulares:', margin, yPos);
  yPos += 6;
  doc.setFont('times', 'normal');
  [
    'Se cambia la pantalla porque estaba quebrada, pero después se detecta que el equipo no carga, y es necesario reemplazar el centro de carga (rack).',
    'Se reemplaza la batería porque no retenía carga, pero luego se identifica que el centro de carga presenta otra falla independiente que impide el encendido normal.',
  ].forEach(ej => {
    doc.text('•', margin + 5, yPos);
    const ls = doc.splitTextToSize(ej, contentWidth - 15);
    doc.text(ls, margin + 10, yPos, { maxWidth: contentWidth - 15, align: 'justify' });
    yPos += ls.length * 5.5 + 2;
  });

  yPos += 8;
  const notifLines = doc.splitTextToSize(
    'En todos los casos, TECNOCELL notificará al cliente antes de continuar, explicando el nuevo problema y el costo adicional necesario para completar la reparación.',
    contentWidth
  );
  doc.text(notifLines, margin, yPos, { maxWidth: contentWidth, align: 'justify' });

  renderFooter();

  // ══════════════════════════════════════════════════════════════════════
  // PÁGINA 2  — sin logo, sin encabezado visual, solo contenido
  // ══════════════════════════════════════════════════════════════════════
  doc.addPage();
  yPos = margin;

  // CONDICIONES DE DEVOLUCIÓN
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.text('CONDICIONES DE DEVOLUCIÓN DEL EQUIPO', margin, yPos);
  yPos += 7;

  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  const devLines = doc.splitTextToSize(
    'Si el cliente decide no proceder con la reparación y solicita la devolución del equipo sin reparar, se aplicará un cobro de Q50.00 por concepto de revisión técnica, diagnóstico y manipulación del equipo.',
    contentWidth
  );
  doc.text(devLines, margin, yPos, { maxWidth: contentWidth, align: 'justify' });
  yPos += devLines.length * 5.5 + 8;

  [
    'El equipo tiene 30 días calendario para ser retirado después de haber sido informado que está listo.',
    'Pasados los 30 días, el equipo pasará a bodega y se cobrará Q10.00 adicionales por resguardo.',
    'Si el equipo no es retirado en un período de 3 meses después de ingresar a bodega, se considerará abandonado y pasará a propiedad de TECNOCELL para cubrir los gastos de diagnóstico, reparación y almacenamiento.',
  ].forEach(cond => {
    doc.text('•', margin + 5, yPos);
    const ls = doc.splitTextToSize(cond, contentWidth - 15);
    doc.text(ls, margin + 10, yPos, { maxWidth: contentWidth - 15, align: 'justify' });
    yPos += ls.length * 5.5 + 2;
  });

  yPos += 8;
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  // DECLARACIÓN DE ACEPTACIÓN
  const declaracionHeight = 25;
  doc.setFillColor(255, 255, 200);
  doc.setDrawColor(200, 180, 0);
  doc.setLineWidth(0.5);
  doc.rect(margin, yPos, contentWidth, declaracionHeight, 'FD');

  yPos += 6;
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.text('DECLARACIÓN DE ACEPTACIÓN', margin + 3, yPos);
  yPos += 6;
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  const declLines = doc.splitTextToSize(
    'Al firmar este documento, el cliente acepta haber leído, comprendido y estar de acuerdo con todos los términos y condiciones de garantía, costos y devolución establecidos por TECNOCELL.',
    contentWidth - 6
  );
  doc.text(declLines, margin + 3, yPos, { maxWidth: contentWidth - 6, align: 'justify' });
  yPos += declaracionHeight + 8;

  // FIRMAS
  yPos += 5;
  const firmaY = yPos;
  const firmaWidth = (contentWidth - 20) / 2;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(margin, firmaY, margin + firmaWidth, firmaY);
  doc.setFont('times', 'bold');
  doc.setFontSize(9);
  doc.text('Firma del Cliente', margin + firmaWidth / 2, firmaY + 5, { align: 'center' });
  doc.setFont('times', 'normal');
  doc.text(data.cliente.nombre, margin + firmaWidth / 2, firmaY + 10, { align: 'center' });

  const firma2X = margin + firmaWidth + 20;
  doc.line(firma2X, firmaY, firma2X + firmaWidth, firmaY);
  doc.setFont('times', 'bold');
  doc.setFontSize(9);
  doc.text('Recibido por TECNOCELL', firma2X + firmaWidth / 2, firmaY + 5, { align: 'center' });
  doc.setFont('times', 'normal');
  doc.text(`Fecha: ${formatFechaPDF(data.fecha)}`, firma2X + firmaWidth / 2, firmaY + 10, { align: 'center' });

  renderFooter();

  // ── Output ────────────────────────────────────────────────────────────
  if (preview) {
    window.open(doc.output('bloburl'), '_blank');
  } else {
    const sanitizedName = sanitizeFileName(data.cliente.nombre);
    doc.save(`${sanitizedName}_${data.numeroReparacion}.pdf`);
  }
};
