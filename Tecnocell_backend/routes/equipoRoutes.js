// Routes para gestionar marcas y modelos de equipos
const express = require('express');
const router = express.Router();
const equipoController = require('../controllers/equipoController');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');

router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);

const soloAdmin = [verifyRole('admin', 'ADMINISTRADOR')];

// Rutas para MARCAS por empresa
router.get('/marcas', equipoController.getAllMarcas);
router.post('/marcas', ...soloAdmin, equipoController.createMarca);
router.put('/marcas/:id', ...soloAdmin, equipoController.updateMarca);
router.delete('/marcas/:id', ...soloAdmin, equipoController.deleteMarca);

// Rutas para MODELOS por empresa
router.get('/modelos', equipoController.getAllModelos);
router.get('/marcas/:marca_id/modelos', equipoController.getModelosByMarca);
router.post('/modelos', ...soloAdmin, equipoController.createModelo);
router.put('/modelos/:id', ...soloAdmin, equipoController.updateModelo);
router.delete('/modelos/:id', ...soloAdmin, equipoController.deleteModelo);

module.exports = router;
