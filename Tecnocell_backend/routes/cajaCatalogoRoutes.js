const router = require('express').Router();
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const branchScope = require('../middleware/branchScope');
const requirePermission = require('../middleware/requirePermission');
const controller = require('../controllers/cajaCatalogoController');

router.use(verifyToken, tenantScope, checkEmpresaActiva, branchScope);
router.get('/', requirePermission('cajas.ver'), controller.listar);
router.post('/', requirePermission('cajas.administrar'), controller.crear);
router.put('/:cajaId', requirePermission('cajas.administrar'), controller.editar);
router.patch('/:cajaId/estado', requirePermission('cajas.administrar'), controller.cambiarEstado);
router.delete('/:cajaId', requirePermission('cajas.administrar'), controller.eliminar);

module.exports = router;
