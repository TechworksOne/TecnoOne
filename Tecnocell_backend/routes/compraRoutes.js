// Routes para gestionar compras de productos
const express = require('express');
const router = express.Router();
const compraController = require('../controllers/compraController');
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
router.use(requirePlanModule('compras'));
router.use(branchScope);

// Fuentes financieras disponibles para registrar compras
router.get('/fuentes-pago', requirePermission('compras.crear'), compraController.getFuentesPago);

// Rutas de compras de PRODUCTOS
router.post('/productos', requirePermission('compras.crear'), requireBranchSpecific, compraController.createCompraProductos);

// Rutas de compras de REPUESTOS
router.post('/repuestos', requirePermission('compras.crear'), requireBranchSpecific, compraController.createCompraRepuestos);

// Compra atómica de productos, repuestos o ambos
router.post('/', requirePermission('compras.crear'), requireBranchSpecific, compraController.createCompra);

// Rutas generales
router.get('/', requirePermission('compras.ver'), compraController.getAllCompras);

// Rutas de series
router.get('/series/producto/:productoId', requirePermission('compras.ver'), compraController.getSeriesByProducto);

router.get('/:id', requirePermission('compras.ver'), compraController.getCompraById);
router.post('/:id/anular', requirePermission('compras.anular'), requireBranchSpecific, compraController.anularCompra);

module.exports = router;
