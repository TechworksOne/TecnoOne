const express = require('express');
const router = express.Router();
const agendaController = require('../controllers/agendaController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const checkEmpresaActiva = require('../middleware/checkEmpresaActiva');
const requirePlanModule = require('../middleware/requirePlanModule');
const requirePermission = require('../middleware/requirePermission');

router.use(verifyToken);
router.use(tenantScope);
router.use(checkEmpresaActiva);
router.use(requirePlanModule('taller_operativo'));

// GET /api/agenda/entregas  — listado de reparaciones con fecha de entrega programada
router.get('/entregas', requirePermission('agenda.ver'), agendaController.getEntregas);

// CRUD /api/agenda/eventos  — eventos y notas libres del calendario
router.get('/usuarios', requirePermission('agenda.ver'), agendaController.getUsuariosSimple);
router.get('/eventos', requirePermission('agenda.ver'), agendaController.getEventos);
router.post('/eventos', requirePermission('agenda.editar'), agendaController.createEvento);
router.put('/eventos/:id', requirePermission('agenda.editar'), agendaController.updateEvento);
router.delete('/eventos/:id', requirePermission('agenda.editar'), agendaController.deleteEvento);

module.exports = router;
