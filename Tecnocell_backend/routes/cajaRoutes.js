const express = require('express');
const router = express.Router();
const cajaController = require('../controllers/cajaController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePermission = require('../middleware/requirePermission');
const requirePlanModule = require('../middleware/requirePlanModule');
const branchScope = require('../middleware/branchScope');
const requireBranchSpecific = require('../middleware/requireBranchSpecific');

// Todas las rutas requieren autenticación
router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);
router.use(requirePlanModule('caja_bancos'));
router.use(branchScope);

// ========== CAJA CHICA (todos los roles autenticados) ==========
router.get('/caja-chica/saldo',         requirePermission('caja.ver'), cajaController.getSaldoCajaChica);
router.get('/caja-chica/movimientos',   requirePermission('caja.ver'), cajaController.getMovimientosCajaChica);
router.get('/caja-chica/arqueos',       requirePermission('caja.ver'), cajaController.getArqueosCajaChica);
router.post(
  '/caja-chica/arqueos',
  requirePermission('caja.arquear'),
  requireBranchSpecific,
  cajaController.registrarArqueoCajaChica
);
router.post(
  '/caja-chica/reposiciones/manual',
  requirePermission('caja.reponer_manual'),
  requireBranchSpecific,
  cajaController.reponerCajaChicaManual
);
router.post(
  '/caja-chica/reposiciones/banco',
  requirePermission('caja.reponer'),
  requirePermission('bancos.administrar'),
  requireBranchSpecific,
  cajaController.reponerCajaChicaDesdeBanco
);
router.post(
  '/caja-chica/movimiento',
  requirePermission('caja.operar'),
  requireBranchSpecific,
  cajaController.registrarMovimientoCajaChica
);
router.put(
  '/caja-chica/confirmar/:id',
  requirePermission('caja.operar'),
  requireBranchSpecific,
  cajaController.confirmarMovimientoCajaChica
);

// ========== BANCOS ==========
// GET /bancos devuelve datos filtrados según rol (no admin no recibe saldo_actual)
router.get('/bancos', requirePermission('caja.ver'), cajaController.getCuentasBancarias);
// Las siguientes rutas son solo para admin
router.get('/bancos/movimientos', requirePermission('caja.ver'), cajaController.getMovimientosBancarios);
router.get('/bancos/:id/saldo', requirePermission('caja.ver'), cajaController.getSaldoCuentaBancaria);
router.get('/bancos/:id/movimientos', requirePermission('caja.ver'), cajaController.getMovimientosPorCuenta);
router.post('/bancos/movimiento', requirePermission('bancos.administrar'), requireBranchSpecific, cajaController.registrarMovimientoBancario);
router.put('/bancos/confirmar/:id', requirePermission('bancos.administrar'), requireBranchSpecific, cajaController.confirmarMovimientoBancario);
// CRUD bancos (solo admin)
router.post('/bancos', requirePermission('bancos.administrar'), cajaController.crearCuentaBancaria);
router.put('/bancos/:id', requirePermission('bancos.administrar'), cajaController.editarCuentaBancaria);
router.delete('/bancos/:id', requirePermission('bancos.administrar'), cajaController.desactivarCuentaBancaria);

// ========== OPERACIONES ENTRE CAJA Y BANCOS (solo admin) ==========
router.post(
  '/retiro-banco',
  requirePermission('bancos.administrar'),
  requireBranchSpecific,
  cajaController.retirarDeBanco
);
router.post(
  '/depositar-banco',
  requirePermission('bancos.administrar'),
  requireBranchSpecific,
  cajaController.depositarAlBanco
);
router.post('/ingreso-banco', requirePermission('caja.operar'), cajaController.ingresoBanco);
router.post('/transferencia-bancos', requirePermission('bancos.administrar'), cajaController.transferenciaBancos);

// ========== TRANSFERENCIA CAJA CHICA → BANCO (todos los roles autenticados) ==========
router.post(
  '/transferir-caja-a-banco',
  requirePermission('caja.operar'),
  requireBranchSpecific,
  cajaController.transferirCajaABanco
);

module.exports = router;
