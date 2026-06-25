const express = require('express');
const router = express.Router();
const marcaLineaController = require('../controllers/marcaLineaController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePermission = require('../middleware/requirePermission');
const requirePlanModule = require('../middleware/requirePlanModule');

router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);
router.use(requirePlanModule('productos'));


// RUTAS DE MARCAS POR EMPRESA
router.get('/marcas/con-lineas', requirePermission('productos.ver'), marcaLineaController.getMarcasConLineas);
router.get('/marcas', requirePermission('productos.ver'), marcaLineaController.getAllMarcas);
router.post('/marcas', requirePermission('catalogos.administrar'), marcaLineaController.createMarca);
router.get('/marcas/:id', requirePermission('productos.ver'), marcaLineaController.getMarcaById);
router.put('/marcas/:id', requirePermission('catalogos.administrar'), marcaLineaController.updateMarca);
router.delete('/marcas/:id', requirePermission('catalogos.administrar'), marcaLineaController.deleteMarca);
router.get('/marcas/:id/lineas', requirePermission('productos.ver'), marcaLineaController.getLineasByMarca);

// RUTAS DE LINEAS POR EMPRESA
router.get('/lineas/con-marca', requirePermission('productos.ver'), marcaLineaController.getLineasConMarca);
router.get('/lineas', requirePermission('productos.ver'), marcaLineaController.getAllLineas);
router.post('/lineas', requirePermission('catalogos.administrar'), marcaLineaController.createLinea);
router.put('/lineas/:id', requirePermission('catalogos.administrar'), marcaLineaController.updateLinea);
router.delete('/lineas/:id', requirePermission('catalogos.administrar'), marcaLineaController.deleteLinea);

module.exports = router;
