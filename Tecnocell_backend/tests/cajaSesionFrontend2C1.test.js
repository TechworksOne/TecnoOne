'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(
  __dirname,
  '..',
  '..',
);

function read(relative) {
  return fs.readFileSync(
    path.join(root, relative),
    'utf8',
  );
}

const service = read(
  'src/services/cajaSesionService.ts',
);

const panel = read(
  'src/components/cajas/CajaSesionPanel.tsx',
);

const historial = read(
  'src/components/cajas/CajaSesionHistorial.tsx',
);

const cajaBancos = read(
  'src/pages/CajaBancos/CajaBancosPage.tsx',
);

assert.match(
  service,
  /sugerencia-apertura/,
);

assert.match(
  service,
  /\/caja-sesiones\/historial/,
);

assert.match(
  service,
  /fondo_siguiente_centavos/,
);

assert.match(
  service,
  /retiro_cierre_centavos/,
);

assert.match(
  panel,
  /getSugerenciaApertura/,
);

assert.match(
  panel,
  /Efectivo dejado en el último cierre/,
);

assert.match(
  panel,
  /Fondo contado al abrir/,
);

assert.match(
  panel,
  /Diferencia de apertura/,
);

assert.match(
  panel,
  /Dejar en caja para el próximo turno/,
);

assert.match(
  panel,
  /Efectivo a retirar/,
);

assert.match(
  panel,
  /fondoSiguienteCentavos/,
);

assert.match(
  panel,
  /ultimoCierre\.retiroCierre/,
);

assert.match(
  panel,
  /caja-sesion-updated/,
);

assert.match(
  historial,
  /Historial de cierres/,
);

assert.match(
  historial,
  /getHistorial/,
);

assert.match(
  historial,
  /cajas\.sesion\.ver/,
);

assert.match(
  historial,
  /fondo_siguiente_centavos/,
);

assert.match(
  historial,
  /retiro_cierre_centavos/,
);

assert.match(
  historial,
  /row\.estado === 'CERRADA'/,
);

assert.match(
  historial,
  /caja-sesion-updated/,
);

assert.match(
  cajaBancos,
  /CajaSesionPanel/,
);

assert.match(
  cajaBancos,
  /CajaSesionHistorial/,
);

console.log(
  'OK cajaSesionFrontend2C1: arrastre, cierre e historial de caja',
);
