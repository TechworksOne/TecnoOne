const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { verifySuperAdmin } = require('../middleware/superAdminMiddleware');
const controller = require('../controllers/superAdminController');
const subscriptionController = require('../controllers/subscriptionController');
const planController = require('../controllers/planController');
const sucursalController = require('../controllers/sucursalController');
const cajaCatalogoController = require('../controllers/cajaCatalogoController');

router.use(verifyToken);
router.use(verifySuperAdmin);

router.get('/me', controller.getMe);
router.get('/planes', planController.getPlanes);
router.get('/planes/:id', planController.getPlanById);
router.get('/empresas', controller.getEmpresas);
router.get('/empresas/:id/consumo-plan', planController.getEmpresaConsumoPlan);
router.get('/empresas/:id', controller.getEmpresaById);
router.post('/empresas', controller.createEmpresa);
router.put('/empresas/:id', controller.updateEmpresa);
router.patch('/empresas/:id/estado', controller.updateEmpresaEstado);
router.post('/empresas/:id/suspender', subscriptionController.suspenderEmpresa);
router.post('/empresas/:id/cancelar', subscriptionController.cancelarEmpresa);
router.post('/empresas/:id/reactivar', subscriptionController.reactivarEmpresa);
router.post('/empresas/:id/administrador', controller.createEmpresaAdministrador);
router.get('/empresas/:id/sucursales', sucursalController.listar);
router.post('/empresas/:id/sucursales', sucursalController.crear);
router.put('/empresas/:id/sucursales/:sucursalId', sucursalController.editar);
router.patch('/empresas/:id/sucursales/:sucursalId/estado', sucursalController.cambiarEstado);
router.get('/empresas/:empresaId/cajas', cajaCatalogoController.listar);
router.post('/empresas/:empresaId/cajas', cajaCatalogoController.crear);
router.put('/empresas/:empresaId/cajas/:cajaId', cajaCatalogoController.editar);
router.patch('/empresas/:empresaId/cajas/:cajaId/estado', cajaCatalogoController.cambiarEstado);
router.delete('/empresas/:empresaId/cajas/:cajaId', cajaCatalogoController.eliminar);
router.get('/empresas/:empresaId/usuarios/:userId/sucursales', sucursalController.listarUsuario);
router.put('/empresas/:empresaId/usuarios/:userId/sucursales', sucursalController.actualizarUsuario);
router.get('/empresas/:id/suscripcion', subscriptionController.getSuscripcion);
router.patch('/empresas/:id/suscripcion', subscriptionController.updateSuscripcion);
router.patch(
  '/empresas/:id/suscripcion/plan',
  subscriptionController.cambiarPlanInmediato
);

router.patch(
  '/empresas/:id/suscripcion/plan/programar',
  subscriptionController.programarCambioPlan
);

router.delete(
  '/empresas/:id/suscripcion/plan/programado',
  subscriptionController.cancelarCambioPlanProgramado
);


router.post('/empresas/:id/suscripcion/renovar', subscriptionController.renovarSuscripcion);
router.get('/empresas/:id/suscripcion/historial', subscriptionController.getHistorial);
router.post('/suscripciones/procesar-pendientes', subscriptionController.procesarPendientes);

module.exports = router;
