const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const empresaController = require('../controllers/empresaController');
const requirePermission = require('../middleware/requirePermission');
const requirePlanModule = require('../middleware/requirePlanModule');

router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);

router.get('/me', empresaController.getEmpresaMe);
const editarEmpresa = [
  requirePlanModule('configuracion'),
  requirePermission('empresa.editar'),
];
router.put('/me', ...editarEmpresa, empresaController.updateEmpresaMe);
router.post('/logo', ...editarEmpresa, empresaController.uploadLogo.single('logo'), empresaController.updateEmpresaLogo);
router.put('/logo', ...editarEmpresa, empresaController.uploadLogo.single('logo'), empresaController.updateEmpresaLogo);

module.exports = router;
