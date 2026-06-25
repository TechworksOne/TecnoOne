const express = require('express');
const router = express.Router();
const ventaController = require('../controllers/ventaController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePermission = require('../middleware/requirePermission');
const requirePlanModule = require('../middleware/requirePlanModule');

// Todas las rutas de ventas requieren autenticación y tenant scope
router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);
router.use(requirePlanModule('ventas'));

// Rutas de ventas
router.post(
  '/comprobantes',
  requirePermission('ventas.editar'),
  ventaController.uploadComprobante.single('comprobante'),
  ventaController.subirComprobante
);
router.post('/', requirePermission('ventas.crear'), ventaController.createVenta);
router.post('/from-quote/:cotizacionId', requirePermission('ventas.crear'), ventaController.createVentaFromQuote);
router.get('/', requirePermission('ventas.ver'), ventaController.getAllVentas);
router.get('/estadisticas', requirePermission('ventas.ver'), ventaController.getEstadisticas);
router.get('/:id', requirePermission('ventas.ver'), ventaController.getVentaById);
router.post('/:id/pagos', requirePermission('ventas.editar'), ventaController.registrarPago);
router.post('/:id/anular', requirePermission('ventas.anular'), ventaController.anularVenta);

module.exports = router;
