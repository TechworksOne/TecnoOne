const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');

// ── Endpoint unificado: detecta rol y devuelve el dashboard correspondiente ───
// Admin  → stats con ganancias/costos
// Ventas → stats comerciales sin datos financieros sensibles
// Técnico → mis reparaciones asignadas
router.get('/', verifyToken, tenantScope, checkEmpresaActiva, dashboardController.getDashboard);

// ── Endpoints específicos (mantener compatibilidad) ───────────────────────────
// Ahora tienen role-guard interno en el controlador
router.get('/stats',   verifyToken, tenantScope, checkEmpresaActiva, dashboardController.getDashboardStats);
router.get('/tecnico', verifyToken, tenantScope, checkEmpresaActiva, dashboardController.getTecnicoDashboardStats);

module.exports = router;
