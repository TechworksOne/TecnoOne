// Routes para gestionar el flujo de reparaciones (estados, checklist, etc.)
const express = require('express');
const router = express.Router();
const flujoController = require('../controllers/flujoReparacionController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePlanModule = require('../middleware/requirePlanModule');
const requirePermission = require('../middleware/requirePermission');
const branchScope = require('../middleware/branchScope');
const requireBranchSpecific = require('../middleware/requireBranchSpecific');

router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);
router.use(requirePlanModule('taller_operativo'));
router.use(branchScope);
// ========== ENDPOINT LEGACY DE CHECKLIST ==========
// El checklist activo se gestiona mediante /api/check-equipo.
router.all(
  '/:id/ingreso-equipo',
  flujoController.legacyIngresoEquipoDisabled
);



// ========== REPARACIONES DEL FLUJO ACTIVO ==========
router.get(
  '/activas',
  requirePermission('flujo_reparaciones.ver'),
  flujoController.getReparacionesFlujoActivo
);

// ========== HISTORIAL DE ENTREGADAS ==========
router.get(
  '/entregadas',
  requirePermission('flujo_reparaciones.ver'),
  flujoController.getEntregadas
);

// ========== RUTAS DE GESTIÓN DE ESTADOS ==========
// Cambiar estado de reparación
router.put(
  '/:id/estado',
  requirePermission('flujo_reparaciones.editar'),
  requireBranchSpecific,
  flujoController.cambiarEstado
);

// Obtener historial completo de estados
router.get(
  '/:id/historial',
  requirePermission('flujo_reparaciones.ver'),
  flujoController.getHistorial
);

// ========== RUTAS DE ASIGNACIÓN ==========
// Asignar técnico
router.put(
  '/:id/tecnico',
  requirePermission('flujo_reparaciones.editar'),
  requireBranchSpecific,
  flujoController.asignarTecnico
);

// Cambiar prioridad
router.put(
  '/:id/prioridad',
  requirePermission('flujo_reparaciones.editar'),
  requireBranchSpecific,
  flujoController.cambiarPrioridad
);

// ========== REINGRESO POR GARANTÍA ==========
router.post(
  '/:id/reingresar-garantia',
  requirePermission('flujo_reparaciones.editar'),
  requireBranchSpecific,
  flujoController.reingresarGarantia
);

module.exports = router;
