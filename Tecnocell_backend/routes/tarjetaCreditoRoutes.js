const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/tarjetaCreditoController');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');

// Todas las rutas requieren autenticación + rol ADMINISTRADOR
router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);
router.use(verifyRole('ADMINISTRADOR', 'admin'));

router.get('/',                    ctrl.getTarjetas);
router.post('/',                   ctrl.createTarjeta);
router.put('/:id',                 ctrl.updateTarjeta);
router.patch('/:id/desactivar',    ctrl.desactivarTarjeta);
router.get('/:id/movimientos',     ctrl.getMovimientos);
router.post('/:id/pagos',          ctrl.registrarPago);
router.post('/:id/ajustes',        ctrl.registrarAjuste);

module.exports = router;
