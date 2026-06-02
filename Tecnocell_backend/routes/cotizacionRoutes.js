const express = require('express');
const router = express.Router();
const cotizacionController = require('../controllers/cotizacionController');
const { verifyToken } = require('../middleware/authMiddleware');

/**
 * RUTAS DE COTIZACIONES
 * GET: Sin autenticación (lectura pública)
 * POST/PUT/DELETE: Con autenticación (escritura protegida)
 */

// Obtener todas las cotizaciones (con filtros opcionales)
// Query params: ?tipo=VENTA&estado=ENVIADA&cliente_id=1&desde=2025-01-01&hasta=2025-12-31&page=1&limit=20
router.get('/', cotizacionController.getAllCotizaciones);

// Obtener estadísticas de cotizaciones
// Query params: ?desde=2025-01-01&hasta=2025-12-31
router.get('/estadisticas', cotizacionController.getEstadisticas);

// Obtener cotizaciones próximas a vencer
// Query params: ?dias=7
router.get('/proximas-vencer', cotizacionController.getCotizacionesProximasVencer);

// Obtener cotización por ID
router.get('/:id', cotizacionController.getCotizacionById);

// Crear nueva cotización (SIN autenticación para desarrollo)
router.post('/', cotizacionController.createCotizacion);

// Actualizar cotización (SIN autenticación para desarrollo)
router.put('/:id', cotizacionController.updateCotizacion);

// Cambiar estado de cotización (SIN autenticación para desarrollo)
router.patch('/:id/estado', cotizacionController.cambiarEstado);

// Eliminar cotización (requiere autenticación)
router.delete('/:id', verifyToken, cotizacionController.deleteCotizacion);

module.exports = router;
