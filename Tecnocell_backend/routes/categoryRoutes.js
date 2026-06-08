const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');

const soloAdmin = [verifyToken, verifyRole('admin')];

// Rutas públicas (sin autenticación) - solo lectura
router.get('/', categoryController.getAllCategories);
router.get('/:categoryId/subcategories', categoryController.getSubcategories);

// Rutas protegidas (requieren autenticación) - escritura
router.post('/', ...soloAdmin, categoryController.createCategory);
router.post('/subcategories', ...soloAdmin, categoryController.createSubcategory);
router.put('/:id', ...soloAdmin, categoryController.updateCategory);
router.put('/subcategories/:id', ...soloAdmin, categoryController.updateSubcategory);
router.delete('/:id', ...soloAdmin, categoryController.deleteCategory);
router.delete('/subcategories/:id', ...soloAdmin, categoryController.deleteSubcategory);

module.exports = router;
