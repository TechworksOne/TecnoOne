const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePermission = require('../middleware/requirePermission');
const requirePlanModule = require('../middleware/requirePlanModule');

router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);
router.use(requirePlanModule('clientes'));

// Rutas de lectura
router.get('/', requirePermission('clientes.ver'), customerController.getAllCustomers);
router.get('/search', requirePermission('clientes.ver'), customerController.searchCustomers);
router.get('/:id', requirePermission('clientes.ver'), customerController.getCustomerById);
router.get('/:id/purchases', requirePermission('clientes.ver'), customerController.getCustomerPurchases);

// Rutas de escritura
router.post('/', requirePermission('clientes.crear'), customerController.createCustomer);
router.put('/:id', requirePermission('clientes.crear'), customerController.updateCustomer);
router.delete('/:id', requirePermission('clientes.crear'), customerController.deleteCustomer);

module.exports = router;
