const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePermission = require('../middleware/requirePermission');
const requirePlanModule = require('../middleware/requirePlanModule');

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
router.use(requirePlanModule('usuarios'));

// Obtener todos los usuarios (solo admin)
router.get('/', requirePermission('usuarios.administrar'), userController.getAllUsers);

// Obtener un usuario por ID
router.get('/:id', requirePermission('usuarios.administrar'), userController.getUserById);

// Crear nuevo usuario (solo admin)
router.post('/', legacyWriteDisabled);

// Actualizar usuario
router.put('/:id', legacyWriteDisabled);

// Eliminar usuario (solo admin)
router.delete('/:id', legacyWriteDisabled);

module.exports = router;
