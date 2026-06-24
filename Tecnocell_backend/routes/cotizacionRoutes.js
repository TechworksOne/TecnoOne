const express = require('express');
const router = express.Router();
const cotizacionController = require('../controllers/cotizacionController');
const ventaController = require('../controllers/ventaController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePermission = require('../middleware/requirePermission');

/**
 * RUTAS DE COTIZACIONES
 * Todas las rutas requieren autenticacion y tenantScope.
 */

router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);

// Obtener todas las cotizaciones (con filtros opcionales)
// Query params: ?tipo=VENTA&estado=ENVIADA&cliente_id=1&desde=2025-01-01&hasta=2025-12-31&page=1&limit=20
router.get('/', requirePermission('cotizaciones.ver'), cotizacionController.getAllCotizaciones);

// Obtener estadísticas de cotizaciones
// Query params: ?desde=2025-01-01&hasta=2025-12-31
router.get('/estadisticas', requirePermission('cotizaciones.ver'), cotizacionController.getEstadisticas);

// Obtener cotizaciones próximas a vencer
// Query params: ?dias=7
router.get('/proximas-vencer', requirePermission('cotizaciones.ver'), cotizacionController.getCotizacionesProximasVencer);

// Obtener cotización por ID
router.get('/:id', requirePermission('cotizaciones.ver'), cotizacionController.getCotizacionById);

// Convertir cotización de venta en venta real
router.post(
  '/:id/convertir-venta',
  requirePermission('cotizaciones.editar'),
  requirePermission('ventas.crear'),
  (req, res) => {
    req.params.cotizacionId = req.params.id;
    return ventaController.createVentaFromQuote(req, res);
  }
);

// Crear nueva cotización (SIN autenticación para desarrollo)
router.post('/', requirePermission('cotizaciones.editar'), cotizacionController.createCotizacion);

// Actualizar cotización (SIN autenticación para desarrollo)
router.put('/:id', requirePermission('cotizaciones.editar'), cotizacionController.updateCotizacion);

// Cambiar estado de cotización (SIN autenticación para desarrollo)
router.patch('/:id/estado', requirePermission('cotizaciones.editar'), cotizacionController.cambiarEstado);

// Eliminar cotización (requiere autenticación)
router.delete('/:id', requirePermission('cotizaciones.editar'), cotizacionController.deleteCotizacion);

module.exports = router;
