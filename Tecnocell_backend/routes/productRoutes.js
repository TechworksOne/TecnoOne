const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const productController = require('../controllers/productController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePermission = require('../middleware/requirePermission');
const { imageFileFilter, getSafeImageExtension } = require('../utils/uploadSecurity');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const productFolder = req.params.id ? String(req.params.id) : '_tmp';
    const uploadPath = path.join(__dirname, '..', 'uploads', 'productos', productFolder);

    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = getSafeImageExtension(file);
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
  fileFilter: imageFileFilter
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
router.use(checkEmpresaActiva);

router.get('/search', requirePermission('productos.ver'), productController.searchProducts);
router.get('/alerts/critical-stock', requirePermission('productos.ver'), productController.getCriticalStockProducts);
router.get('/', requirePermission('productos.ver'), productController.getAllProducts);
router.get('/:id', requirePermission('productos.ver'), productController.getProductById);
router.get('/:id/kardex', requirePermission('productos.ver'), productController.getProductKardex);

router.post('/', requirePermission('productos.administrar'), uploadImagenesProducto, productController.createProduct);
router.put('/:id', requirePermission('productos.administrar'), uploadImagenesProducto, productController.updateProduct);
router.patch('/:id/stock', requirePermission('productos.administrar'), productController.adjustStock);
router.delete('/:id', requirePermission('productos.administrar'), productController.deleteProduct);

module.exports = router;
