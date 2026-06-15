// Routes para gestionar el flujo de reparaciones (estados, checklist, etc.)
const express = require('express');
const router = express.Router();
const flujoController = require('../controllers/flujoReparacionController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');

router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);

// ========== RUTAS DE INGRESO DE EQUIPO (CHECKLIST) ==========
// Guardar/actualizar checklist de ingreso con fotos
router.post(
  '/:id/ingreso-equipo',
  flujoController.uploadMiddleware,
  flujoController.saveIngresoEquipo
);

// Obtener checklist de ingreso
router.get(
  '/:id/ingreso-equipo',
  flujoController.getIngresoEquipo
);

// ========== REPARACIONES DEL FLUJO ACTIVO ==========
router.get(
  '/activas',
  flujoController.getReparacionesFlujoActivo
);

// ========== HISTORIAL DE ENTREGADAS ==========
router.get(
  '/entregadas',
  flujoController.getEntregadas
);

// ========== RUTAS DE GESTIÓN DE ESTADOS ==========
// Cambiar estado de reparación
router.put(
  '/:id/estado',
  flujoController.cambiarEstado
);

// Obtener historial completo de estados
router.get(
  '/:id/historial',
  flujoController.getHistorial
);

// ========== RUTAS DE ASIGNACIÓN ==========
// Asignar técnico
router.put(
  '/:id/tecnico',
  flujoController.asignarTecnico
);

// Cambiar prioridad
router.put(
  '/:id/prioridad',
  flujoController.cambiarPrioridad
);

// ========== REINGRESO POR GARANTÍA ==========
router.post(
  '/:id/reingresar-garantia',
  flujoController.reingresarGarantia
);

module.exports = router;
