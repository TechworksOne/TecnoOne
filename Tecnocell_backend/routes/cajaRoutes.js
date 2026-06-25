const express = require('express');
const router = express.Router();
const cajaController = require('../controllers/cajaController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePermission = require('../middleware/requirePermission');
const requirePlanModule = require('../middleware/requirePlanModule');

// Todas las rutas requieren autenticación
router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);
router.use(requirePlanModule('caja_bancos'));

// ========== CAJA CHICA (todos los roles autenticados) ==========
router.get('/caja-chica/saldo',         requirePermission('caja.ver'), cajaController.getSaldoCajaChica);
router.get('/caja-chica/movimientos',   requirePermission('caja.ver'), cajaController.getMovimientosCajaChica);
router.post('/caja-chica/movimiento',   requirePermission('caja.operar'), cajaController.registrarMovimientoCajaChica);
router.put('/caja-chica/confirmar/:id', requirePermission('caja.operar'), cajaController.confirmarMovimientoCajaChica);

// ========== BANCOS ==========
// GET /bancos devuelve datos filtrados según rol (no admin no recibe saldo_actual)
router.get('/bancos', requirePermission('caja.ver'), cajaController.getCuentasBancarias);
// Las siguientes rutas son solo para admin
router.get('/bancos/movimientos', requirePermission('caja.ver'), cajaController.getMovimientosBancarios);
router.get('/bancos/:id/saldo', requirePermission('caja.ver'), cajaController.getSaldoCuentaBancaria);
router.get('/bancos/:id/movimientos', requirePermission('caja.ver'), cajaController.getMovimientosPorCuenta);
router.post('/bancos/movimiento', requirePermission('bancos.administrar'), cajaController.registrarMovimientoBancario);
router.put('/bancos/confirmar/:id', requirePermission('bancos.administrar'), cajaController.confirmarMovimientoBancario);
// CRUD bancos (solo admin)
router.post('/bancos', requirePermission('bancos.administrar'), cajaController.crearCuentaBancaria);
router.put('/bancos/:id', requirePermission('bancos.administrar'), cajaController.editarCuentaBancaria);
router.delete('/bancos/:id', requirePermission('bancos.administrar'), cajaController.desactivarCuentaBancaria);

// ========== OPERACIONES ENTRE CAJA Y BANCOS (solo admin) ==========
router.post('/retiro-banco', requirePermission('bancos.administrar'), cajaController.retirarDeBanco);
router.post('/depositar-banco', requirePermission('bancos.administrar'), cajaController.depositarAlBanco);
router.post('/ingreso-banco', requirePermission('caja.operar'), cajaController.ingresoBanco);
router.post('/transferencia-bancos', requirePermission('bancos.administrar'), cajaController.transferenciaBancos);

// ========== TRANSFERENCIA CAJA CHICA → BANCO (todos los roles autenticados) ==========
router.post('/transferir-caja-a-banco', requirePermission('caja.operar'), cajaController.transferirCajaABanco);

module.exports = router;
