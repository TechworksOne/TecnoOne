// Routes: Órdenes de Trabajo
const express = require('express');
const router = express.Router();
const otController = require('../controllers/otController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePlanModule = require('../middleware/requirePlanModule');

// Todas las rutas requieren autenticación
router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);
router.use(requirePlanModule('taller_operativo'));

// GET /api/ot/resumen  — KPI cards del dashboard (activas, por estado, carga técnico)
router.get('/resumen',   otController.getResumenOT);

// GET /api/ot/historial — OTs canceladas y entregadas
router.get('/historial', otController.getHistorialOT);

// GET /api/ot/tecnicos — lista de usuarios disponibles para asignar OT
router.get('/tecnicos',  otController.getTecnicos);

// GET /api/ot — listado de OTs activas
router.get('/',          otController.getOrdenesTrabajo);

module.exports = router;
