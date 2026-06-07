const db = require('../config/database');

function isSuperadminTenant(req) {
  return req.tenant?.isSuperadmin === true;
}

function getTenantEmpresaId(req) {
  return req.tenant?.empresa_id ?? null;
}

function requireTenantEmpresaId(req) {
  return isSuperadminTenant(req) ? getTenantEmpresaId(req) : getTenantEmpresaId(req);
}

function stickerTenantClause(req, alias = 's') {
  if (isSuperadminTenant(req)) return { sql: '', params: [] };

  return {
    sql: ` AND ${alias}.empresa_id = ?`,
    params: [getTenantEmpresaId(req)]
  };
}

function loteTenantClause(req, alias = 'sl') {
  if (isSuperadminTenant(req)) return { sql: '', params: [] };

  return {
    sql: ` AND ${alias}.empresa_id = ?`,
    params: [getTenantEmpresaId(req)]
  };
}

async function validateEmpresaExists(connectionOrDb, empresaId) {
  const [empresas] = await connectionOrDb.query(
    'SELECT id FROM empresas WHERE id = ? LIMIT 1',
    [empresaId]
  );

  return empresas.length > 0;
}

async function getEmpresaIdForLote(connectionOrDb, req, body = {}) {
  if (!isSuperadminTenant(req)) return requireTenantEmpresaId(req);

  const empresaId = body.empresa_id !== undefined && body.empresa_id !== ''
    ? Number(body.empresa_id)
    : requireTenantEmpresaId(req);

  if (!empresaId) return null;

  const exists = await validateEmpresaExists(connectionOrDb, empresaId);
  return exists ? empresaId : null;
}

async function validateReparacionForTenant(connectionOrDb, reparacionId, req) {
  const tenant = isSuperadminTenant(req)
    ? { sql: '', params: [] }
    : { sql: ' AND r.empresa_id = ?', params: [getTenantEmpresaId(req)] };

  const [reparaciones] = await connectionOrDb.query(
    `SELECT r.id, r.empresa_id
     FROM reparaciones r
     WHERE r.id = ?${tenant.sql}
     LIMIT 1`,
    [reparacionId, ...tenant.params]
  );

  return reparaciones[0] || null;
}

// Obtener todos los stickers disponibles
exports.getStickersDisponibles = async (req, res) => {
  try {
    const tenant = stickerTenantClause(req, 's');
    const [stickers] = await db.query(
      `SELECT s.* FROM stickers_garantia s
       WHERE s.estado = 'DISPONIBLE'${tenant.sql}
       ORDER BY s.numero_sticker ASC`,
      tenant.params
    );

    res.json({
      success: true,
      data: stickers,
      total: stickers.length
    });
  } catch (error) {
    console.error('Error getting stickers disponibles:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener stickers disponibles',
      error: error.message
    });
  }
};

// Obtener todos los stickers asignados
exports.getStickersAsignados = async (req, res) => {
  try {
    const tenant = stickerTenantClause(req, 's');
    const [stickers] = await db.query(
      `SELECT s.*, r.cliente_nombre as clienteNombre, r.estado as estado_reparacion
       FROM stickers_garantia s
       LEFT JOIN reparaciones r ON s.reparacion_id = r.id AND r.empresa_id = s.empresa_id
       WHERE s.estado IN ('ASIGNADO', 'USADO')${tenant.sql}
       ORDER BY s.fecha_asignacion DESC`,
      tenant.params
    );

    res.json({
      success: true,
      data: stickers,
      total: stickers.length
    });
  } catch (error) {
    console.error('Error getting stickers asignados:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener stickers asignados',
      error: error.message
    });
  }
};

// Asignar sticker a reparación
exports.asignarSticker = async (req, res) => {
  try {
    const { stickerId, reparacionId, ubicacion } = req.body;

    if (!stickerId || !reparacionId) {
      return res.status(400).json({
        success: false,
        message: 'Sticker ID y Reparación ID son requeridos'
      });
    }

    // Verificar que el sticker esté disponible
    const reparacion = await validateReparacionForTenant(db, reparacionId, req);
    if (!reparacion) {
      return res.status(404).json({
        success: false,
        message: 'Reparación no encontrada'
      });
    }

    const reparacionEmpresaId = reparacion.empresa_id;

    const [sticker] = await db.query(
      'SELECT * FROM stickers_garantia WHERE id = ? AND estado = "DISPONIBLE" AND empresa_id = ?',
      [stickerId, reparacionEmpresaId]
    );

    if (sticker.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Sticker no disponible'
      });
    }

    // Asignar sticker
    await db.query(
      `UPDATE stickers_garantia 
       SET estado = 'ASIGNADO', 
           reparacion_id = ?, 
           ubicacion_sticker = ?,
           fecha_asignacion = NOW()
       WHERE id = ? AND empresa_id = ?`,
      [reparacionId, ubicacion, stickerId, reparacionEmpresaId]
    );

    // Actualizar reparación
    await db.query(
      `UPDATE reparaciones 
       SET sticker_serie_interna = ?, 
           sticker_ubicacion = ?
       WHERE id = ? AND empresa_id = ?`,
      [sticker[0].numero_sticker, ubicacion, reparacionId, reparacionEmpresaId]
    );

    res.json({
      success: true,
      message: 'Sticker asignado exitosamente',
      data: {
        stickerId,
        reparacionId,
        numeroSticker: sticker[0].numero_sticker
      }
    });
  } catch (error) {
    console.error('Error asignando sticker:', error);
    res.status(500).json({
      success: false,
      message: 'Error al asignar sticker',
      error: error.message
    });
  }
};

// Obtener estadísticas de stickers
exports.getEstadisticas = async (req, res) => {
  try {
    const tenant = stickerTenantClause(req, 's');
    const [stats] = await db.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN s.estado = 'DISPONIBLE' THEN 1 ELSE 0 END) as disponibles,
        SUM(CASE WHEN s.estado = 'ASIGNADO' THEN 1 ELSE 0 END) as asignados,
        SUM(CASE WHEN s.estado = 'USADO' THEN 1 ELSE 0 END) as usados
       FROM stickers_garantia s
       WHERE 1=1${tenant.sql}`,
      tenant.params
    );

    res.json({
      success: true,
      data: stats[0]
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
};

// Liberar sticker (volver a disponible)
exports.liberarSticker = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = stickerTenantClause(req, 's');
    const [stickers] = await db.query(
      `SELECT s.*, r.empresa_id AS reparacion_empresa_id
       FROM stickers_garantia s
       LEFT JOIN reparaciones r ON r.id = s.reparacion_id
       WHERE s.id = ?${tenant.sql}
       LIMIT 1`,
      [id, ...tenant.params]
    );

    if (stickers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sticker no encontrado'
      });
    }

    const sticker = stickers[0];
    if (sticker.reparacion_id && sticker.reparacion_empresa_id !== sticker.empresa_id) {
      return res.status(409).json({
        success: false,
        message: 'Sticker asociado a una reparación inconsistente'
      });
    }

    await db.query(
      `UPDATE stickers_garantia 
       SET estado = 'DISPONIBLE', 
           reparacion_id = NULL, 
           ubicacion_sticker = NULL,
           fecha_asignacion = NULL
       WHERE id = ? AND empresa_id = ?`,
      [id, sticker.empresa_id]
    );

    res.json({
      success: true,
      message: 'Sticker liberado exitosamente'
    });
  } catch (error) {
    console.error('Error liberando sticker:', error);
    res.status(500).json({
      success: false,
      message: 'Error al liberar sticker',
      error: error.message
    });
  }
};

// ─── Lotes: helpers ───────────────────────────────────────────────────────────

/**
 * Genera un array de códigos según la configuración dada.
 * No toca la base de datos.
 */
function generarCodigos(config) {
  const {
    tipo = 'correlativo',
    cantidad = 0,
    numeroInicial = 1,
    digitos = 4,
    prefijo = '',
    estructura = '',
    codigosManual = '',
  } = config;

  const now = new Date();
  const YYYY = now.getFullYear().toString();
  const YY = YYYY.slice(2);
  const MM = (now.getMonth() + 1).toString().padStart(2, '0');
  const DD = now.getDate().toString().padStart(2, '0');

  if (tipo === 'manual') {
    return codigosManual
      .split('\n')
      .map((c) => c.trim())
      .filter(Boolean);
  }

  const codes = [];
  for (let i = 0; i < Number(cantidad); i++) {
    const num = Number(numeroInicial) + i;
    let code = '';

    if (tipo === 'correlativo') {
      code = num.toString().padStart(Number(digitos), '0');
    } else if (tipo === 'con_prefijo') {
      code = `${prefijo}-${num.toString().padStart(Number(digitos), '0')}`;
    } else if (tipo === 'estructura') {
      let tpl = estructura;
      tpl = tpl.replace(/\{YYYY\}/g, YYYY);
      tpl = tpl.replace(/\{YY\}/g, YY);
      tpl = tpl.replace(/\{MM\}/g, MM);
      tpl = tpl.replace(/\{DD\}/g, DD);
      tpl = tpl.replace(/\{PREFIX\}/g, prefijo);
      tpl = tpl.replace(/\{(#+)\}/g, (_, hashes) =>
        num.toString().padStart(hashes.length, '0'),
      );
      code = tpl;
    } else if (tipo === 'aleatorio') {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const pre = prefijo ? `${prefijo}-` : '';
      let rand = '';
      for (let j = 0; j < Number(digitos); j++) {
        rand += chars[Math.floor(Math.random() * chars.length)];
      }
      code = `${pre}${rand}`;
    }

    if (code) codes.push(code);
  }
  return codes;
}

/**
 * Asegura que las tablas de lotes existan y que stickers_garantia
 * tenga las columnas extendidas.
 */
async function ensureLoteTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS sticker_lotes (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      codigo_lote   VARCHAR(80)  UNIQUE NOT NULL,
      tipo_generacion VARCHAR(30) NOT NULL,
      estructura    VARCHAR(255),
      prefijo       VARCHAR(80),
      cantidad      INT          NOT NULL DEFAULT 0,
      numero_inicial INT         DEFAULT 1,
      digitos       INT          DEFAULT 4,
      dias_garantia INT          DEFAULT 0,
      tipo_garantia VARCHAR(80),
      notas         TEXT,
      creado_por    INT,
      created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const extraCols = [
    'ALTER TABLE stickers_garantia ADD COLUMN IF NOT EXISTS lote_id INT NULL',
    'ALTER TABLE stickers_garantia ADD COLUMN IF NOT EXISTS tipo_garantia VARCHAR(80) NULL',
    'ALTER TABLE stickers_garantia ADD COLUMN IF NOT EXISTS dias_garantia INT NULL',
    'ALTER TABLE stickers_garantia ADD COLUMN IF NOT EXISTS notas TEXT NULL',
    'ALTER TABLE stickers_garantia ADD COLUMN IF NOT EXISTS activo TINYINT(1) NOT NULL DEFAULT 1',
  ];
  for (const sql of extraCols) {
    try { await db.query(sql); } catch (_) { /* columna ya existe */ }
  }
}

// ─── Lotes: preview ───────────────────────────────────────────────────────────

exports.previewLote = async (req, res) => {
  try {
    const config = req.body;
    const { cantidad } = config;

    if (!cantidad || Number(cantidad) <= 0) {
      return res.status(400).json({ success: false, message: 'La cantidad debe ser mayor a 0' });
    }
    if (Number(cantidad) > 500) {
      return res.status(400).json({ success: false, message: 'No se pueden generar más de 500 stickers por lote' });
    }

    const codes = generarCodigos(config);

    const unique = [...new Set(codes)];
    if (unique.length !== codes.length) {
      return res.status(400).json({ success: false, message: 'Los códigos generados contienen duplicados internos' });
    }

    if (codes.length > 0) {
      const ph = codes.map(() => '?').join(',');
      const [existing] = await db.query(
        `SELECT numero_sticker FROM stickers_garantia WHERE numero_sticker IN (${ph})`,
        codes,
      );
      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Algunos códigos ya existen en la base de datos',
          duplicados: existing.map((r) => r.numero_sticker),
        });
      }
    }

    res.json({ success: true, codigos: codes, total: codes.length });
  } catch (error) {
    console.error('Error en preview lote:', error);
    res.status(500).json({ success: false, message: 'Error al generar vista previa', error: error.message });
  }
};

// ─── Lotes: crear ─────────────────────────────────────────────────────────────

exports.createLote = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureLoteTables();
    await connection.beginTransaction();

    const config = req.body;
    const { cantidad, diasGarantia = 0, tipoGarantia = '', notas = '' } = config;
    const empresaId = await getEmpresaIdForLote(connection, req, config);

    if (!empresaId) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Empresa requerida para crear lote de stickers'
      });
    }

    if (!cantidad || Number(cantidad) <= 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'La cantidad debe ser mayor a 0' });
    }
    if (Number(cantidad) > 500) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'No se pueden generar más de 500 stickers por lote' });
    }

    const codes = generarCodigos(config);
    const unique = [...new Set(codes)];
    if (unique.length !== codes.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Los códigos generados contienen duplicados internos' });
    }

    if (codes.length > 0) {
      const ph = codes.map(() => '?').join(',');
      const [existing] = await connection.query(
        `SELECT numero_sticker FROM stickers_garantia WHERE numero_sticker IN (${ph})`,
        codes,
      );
      if (existing.length > 0) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: 'Algunos códigos ya existen en la base de datos',
          duplicados: existing.map((r) => r.numero_sticker),
        });
      }
    }

    const codigoLote = `LOTE-${Date.now()}`;
    const [loteResult] = await connection.query(
      `INSERT INTO sticker_lotes
         (empresa_id, codigo_lote, tipo_generacion, estructura, prefijo, cantidad, numero_inicial, digitos,
          dias_garantia, tipo_garantia, notas, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId,
        codigoLote,
        config.tipo,
        config.estructura || null,
        config.prefijo || null,
        codes.length,
        config.numeroInicial || 1,
        config.digitos || 4,
        diasGarantia,
        tipoGarantia || null,
        notas || null,
        req.user?.id || null,
      ],
    );
    const loteId = loteResult.insertId;

    if (codes.length > 0) {
      const values = codes.map((code) => [
        empresaId,
        code,
        'DISPONIBLE',
        loteId,
        tipoGarantia || null,
        diasGarantia || null,
        notas || null,
      ]);
      await connection.query(
        `INSERT INTO stickers_garantia
           (empresa_id, numero_sticker, estado, lote_id, tipo_garantia, dias_garantia, notas)
         VALUES ?`,
        [values],
      );
    }

    await connection.commit();
    res.status(201).json({
      success: true,
      message: `Lote creado con ${codes.length} stickers`,
      data: { loteId, codigoLote, cantidad: codes.length, primerosCodigos: codes.slice(0, 5) },
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error al crear lote:', error);
    res.status(500).json({ success: false, message: 'Error al crear el lote', error: error.message });
  } finally {
    connection.release();
  }
};

// ─── Lotes: listar ────────────────────────────────────────────────────────────

exports.getLotes = async (req, res) => {
  try {
    await ensureLoteTables();
    const tenant = loteTenantClause(req, 'sl');
    const [lotes] = await db.query(`
      SELECT sl.*,
             COUNT(sg.id)                                                    AS total_generados,
             SUM(CASE WHEN sg.estado = 'DISPONIBLE' THEN 1 ELSE 0 END)      AS disponibles,
             SUM(CASE WHEN sg.estado = 'ASIGNADO'   THEN 1 ELSE 0 END)      AS asignados,
             SUM(CASE WHEN sg.estado = 'ANULADO'    THEN 1 ELSE 0 END)      AS anulados
        FROM sticker_lotes sl
        LEFT JOIN stickers_garantia sg ON sg.lote_id = sl.id AND sg.empresa_id = sl.empresa_id
       WHERE 1=1${tenant.sql}
       GROUP BY sl.id
       ORDER BY sl.created_at DESC
    `, tenant.params);
    res.json({ success: true, data: lotes });
  } catch (error) {
    console.error('Error al obtener lotes:', error);
    res.status(500).json({ success: false, message: 'Error al obtener lotes', error: error.message });
  }
};

// ─── Stickers: listado con filtros ────────────────────────────────────────────

exports.getAllStickers = async (req, res) => {
  try {
    const { estado, lote_id, codigo, page = 1, limit = 200 } = req.query;
    const tenant = stickerTenantClause(req, 's');

    let query = `
      SELECT s.*, sl.codigo_lote, sl.tipo_generacion
        FROM stickers_garantia s
        LEFT JOIN sticker_lotes sl ON sl.id = s.lote_id AND sl.empresa_id = s.empresa_id
       WHERE 1=1${tenant.sql}`;
    const params = [...tenant.params];

    if (estado)   { query += ' AND s.estado = ?';              params.push(estado); }
    if (lote_id)  { query += ' AND s.lote_id = ?';             params.push(Number(lote_id)); }
    if (codigo)   { query += ' AND s.numero_sticker LIKE ?';   params.push(`%${codigo}%`); }

    query += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), (Number(page) - 1) * Number(limit));

    const [stickers] = await db.query(query, params);
    res.json({ success: true, data: stickers });
  } catch (error) {
    console.error('Error al obtener stickers:', error);
    res.status(500).json({ success: false, message: 'Error al obtener stickers', error: error.message });
  }
};

// ─── Stickers: anular ─────────────────────────────────────────────────────────

exports.anularSticker = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = stickerTenantClause(req, 's');
    const [result] = await db.query(
      `UPDATE stickers_garantia s
       SET s.estado = 'ANULADO'
       WHERE s.id = ? AND s.estado = 'DISPONIBLE'${tenant.sql}`,
      [id, ...tenant.params],
    );
    if (result.affectedRows === 0) {
      return res.status(400).json({ success: false, message: 'Sticker no encontrado o no está disponible para anular' });
    }
    res.json({ success: true, message: 'Sticker anulado exitosamente' });
  } catch (error) {
    console.error('Error al anular sticker:', error);
    res.status(500).json({ success: false, message: 'Error al anular sticker', error: error.message });
  }
};

module.exports = exports;
