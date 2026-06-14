/**
 * Prints a barcode label for a product or repuesto.
 * Uses JsBarcode (CODE128) loaded from CDN — no npm install needed.
 *
 * @param sku   The value to encode (SKU / codigo)
 * @param name  Display name shown above the barcode
 * @param type  Optional type label shown on the ticket (e.g. "Producto" / "Repuesto")
 */
export function printBarcode(sku: string, name: string, type?: string): void {
  if (!sku) return;

  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Etiqueta ${esc(sku)}</title>
  <style>
    @page { size: 2in 1in; margin: 1mm; }
    * { box-sizing: border-box; }
    html, body {
      font-family: Arial, sans-serif;
      font-size: 6px;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 0;
      width: 2in;
      height: 1in;
      max-height: 1in;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      page-break-after: avoid;
    }
    .label {
      width: 100%;
      text-align: center;
      padding: 0 1mm;
    }
    .name {
      font-size: 7px;
      font-weight: bold;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 0.5mm;
    }
    .type {
      font-size: 5px;
      color: #555;
      margin-bottom: 0.5mm;
    }
    svg {
      max-width: 100%;
      height: auto;
      shape-rendering: crispEdges;
    }
    .sku-text {
      font-size: 6px;
      font-family: monospace;
      margin-top: 0.5mm;
    }
    @media print {
      body { background: #fff !important; color: #000 !important; }
    }
  </style>
</head>
<body>
<div class="label">
  ${type ? `<div class="type">${esc(type)}</div>` : ''}
  <div class="name">${esc(name)}</div>
  <svg id="barcode"></svg>
  <div class="sku-text">${esc(sku)}</div>
</div>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
<script>
  window.onload = function () {
    try {
      JsBarcode('#barcode', ${JSON.stringify(sku)}, {
        format: 'CODE128',
        width: 2.4,
        height: 34,
        displayValue: false,
        margin: 2,
        fontSize: 10,
      });
    } catch (e) {
      console.error('Barcode error:', e);
    }
    window.print();
    setTimeout(function () { window.close(); }, 800);
  };
</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=220,height=130');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}
