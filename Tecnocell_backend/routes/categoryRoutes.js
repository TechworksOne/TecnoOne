const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { verifyToken } = require('../middleware/authMiddleware');

// Rutas públicas (sin autenticación) - solo lectura
router.get('/', categoryController.getAllCategories);
router.get('/:categoryId/subcategories', categoryController.getSubcategories);

// Rutas protegidas (requieren autenticación) - escritura
router.post('/', verifyToken, categoryController.createCategory);
router.post('/subcategories', verifyToken, categoryController.createSubcategory);
router.put('/:id', verifyToken, categoryController.updateCategory);
router.put('/subcategories/:id', verifyToken, categoryController.updateSubcategory);
router.delete('/:id', verifyToken, categoryController.deleteCategory);
router.delete('/subcategories/:id', verifyToken, categoryController.deleteSubcategory);

module.exports = router;
