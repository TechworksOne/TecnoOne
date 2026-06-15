const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');

router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);

const soloAdmin = [verifyRole('admin', 'ADMINISTRADOR')];

// Rutas privadas de lectura para catálogos por empresa
router.get('/', categoryController.getAllCategories);
router.get('/:categoryId/subcategories', categoryController.getSubcategories);

// Rutas protegidas de escritura por empresa
router.post('/', ...soloAdmin, categoryController.createCategory);
router.post('/subcategories', ...soloAdmin, categoryController.createSubcategory);
router.put('/:id', ...soloAdmin, categoryController.updateCategory);
router.put('/subcategories/:id', ...soloAdmin, categoryController.updateSubcategory);
router.delete('/:id', ...soloAdmin, categoryController.deleteCategory);
router.delete('/subcategories/:id', ...soloAdmin, categoryController.deleteSubcategory);

module.exports = router;
