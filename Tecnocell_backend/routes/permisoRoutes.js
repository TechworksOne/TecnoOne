const express = require('express');
const router = express.Router();
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePermission = require('../middleware/requirePermission');
const permisoController = require('../controllers/permisoController');

router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);

router.get('/mis-permisos', permisoController.getMisPermisos);
router.get('/mis-modulos', permisoController.getMisModulos);

const administrar = [
  verifyRole('ADMINISTRADOR', 'admin', 'superadmin'),
  requirePermission('permisos.administrar'),
];

router.get('/', ...administrar, permisoController.getCatalogo);
router.get('/roles', ...administrar, permisoController.getRoles);
router.get('/roles/:rolId', ...administrar, permisoController.getRolPermisos);
router.put('/roles/:rolId', ...administrar, permisoController.updateRolPermisos);

module.exports = router;
