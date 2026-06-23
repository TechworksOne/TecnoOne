const db = require('../config/database');
const planAccess = require('../services/planAccessService');

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

exports.getPlanes = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         p.*,
         (
           SELECT COUNT(*)
           FROM plan_modulos pm
           WHERE pm.plan_id = p.id
             AND pm.habilitado = 1
         ) AS total_modulos,
         (
           SELECT COUNT(*)
           FROM suscripciones s
           WHERE s.plan_id = p.id
         ) AS total_empresas
       FROM planes p
       ORDER BY p.orden, p.id`
    );

    const planes = rows.map(row => ({
      ...planAccess.normalizePlan(row),
      total_modulos: Number(row.total_modulos || 0),
      total_empresas: Number(row.total_empresas || 0),
    }));

    return res.json({
      success: true,
      data: planes,
    });
  } catch (error) {
    console.error('getPlanes error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al cargar los planes',
    });
  }
};

exports.getPlanById = async (req, res) => {
  try {
    const planId = parseId(req.params.id);

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: 'Identificador de plan no válido',
      });
    }

    const plan = await planAccess.obtenerPlanPorId(planId);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan no encontrado',
      });
    }

    const modulos = await planAccess.obtenerModulosPlan(planId);

    const [usageRows] = await db.query(
      `SELECT COUNT(*) AS total_empresas
       FROM suscripciones
       WHERE plan_id = ?`,
      [planId]
    );

    return res.json({
      success: true,
      data: {
        ...plan,
        modulos,
        total_empresas: Number(
          usageRows[0]?.total_empresas || 0
        ),
      },
    });
  } catch (error) {
    console.error('getPlanById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al cargar el plan',
    });
  }
};

exports.getEmpresaConsumoPlan = async (req, res) => {
  try {
    const empresaId = parseId(req.params.id);

    if (!empresaId) {
      return res.status(400).json({
        success: false,
        message: 'Identificador de empresa no válido',
      });
    }

    const resumen =
      await planAccess.obtenerResumenPlanEmpresa(empresaId);

    if (!resumen) {
      return res.status(404).json({
        success: false,
        message: 'Empresa o suscripción no encontrada',
      });
    }

    return res.json({
      success: true,
      data: resumen,
    });
  } catch (error) {
    console.error('getEmpresaConsumoPlan error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al cargar el consumo del plan',
    });
  }
};
