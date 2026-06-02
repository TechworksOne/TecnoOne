const express = require('express');
const router = express.Router();
const stickerController = require('../controllers/stickerController');
const { verifyToken } = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Estadísticas
router.get('/estadisticas', stickerController.getEstadisticas);

// Obtener stickers disponibles (legacy)
router.get('/disponibles', stickerController.getStickersDisponibles);

// Obtener stickers asignados (legacy)
router.get('/asignados', stickerController.getStickersAsignados);

// ── Lotes ────────────────────────────────────────────────────────────────────
// IMPORTANTE: estas rutas van ANTES de /:id para evitar conflicto de parámetros

// Vista previa de lote (sin guardar)
router.post('/lotes/preview', stickerController.previewLote);

// Crear lote y guardar stickers
router.post('/lotes', stickerController.createLote);

// Listar lotes generados
router.get('/lotes', stickerController.getLotes);

// Listado de stickers con filtros
router.get('/lista', stickerController.getAllStickers);

// ── Acciones por ID ───────────────────────────────────────────────────────────

// Asignar sticker a reparación
router.post('/asignar', stickerController.asignarSticker);

// Anular sticker disponible
router.put('/:id/anular', stickerController.anularSticker);

// Liberar sticker (volver a disponible)
router.put('/:id/liberar', stickerController.liberarSticker);

module.exports = router;

