const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const auditoriaController = require('../controllers/auditoriaController');
const requirePermission = require('../middleware/requirePermission');

router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);
router.use(requirePermission('auditoria.ver'));

router.get('/', auditoriaController.getLogs);
router.get('/:id', auditoriaController.getLogById);

module.exports = router;
