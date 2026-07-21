const express = require('express');
const router = express.Router();
const ventaController = require('../controllers/ventaController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePermission = require('../middleware/requirePermission');
const requirePlanModule = require('../middleware/requirePlanModule');
const branchScope = require('../middleware/branchScope');
const saleInventoryService = require('../services/saleInventoryService');

const requireSpecificSale = (req, res, next) => {
  try {
    saleInventoryService.requireSpecific(req.branchScope);
    next();
  } catch (error) {
    res.status(error.statusCode || 409).json({ code: error.code, error: error.message });
  }
};

// Todas las rutas de ventas requieren autenticación y tenant scope
router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);
router.use(requirePlanModule('ventas'));
router.use(branchScope);

// Rutas de ventas
router.post(
  '/comprobantes',
  requirePermission('ventas.editar'),
  requireSpecificSale,
  ventaController.uploadComprobante.single('comprobante'),
  ventaController.subirComprobante
);
router.post('/', requirePermission('ventas.crear'), requireSpecificSale, ventaController.createVenta);
router.post('/from-quote/:cotizacionId', requirePermission('ventas.crear'), requireSpecificSale, ventaController.createVentaFromQuote);
router.get('/', requirePermission('ventas.ver'), ventaController.getAllVentas);
router.get('/estadisticas', requirePermission('ventas.ver'), ventaController.getEstadisticas);
router.get('/:id', requirePermission('ventas.ver'), ventaController.getVentaById);
router.post('/:id/pagos', requirePermission('ventas.editar'), requireSpecificSale, ventaController.registrarPago);
router.post('/:id/anular', requirePermission('ventas.anular'), requireSpecificSale, ventaController.anularVenta);

module.exports = router;
