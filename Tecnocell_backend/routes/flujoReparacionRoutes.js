// Routes para gestionar el flujo de reparaciones (estados, checklist, etc.)
const express = require('express');
const router = express.Router();
const flujoController = require('../controllers/flujoReparacionController');
const { verifyToken } = require('../middleware/authMiddleware');

// ========== RUTAS DE INGRESO DE EQUIPO (CHECKLIST) ==========
// Guardar/actualizar checklist de ingreso con fotos
router.post(
  '/:id/ingreso-equipo',
  verifyToken,
  flujoController.uploadMiddleware,
  flujoController.saveIngresoEquipo
);

// Obtener checklist de ingreso
router.get(
  '/:id/ingreso-equipo',
  verifyToken,
  flujoController.getIngresoEquipo
);

// ========== REPARACIONES DEL FLUJO ACTIVO ==========
router.get(
  '/activas',
  verifyToken,
  flujoController.getReparacionesFlujoActivo
);

// ========== HISTORIAL DE ENTREGADAS ==========
router.get(
  '/entregadas',
  verifyToken,
  flujoController.getEntregadas
);

// ========== RUTAS DE GESTIÓN DE ESTADOS ==========
// Cambiar estado de reparación
router.put(
  '/:id/estado',
  verifyToken,
  flujoController.cambiarEstado
);

// Obtener historial completo de estados
router.get(
  '/:id/historial',
  verifyToken,
  flujoController.getHistorial
);

// ========== RUTAS DE ASIGNACIÓN ==========
// Asignar técnico
router.put(
  '/:id/tecnico',
  verifyToken,
  flujoController.asignarTecnico
);

// Cambiar prioridad
router.put(
  '/:id/prioridad',
  verifyToken,
  flujoController.cambiarPrioridad
);

// ========== REINGRESO POR GARANTÍA ==========
router.post(
  '/:id/reingresar-garantia',
  verifyToken,
  flujoController.reingresarGarantia
);

module.exports = router;
