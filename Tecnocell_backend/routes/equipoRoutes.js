// Routes para gestionar marcas y modelos de equipos
const express = require('express');
const router = express.Router();
const equipoController = require('../controllers/equipoController');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');

const soloAdmin = [verifyToken, verifyRole('admin')];

// Rutas para MARCAS
router.get('/marcas', equipoController.getAllMarcas);
router.post('/marcas', ...soloAdmin, equipoController.createMarca);
router.put('/marcas/:id', ...soloAdmin, equipoController.updateMarca);
router.delete('/marcas/:id', ...soloAdmin, equipoController.deleteMarca);

// Rutas para MODELOS
router.get('/modelos', equipoController.getAllModelos);
router.get('/marcas/:marca_id/modelos', equipoController.getModelosByMarca);
router.post('/modelos', ...soloAdmin, equipoController.createModelo);
router.put('/modelos/:id', ...soloAdmin, equipoController.updateModelo);
router.delete('/modelos/:id', ...soloAdmin, equipoController.deleteModelo);

module.exports = router;
