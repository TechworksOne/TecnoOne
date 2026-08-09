'use strict';

const router = require('express').Router();
const { verifyToken }         = require('../middleware/authMiddleware');
const tenantScope             = require('../middleware/tenantScope');
const checkEmpresaActiva      = require('../middleware/checkEmpresaActiva');
const requirePlanModule       = require('../middleware/requirePlanModule');
const requirePermission       = require('../middleware/requirePermission');
const branchScope             = require('../middleware/branchScope');
const requireBranchSpecific   = require('../middleware/requireBranchSpecific');
const controller              = require('../controllers/cajaSesionController');

router.use(verifyToken, tenantScope, checkEmpresaActiva, requirePlanModule('caja_bancos'), branchScope);

// Lectura: acepta specific y consolidated
router.get('/activa',    requirePermission('cajas.sesion.operar'), controller.getSesionActiva);
router.get('/historial', requirePermission('cajas.sesion.ver'), controller.getHistorial);

// Escritura: solo sucursal específica
router.post('/abrir',       requirePermission('cajas.sesion.operar'), requireBranchSpecific, controller.abrirSesion);
router.post('/:id/cerrar',  requirePermission('cajas.sesion.operar'), requireBranchSpecific, controller.cerrarSesion);

module.exports = router;
