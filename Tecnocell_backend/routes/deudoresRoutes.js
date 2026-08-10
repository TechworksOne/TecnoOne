const express = require('express');
const router = express.Router();
const deudoresController = require('../controllers/deudoresController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePermission = require('../middleware/requirePermission');
const requirePlanModule = require('../middleware/requirePlanModule');
const branchScope = require('../middleware/branchScope');
const requireBranchSpecific = require('../middleware/requireBranchSpecific');

router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);
router.use(requirePlanModule('deudores_pagos'));
router.use(branchScope);

router.get('/', requirePermission('deudores.ver'), deudoresController.getDeudores);
router.get('/resumen', requirePermission('deudores.ver'), deudoresController.getResumen);
router.get('/buscar/reparaciones', requirePermission('deudores.ver'), deudoresController.searchReparaciones);
router.get('/:id', requirePermission('deudores.ver'), deudoresController.getDeudorById);
router.post('/', requirePermission('deudores.administrar'), requireBranchSpecific, deudoresController.createDeudor);
router.post('/:id/pago', requirePermission('deudores.administrar'), requireBranchSpecific, deudoresController.registrarPago);
router.post('/:id/anular', requirePermission('deudores.administrar'), requireBranchSpecific, deudoresController.anularDeudor);

module.exports = router;
