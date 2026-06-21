const db = require('../config/database');

const ESTADOS_PERMITIDOS = new Set(['activa', 'prueba', 'demo']);

function empresaInactivaResponse(res, code = 'EMPRESA_INACTIVA') {
  return res.status(403).json({
    success: false,
    code,
    message: 'La empresa no se encuentra activa. Contacta al administrador de TecnoOne.',
  });
}

async function checkEmpresaActiva(req, res, next) {
  try {
    if (req.tenant?.isSuperadmin === true) {
      return next();
    }

    const empresaId = req.tenant?.empresa_id;

    if (!empresaId) {
      return empresaInactivaResponse(res);
    }

    const [rows] = await db.query(
      `
        SELECT
          id,
          nombre,
          slug,
          estado,
          plan,
          DATE_FORMAT(fecha_vencimiento, '%Y-%m-%d') AS fecha_vencimiento,
          CASE
            WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento < CURDATE()
            THEN 1
            ELSE 0
          END AS esta_vencida
        FROM empresas
        WHERE id = ?
        LIMIT 1
      `,
      [empresaId]
    );

    if (rows.length === 0) {
      return empresaInactivaResponse(res);
    }

    const empresa = rows[0];
    const estado = String(empresa.estado || '').toLowerCase();

    if (!ESTADOS_PERMITIDOS.has(estado)) {
      return empresaInactivaResponse(res, 'EMPRESA_INACTIVA');
    }

    if (Number(empresa.esta_vencida) === 1) {
      return empresaInactivaResponse(res, 'EMPRESA_VENCIDA');
    }

    req.empresa = {
      id: empresa.id,
      nombre: empresa.nombre,
      slug: empresa.slug,
      estado: empresa.estado,
      plan: empresa.plan,
      fecha_vencimiento: empresa.fecha_vencimiento,
    };

    return next();
  } catch (error) {
    console.error('Error en checkEmpresaActiva:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verificando estado de la empresa',
    });
  }
}

module.exports = checkEmpresaActiva;
