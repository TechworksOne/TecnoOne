const express = require('express');
const router = express.Router();
const stickerController = require('../controllers/stickerController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePlanModule = require('../middleware/requirePlanModule');
const requirePermission = require('../middleware/requirePermission');

// Todas las rutas requieren autenticación
router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);
router.use(requirePlanModule('taller_operativo'));

// Estadísticas
router.get('/estadisticas', requirePermission('stickers.ver'), stickerController.getEstadisticas);

// Obtener stickers disponibles (legacy)
router.get('/disponibles', requirePermission('stickers.ver'), stickerController.getStickersDisponibles);

// Obtener stickers asignados (legacy)
router.get('/asignados', requirePermission('stickers.ver'), stickerController.getStickersAsignados);

// ── Lotes ────────────────────────────────────────────────────────────────────
// IMPORTANTE: estas rutas van ANTES de /:id para evitar conflicto de parámetros

// Vista previa de lote (sin guardar)
router.post('/lotes/preview', requirePermission('stickers.administrar'), stickerController.previewLote);

// Crear lote y guardar stickers
router.post('/lotes', requirePermission('stickers.administrar'), stickerController.createLote);

// Listar lotes generados
router.get('/lotes', requirePermission('stickers.ver'), stickerController.getLotes);

// Listado de stickers con filtros
router.get('/lista', requirePermission('stickers.ver'), stickerController.getAllStickers);

// ── Acciones por ID ───────────────────────────────────────────────────────────

// Asignar sticker a reparación
router.post('/asignar', requirePermission('stickers.administrar'), stickerController.asignarSticker);

// Anular sticker disponible
router.put('/:id/anular', requirePermission('stickers.administrar'), stickerController.anularSticker);

// Liberar sticker (volver a disponible)
router.put('/:id/liberar', requirePermission('stickers.administrar'), stickerController.liberarSticker);

module.exports = router;

