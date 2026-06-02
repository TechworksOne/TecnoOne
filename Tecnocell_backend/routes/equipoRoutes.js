// Routes para gestionar marcas y modelos de equipos
const express = require('express');
const router = express.Router();
const equipoController = require('../controllers/equipoController');

// Rutas para MARCAS
router.get('/marcas', equipoController.getAllMarcas);
router.post('/marcas', equipoController.createMarca);
router.put('/marcas/:id', equipoController.updateMarca);
router.delete('/marcas/:id', equipoController.deleteMarca);

// Rutas para MODELOS
router.get('/modelos', equipoController.getAllModelos);
router.get('/marcas/:marca_id/modelos', equipoController.getModelosByMarca);
router.post('/modelos', equipoController.createModelo);
router.put('/modelos/:id', equipoController.updateModelo);
router.delete('/modelos/:id', equipoController.deleteModelo);

module.exports = router;
