const router = require('express').Router();
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const branchScope = require('../middleware/branchScope');
const requireBranchSpecific = require('../middleware/requireBranchSpecific');
const requirePermission = require('../middleware/requirePermission');
const controller = require('../controllers/cajaCatalogoController');

router.use(verifyToken, tenantScope, checkEmpresaActiva, branchScope);
router.get('/', requirePermission('cajas.ver'), controller.listar);
router.post('/', requirePermission('cajas.administrar'), requireBranchSpecific, controller.crear);
router.put('/:cajaId', requirePermission('cajas.administrar'), requireBranchSpecific, controller.editar);
router.patch('/:cajaId/estado', requirePermission('cajas.administrar'), requireBranchSpecific, controller.cambiarEstado);
router.delete('/:cajaId', requirePermission('cajas.administrar'), requireBranchSpecific, controller.eliminar);

module.exports = router;
