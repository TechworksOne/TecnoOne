const express = require('express');
const router = express.Router();
const checkEquipoController = require('../controllers/checkEquipoController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePlanModule = require('../middleware/requirePlanModule');
const requirePermission = require('../middleware/requirePermission');

// Todas las rutas requieren autenticación
router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);
router.use(requirePlanModule('taller_operativo'));

// Obtener todos los checklists
router.get('/', requirePermission('reparaciones.ver'), checkEquipoController.getAllChecks);

// Crear checklist de equipo
router.post('/', requirePermission('reparaciones.editar'), checkEquipoController.createCheckEquipo);

// Obtener checklist por reparación
router.get('/reparacion/:reparacionId', requirePermission('reparaciones.ver'), checkEquipoController.getCheckByReparacion);

// Actualizar checklist
router.put('/:id', requirePermission('reparaciones.editar'), checkEquipoController.updateCheckEquipo);

module.exports = router;
