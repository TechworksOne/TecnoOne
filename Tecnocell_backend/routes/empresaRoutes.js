const express = require('express');
const router = express.Router();

const { verifyToken, verifyRole } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const empresaController = require('../controllers/empresaController');

router.use(verifyToken);
router.use(tenantScope);

router.get('/me', empresaController.getEmpresaMe);
router.put('/me', verifyRole('admin', 'ADMINISTRADOR'), empresaController.updateEmpresaMe);

module.exports = router;
