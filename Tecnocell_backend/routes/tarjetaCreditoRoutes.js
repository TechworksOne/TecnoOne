const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/tarjetaCreditoController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePermission = require('../middleware/requirePermission');

// Todas las rutas requieren autenticación y permisos efectivos
router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);

router.get('/', requirePermission('tarjetas.ver'), ctrl.getTarjetas);
router.post('/', requirePermission('tarjetas.administrar'), ctrl.createTarjeta);
router.put('/:id', requirePermission('tarjetas.administrar'), ctrl.updateTarjeta);
router.patch('/:id/desactivar', requirePermission('tarjetas.administrar'), ctrl.desactivarTarjeta);
router.get('/:id/movimientos', requirePermission('tarjetas.ver'), ctrl.getMovimientos);
router.post('/:id/pagos', requirePermission('tarjetas.administrar'), ctrl.registrarPago);
router.post('/:id/ajustes', requirePermission('tarjetas.administrar'), ctrl.registrarAjuste);

module.exports = router;
