const express = require('express');
const router = express.Router();
const marcaLineaController = require('../controllers/marcaLineaController');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');

router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);

const soloAdmin = [verifyRole('admin', 'ADMINISTRADOR')];

// RUTAS DE MARCAS POR EMPRESA
router.get('/marcas/con-lineas', marcaLineaController.getMarcasConLineas);
router.get('/marcas', marcaLineaController.getAllMarcas);
router.post('/marcas', ...soloAdmin, marcaLineaController.createMarca);
router.get('/marcas/:id', marcaLineaController.getMarcaById);
router.put('/marcas/:id', ...soloAdmin, marcaLineaController.updateMarca);
router.delete('/marcas/:id', ...soloAdmin, marcaLineaController.deleteMarca);
router.get('/marcas/:id/lineas', marcaLineaController.getLineasByMarca);

// RUTAS DE LINEAS POR EMPRESA
router.get('/lineas/con-marca', marcaLineaController.getLineasConMarca);
router.get('/lineas', marcaLineaController.getAllLineas);
router.post('/lineas', ...soloAdmin, marcaLineaController.createLinea);
router.put('/lineas/:id', ...soloAdmin, marcaLineaController.updateLinea);
router.delete('/lineas/:id', ...soloAdmin, marcaLineaController.deleteLinea);

module.exports = router;
