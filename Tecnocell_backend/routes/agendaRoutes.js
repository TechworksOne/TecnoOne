const express = require('express');
const router = express.Router();
const agendaController = require('../controllers/agendaController');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');

router.use(verifyToken);

// GET /api/agenda/entregas  — listado de reparaciones con fecha de entrega programada
router.get('/entregas', tenantScope, agendaController.getEntregas);

// CRUD /api/agenda/eventos  — eventos y notas libres del calendario
router.get('/usuarios',     agendaController.getUsuariosSimple);
router.get('/eventos',      agendaController.getEventos);
router.post('/eventos',     agendaController.createEvento);
router.put('/eventos/:id',  agendaController.updateEvento);
router.delete('/eventos/:id', agendaController.deleteEvento);

module.exports = router;
