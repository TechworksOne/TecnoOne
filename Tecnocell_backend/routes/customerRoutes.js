const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');

router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);

// Rutas de lectura
router.get('/', customerController.getAllCustomers);
router.get('/search', customerController.searchCustomers);
router.get('/:id', customerController.getCustomerById);
router.get('/:id/purchases', customerController.getCustomerPurchases);

// Rutas de escritura
router.post('/', customerController.createCustomer);
router.put('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

module.exports = router;
