// Routes para gestionar marcas y modelos de equipos
const express = require('express');
const router = express.Router();
const equipoController = require('../controllers/equipoController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePlanModule = require('../middleware/requirePlanModule');
const requirePermission = require('../middleware/requirePermission');

router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);
router.use(requirePlanModule('taller_operativo'));


// Rutas para MARCAS por empresa
router.get('/marcas', requirePermission('reparaciones.ver'), equipoController.getAllMarcas);
router.post('/marcas', requirePermission('catalogos.administrar'), equipoController.createMarca);
router.put('/marcas/:id', requirePermission('catalogos.administrar'), equipoController.updateMarca);
router.delete('/marcas/:id', requirePermission('catalogos.administrar'), equipoController.deleteMarca);

// Rutas para MODELOS por empresa
router.get('/modelos', requirePermission('reparaciones.ver'), equipoController.getAllModelos);
router.get('/marcas/:marca_id/modelos', requirePermission('reparaciones.ver'), equipoController.getModelosByMarca);
router.post('/modelos', requirePermission('catalogos.administrar'), equipoController.createModelo);
router.put('/modelos/:id', requirePermission('catalogos.administrar'), equipoController.updateModelo);
router.delete('/modelos/:id', requirePermission('catalogos.administrar'), equipoController.deleteModelo);

module.exports = router;
