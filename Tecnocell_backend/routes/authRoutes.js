const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

// Rutas públicas
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/verify', authController.verifyToken);

// Rutas protegidas
router.get('/me', verifyToken, authController.getMe);
router.put('/me/perfil', verifyToken, authController.uploadMe.single('foto_perfil'), authController.updateMePerfil);

module.exports = router;
