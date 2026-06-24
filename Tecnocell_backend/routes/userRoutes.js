const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');

function legacyWriteDisabled(req, res) {
  return res.status(410).json({
    success: false,
    code: 'LEGACY_USER_WRITE_DISABLED',
    message:
      'Esta operación fue reemplazada por /api/admin/usuarios'
  });
}


// Todas las rutas requieren autenticación
router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);

// Obtener todos los usuarios (solo admin)
router.get('/', verifyRole('admin'), userController.getAllUsers);

// Obtener un usuario por ID
router.get('/:id', userController.getUserById);

// Crear nuevo usuario (solo admin)
router.post('/', legacyWriteDisabled);

// Actualizar usuario
router.put('/:id', legacyWriteDisabled);

// Eliminar usuario (solo admin)
router.delete('/:id', legacyWriteDisabled);

module.exports = router;
