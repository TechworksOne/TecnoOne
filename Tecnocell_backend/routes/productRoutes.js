const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const productController = require('../controllers/productController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const productFolder = req.params.id ? String(req.params.id) : '_tmp';
    const uploadPath = path.join(__dirname, '..', 'uploads', 'productos', productFolder);

    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const safeName = `img_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 3
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Solo se permiten archivos de imagen'));
    }

    cb(null, true);
  }
});

const uploadImagenesProducto = (req, res, next) => {
  upload.array('imagenes', 3)(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Error al subir imágenes del producto'
      });
    }

    next();
  });
};

router.use(verifyToken);
router.use(tenantScope);

router.get('/search', productController.searchProducts);
router.get('/alerts/critical-stock', productController.getCriticalStockProducts);
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);
router.get('/:id/kardex', productController.getProductKardex);

router.post('/', uploadImagenesProducto, productController.createProduct);
router.put('/:id', uploadImagenesProducto, productController.updateProduct);
router.patch('/:id/stock', productController.adjustStock);
router.delete('/:id', productController.deleteProduct);

module.exports = router;
