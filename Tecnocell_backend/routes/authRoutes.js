const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');
const loginRateLimiter = require('../middleware/loginRateLimiter');

// Rutas públicas
router.post('/login', loginRateLimiter, authController.login);
router.post('/logout', authController.logout);
router.get('/verify', authController.verifyToken);

// Rutas protegidas
router.get('/me', verifyToken, authController.getMe);
router.put('/me/perfil', verifyToken, authController.uploadMe.single('foto_perfil'), authController.updateMePerfil);

module.exports = router;
