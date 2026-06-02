const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { verifyToken } = require('../middleware/authMiddleware');

// Rutas públicas (sin autenticación) - solo lectura
router.get('/', supplierController.getAllSuppliers);
router.get('/search', supplierController.searchSuppliers);
router.get('/:id', supplierController.getSupplierById);
router.get('/:id/purchases', supplierController.getSupplierPurchases);

// Rutas protegidas (requieren autenticación) - escritura
router.post('/', verifyToken, supplierController.createSupplier);
router.put('/:id', verifyToken, supplierController.updateSupplier);
router.delete('/:id', verifyToken, supplierController.deleteSupplier);

module.exports = router;
