const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const reportesController = require('../controllers/reportesController');
const requirePermission = require('../middleware/requirePermission');
const requirePlanModule = require('../middleware/requirePlanModule');

const soloAdmin = [
  verifyToken,
  tenantScope,
  checkEmpresaActiva,
  requirePlanModule('reportes_comerciales'),
  requirePermission('reportes.ver'),
];

router.get('/resumen',               ...soloAdmin, reportesController.getResumen);
router.get('/diario',                ...soloAdmin, reportesController.getDiario);
router.get('/semanal',               ...soloAdmin, reportesController.getSemanal);
router.get('/productos-mas-vendidos',...soloAdmin, reportesController.getProductosMasVendidos);
router.get('/historial-ventas',      ...soloAdmin, reportesController.getHistorialVentas);
router.get('/metricas-financieras',  ...soloAdmin, reportesController.getMetricasFinancieras);

module.exports = router;
