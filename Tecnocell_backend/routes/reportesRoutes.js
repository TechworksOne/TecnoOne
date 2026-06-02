const express = require('express');
const router = express.Router();
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');
const reportesController = require('../controllers/reportesController');

const soloAdmin = [verifyToken, verifyRole('ADMINISTRADOR')];

router.get('/resumen',               ...soloAdmin, reportesController.getResumen);
router.get('/diario',                ...soloAdmin, reportesController.getDiario);
router.get('/semanal',               ...soloAdmin, reportesController.getSemanal);
router.get('/productos-mas-vendidos',...soloAdmin, reportesController.getProductosMasVendidos);
router.get('/historial-ventas',      ...soloAdmin, reportesController.getHistorialVentas);
router.get('/metricas-financieras',  ...soloAdmin, reportesController.getMetricasFinancieras);

module.exports = router;
