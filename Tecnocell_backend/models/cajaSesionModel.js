'use strict';

const db = require('../config/database');

function sesionError(message, statusCode, code) {
  const e = new Error(message);
  e.statusCode = statusCode;
  e.code = code;
  return e;
}

const SELECT_SESION = `
  SELECT cs.*,
         c.nombre  AS caja_nombre,  c.codigo AS caja_codigo,
         s.nombre  AS sucursal_nombre,
         ua.username AS usuario_apertura_username,
         uc.username AS cerrado_por_username
  FROM caja_sesiones cs
  INNER JOIN cajas      c  ON c.id  = cs.caja_id
                          AND c.empresa_id = cs.empresa_id
                          AND c.sucursal_id = cs.sucursal_id
  INNER JOIN sucursales s  ON s.id  = cs.sucursal_id  AND s.empresa_id  = cs.empresa_id
  LEFT JOIN  users      ua ON ua.id = cs.usuario_apertura_id
  LEFT JOIN  users      uc ON uc.id = cs.cerrado_por
`;

function buildSucursalFilter(sucursalIds, params) {
  if (!Array.isArray(sucursalIds) || !sucursalIds.length) return ' AND 1 = 0';
  if (sucursalIds.length === 1) { params.push(sucursalIds[0]); return ' AND cs.sucursal_id = ?'; }
  params.push(...sucursalIds);
  return ` AND cs.sucursal_id IN (${sucursalIds.map(() => '?').join(',')})`;
}


/**
 * Resuelve y bloquea la sesión operativa ABIERTA del usuario.
 *
 * Debe recibir la misma connection de la operación financiera.
 * El FOR UPDATE serializa cobros/reversas contra el cierre de caja.
 */
async function resolverActivaParaOperacion(
  connection,
  { empresaId, sucursalId, usuarioId }
) {
  if (!connection || typeof connection.query !== 'function') {
    throw sesionError(
      'Conexión transaccional requerida para operar caja',
      500,
      'CAJA_SESION_CONNECTION_REQUIRED'
    );
  }

  const companyId = Number(empresaId);
  const branchId = Number(sucursalId);
  const userId = Number(usuarioId);

  if (
    !Number.isInteger(companyId) || companyId <= 0 ||
    !Number.isInteger(branchId) || branchId <= 0 ||
    !Number.isInteger(userId) || userId <= 0
  ) {
    throw sesionError(
      'Debe existir un usuario autenticado y una sucursal específica para operar efectivo',
      409,
      'CAJA_SESION_REQUERIDA'
    );
  }

  const [[sesion]] = await connection.query(
    `SELECT
       cs.id,
       cs.empresa_id,
       cs.sucursal_id,
       cs.caja_id,
       cs.usuario_apertura_id,
       cs.fondo_inicial_centavos,
       cs.fecha_apertura
     FROM caja_sesiones cs
     INNER JOIN cajas c
       ON c.id = cs.caja_id
      AND c.empresa_id = cs.empresa_id
      AND c.sucursal_id = cs.sucursal_id
      AND c.activa = 1
     WHERE cs.empresa_id = ?
       AND cs.sucursal_id = ?
       AND cs.usuario_apertura_id = ?
       AND cs.estado = 'ABIERTA'
     LIMIT 1
     FOR UPDATE`,
    [companyId, branchId, userId]
  );

  if (!sesion) {
    throw sesionError(
      'Debe abrir una caja en la sucursal activa antes de operar efectivo',
      409,
      'CAJA_SESION_REQUERIDA'
    );
  }

  return sesion;
}

async function listarActivas({ empresaId, sucursalIds, usuarioId, cajaId }) {
  const params = [empresaId];
  let where = ' WHERE cs.empresa_id = ? AND cs.estado = \'ABIERTA\'';
  where += buildSucursalFilter(sucursalIds, params);

  if (usuarioId) {
    where += ' AND cs.usuario_apertura_id = ?';
    params.push(Number(usuarioId));
  }

  if (cajaId) {
    where += ' AND cs.caja_id = ?';
    params.push(Number(cajaId));
  }
  const [rows] = await db.query(`${SELECT_SESION}${where} ORDER BY cs.fecha_apertura DESC`, params);
  return rows;
}

async function obtenerSugerenciaApertura({ empresaId, sucursalId, cajaId }) {
  const [[caja]] = await db.query(
    `SELECT id
     FROM cajas
     WHERE id = ?
       AND empresa_id = ?
       AND sucursal_id = ?
       AND activa = 1
     LIMIT 1`,
    [cajaId, empresaId, sucursalId]
  );

  if (!caja) return null;

  const [[anterior]] = await db.query(
    `SELECT
       id AS sesion_anterior_id,
       fondo_siguiente_centavos,
       fecha_cierre
     FROM caja_sesiones
     WHERE empresa_id = ?
       AND sucursal_id = ?
       AND caja_id = ?
       AND estado = 'CERRADA'
     ORDER BY fecha_cierre DESC, id DESC
     LIMIT 1`,
    [empresaId, sucursalId, cajaId]
  );

  return {
    caja_id: Number(cajaId),
    sesion_anterior_id: anterior?.sesion_anterior_id
      ? Number(anterior.sesion_anterior_id)
      : null,
    fondo_sugerido_centavos:
      anterior?.fondo_siguiente_centavos !== null &&
      anterior?.fondo_siguiente_centavos !== undefined
        ? Number(anterior.fondo_siguiente_centavos)
        : null,
    fecha_cierre_anterior: anterior?.fecha_cierre ?? null,
  };
}

async function listar({ empresaId, sucursalIds, cajaId, limit = 20, offset = 0 }) {
  const params = [empresaId];
  let where = ' WHERE cs.empresa_id = ?';

  where += buildSucursalFilter(
    sucursalIds,
    params
  );

  if (cajaId) {
    where += ' AND cs.caja_id = ?';
    params.push(Number(cajaId));
  }

  params.push(
    Math.min(Number(limit) || 20, 100),
    Math.max(Number(offset) || 0, 0)
  );

  const [rows] = await db.query(
    `${SELECT_SESION}${where}
     ORDER BY cs.fecha_apertura DESC
     LIMIT ? OFFSET ?`,
    params
  );

  if (!rows.length) {
    return rows;
  }

  const sesionIds = rows
    .map(row => Number(row.id))
    .filter(Number.isInteger);

  const placeholders =
    sesionIds.map(() => '?').join(',');

  const [resumenRows] = await db.query(
    `SELECT
       caja_sesion_id,

       COALESCE(SUM(
         CASE
           WHEN fuente = 'VENTA'
            AND accion = 'INGRESO'
           THEN monto_centavos
           ELSE 0
         END
       ), 0) AS ventas_ingresos_centavos,

       COALESCE(SUM(
         CASE
           WHEN fuente = 'VENTA'
            AND accion = 'REVERSA'
           THEN monto_centavos
           ELSE 0
         END
       ), 0) AS ventas_reversas_centavos,

       COALESCE(SUM(
         CASE
           WHEN fuente = 'REPARACION'
            AND accion = 'INGRESO'
           THEN monto_centavos
           ELSE 0
         END
       ), 0) AS reparaciones_ingresos_centavos,

       COALESCE(SUM(
         CASE
           WHEN fuente = 'REPARACION'
            AND accion = 'REVERSA'
           THEN monto_centavos
           ELSE 0
         END
       ), 0) AS reparaciones_reversas_centavos

     FROM (
       SELECT
         caja_sesion_id,
         'VENTA' AS fuente,
         accion,
         monto_centavos
       FROM venta_movimientos_financieros
       WHERE metodo = 'EFECTIVO'
         AND caja_sesion_id IN (${placeholders})

       UNION ALL

       SELECT
         caja_sesion_id,
         'REPARACION' AS fuente,
         accion,
         monto_centavos
       FROM reparacion_movimientos_financieros
       WHERE metodo = 'EFECTIVO'
         AND caja_sesion_id IN (${placeholders})
     ) movimientos

     GROUP BY caja_sesion_id`,
    [
      ...sesionIds,
      ...sesionIds,
    ]
  );

  const resumenPorSesion =
    new Map(
      resumenRows.map(row => [
        Number(row.caja_sesion_id),
        row,
      ])
    );

  return rows.map(row => {
    const resumen =
      resumenPorSesion.get(
        Number(row.id)
      ) || {};

    const ventasIngresos =
      Number(
        resumen.ventas_ingresos_centavos ||
        0
      );

    const ventasReversas =
      Number(
        resumen.ventas_reversas_centavos ||
        0
      );

    const reparacionesIngresos =
      Number(
        resumen.reparaciones_ingresos_centavos ||
        0
      );

    const reparacionesReversas =
      Number(
        resumen.reparaciones_reversas_centavos ||
        0
      );

    return {
      ...row,

      ventas_ingresos_centavos:
        ventasIngresos,

      ventas_reversas_centavos:
        ventasReversas,

      reparaciones_ingresos_centavos:
        reparacionesIngresos,

      reparaciones_reversas_centavos:
        reparacionesReversas,

      movimientos_efectivo_centavos:
        ventasIngresos -
        ventasReversas +
        reparacionesIngresos -
        reparacionesReversas,
    };
  });
}


/**
 * Devuelve una sesión y todos sus movimientos de efectivo,
 * ordenados cronológicamente.
 *
 * La sesión debe pertenecer a empresa + sucursales autorizadas.
 */
async function obtenerDetalle({
  empresaId,
  sucursalIds,
  sesionId,
}) {
  const params = [empresaId];

  let where =
    ' WHERE cs.empresa_id = ?';

  where += buildSucursalFilter(
    sucursalIds,
    params
  );

  where += ' AND cs.id = ?';
  params.push(Number(sesionId));

  const [[sesion]] = await db.query(
    `${SELECT_SESION}${where}
     LIMIT 1`,
    params
  );

  if (!sesion) {
    return null;
  }

  const empresaIdNormalizado =
    Number(empresaId);

  const sucursalId =
    Number(sesion.sucursal_id);

  const sesionIdNormalizado =
    Number(sesionId);

  const [movimientos] = await db.query(
    `SELECT
       'VENTA' AS fuente,
       vmf.id AS movimiento_id,
       CAST(vmf.venta_id AS CHAR) AS entidad_id,

       COALESCE(
         v.numero_venta,
         CONCAT('#', vmf.venta_id)
       ) AS documento,

       v.cliente_nombre AS cliente_nombre,

       NULL AS detalle_principal,

       vmf.pago_indice,
       vmf.accion,
       vmf.metodo,
       vmf.monto_centavos,
       vmf.referencia,
       vmf.usuario_id,
       u.username AS usuario_username,
       vmf.created_at

     FROM venta_movimientos_financieros vmf

     LEFT JOIN ventas v
       ON v.id = vmf.venta_id
      AND v.empresa_id = vmf.empresa_id
      AND v.sucursal_id = vmf.sucursal_id

     LEFT JOIN users u
       ON u.id = vmf.usuario_id

     WHERE vmf.empresa_id = ?
       AND vmf.sucursal_id = ?
       AND vmf.caja_sesion_id = ?
       AND vmf.metodo = 'EFECTIVO'

     UNION ALL

     SELECT
       'REPARACION' AS fuente,
       rmf.id AS movimiento_id,
       rmf.reparacion_id AS entidad_id,

       rmf.reparacion_id AS documento,

       r.cliente_nombre AS cliente_nombre,

       COALESCE(
         NULLIF(
           TRIM(
             CONCAT_WS(
               ' ',
               r.marca,
               r.modelo
             )
           ),
           ''
         ),
         r.tipo_equipo
       ) AS detalle_principal,

       rmf.pago_indice,
       rmf.accion,
       rmf.metodo,
       rmf.monto_centavos,
       rmf.referencia,
       rmf.usuario_id,
       u.username AS usuario_username,
       rmf.created_at

     FROM reparacion_movimientos_financieros rmf

     LEFT JOIN reparaciones r
       ON r.id = rmf.reparacion_id
      AND r.empresa_id = rmf.empresa_id
      AND r.sucursal_id = rmf.sucursal_id

     LEFT JOIN users u
       ON u.id = rmf.usuario_id

     WHERE rmf.empresa_id = ?
       AND rmf.sucursal_id = ?
       AND rmf.caja_sesion_id = ?
       AND rmf.metodo = 'EFECTIVO'

     ORDER BY created_at ASC,
              movimiento_id ASC`,
    [
      empresaIdNormalizado,
      sucursalId,
      sesionIdNormalizado,

      empresaIdNormalizado,
      sucursalId,
      sesionIdNormalizado,
    ]
  );

  return {
    sesion,

    movimientos:
      movimientos.map(mov => ({
        ...mov,

        movimiento_id:
          Number(mov.movimiento_id),

        pago_indice:
          Number(mov.pago_indice),

        monto_centavos:
          Number(mov.monto_centavos),

        usuario_id:
          mov.usuario_id
            ? Number(mov.usuario_id)
            : null,
      })),
  };
}

/**
 * Abre una sesión de caja dentro de una transacción.
 * Verifica que la caja pertenezca a empresa+sucursal y esté activa.
 * Traduce ER_DUP_ENTRY de los UNIQUE generados al código de error de negocio.
 * Devuelve null si la caja no existe/no pertenece; lanza para otros errores.
 */
async function crear({ empresaId, sucursalId, cajaId, usuarioId, fondoInicial }) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [[caja]] = await connection.query(
      `SELECT id FROM cajas
       WHERE id = ? AND empresa_id = ? AND sucursal_id = ? AND activa = 1
       LIMIT 1`,
      [cajaId, empresaId, sucursalId]
    );
    if (!caja) { await connection.rollback(); return null; }

    const [[anterior]] = await connection.query(
      `SELECT
         id,
         fondo_siguiente_centavos
       FROM caja_sesiones
       WHERE empresa_id = ?
         AND sucursal_id = ?
         AND caja_id = ?
         AND estado = 'CERRADA'
       ORDER BY fecha_cierre DESC, id DESC
       LIMIT 1`,
      [empresaId, sucursalId, cajaId]
    );

    const fondoSugerido =
      anterior?.fondo_siguiente_centavos !== null &&
      anterior?.fondo_siguiente_centavos !== undefined
        ? Number(anterior.fondo_siguiente_centavos)
        : null;

    const diferenciaApertura =
      fondoSugerido === null
        ? null
        : Number(fondoInicial) - fondoSugerido;

    const [ins] = await connection.query(
      `INSERT INTO caja_sesiones
       (
         empresa_id,
         sucursal_id,
         caja_id,
         usuario_apertura_id,
         fondo_inicial_centavos,
         fondo_sugerido_centavos,
         diferencia_apertura_centavos
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId,
        sucursalId,
        cajaId,
        usuarioId,
        fondoInicial,
        fondoSugerido,
        diferenciaApertura,
      ]
    );

    const [[sesion]] = await connection.query(
      `${SELECT_SESION} WHERE cs.id = ?`,
      [ins.insertId]
    );

    await connection.commit();
    return sesion;
  } catch (err) {
    try { await connection.rollback(); } catch (_) {}
    if (err.code === 'ER_DUP_ENTRY') {
      const msg = String(err.message || err.sqlMessage || '');
      if (/uk_sesion_caja_abierta/i.test(msg))
        throw sesionError('La caja ya tiene una sesión abierta', 409, 'CAJA_YA_TIENE_SESION_ABIERTA');
      if (/uk_sesion_usuario_abierta/i.test(msg))
        throw sesionError('El usuario ya tiene una sesión de caja abierta en esta empresa', 409, 'USUARIO_YA_TIENE_SESION_ABIERTA');
      throw sesionError('No se pudo abrir la sesión por conflicto de unicidad', 409, 'SESION_CONFLICTO');
    }
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Calcula el efectivo operativo de una sesión usando exactamente
 * los mismos ledgers de ventas y reparaciones que utiliza el cierre.
 */
async function calcularEfectivoEsperado(
  executor,
  { sesionId, fondoInicial }
) {
  const [[ventaCash]] = await executor.query(
    `SELECT COALESCE(SUM(
       CASE
         WHEN accion = 'INGRESO' THEN monto_centavos
         WHEN accion = 'REVERSA' THEN -monto_centavos
         ELSE 0
       END
     ), 0) AS neto
     FROM venta_movimientos_financieros
     WHERE caja_sesion_id = ?
       AND metodo = 'EFECTIVO'`,
    [sesionId]
  );

  const [[reparacionCash]] = await executor.query(
    `SELECT COALESCE(SUM(
       CASE
         WHEN accion = 'INGRESO' THEN monto_centavos
         WHEN accion = 'REVERSA' THEN -monto_centavos
         ELSE 0
       END
     ), 0) AS neto
     FROM reparacion_movimientos_financieros
     WHERE caja_sesion_id = ?
       AND metodo = 'EFECTIVO'`,
    [sesionId]
  );

  const ventasEfectivo =
    Number(ventaCash?.neto || 0);

  const reparacionesEfectivo =
    Number(reparacionCash?.neto || 0);

  const movimientosEfectivo =
    ventasEfectivo + reparacionesEfectivo;

  const esperado =
    Number(fondoInicial) +
    movimientosEfectivo;

  return {
    esperado,
    movimientosEfectivo,
    ventasEfectivo,
    reparacionesEfectivo,
  };
}

/**
 * Resumen operativo de la sesión ABIERTA del usuario.
 * Es solo lectura; el cierre vuelve a calcular dentro de su
 * propia transacción y continúa siendo la autoridad final.
 */
async function obtenerResumenActiva({
  empresaId,
  sucursalId,
  usuarioId,
}) {
  const [[sesion]] = await db.query(
    `${SELECT_SESION}
     WHERE cs.empresa_id = ?
       AND cs.sucursal_id = ?
       AND cs.usuario_apertura_id = ?
       AND cs.estado = 'ABIERTA'
     ORDER BY cs.fecha_apertura DESC
     LIMIT 1`,
    [
      Number(empresaId),
      Number(sucursalId),
      Number(usuarioId),
    ]
  );

  if (!sesion) return null;

  const calculo =
    await calcularEfectivoEsperado(
      db,
      {
        sesionId: sesion.id,
        fondoInicial:
          sesion.fondo_inicial_centavos,
      }
    );

  return {
    ...sesion,
    movimientos_efectivo_centavos:
      calculo.movimientosEfectivo,
    ventas_efectivo_centavos:
      calculo.ventasEfectivo,
    reparaciones_efectivo_centavos:
      calculo.reparacionesEfectivo,
    efectivo_esperado_actual_centavos:
      calculo.esperado,
  };
}

/**
 * Cierra una sesión ABIERTA dentro de una transacción.
 * El efectivo esperado usa el mismo cálculo del resumen operativo.
 * Devuelve null si la sesión no existe/ya está cerrada o pertenece a otra sucursal.
 */
async function cerrar({
  sesionId,
  empresaId,
  sucursalId,
  usuarioId,
  efectivoContado,
  fondoSiguiente = 0,
  cerradoPor,
  notas,
}) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [[sesion]] = await connection.query(
      `SELECT id, fondo_inicial_centavos FROM caja_sesiones
       WHERE id = ?
         AND empresa_id = ?
         AND sucursal_id = ?
         AND usuario_apertura_id = ?
         AND estado = 'ABIERTA'
       FOR UPDATE`,
      [sesionId, empresaId, sucursalId, usuarioId]
    );
    if (!sesion) { await connection.rollback(); return null; }

    const {
      esperado,
    } = await calcularEfectivoEsperado(
      connection,
      {
        sesionId,
        fondoInicial:
          sesion.fondo_inicial_centavos,
      }
    );

    const contado = Number(efectivoContado);
    const fondoSiguienteNormalizado = Number(fondoSiguiente);

    if (
      !Number.isInteger(fondoSiguienteNormalizado) ||
      fondoSiguienteNormalizado < 0
    ) {
      throw sesionError(
        'El fondo para el siguiente turno debe ser un entero no negativo',
        400,
        'FONDO_SIGUIENTE_INVALIDO'
      );
    }

    if (fondoSiguienteNormalizado > contado) {
      throw sesionError(
        'El fondo para el siguiente turno no puede superar el efectivo contado',
        400,
        'FONDO_SIGUIENTE_SUPERA_CONTADO'
      );
    }

    const diferencia = contado - esperado;
    const retiroCierre = contado - fondoSiguienteNormalizado;

    await connection.query(
      `UPDATE caja_sesiones
       SET estado                     = 'CERRADA',
           fecha_cierre               = NOW(),
           efectivo_esperado_centavos = ?,
           efectivo_contado_centavos  = ?,
           diferencia_centavos        = ?,
           fondo_siguiente_centavos   = ?,
           retiro_cierre_centavos     = ?,
           cerrado_por                = ?,
           notas_cierre               = ?
       WHERE id = ?`,
      [
        esperado,
        contado,
        diferencia,
        fondoSiguienteNormalizado,
        retiroCierre,
        cerradoPor,
        notas || null,
        sesionId,
      ]
    );

    await connection.commit();

    return {
      sesionId: Number(sesionId),
      diferencia,
      efectivoEsperado: esperado,
      efectivoContado: contado,
      fondoSiguiente: fondoSiguienteNormalizado,
      retiroCierre,
    };
  } catch (err) {
    try { await connection.rollback(); } catch (_) {}
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  resolverActivaParaOperacion,
  listarActivas,
  obtenerSugerenciaApertura,
  obtenerResumenActiva,
  calcularEfectivoEsperado,
  listar,
  obtenerDetalle,
  crear,
  cerrar,
};
