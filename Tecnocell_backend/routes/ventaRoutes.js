const express = require('express');
const router = express.Router();
const ventaController = require('../controllers/ventaController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');

// Todas las rutas de ventas requieren autenticación y tenant scope
router.use(verifyToken);
router.use(tenantScope);

// Rutas de ventas
router.post('/', ventaController.createVenta);
router.post('/from-quote/:cotizacionId', ventaController.createVentaFromQuote);
router.get('/', ventaController.getAllVentas);
router.get('/estadisticas', ventaController.getEstadisticas);
router.get('/:id', ventaController.getVentaById);
router.post('/:id/pagos', ventaController.registrarPago);
router.post('/:id/anular', ventaController.anularVenta);

module.exports = router;
