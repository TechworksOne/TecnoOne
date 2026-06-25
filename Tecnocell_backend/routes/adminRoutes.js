const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminUsuariosController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePermission = require('../middleware/requirePermission');
const requirePlanModule = require('../middleware/requirePlanModule');

// Todas las rutas requieren autenticación
router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);
router.use(requirePlanModule('usuarios'));
router.use(requirePermission('usuarios.administrar'));

// ── Usuarios ──────────────────────────────────────────────────────────────
router.get('/usuarios', ctrl.getUsuarios);
router.get('/usuarios/:id', ctrl.getUsuarioById);
router.post('/usuarios', ctrl.upload.single('foto_perfil'), ctrl.createUsuario);
router.put('/usuarios/:id', ctrl.upload.single('foto_perfil'), ctrl.updateUsuario);
router.patch('/usuarios/:id/estado', ctrl.toggleEstado);
router.patch('/usuarios/:id/password', ctrl.changePassword);
router.delete('/usuarios/:id', ctrl.deleteUsuario);

// ── Roles ─────────────────────────────────────────────────────────────────
router.get('/roles', ctrl.getRoles);
router.post('/roles', ctrl.createRol);
router.put('/roles/:id', ctrl.updateRol);

module.exports = router;
