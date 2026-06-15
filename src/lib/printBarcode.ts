/**
 * Prints a thermal barcode label for products or repuestos.
 * Label target: 2in x 1in.
 * Uses JsBarcode CODE128 from CDN.
 */

export function printBarcode(sku: string, name?: string, type?: string): void {
  const code = String(sku || '').trim();

  if (!code) {
    alert('No hay código/SKU para imprimir.');
    return;
  }

  const printWindow = window.open('', '_blank', 'width=420,height=320');

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
  <title>Código ${code}</title>
  <style>
    @page {
      size: 2in 1in;
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      width: 2in;
      height: 1in;
      margin: 0;
      padding: 0;
      background: #ffffff;
      overflow: hidden;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-family: Arial, Helvetica, sans-serif;
    }

    .barcode-print-root {
      width: 2in;
      height: 1in;
      margin: 0;
      padding: 0;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .barcode-label {
      width: 2in;
      height: 1in;
      padding: 0.055in 0.06in 0.035in;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .barcode-svg-wrap {
      width: 100%;
      height: 0.72in;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    #barcode {
      width: 100%;
      height: 100%;
      display: block;
    }

    .barcode-code {
      width: 100%;
      margin-top: 0.015in;
      text-align: center;
      font-size: 8.5pt;
      font-weight: 700;
      line-height: 1;
      color: #000000;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      letter-spacing: 0.2px;
    }

    @media print {
      html,
      body,
      .barcode-print-root {
        width: 2in !important;
        height: 1in !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        background: #ffffff !important;
      }
    }
  </style>
</head>
<body>
  <div class="barcode-print-root">
    <div class="barcode-label">
      <div class="barcode-svg-wrap">
        <svg id="barcode"></svg>
      </div>
      <div class="barcode-code">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
  <script>
    function doPrint() {
      try {
        JsBarcode('#barcode', ${JSON.stringify(code)}, {
          format: 'CODE128',
          width: 1.65,
          height: 68,
          margin: 0,
          displayValue: false,
          background: '#ffffff',
          lineColor: '#000000'
        });

        setTimeout(function () {
          window.focus();
          window.print();
        }, 350);
      } catch (e) {
        console.error('Barcode error:', e);
        document.body.innerHTML = '<p style="font-family:Arial;font-size:12px;padding:8px;">Error generando código de barras</p>';
      }
    }

    if (document.readyState === 'complete') {
      doPrint();
    } else {
      window.onload = doPrint;
    }

    window.onafterprint = function () {
      window.close();
    };
  </script>
</body>
</html>
  `);
  printWindow.document.close();
}
