const express = require('express');
const router = express.Router();
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const auditoriaController = require('../controllers/auditoriaController');

router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);
router.use(verifyRole('ADMINISTRADOR', 'admin'));

router.get('/', auditoriaController.getLogs);
router.get('/:id', auditoriaController.getLogById);

module.exports = router;
