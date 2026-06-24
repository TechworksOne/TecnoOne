const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePermission = require('../middleware/requirePermission');

router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);


// Rutas privadas de lectura para catálogos por empresa
router.get('/', requirePermission('productos.ver'), categoryController.getAllCategories);
router.get('/:categoryId/subcategories', requirePermission('productos.ver'), categoryController.getSubcategories);

// Rutas protegidas de escritura por empresa
router.post('/', requirePermission('catalogos.administrar'), categoryController.createCategory);
router.post('/subcategories', requirePermission('catalogos.administrar'), categoryController.createSubcategory);
router.put('/:id', requirePermission('catalogos.administrar'), categoryController.updateCategory);
router.put('/subcategories/:id', requirePermission('catalogos.administrar'), categoryController.updateSubcategory);
router.delete('/:id', requirePermission('catalogos.administrar'), categoryController.deleteCategory);
router.delete('/subcategories/:id', requirePermission('catalogos.administrar'), categoryController.deleteSubcategory);

module.exports = router;
