'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(
  __dirname,
  '..',
  '..',
);

function read(file) {
  return fs.readFileSync(
    path.join(root, file),
    'utf8',
  );
}

const model = read(
  'Tecnocell_backend/models/cajaSesionModel.js'
);

const controller = read(
  'Tecnocell_backend/controllers/cajaSesionController.js'
);

const routes = read(
  'Tecnocell_backend/routes/cajaSesionRoutes.js'
);

const service = read(
  'src/services/cajaSesionService.ts'
);

const component = read(
  'src/components/cajas/CajaSesionHistorial.tsx'
);

const page = read(
  'src/pages/CajaBancos/CajaBancosPage.tsx'
);

const panel = read(
  'src/components/cajas/CajaSesionPanel.tsx'
);

assert.match(
  model,
  /ventas_ingresos_centavos/,
);

assert.match(
  model,
  /ventas_reversas_centavos/,
);

assert.match(
  model,
  /reparaciones_ingresos_centavos/,
);

assert.match(
  model,
  /reparaciones_reversas_centavos/,
);

assert.match(
  model,
  /async function obtenerDetalle/,
);

assert.match(
  model,
  /venta_movimientos_financieros/,
);

assert.match(
  model,
  /reparacion_movimientos_financieros/,
);

assert.match(
  model,
  /cliente_nombre AS cliente_nombre/,
);

assert.match(
  model,
  /numero_venta/,
);

assert.match(
  model,
  /r\.marca/,
);

assert.match(
  model,
  /r\.modelo/,
);

assert.match(
  controller,
  /exports\.getDetalle/,
);

assert.match(
  routes,
  /\/:id\/detalle/,
);

assert.match(
  routes,
  /cajas\.sesion\.ver/,
);

assert.match(
  service,
  /getDetalle/,
);

assert.match(
  service,
  /CajaSesionMovimientoDetalle/,
);

assert.match(
  component,
  /Historial de Caja Operativa/,
);

assert.match(
  component,
  /Historial de cierres/,
);

assert.match(
  component,
  /Ver movimientos/,
);

assert.match(
  component,
  /Reversas \/ devoluciones/,
);

assert.match(
  component,
  /Retirado al cierre/,
);

assert.match(
  component,
  /Modal/,
);

assert.match(
  page,
  /<CajaSesionHistorial \/>/,
);

assert.match(
  panel,
  /Ver movimientos actuales/,
);

assert.match(
  panel,
  /Movimientos de la sesión actual/,
);

assert.match(
  panel,
  /cajaSesionApi\.getDetalle/,
);

assert.match(
  panel,
  /cliente_nombre/,
);

assert.match(
  panel,
  /detalle_principal/,
);

console.log(
  'OK cajaSesionHistorial2C3: cierres resumidos, detalle cronológico y ventana de auditoría',
);
