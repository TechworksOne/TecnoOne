const express = require('express');
const router = express.Router();
const cajaController = require('../controllers/cajaController');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');

// Todas las rutas requieren autenticación
router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);

const soloAdmin = verifyRole('ADMINISTRADOR', 'admin');

// ========== CAJA CHICA (todos los roles autenticados) ==========
router.get('/caja-chica/saldo',         cajaController.getSaldoCajaChica);
router.get('/caja-chica/movimientos',   cajaController.getMovimientosCajaChica);
router.post('/caja-chica/movimiento',   cajaController.registrarMovimientoCajaChica);
router.put('/caja-chica/confirmar/:id', cajaController.confirmarMovimientoCajaChica);

// ========== BANCOS ==========
// GET /bancos devuelve datos filtrados según rol (no admin no recibe saldo_actual)
router.get('/bancos', cajaController.getCuentasBancarias);
// Las siguientes rutas son solo para admin
router.get('/bancos/movimientos', verifyRole('admin', 'ADMINISTRADOR'), cajaController.getMovimientosBancarios);
router.get('/bancos/:id/saldo',       verifyRole('admin', 'ADMINISTRADOR'), cajaController.getSaldoCuentaBancaria);
router.get('/bancos/:id/movimientos', verifyRole('admin', 'ADMINISTRADOR'), cajaController.getMovimientosPorCuenta);
router.post('/bancos/movimiento', verifyRole('admin', 'ADMINISTRADOR'), cajaController.registrarMovimientoBancario);
router.put('/bancos/confirmar/:id', verifyRole('admin', 'ADMINISTRADOR'), cajaController.confirmarMovimientoBancario);
// CRUD bancos (solo admin)
router.post('/bancos', verifyRole('admin', 'ADMINISTRADOR'), cajaController.crearCuentaBancaria);
router.put('/bancos/:id', verifyRole('admin', 'ADMINISTRADOR'), cajaController.editarCuentaBancaria);
router.delete('/bancos/:id', verifyRole('admin', 'ADMINISTRADOR'), cajaController.desactivarCuentaBancaria);

// ========== OPERACIONES ENTRE CAJA Y BANCOS (solo admin) ==========
router.post('/retiro-banco', verifyRole('admin', 'ADMINISTRADOR'), cajaController.retirarDeBanco);
router.post('/depositar-banco', verifyRole('admin', 'ADMINISTRADOR'), cajaController.depositarAlBanco);
router.post('/ingreso-banco',   cajaController.ingresoBanco);
router.post('/transferencia-bancos', verifyRole('admin', 'ADMINISTRADOR'), cajaController.transferenciaBancos);

// ========== TRANSFERENCIA CAJA CHICA → BANCO (todos los roles autenticados) ==========
router.post('/transferir-caja-a-banco', cajaController.transferirCajaABanco);

module.exports = router;
