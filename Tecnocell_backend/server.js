const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Cargar variables de entorno
dotenv.config();

const app = express();

// Necesario para obtener la IP real detrás de Nginx/Docker en producción
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos desde /uploads (para desarrollo local)
// En producción con Nginx, esto no será necesario
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rutas
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const customerRoutes = require('./routes/customerRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const interactionRoutes = require('./routes/interactionRoutes');
const cotizacionRoutes = require('./routes/cotizacionRoutes');
const repuestoRoutes = require('./routes/repuestoRoutes');
const marcaLineaRoutes = require('./routes/marcaLineaRoutes');
const ventaRoutes = require('./routes/ventaRoutes');
const equipoRoutes = require('./routes/equipoRoutes');
const compraRoutes = require('./routes/compraRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const reparacionRoutes = require('./routes/reparacionRoutes');
const flujoReparacionRoutes = require('./routes/flujoReparacionRoutes');
const checkEquipoRoutes = require('./routes/checkEquipoRoutes');
const cajaRoutes = require('./routes/cajaRoutes');
const stickerRoutes = require('./routes/stickerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reportesRoutes = require('./routes/reportesRoutes');
const deudoresRoutes = require('./routes/deudoresRoutes');
const agendaRoutes = require('./routes/agendaRoutes');
const otRoutes = require('./routes/otRoutes');
const tarjetaCreditoRoutes = require('./routes/tarjetaCreditoRoutes');
const empresaRoutes = require('./routes/empresaRoutes');
const auditoriaRoutes = require('./routes/auditoriaRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/cotizaciones', cotizacionRoutes);
app.use('/api/repuestos', repuestoRoutes);
app.use('/api/ventas', ventaRoutes);
app.use('/api/equipos', equipoRoutes);
app.use('/api/compras', compraRoutes);
app.use('/api/reparaciones', reparacionRoutes);
app.use('/api/flujo-reparaciones', flujoReparacionRoutes);
app.use('/api/check-equipo', checkEquipoRoutes);
app.use('/api/caja', cajaRoutes);
app.use('/api/stickers', stickerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/deudores', deudoresRoutes);
app.use('/api/agenda', agendaRoutes);
app.use('/api/ot', otRoutes);
app.use('/api/tarjetas-credito', tarjetaCreditoRoutes);
app.use('/api/empresa', empresaRoutes);
app.use('/api/auditoria', auditoriaRoutes);
// app.use('/api/dashboard', dashboardRoutes);
app.use('/api', marcaLineaRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ message: 'API TecnoOne funcionando correctamente' });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Error en el servidor', error: err.message });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
