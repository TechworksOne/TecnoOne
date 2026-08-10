const express = require('express');
const router = express.Router();
const checkEquipoController = require('../controllers/checkEquipoController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePlanModule = require('../middleware/requirePlanModule');
const requirePermission = require('../middleware/requirePermission');
const branchScope = require('../middleware/branchScope');
const requireBranchSpecific = require('../middleware/requireBranchSpecific');

// Todas las rutas requieren autenticación
router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);
router.use(requirePlanModule('taller_operativo'));
router.use(branchScope);

// Obtener todos los checklists
router.get('/', requirePermission('reparaciones.ver'), checkEquipoController.getAllChecks);

// Crear checklist de equipo
router.post('/', requirePermission('reparaciones.editar'), requireBranchSpecific, checkEquipoController.createCheckEquipo);

// Obtener checklist por reparación
router.get('/reparacion/:reparacionId', requirePermission('reparaciones.ver'), checkEquipoController.getCheckByReparacion);

// Actualizar checklist
router.put('/:id', requirePermission('reparaciones.editar'), requireBranchSpecific, checkEquipoController.updateCheckEquipo);

module.exports = router;
