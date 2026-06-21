const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { verifySuperAdmin } = require('../middleware/superAdminMiddleware');
const controller = require('../controllers/superAdminController');

router.use(verifyToken);
router.use(verifySuperAdmin);

router.get('/me', controller.getMe);
router.get('/empresas', controller.getEmpresas);
router.get('/empresas/:id', controller.getEmpresaById);
router.post('/empresas', controller.createEmpresa);
router.put('/empresas/:id', controller.updateEmpresa);
router.patch('/empresas/:id/estado', controller.updateEmpresaEstado);
router.post('/empresas/:id/administrador', controller.createEmpresaAdministrador);

module.exports = router;
