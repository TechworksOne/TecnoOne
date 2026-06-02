const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminUsuariosController');
const { verifyToken } = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// ── Usuarios ──────────────────────────────────────────────────────────────
router.get('/usuarios', ctrl.getUsuarios);
router.get('/usuarios/:id', ctrl.getUsuarioById);
router.post('/usuarios', ctrl.upload.single('foto_perfil'), ctrl.createUsuario);
router.put('/usuarios/:id', ctrl.upload.single('foto_perfil'), ctrl.updateUsuario);
router.patch('/usuarios/:id/estado', ctrl.toggleEstado);
router.patch('/usuarios/:id/password', ctrl.changePassword);

// ── Roles ─────────────────────────────────────────────────────────────────
router.get('/roles', ctrl.getRoles);
router.post('/roles', ctrl.createRol);
router.put('/roles/:id', ctrl.updateRol);

module.exports = router;
