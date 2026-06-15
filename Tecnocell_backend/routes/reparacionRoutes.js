// Routes para gestionar reparaciones
const express = require('express');
const router = express.Router();
const reparacionController = require('../controllers/reparacionController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');

router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);

// Rutas CRUD
router.get('/', reparacionController.getAllReparaciones);
router.get('/:id/historial-completo', reparacionController.getHistorialCompleto);
router.get('/:id', reparacionController.getReparacionById);
router.post('/', reparacionController.createReparacion);

// Actualizar solo el estado (simple) — PUT usa JSON plano desde el Kanban
router.put('/:id/estado', reparacionController.updateEstadoReparacion);

// Actualizar prioridad
router.patch('/:id/prioridad', reparacionController.updatePrioridad);

// Registrar pago de saldo pendiente
router.post('/:id/pago', reparacionController.registrarPagoSaldo);

// Cancelar reparación
router.patch('/:id/cancelar', reparacionController.cancelarReparacion);

// Completar reparación (repuestos + regalías + pago final, con imágenes opcionales)
router.post(
  '/:id/completar',
  reparacionController.uploadMiddleware,
  reparacionController.completarReparacion
);

// Asignación técnica (OT)
const otController = require('../controllers/otController');
router.patch('/:id/asignar-tecnico', otController.asignarTecnico);
router.delete('/:id/asignar-tecnico', otController.quitarAsignacion);

// Fecha de entrega programada (Agenda)
const agendaController = require('../controllers/agendaController');
router.patch('/:id/fecha-entrega', agendaController.patchFechaEntrega);
router.delete('/:id/fecha-entrega', agendaController.deleteFechaEntrega);

// Cambiar estado con imágenes — POST usa FormData desde ModalActualizarEstado
router.post(
  '/:id/estado',
  reparacionController.uploadMiddleware,
  reparacionController.changeRepairState
);

// Descargar contrato PDF generado al crear la reparación
router.get('/:id/contrato', reparacionController.descargarContrato);

// Subir imagen individual (opcional)
router.post(
  '/upload',
  reparacionController.uploadMiddleware,
  (req, res) => {
    const files = req.files;
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se subieron archivos'
      });
    }
    
    const urls = files.map(file => ({
      filename: file.filename,
      url_path: `/uploads/reparaciones/${req.body.repairId || 'temp'}/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype
    }));
    
    res.json({
      success: true,
      data: urls
    });
  }
);

module.exports = router;
