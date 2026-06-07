const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');

router.use(verifyToken);
router.use(tenantScope);

router.get('/', supplierController.getAllSuppliers);
router.get('/search', supplierController.searchSuppliers);
router.get('/:id/purchases', supplierController.getSupplierPurchases);
router.get('/:id', supplierController.getSupplierById);
router.post('/', supplierController.createSupplier);
router.put('/:id', supplierController.updateSupplier);
router.delete('/:id', supplierController.deleteSupplier);

module.exports = router;
