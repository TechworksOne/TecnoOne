const express = require('express');
const router = express.Router();
const deudoresController = require('../controllers/deudoresController');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');

// Deudores: exclusivo para administradores
const soloAdmin = [verifyToken, verifyRole('ADMINISTRADOR', 'admin')];

router.get('/',                    ...soloAdmin, deudoresController.getDeudores);
router.get('/resumen',             ...soloAdmin, deudoresController.getResumen);
router.get('/buscar/reparaciones', ...soloAdmin, deudoresController.searchReparaciones);
router.get('/:id',                 ...soloAdmin, deudoresController.getDeudorById);
router.post('/',                   ...soloAdmin, deudoresController.createDeudor);
router.post('/:id/pago',           ...soloAdmin, deudoresController.registrarPago);
router.post('/:id/anular',         ...soloAdmin, deudoresController.anularDeudor);

module.exports = router;
