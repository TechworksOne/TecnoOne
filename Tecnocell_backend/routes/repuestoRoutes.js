const express = require('express');
const router = express.Router();
const repuestoController = require('../controllers/repuestoController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePlanModule = require('../middleware/requirePlanModule');

router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);
router.use(requirePlanModule('taller_operativo'));

// GET /api/repuestos/stock-bajo - Debe ir antes de /:id
router.get('/stock-bajo', repuestoController.getStockBajo);

// GET /api/repuestos/estadisticas - Debe ir antes de /:id
router.get('/estadisticas', repuestoController.getEstadisticas);

// ── Catálogos jerárquicos ─────────────────────────────────────────────────
// GET  /api/repuestos/tipos
router.get('/tipos', repuestoController.getTiposRepuesto);
// POST /api/repuestos/tipos
router.post('/tipos', repuestoController.createTipoRepuesto);
// GET  /api/repuestos/marcas?tipo_id=ID
router.get('/marcas', repuestoController.getMarcasRepuesto);
// POST /api/repuestos/marcas
router.post('/marcas', repuestoController.createMarcaRepuesto);
// GET  /api/repuestos/modelos?tipo_id=ID&marca_id=ID
router.get('/modelos', repuestoController.getModelosRepuesto);
// POST /api/repuestos/modelos
router.post('/modelos', repuestoController.createModeloRepuesto);
// Alias de compatibilidad: /lineas → /modelos
router.get('/lineas', repuestoController.getModelosRepuesto);
router.post('/lineas', repuestoController.createModeloRepuesto);
// ─────────────────────────────────────────────────────────────────────────

// GET /api/repuestos - Obtener todos los repuestos (con filtros)
router.get('/', repuestoController.getAllRepuestos);

// POST /api/repuestos - Crear nuevo repuesto
router.post('/', repuestoController.uploadRepuestos, repuestoController.createRepuesto);

// GET /api/repuestos/:id - Obtener repuesto por ID
router.get('/:id', repuestoController.getRepuestoById);

// PUT /api/repuestos/:id - Actualizar repuesto
router.put('/:id', repuestoController.uploadRepuestos, repuestoController.updateRepuesto);

// DELETE /api/repuestos/:id - Eliminar repuesto
router.delete('/:id', repuestoController.deleteRepuesto);

// GET /api/repuestos/:id/movimientos - Historial de movimientos de stock
router.get('/:id/movimientos', repuestoController.getMovimientosRepuesto);

// POST /api/repuestos/:id/movimiento - Registrar movimiento de stock
router.post('/:id/movimiento', repuestoController.registrarMovimiento);

module.exports = router;
