const express = require('express');
const router = express.Router();
const interactionController = require('../controllers/interactionController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePermission = require('../middleware/requirePermission');
const requirePlanModule = require('../middleware/requirePlanModule');

// Todas las rutas requieren autenticación
router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);
router.use(requirePlanModule('clientes'));

// Crear nueva interacción
router.post('/', requirePermission('clientes.crear'), interactionController.createInteraction);

// Obtener interacciones de un cliente
router.get('/cliente/:cliente_id', requirePermission('clientes.ver'), interactionController.getCustomerInteractions);

// Obtener resumen de un cliente
router.get('/cliente/:cliente_id/resumen', requirePermission('clientes.ver'), interactionController.getCustomerSummary);

// Obtener estadísticas de interacciones
router.get('/stats', requirePermission('clientes.ver'), interactionController.getInteractionStats);

module.exports = router;
