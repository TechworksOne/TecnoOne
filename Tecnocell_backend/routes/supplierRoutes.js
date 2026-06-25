const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePermission = require('../middleware/requirePermission');
const requirePlanModule = require('../middleware/requirePlanModule');

router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);
router.use(requirePlanModule('proveedores'));

router.get('/', requirePermission('proveedores.ver'), supplierController.getAllSuppliers);
router.get('/search', requirePermission('proveedores.ver'), supplierController.searchSuppliers);
router.get('/:id/purchases', requirePermission('proveedores.ver'), supplierController.getSupplierPurchases);
router.get('/:id', requirePermission('proveedores.ver'), supplierController.getSupplierById);
router.post('/', requirePermission('proveedores.administrar'), supplierController.createSupplier);
router.put('/:id', requirePermission('proveedores.administrar'), supplierController.updateSupplier);
router.delete('/:id', requirePermission('proveedores.administrar'), supplierController.deleteSupplier);

module.exports = router;
