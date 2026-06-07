const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');

// ── Endpoint unificado: detecta rol y devuelve el dashboard correspondiente ───
// Admin  → stats con ganancias/costos
// Ventas → stats comerciales sin datos financieros sensibles
// Técnico → mis reparaciones asignadas
router.get('/', verifyToken, tenantScope, dashboardController.getDashboard);

// ── Endpoints específicos (mantener compatibilidad) ───────────────────────────
// Ahora tienen role-guard interno en el controlador
router.get('/stats',   verifyToken, tenantScope, dashboardController.getDashboardStats);
router.get('/tecnico', verifyToken, tenantScope, dashboardController.getTecnicoDashboardStats);

module.exports = router;
