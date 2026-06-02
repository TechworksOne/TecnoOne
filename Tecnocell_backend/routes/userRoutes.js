const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Obtener todos los usuarios (solo admin)
router.get('/', verifyRole('admin'), userController.getAllUsers);

// Obtener un usuario por ID
router.get('/:id', userController.getUserById);

// Crear nuevo usuario (solo admin)
router.post('/', verifyRole('admin'), userController.createUser);

// Actualizar usuario
router.put('/:id', userController.updateUser);

// Eliminar usuario (solo admin)
router.delete('/:id', verifyRole('admin'), userController.deleteUser);

module.exports = router;
