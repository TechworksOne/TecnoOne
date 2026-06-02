const express = require('express');
const router = express.Router();
const marcaLineaController = require('../controllers/marcaLineaController');
const { verifyToken } = require('../middleware/authMiddleware');

// Autenticación deshabilitada temporalmente para desarrollo
// router.use(verifyToken);

// ============================================
// RUTAS DE MARCAS
// ============================================

// GET /api/marcas/con-lineas - Debe ir antes de /:id
router.get('/marcas/con-lineas', marcaLineaController.getMarcasConLineas);

// GET /api/marcas - Obtener todas las marcas
router.get('/marcas', marcaLineaController.getAllMarcas);

// POST /api/marcas - Crear nueva marca
router.post('/marcas', marcaLineaController.createMarca);

// GET /api/marcas/:id - Obtener marca por ID
router.get('/marcas/:id', marcaLineaController.getMarcaById);

// PUT /api/marcas/:id - Actualizar marca
router.put('/marcas/:id', marcaLineaController.updateMarca);

// DELETE /api/marcas/:id - Eliminar marca
router.delete('/marcas/:id', marcaLineaController.deleteMarca);

// GET /api/marcas/:id/lineas - Obtener líneas de una marca
router.get('/marcas/:id/lineas', marcaLineaController.getLineasByMarca);

// ============================================
// RUTAS DE LÍNEAS
// ============================================

// GET /api/lineas/con-marca - Debe ir antes de /:id
router.get('/lineas/con-marca', marcaLineaController.getLineasConMarca);

// GET /api/lineas - Obtener todas las líneas
router.get('/lineas', marcaLineaController.getAllLineas);

// POST /api/lineas - Crear nueva línea
router.post('/lineas', marcaLineaController.createLinea);

// PUT /api/lineas/:id - Actualizar línea
router.put('/lineas/:id', marcaLineaController.updateLinea);

// DELETE /api/lineas/:id - Eliminar línea
router.delete('/lineas/:id', marcaLineaController.deleteLinea);

module.exports = router;
