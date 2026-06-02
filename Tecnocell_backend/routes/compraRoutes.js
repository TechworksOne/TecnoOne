// Routes para gestionar compras de productos
const express = require('express');
const router = express.Router();
const compraController = require('../controllers/compraController');
const { verifyToken } = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Rutas de compras de PRODUCTOS
router.post('/productos', compraController.createCompraProductos);

// Rutas de compras de REPUESTOS
router.post('/repuestos', compraController.createCompraRepuestos);

// Rutas generales (ambos tipos)
router.get('/', compraController.getAllCompras);
router.get('/:id', compraController.getCompraById);
router.post('/:id/anular', compraController.anularCompra);

// Rutas de series
router.get('/series/producto/:productoId', compraController.getSeriesByProducto);

module.exports = router;
