const db = require('../config/database');
const { parsePagination } = require('../utils/pagination');

function parseJson(value) {
  if (!value || typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch (_) {
    return value;
  }
}

function isValidDate(value) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));

  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function optionalText(value, maxLength) {
  if (value === undefined || value === null) return '';

  return String(value).trim().slice(0, maxLength);
}

exports.getLogs = async (req, res) => {
  try {
    const empresaId = req.tenant?.empresa_id;

    if (!empresaId) {
      return res.status(403).json({
        success: false,
        message: 'Empresa no asignada',
      });
    }

    const { page, limit, offset } = parsePagination(
      req.query,
      {
        defaultLimit: 25,
        maxLimit: 100,
      }
    );

    const {
      search,
      usuario_id,
      accion,
      entidad,
      entidad_id,
      fecha_desde,
      fecha_hasta,
    } = req.query;

    const fechaDesde =
      fecha_desde === undefined || fecha_desde === null
        ? ''
        : String(fecha_desde).trim();

    const fechaHasta =
      fecha_hasta === undefined || fecha_hasta === null
        ? ''
        : String(fecha_hasta).trim();

    if (fechaDesde && !isValidDate(fechaDesde)) {
      return res.status(400).json({
        success: false,
        message: 'fecha_desde debe tener formato YYYY-MM-DD',
      });
    }

    if (fechaHasta && !isValidDate(fechaHasta)) {
      return res.status(400).json({
        success: false,
        message: 'fecha_hasta debe tener formato YYYY-MM-DD',
      });
    }

    if (
      fechaDesde &&
      fechaHasta &&
      fechaDesde > fechaHasta
    ) {
      return res.status(400).json({
        success: false,
        message: 'fecha_desde no puede ser posterior a fecha_hasta',
      });
    }

    const conditions = ['empresa_id = ?'];
    const params = [empresaId];

    const searchValue = optionalText(search, 100);

    if (searchValue) {
      const term = `%${searchValue}%`;

      conditions.push(
        '(usuario_nombre LIKE ? OR descripcion LIKE ? OR entidad_id LIKE ?)'
      );
      params.push(term, term, term);
    }

    if (
      usuario_id !== undefined &&
      usuario_id !== null &&
      String(usuario_id).trim() !== ''
    ) {
      const usuarioId = Number(usuario_id);

      if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'usuario_id inválido',
        });
      }

      conditions.push('usuario_id = ?');
      params.push(usuarioId);
    }

    const accionValue = optionalText(accion, 80);
    const entidadValue = optionalText(entidad, 80);
    const entidadIdValue = optionalText(entidad_id, 100);

    if (accionValue) {
      conditions.push('accion = ?');
      params.push(accionValue);
    }

    if (entidadValue) {
      conditions.push('entidad = ?');
      params.push(entidadValue);
    }

    if (entidadIdValue) {
      conditions.push('entidad_id = ?');
      params.push(entidadIdValue);
    }

    if (fechaDesde) {
      conditions.push('created_at >= ?');
      params.push(`${fechaDesde} 00:00:00`);
    }

    if (fechaHasta) {
      conditions.push('created_at <= ?');
      params.push(`${fechaHasta} 23:59:59`);
    }

    const where = conditions.join(' AND ');

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM auditoria_logs
       WHERE ${where}`,
      params
    );

    const [rows] = await db.query(
      `SELECT
         id,
         empresa_id,
         usuario_id,
         usuario_nombre,
         accion,
         entidad,
         entidad_id,
         descripcion,
         metodo_http,
         ruta,
         ip,
         created_at
       FROM auditoria_logs
       WHERE ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const total = Number(countRow.total);

    return res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('getLogs auditoria error:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al obtener la auditoría',
    });
  }
};

exports.getLogById = async (req, res) => {
  try {
    const empresaId = req.tenant?.empresa_id;
    const id = String(req.params.id || '').trim();

    if (!empresaId) {
      return res.status(403).json({
        success: false,
        message: 'Empresa no asignada',
      });
    }

    if (!/^[1-9]\d*$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de auditoría inválido',
      });
    }

    const [[row]] = await db.query(
      `SELECT
         id,
         empresa_id,
         usuario_id,
         usuario_nombre,
         accion,
         entidad,
         entidad_id,
         descripcion,
         datos_anteriores,
         datos_nuevos,
         metodo_http,
         ruta,
         ip,
         user_agent,
         created_at
       FROM auditoria_logs
       WHERE id = ?
         AND empresa_id = ?
       LIMIT 1`,
      [id, empresaId]
    );

    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Registro no encontrado',
      });
    }

    row.datos_anteriores =
      parseJson(row.datos_anteriores);

    row.datos_nuevos =
      parseJson(row.datos_nuevos);

    return res.json({
      success: true,
      data: row,
    });
  } catch (error) {
    console.error('getLogById auditoria error:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al obtener el detalle de auditoría',
    });
  }
};
