'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(
  __dirname,
  '../..'
);

function read(relative) {
  return fs.readFileSync(
    path.join(root, relative),
    'utf8'
  );
}

const migration = read(
  'Tecnocell_backend/scripts/migration_compras_origen_financiero_sprint_2d4.sql'
);

const service = read(
  'Tecnocell_backend/services/purchaseFinanceService.js'
);

const cajaSesionModel = read(
  'Tecnocell_backend/models/cajaSesionModel.js'
);

const controller = read(
  'Tecnocell_backend/controllers/compraController.js'
);

const purchaseService = read(
  'src/services/purchaseService.ts'
);

const purchaseModal = read(
  'src/pages/Purchases/NuevaCompraModal.tsx'
);

const purchasesPage = read(
  'src/pages/Purchases/PurchasesPage.tsx'
);

const cajaSesionService = read(
  'src/services/cajaSesionService.ts'
);

const cajaSesionPanel = read(
  'src/components/cajas/CajaSesionPanel.tsx'
);

const cajaSesionHistorial = read(
  'src/components/cajas/CajaSesionHistorial.tsx'
);

assert.match(
  migration,
  /fuente_financiera/
);

assert.match(
  migration,
  /CAJA_OPERATIVA/
);

assert.match(
  migration,
  /CAJA_CHICA/
);

assert.match(
  migration,
  /CUENTA_BANCARIA/
);

assert.match(
  migration,
  /TARJETA_CREDITO/
);

assert.match(
  migration,
  /CREATE TABLE compra_movimientos_financieros/
);

assert.match(
  migration,
  /accion ENUM\([\s\S]*'EGRESO'[\s\S]*'REVERSA'/
);

assert.match(
  migration,
  /caja_sesion_id/
);

assert.match(
  migration,
  /fk_compra_fin_caja_sesion/
);

assert.match(
  service,
  /resolverActivaParaOperacion/
);

assert.match(
  service,
  /usuario_apertura_id|usuarioId/
);

assert.match(
  service,
  /FROM sucursales[\s\S]{0,220}FOR UPDATE/
);

assert.match(
  service,
  /WHERE empresa_id = \?[\s\S]{0,80}sucursal_id = \?/
);

assert.match(
  service,
  /CAJA_CHICA_SALDO_INSUFICIENTE/
);

assert.match(
  service,
  /FUENTE_EFECTIVO_REQUERIDA/
);

assert.match(
  service,
  /CAJA_OPERATIVA_SALDO_INSUFICIENTE/
);

assert.match(
  service,
  /calcularEfectivoEsperado/
);

assert.match(
  service,
  /INSERT INTO compra_movimientos_financieros/
);

assert.match(
  service,
  /'EGRESO'/
);

assert.match(
  service,
  /'REVERSA'/
);

assert.match(
  service,
  /INSERT INTO caja_chica/
);

assert.match(
  cajaSesionModel,
  /FROM compra_movimientos_financieros/
);

assert.match(
  cajaSesionModel,
  /WHEN accion = 'EGRESO'[\s\S]{0,80}THEN monto_centavos/
);

assert.match(
  cajaSesionModel,
  /WHEN accion = 'REVERSA'[\s\S]{0,80}THEN monto_centavos/
);

assert.match(
  cajaSesionModel,
  /-comprasEgresos[\s\S]{0,80}\+[\s\S]{0,40}comprasReversas/
);

assert.match(
  cajaSesionModel,
  /comprasEfectivo/
);

assert.match(
  cajaSesionModel,
  /compras_efectivo_centavos/
);

const llamadasAplicarPago =
  controller.match(
    /aplicarPagoCompra\(connection,\s*\{[\s\S]{0,260}?fuenteFinanciera:\s*fuente_financiera/g
  ) || [];

assert.strictEqual(
  llamadasAplicarPago.length,
  3,
  'Los tres flujos de creación deben enviar fuente_financiera'
);

const destructuringsFuente =
  controller.match(
    /metodo_pago\s*=\s*'efectivo',\s*fuente_financiera,\s*tarjeta_id,\s*cuenta_id/g
  ) || [];

assert.strictEqual(
  destructuringsFuente.length,
  3,
  'Los tres flujos de creación deben aceptar fuente_financiera'
);


assert.match(
  cajaSesionModel,
  /'COMPRA' AS fuente/
);

assert.match(
  cajaSesionModel,
  /compras_egresos_centavos/
);

assert.match(
  cajaSesionModel,
  /compras_reversas_centavos/
);

assert.match(
  cajaSesionModel,
  /FROM compra_movimientos_financieros cmf/
);

assert.match(
  cajaSesionModel,
  /c\.proveedor_nombre AS cliente_nombre/
);

assert.match(
  cajaSesionService,
  /'COMPRA'/
);

assert.match(
  cajaSesionPanel,
  /Compra \$\{documento\}/
);

assert.match(
  cajaSesionPanel,
  /Anulación compra \$\{documento\}/
);

assert.match(
  cajaSesionHistorial,
  /Compra \$\{documento\}/
);

assert.match(
  cajaSesionHistorial,
  /Anulación compra \$\{documento\}/
);

assert.match(
  cajaSesionPanel,
  /movimientoEsEntradaCaja/
);

assert.match(
  cajaSesionHistorial,
  /movimientoEsEntradaCaja/
);


assert.doesNotMatch(
  cajaSesionPanel,
  /function movimientoEsEntradaCaja[\s\S]{0,260}return movimientoEsEntradaCaja\(movimiento\)/,
  'El helper de signo no debe ser recursivo en el panel'
);

assert.doesNotMatch(
  cajaSesionHistorial,
  /function movimientoEsEntradaCaja[\s\S]{0,260}return movimientoEsEntradaCaja\(movimiento\)/,
  'El helper de signo no debe ser recursivo en el historial'
);


assert.match(
  cajaSesionModel,
  /comprasEgresos/
);

assert.match(
  cajaSesionModel,
  /comprasReversas/
);

assert.match(
  cajaSesionPanel,
  /Compras -Q/
);

assert.match(
  cajaSesionPanel,
  /Anulaciones \+Q/
);

assert.match(
  cajaSesionHistorial,
  /Compras efectivo/
);

assert.match(
  cajaSesionHistorial,
  /Anulaciones de compras/
);

assert.match(
  cajaSesionHistorial,
  /Reversas ventas \/ reparaciones/
);

assert.match(
  cajaSesionHistorial,
  /comprasEgresos/
);

assert.match(
  cajaSesionHistorial,
  /comprasReversas/
);


console.log(
  'OK comprasOrigenFinanciero2D4: origen explícito, Caja Operativa y Caja Chica multisucursal preparados'
);


assert.match(
  controller,
  /purchaseFinanceService/
);

assert.match(
  controller,
  /fuente_financiera = \?/
);

assert.match(
  controller,
  /fuenteFinanciera/
);

assert.match(
  controller,
  /aplicarCajaOperativa/
);

assert.match(
  controller,
  /aplicarCajaChica/
);

assert.match(
  controller,
  /revertirCajaOperativa/
);

assert.match(
  controller,
  /revertirCajaChica/
);

assert.match(
  controller,
  /saldo_caja_chica/
);

assert.match(
  controller,
  /caja_operativa/
);

assert.match(
  controller,
  /sucursal_id = \?/
);

assert.match(
  controller,
  /compra histórica en efectivo no tiene un origen financiero verificable y requiere revisión manual/
);

assert.doesNotMatch(
  controller,
  /metodo === 'efectivo'\s*\?\s*'CAJA_CHICA'/,
  'Una compra histórica en efectivo sin fuente no debe reinterpretarse como Caja Chica'
);

assert.match(
  purchasesPage,
  /const totalInvertido = compras[\s\S]{0,320}CANCELADA[\s\S]{0,260}\.reduce/
);

assert.match(
  purchasesPage,
  /\.toUpperCase\(\) !== 'CANCELADA'/
);
