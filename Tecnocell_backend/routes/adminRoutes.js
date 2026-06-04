const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminUsuariosController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// ── Usuarios ──────────────────────────────────────────────────────────────
router.get('/usuarios', tenantScope, ctrl.getUsuarios);
router.get('/usuarios/:id', tenantScope, ctrl.getUsuarioById);
router.post('/usuarios', tenantScope, ctrl.upload.single('foto_perfil'), ctrl.createUsuario);
router.put('/usuarios/:id', tenantScope, ctrl.upload.single('foto_perfil'), ctrl.updateUsuario);
router.patch('/usuarios/:id/estado', tenantScope, ctrl.toggleEstado);
router.patch('/usuarios/:id/password', tenantScope, ctrl.changePassword);

// ── Roles ─────────────────────────────────────────────────────────────────
router.get('/roles', ctrl.getRoles);
router.post('/roles', ctrl.createRol);
router.put('/roles/:id', ctrl.updateRol);

module.exports = router;
