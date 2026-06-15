import { getImageUrl } from '../utils/getImageUrl';
type AnySale = Record<string, any>;

const esc = (value: any): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const toNumber = (value: any): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const isBackendSaleInCents = (sale: AnySale): boolean => {
  return (
    sale.monto_pagado !== undefined ||
    sale.saldo_pendiente !== undefined ||
    sale.created_at !== undefined ||
    sale.cliente_nombre !== undefined ||
    sale.pagos !== undefined
  );
};

const money = (value: any, cents: boolean): string => {
  const n = toNumber(value);
  const amount = cents ? n / 100 : n;
  return `Q${amount.toFixed(2)}`;
};

const formatDate = (value: any): string => {
  if (!value) return new Date().toLocaleString('es-GT');
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('es-GT', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getClienteNombre = (sale: AnySale): string => {
  return (
    sale.cliente?.name ||
    sale.cliente?.nombre_completo ||
    sale.cliente?.nombre ||
    sale.cliente_nombre ||
    sale.customer_name ||
    'Consumidor final'
  );
};

const getClienteTelefono = (sale: AnySale): string => {
  return sale.cliente?.phone || sale.cliente?.telefono || sale.cliente_telefono || '';
};

const getClienteNit = (sale: AnySale): string => {
  return sale.cliente?.nit || sale.cliente_nit || 'CF';
};

const getItems = (sale: AnySale): AnySale[] => {
  if (Array.isArray(sale.items)) return sale.items;
  if (Array.isArray(sale.detalles)) return sale.detalles;
  if (Array.isArray(sale.productos)) return sale.productos;
  return [];
};

const getPayments = (sale: AnySale): AnySale[] => {
  if (Array.isArray(sale.payments)) return sale.payments;
  if (Array.isArray(sale.pagos)) return sale.pagos;
  return [];
};

export function printSaleReceipt(sale: AnySale, empresa?: Record<string, any> | null): void {
  if (!sale) {
    alert('No hay datos de venta para imprimir.');
    return;
  }

  const cents = isBackendSaleInCents(sale);
  const items = getItems(sale);
  const payments = getPayments(sale);

  const numero = sale.numero || sale.numero_venta || sale.codigo || `VENTA-${sale.id ?? ''}`;
  const fecha = sale.createdAt || sale.created_at || sale.fecha || new Date();
  const clienteNombre = getClienteNombre(sale);
  const clienteTelefono = getClienteTelefono(sale);
  const clienteNit = getClienteNit(sale);

  const empresaNombre =
    empresa?.nombre_comercial ||
    empresa?.nombre ||
    empresa?.razon_social ||
    'TecnoOne';

  const empresaRazonSocial =
    empresa?.razon_social && empresa.razon_social !== empresaNombre
      ? empresa.razon_social
      : '';

  const empresaNit = empresa?.nit || '';
  const empresaTelefono = empresa?.telefono || '';
  const empresaCorreo = empresa?.correo || empresa?.email || '';
  const empresaDireccion = empresa?.direccion || '';
  const empresaLogo = empresa?.logo_url ? getImageUrl(empresa.logo_url) : '';

  const logoHtml = empresaLogo
    ? `<img class="company-logo" src="${esc(empresaLogo)}" alt="${esc(empresaNombre)}" />`
    : `<div class="brand">${esc(empresaNombre)}</div>`;

  const subtotal = sale.subtotal ?? items.reduce((sum, item) => {
    const sub = item.subtotal ?? item.total ?? (toNumber(item.cantidad ?? 1) * toNumber(item.precioUnit ?? item.precio_unitario ?? item.precio ?? 0));
    return sum + toNumber(sub);
  }, 0);

  const impuestos = sale.impuestos ?? sale.impuesto ?? 0;
  const total = sale.total ?? sale.monto_total ?? subtotal + impuestos;

  const pagado = sale.monto_pagado ?? sale.total_pagado ?? payments.reduce((sum, p) => sum + toNumber(p.monto ?? p.amount ?? 0), 0);
  const saldo = sale.saldo_pendiente ?? Math.max(0, toNumber(total) - toNumber(pagado));

  const rows = items.length
    ? items.map((item) => {
        const cantidad = toNumber(item.cantidad ?? item.qty ?? 1);
        const nombre = item.nombre || item.descripcion || item.producto_nombre || item.repuesto_nombre || item.name || 'Item';
        const precio = item.precioUnit ?? item.precio_unitario ?? item.precio ?? item.price ?? 0;
        const sub = item.subtotal ?? item.total ?? cantidad * toNumber(precio);

        return `
          <tr>
            <td class="qty">${esc(cantidad)}</td>
            <td>${esc(nombre)}</td>
            <td class="money">${money(precio, cents)}</td>
            <td class="money">${money(sub, cents)}</td>
          </tr>
        `;
      }).join('')
    : `
      <tr>
        <td colspan="4" class="empty">Sin detalle de productos</td>
      </tr>
    `;

  const paymentRows = payments.length
    ? payments.map((p) => {
        const metodo = p.metodo || p.method || sale.metodo_pago || 'Pago';
        const monto = p.monto ?? p.amount ?? 0;
        const ref = p.referencia ? ` · Ref: ${esc(p.referencia)}` : '';
        return `<div class="payment-row"><span>${esc(metodo)}${ref}</span><strong>${money(monto, cents)}</strong></div>`;
      }).join('')
    : `<div class="payment-row"><span>${esc(sale.metodo_pago || sale.metodo || 'No especificado')}</span><strong>${money(pagado || total, cents)}</strong></div>`;

  const printWindow = window.open('', '_blank', 'width=900,height=700');

  if (!printWindow) {
    alert('No se pudo abrir la ventana de impresión. Revisa si el navegador bloqueó ventanas emergentes.');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(`
<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Recibo ${esc(numero)}</title>
  <style>
    @page {
      size: letter;
      margin: 10mm;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .receipt {
      width: 100%;
      max-width: 760px;
      margin: 0 auto;
      background: #ffffff;
    }

    .header {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 20px;
      align-items: start;
      border-bottom: 2px solid #16a34a;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }

    .brand-wrap {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .company-logo {
      max-width: 95px;
      max-height: 72px;
      object-fit: contain;
      display: block;
    }

    .brand-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .brand {
      font-size: 22px;
      font-weight: 800;
      color: #111827;
      line-height: 1.1;
    }

    .brand-sub {
      margin-top: 3px;
      color: #6b7280;
      font-size: 11px;
    }

    .brand-meta {
      color: #374151;
      font-size: 11px;
      line-height: 1.3;
    }

    .company-info {
      text-align: right;
      font-size: 11px;
      color: #374151;
      line-height: 1.35;
    }

    .title {
      text-align: center;
      margin: 12px 0 16px;
    }

    .title h1 {
      margin: 0;
      font-size: 18px;
      color: #16a34a;
      letter-spacing: 0.4px;
    }

    .title .number {
      margin-top: 4px;
      font-size: 14px;
      font-weight: 700;
      color: #111827;
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 14px;
    }

    .box {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 10px;
      break-inside: avoid;
    }

    .box-title {
      font-size: 11px;
      text-transform: uppercase;
      color: #16a34a;
      font-weight: 800;
      margin-bottom: 7px;
      letter-spacing: 0.3px;
    }

    .row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin: 3px 0;
      color: #374151;
    }

    .row strong {
      color: #111827;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      margin-bottom: 12px;
      border: 1px solid #e5e7eb;
    }

    th {
      background: #16a34a;
      color: #ffffff;
      text-transform: uppercase;
      font-size: 10px;
      padding: 7px 6px;
      text-align: left;
    }

    td {
      border-bottom: 1px solid #e5e7eb;
      padding: 7px 6px;
      vertical-align: top;
    }

    .qty {
      width: 48px;
      text-align: center;
      font-weight: 700;
    }

    .money {
      text-align: right;
      white-space: nowrap;
      font-weight: 600;
    }

    .empty {
      text-align: center;
      color: #6b7280;
      padding: 16px;
    }

    .summary {
      width: 280px;
      margin-left: auto;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 10px;
      break-inside: avoid;
    }

    .summary .line {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid #f3f4f6;
    }

    .summary .line:last-child {
      border-bottom: 0;
    }

    .summary .total {
      font-size: 16px;
      font-weight: 900;
      color: #16a34a;
      padding-top: 8px;
    }

    .payments {
      margin-top: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 10px;
      break-inside: avoid;
    }

    .payment-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid #f3f4f6;
    }

    .payment-row:last-child {
      border-bottom: 0;
    }

    .footer {
      margin-top: 18px;
      padding-top: 10px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 11px;
      line-height: 1.4;
    }

    @media print {
      html,
      body {
        background: #ffffff !important;
      }

      .receipt {
        max-width: none !important;
        margin: 0 !important;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="brand-wrap">
        ${logoHtml}
        <div class="brand-text">
          ${empresaLogo ? `<div class="brand">${esc(empresaNombre)}</div>` : ''}
          ${empresaRazonSocial ? `<div class="brand-sub">${esc(empresaRazonSocial)}</div>` : ''}
          ${empresaDireccion ? `<div class="brand-meta">${esc(empresaDireccion)}</div>` : ''}
          ${empresaTelefono ? `<div class="brand-meta">Tel: ${esc(empresaTelefono)}</div>` : ''}
          ${empresaCorreo ? `<div class="brand-meta">${esc(empresaCorreo)}</div>` : ''}
          ${empresaNit ? `<div class="brand-meta"><strong>NIT: ${esc(empresaNit)}</strong></div>` : ''}
        </div>
      </div>
      <div class="company-info">
        <strong>Recibo de venta</strong><br />
        Fecha: ${esc(formatDate(fecha))}<br />
        Estado: ${esc(sale.estado || '—')}
      </div>
    </div>

    <div class="title">
      <h1>RECIBO DE VENTA</h1>
      <div class="number">${esc(numero)}</div>
    </div>

    <div class="grid">
      <div class="box">
        <div class="box-title">Datos del cliente</div>
        <div class="row"><span>Nombre:</span><strong>${esc(clienteNombre)}</strong></div>
        <div class="row"><span>Teléfono:</span><strong>${esc(clienteTelefono || '—')}</strong></div>
        <div class="row"><span>NIT:</span><strong>${esc(clienteNit)}</strong></div>
      </div>

      <div class="box">
        <div class="box-title">Datos de la venta</div>
        <div class="row"><span>Fecha:</span><strong>${esc(formatDate(fecha))}</strong></div>
        <div class="row"><span>Método:</span><strong>${esc(sale.metodo_pago || sale.metodo || '—')}</strong></div>
        <div class="row"><span>Vendedor:</span><strong>${esc(sale.vendedor_nombre || sale.usuario_nombre || '—')}</strong></div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Cant.</th>
          <th>Descripción</th>
          <th style="text-align:right">P. Unit.</th>
          <th style="text-align:right">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="summary">
      <div class="line"><span>Subtotal:</span><strong>${money(subtotal, cents)}</strong></div>
      ${toNumber(impuestos) > 0 ? `<div class="line"><span>Impuestos:</span><strong>${money(impuestos, cents)}</strong></div>` : ''}
      <div class="line total"><span>TOTAL:</span><strong>${money(total, cents)}</strong></div>
      <div class="line"><span>Pagado:</span><strong>${money(pagado || total, cents)}</strong></div>
      <div class="line"><span>Saldo:</span><strong>${money(saldo, cents)}</strong></div>
    </div>

    <div class="payments">
      <div class="box-title">Forma de pago</div>
      ${paymentRows}
    </div>

    ${sale.observaciones ? `
      <div class="payments">
        <div class="box-title">Observaciones</div>
        <div>${esc(sale.observaciones)}</div>
      </div>
    ` : ''}

    <div class="footer">
      <strong>Gracias por su compra.</strong><br />
      Este recibo es un comprobante interno de venta. Para factura fiscal, solicítela al momento de la compra.
    </div>
  </div>

  <script>
    window.onload = function () {
      setTimeout(function () {
        window.focus();
        window.print();
      }, 350);
    };

    window.onafterprint = function () {
      window.close();
    };
  <\/script>
</body>
</html>
  `);
  printWindow.document.close();
}
