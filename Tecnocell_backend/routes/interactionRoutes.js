const express = require('express');
const router = express.Router();
const interactionController = require('../controllers/interactionController');
const { verifyToken } = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Crear nueva interacción
router.post('/', interactionController.createInteraction);

// Obtener interacciones de un cliente
router.get('/cliente/:cliente_id', interactionController.getCustomerInteractions);

// Obtener resumen de un cliente
router.get('/cliente/:cliente_id/resumen', interactionController.getCustomerSummary);

// Obtener estadísticas de interacciones
router.get('/stats', interactionController.getInteractionStats);

module.exports = router;
