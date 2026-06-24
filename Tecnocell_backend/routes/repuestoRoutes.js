const express = require('express');
const router = express.Router();
const repuestoController = require('../controllers/repuestoController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePlanModule = require('../middleware/requirePlanModule');
const requirePermission = require('../middleware/requirePermission');

router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);
router.use(requirePlanModule('taller_operativo'));

// GET /api/repuestos/stock-bajo - Debe ir antes de /:id
router.get('/stock-bajo', requirePermission('repuestos.ver'), repuestoController.getStockBajo);

// GET /api/repuestos/estadisticas - Debe ir antes de /:id
router.get('/estadisticas', requirePermission('repuestos.ver'), repuestoController.getEstadisticas);

// ── Catálogos jerárquicos ─────────────────────────────────────────────────
// GET  /api/repuestos/tipos
router.get('/tipos', requirePermission('repuestos.ver'), repuestoController.getTiposRepuesto);
// POST /api/repuestos/tipos
router.post('/tipos', requirePermission('repuestos.administrar'), repuestoController.createTipoRepuesto);
// GET  /api/repuestos/marcas?tipo_id=ID
router.get('/marcas', requirePermission('repuestos.ver'), repuestoController.getMarcasRepuesto);
// POST /api/repuestos/marcas
router.post('/marcas', requirePermission('repuestos.administrar'), repuestoController.createMarcaRepuesto);
// GET  /api/repuestos/modelos?tipo_id=ID&marca_id=ID
router.get('/modelos', requirePermission('repuestos.ver'), repuestoController.getModelosRepuesto);
// POST /api/repuestos/modelos
router.post('/modelos', requirePermission('repuestos.administrar'), repuestoController.createModeloRepuesto);
// Alias de compatibilidad: /lineas → /modelos
router.get('/lineas', requirePermission('repuestos.ver'), repuestoController.getModelosRepuesto);
router.post('/lineas', requirePermission('repuestos.administrar'), repuestoController.createModeloRepuesto);
// ─────────────────────────────────────────────────────────────────────────

// GET /api/repuestos - Obtener todos los repuestos (con filtros)
router.get('/', requirePermission('repuestos.ver'), repuestoController.getAllRepuestos);

// POST /api/repuestos - Crear nuevo repuesto
router.post('/', requirePermission('repuestos.administrar'), repuestoController.uploadRepuestos, repuestoController.createRepuesto);

// GET /api/repuestos/:id - Obtener repuesto por ID
router.get('/:id', requirePermission('repuestos.ver'), repuestoController.getRepuestoById);

// PUT /api/repuestos/:id - Actualizar repuesto
router.put('/:id', requirePermission('repuestos.administrar'), repuestoController.uploadRepuestos, repuestoController.updateRepuesto);

// DELETE /api/repuestos/:id - Eliminar repuesto
router.delete('/:id', requirePermission('repuestos.administrar'), repuestoController.deleteRepuesto);

// GET /api/repuestos/:id/movimientos - Historial de movimientos de stock
router.get('/:id/movimientos', requirePermission('repuestos.ver'), repuestoController.getMovimientosRepuesto);

// POST /api/repuestos/:id/movimiento - Registrar movimiento de stock
router.post('/:id/movimiento', requirePermission('repuestos.administrar'), repuestoController.registrarMovimiento);

module.exports = router;
