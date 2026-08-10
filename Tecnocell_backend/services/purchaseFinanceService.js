'use strict';

const cajaSesionModel =
  require('../models/cajaSesionModel');

function financeError(
  message,
  statusCode = 400,
  code = 'PURCHASE_FINANCE_ERROR'
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function requirePositiveInteger(
  value,
  label
) {
  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    throw financeError(
      `${label} inválido`,
      400,
      'PURCHASE_FINANCE_INVALID_ARGUMENT'
    );
  }

  return parsed;
}

function usuarioId(req) {
  const id =
    req?.user?.id ??
    req?.user?.userId ??
    null;

  const parsed = Number(id);

  return Number.isInteger(parsed) &&
    parsed > 0
    ? parsed
    : null;
}

function usuarioNombre(req) {
  return String(
    req?.user?.name ||
    req?.user?.username ||
    req?.user?.id ||
    'Sistema'
  );
}

function montoQuetzales(total) {
  const value =
    Math.round(
      Number(total) * 100
    ) / 100;

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw financeError(
      'El total de la compra debe ser mayor que cero',
      400,
      'PURCHASE_TOTAL_INVALID'
    );
  }

  return value;
}

function montoCentavos(total) {
  return Math.round(
    montoQuetzales(total) * 100
  );
}

function normalizarFuenteFinanciera(
  metodoPago,
  fuenteFinanciera
) {
  const metodo =
    String(metodoPago || '')
      .trim()
      .toLowerCase();

  const fuente =
    fuenteFinanciera
      ? String(fuenteFinanciera)
          .trim()
          .toUpperCase()
      : null;

  if (metodo === 'efectivo') {
    if (
      fuente !== 'CAJA_OPERATIVA' &&
      fuente !== 'CAJA_CHICA'
    ) {
      throw financeError(
        'Selecciona si el efectivo saldrá de Caja Operativa o Caja Chica.',
        400,
        'FUENTE_EFECTIVO_REQUERIDA'
      );
    }

    return fuente;
  }

  if (metodo === 'transferencia') {
    if (
      fuente &&
      fuente !== 'CUENTA_BANCARIA'
    ) {
      throw financeError(
        'Una transferencia debe utilizar una cuenta bancaria.',
        400,
        'FUENTE_FINANCIERA_INVALIDA'
      );
    }

    return 'CUENTA_BANCARIA';
  }

  if (metodo === 'tarjeta_credito') {
    if (
      fuente &&
      fuente !== 'TARJETA_CREDITO'
    ) {
      throw financeError(
        'El pago con tarjeta debe utilizar una tarjeta de crédito.',
        400,
        'FUENTE_FINANCIERA_INVALIDA'
      );
    }

    return 'TARJETA_CREDITO';
  }

  throw financeError(
    'Método de pago inválido',
    400,
    'METODO_PAGO_INVALIDO'
  );
}

/**
 * Caja Chica usa la fila de sucursales como mutex estable.
 *
 * Esto evita que dos egresos concurrentes validen
 * simultáneamente el mismo saldo.
 */
async function bloquearCajaChicaYObtenerSaldo(
  connection,
  {
    empresaId,
    sucursalId,
  }
) {
  const companyId =
    requirePositiveInteger(
      empresaId,
      'Empresa'
    );

  const branchId =
    requirePositiveInteger(
      sucursalId,
      'Sucursal'
    );

  const [[sucursal]] =
    await connection.query(
      `SELECT id
       FROM sucursales
       WHERE id = ?
         AND empresa_id = ?
         AND activa = TRUE
       LIMIT 1
       FOR UPDATE`,
      [
        branchId,
        companyId,
      ]
    );

  if (!sucursal) {
    throw financeError(
      'La sucursal seleccionada no está disponible.',
      409,
      'BRANCH_INACTIVE'
    );
  }

  const [[saldoRow]] =
    await connection.query(
      `SELECT COALESCE(
         SUM(
           CASE
             WHEN estado = 'CONFIRMADO'
              AND tipo_movimiento = 'INGRESO'
             THEN monto

             WHEN estado = 'CONFIRMADO'
              AND tipo_movimiento = 'EGRESO'
             THEN -monto

             ELSE 0
           END
         ),
         0
       ) AS saldo
       FROM caja_chica
       WHERE empresa_id = ?
         AND sucursal_id = ?`,
      [
        companyId,
        branchId,
      ]
    );

  return Number(
    saldoRow?.saldo || 0
  );
}

/**
 * Egreso de una compra desde la Caja Operativa.
 *
 * La caja y la sesión NO vienen del frontend:
 * se resuelven exclusivamente desde la sesión
 * ABIERTA del usuario autenticado.
 */
async function aplicarCajaOperativa(
  connection,
  {
    empresaId,
    sucursalId,
    total,
    compraId,
    numeroCompra,
    req,
  }
) {
  const companyId =
    requirePositiveInteger(
      empresaId,
      'Empresa'
    );

  const branchId =
    requirePositiveInteger(
      sucursalId,
      'Sucursal'
    );

  const purchaseId =
    requirePositiveInteger(
      compraId,
      'Compra'
    );

  const actorId =
    usuarioId(req);

  if (!actorId) {
    throw financeError(
      'Usuario autenticado requerido para operar efectivo.',
      409,
      'CAJA_SESION_REQUERIDA'
    );
  }

  const centavos =
    montoCentavos(total);

  const sesion =
    await cajaSesionModel
      .resolverActivaParaOperacion(
        connection,
        {
          empresaId: companyId,
          sucursalId: branchId,
          usuarioId: actorId,
        }
      );

  const calculo =
    await cajaSesionModel
      .calcularEfectivoEsperado(
        connection,
        {
          sesionId:
            Number(sesion.id),

          fondoInicial:
            Number(
              sesion.fondo_inicial_centavos ||
              0
            ),
        }
      );

  const disponibleCentavos =
    Math.max(
      0,
      Number(calculo.esperado || 0)
    );

  if (
    centavos >
    disponibleCentavos
  ) {
    throw financeError(
      `Efectivo insuficiente en Caja Operativa. Disponible: Q${(
        disponibleCentavos / 100
      ).toFixed(2)}`,
      409,
      'CAJA_OPERATIVA_SALDO_INSUFICIENTE'
    );
  }

  await connection.query(
    `INSERT INTO compra_movimientos_financieros
      (
        empresa_id,
        sucursal_id,
        compra_id,
        accion,
        metodo,
        monto_centavos,
        caja_id,
        caja_sesion_id,
        referencia,
        usuario_id
      )
     VALUES (
       ?, ?, ?,
       'EGRESO',
       'EFECTIVO',
       ?, ?, ?, ?, ?
     )`,
    [
      companyId,
      branchId,
      purchaseId,
      centavos,
      Number(sesion.caja_id),
      Number(sesion.id),
      `Pago compra ${numeroCompra}`,
      actorId,
    ]
  );

  return {
    fuenteFinanciera:
      'CAJA_OPERATIVA',

    cajaId:
      Number(sesion.caja_id),

    cajaSesionId:
      Number(sesion.id),

    montoCentavos:
      centavos,
  };
}

/**
 * Anulación de compra originalmente pagada
 * desde Caja Operativa.
 *
 * La devolución se registra en la sesión ABIERTA
 * actual del usuario que procesa la anulación.
 */
async function revertirCajaOperativa(
  connection,
  {
    empresaId,
    sucursalId,
    total,
    compraId,
    numeroCompra,
    req,
  }
) {
  const companyId =
    requirePositiveInteger(
      empresaId,
      'Empresa'
    );

  const branchId =
    requirePositiveInteger(
      sucursalId,
      'Sucursal'
    );

  const purchaseId =
    requirePositiveInteger(
      compraId,
      'Compra'
    );

  const actorId =
    usuarioId(req);

  if (!actorId) {
    throw financeError(
      'Usuario autenticado requerido para reintegrar efectivo.',
      409,
      'CAJA_SESION_REQUERIDA'
    );
  }

  const centavos =
    montoCentavos(total);

  const sesion =
    await cajaSesionModel
      .resolverActivaParaOperacion(
        connection,
        {
          empresaId: companyId,
          sucursalId: branchId,
          usuarioId: actorId,
        }
      );

  await connection.query(
    `INSERT INTO compra_movimientos_financieros
      (
        empresa_id,
        sucursal_id,
        compra_id,
        accion,
        metodo,
        monto_centavos,
        caja_id,
        caja_sesion_id,
        referencia,
        usuario_id
      )
     VALUES (
       ?, ?, ?,
       'REVERSA',
       'EFECTIVO',
       ?, ?, ?, ?, ?
     )`,
    [
      companyId,
      branchId,
      purchaseId,
      centavos,
      Number(sesion.caja_id),
      Number(sesion.id),
      `Reintegro compra ${numeroCompra}`,
      actorId,
    ]
  );

  return {
    fuenteFinanciera:
      'CAJA_OPERATIVA',

    cajaId:
      Number(sesion.caja_id),

    cajaSesionId:
      Number(sesion.id),

    montoCentavos:
      centavos,
  };
}

async function aplicarCajaChica(
  connection,
  {
    empresaId,
    sucursalId,
    total,
    compraId,
    numeroCompra,
    req,
  }
) {
  const companyId =
    requirePositiveInteger(
      empresaId,
      'Empresa'
    );

  const branchId =
    requirePositiveInteger(
      sucursalId,
      'Sucursal'
    );

  const purchaseId =
    requirePositiveInteger(
      compraId,
      'Compra'
    );

  const monto =
    montoQuetzales(total);

  const saldo =
    await bloquearCajaChicaYObtenerSaldo(
      connection,
      {
        empresaId: companyId,
        sucursalId: branchId,
      }
    );

  if (
    monto >
    saldo + 0.0001
  ) {
    throw financeError(
      `Saldo insuficiente en Caja Chica. Disponible: Q${saldo.toFixed(2)}`,
      409,
      'CAJA_CHICA_SALDO_INSUFICIENTE'
    );
  }

  await connection.query(
    `INSERT INTO caja_chica
      (
        empresa_id,
        sucursal_id,
        tipo_movimiento,
        monto,
        concepto,
        categoria,
        estado,
        realizado_por,
        observaciones,
        referencia_tipo,
        referencia_id,
        confirmado_por,
        confirmado_en
      )
     VALUES (
       ?, ?,
       'EGRESO',
       ?,
       ?,
       'Compra a proveedor',
       'CONFIRMADO',
       ?,
       ?,
       'compra',
       ?,
       ?,
       NOW()
     )`,
    [
      companyId,
      branchId,
      monto,
      `Pago de compra ${numeroCompra}`,
      usuarioNombre(req),
      `Egreso automático de Caja Chica por compra ${numeroCompra}`,
      String(purchaseId),
      usuarioId(req),
    ]
  );

  return {
    fuenteFinanciera:
      'CAJA_CHICA',

    saldoAnterior:
      saldo,

    saldoNuevo:
      saldo - monto,
  };
}

async function revertirCajaChica(
  connection,
  {
    empresaId,
    sucursalId,
    total,
    compraId,
    numeroCompra,
    req,
  }
) {
  const companyId =
    requirePositiveInteger(
      empresaId,
      'Empresa'
    );

  const branchId =
    requirePositiveInteger(
      sucursalId,
      'Sucursal'
    );

  const purchaseId =
    requirePositiveInteger(
      compraId,
      'Compra'
    );

  const monto =
    montoQuetzales(total);

  // Se toma el mismo mutex para serializar
  // la reversa con cualquier otro movimiento.
  await bloquearCajaChicaYObtenerSaldo(
    connection,
    {
      empresaId: companyId,
      sucursalId: branchId,
    }
  );

  await connection.query(
    `INSERT INTO caja_chica
      (
        empresa_id,
        sucursal_id,
        tipo_movimiento,
        monto,
        concepto,
        categoria,
        estado,
        realizado_por,
        observaciones,
        referencia_tipo,
        referencia_id,
        confirmado_por,
        confirmado_en
      )
     VALUES (
       ?, ?,
       'INGRESO',
       ?,
       ?,
       'Anulación de compra',
       'CONFIRMADO',
       ?,
       ?,
       'compra_anulacion',
       ?,
       ?,
       NOW()
     )`,
    [
      companyId,
      branchId,
      monto,
      `Reintegro de compra ${numeroCompra}`,
      usuarioNombre(req),
      `Reversa automática de Caja Chica por compra ${numeroCompra}`,
      String(purchaseId),
      usuarioId(req),
    ]
  );

  return {
    fuenteFinanciera:
      'CAJA_CHICA',
  };
}

module.exports = {
  financeError,
  usuarioId,
  usuarioNombre,
  montoQuetzales,
  montoCentavos,
  normalizarFuenteFinanciera,
  bloquearCajaChicaYObtenerSaldo,
  aplicarCajaOperativa,
  revertirCajaOperativa,
  aplicarCajaChica,
  revertirCajaChica,
};
