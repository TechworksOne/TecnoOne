const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { verifyToken } = require('../middleware/authMiddleware');

// Rutas públicas (sin autenticación) - solo lectura
router.get('/', customerController.getAllCustomers);
router.get('/search', customerController.searchCustomers);
router.get('/:id', customerController.getCustomerById);
router.get('/:id/purchases', customerController.getCustomerPurchases);

// Rutas protegidas (requieren autenticación) - escritura
router.post('/', verifyToken, customerController.createCustomer);
router.put('/:id', verifyToken, customerController.updateCustomer);
router.delete('/:id', verifyToken, customerController.deleteCustomer);

module.exports = router;
