const express = require('express');
const router = express.Router();
const checkEquipoController = require('../controllers/checkEquipoController');
const { verifyToken } = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Obtener todos los checklists
router.get('/', checkEquipoController.getAllChecks);

// Crear checklist de equipo
router.post('/', checkEquipoController.createCheckEquipo);

// Obtener checklist por reparación
router.get('/reparacion/:reparacionId', checkEquipoController.getCheckByReparacion);

// Actualizar checklist
router.put('/:id', checkEquipoController.updateCheckEquipo);

module.exports = router;
