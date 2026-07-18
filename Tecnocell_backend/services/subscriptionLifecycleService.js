const db = require('../config/database');
const subscriptionAccess = require('./subscriptionAccessService');
const planAccess = require('./planAccessService');

const ESTADOS_EMPRESA = Object.freeze(['demo', 'prueba', 'activa', 'suspendida', 'cancelada']);
const ESTADOS_SUSCRIPCION = Object.freeze(['prueba', 'vigente', 'gracia', 'vencida']);
const ESTADOS_CON_ACCESO = Object.freeze({
  empresa: ['demo', 'prueba', 'activa'],
  suscripcion: ['prueba', 'vigente', 'gracia'],
});

function lifecycleError(message, status = 400, code = 'LIFECYCLE_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function serialize(value) {
  return value == null ? null : JSON.stringify(value);
}

function snapshot(empresa, suscripcion) {
  return {
    empresa_id: Number(empresa.id),
    estado_empresa: empresa.estado,
    plan: suscripcion.plan,
    plan_id: suscripcion.plan_id == null ? null : Number(suscripcion.plan_id),
    tipo: suscripcion.tipo,
    estado: suscripcion.estado,
    fecha_inicio: subscriptionAccess.toDateString(suscripcion.fecha_inicio),
    fecha_vencimiento: subscriptionAccess.toDateString(suscripcion.fecha_vencimiento),
    dias_gracia: Number(suscripcion.dias_gracia || 0),
    fecha_fin_gracia: subscriptionAccess.toDateString(suscripcion.fecha_fin_gracia),
    duracion_meses: suscripcion.duracion_meses == null ? null : Number(suscripcion.duracion_meses),
  };
}

async function getSubscriptionLocked(connection, empresaId) {
  const [[empresa]] = await connection.query(
    'SELECT id, estado, plan, fecha_inicio, fecha_vencimiento FROM empresas WHERE id = ? FOR UPDATE',
    [empresaId]
  );
  if (!empresa) throw lifecycleError('Empresa no encontrada', 404, 'EMPRESA_NOT_FOUND');
  const [[suscripcion]] = await connection.query(
    'SELECT * FROM suscripciones WHERE empresa_id = ? FOR UPDATE',
    [empresaId]
  );
  if (!suscripcion) {
    throw lifecycleError('La empresa no tiene suscripción configurada', 409, 'SUBSCRIPTION_REQUIRED');
  }
  return { empresa, suscripcion };
}

async function registrarHistorial(connection, {
  empresa,
  suscripcion,
  anterior,
  nuevo,
  tipoEvento,
  motivo = null,
  superAdminId = null,
  meses = null,
  origen = 'super_admin',
}) {
  await connection.query(
    `INSERT INTO historial_suscripciones (
       suscripcion_id, empresa_id, tipo_evento,
       estado_empresa_anterior, estado_empresa_nuevo,
       estado_suscripcion_anterior, estado_suscripcion_nuevo,
       fecha_inicio_anterior, fecha_inicio_nueva,
       fecha_vencimiento_anterior, fecha_vencimiento_nueva,
       dias_gracia_anterior, dias_gracia_nuevo,
       meses_renovados, motivo, super_admin_id, origen,
       datos_anteriores, datos_nuevos
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      suscripcion.id, empresa.id, tipoEvento,
      anterior.estado_empresa, nuevo.estado_empresa,
      anterior.estado, nuevo.estado,
      anterior.fecha_inicio, nuevo.fecha_inicio,
      anterior.fecha_vencimiento, nuevo.fecha_vencimiento,
      anterior.dias_gracia, nuevo.dias_gracia,
      meses, motivo, superAdminId, origen,
      serialize(anterior), serialize(nuevo),
    ]
  );
}

async function inTransaction(work) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    throw error;
  } finally {
    connection.release();
  }
}

async function cambiarEstadoEmpresa(connection, {
  empresaId, estado, motivo, superAdminId, tipoEvento,
}) {
  const { empresa, suscripcion } = await getSubscriptionLocked(connection, empresaId);
  const anterior = snapshot(empresa, suscripcion);
  if (empresa.estado === estado) return { anterior, nuevo: anterior, sin_cambios: true };
  await connection.query('UPDATE empresas SET estado = ? WHERE id = ?', [estado, empresa.id]);
  const nuevo = { ...anterior, estado_empresa: estado };
  await registrarHistorial(connection, {
    empresa, suscripcion, anterior, nuevo, tipoEvento, motivo, superAdminId,
  });
  return { anterior, nuevo, sin_cambios: false };
}

function suspenderEmpresaConSuscripcion(empresaId, options = {}) {
  return inTransaction(connection => cambiarEstadoEmpresa(connection, {
    empresaId, estado: 'suspendida', tipoEvento: 'SUSPENSION_EMPRESA', ...options,
  }));
}

function cancelarEmpresaConSuscripcion(empresaId, options = {}) {
  return inTransaction(connection => cambiarEstadoEmpresa(connection, {
    empresaId, estado: 'cancelada', tipoEvento: 'CANCELACION_EMPRESA', ...options,
  }));
}

function reactivarEmpresaConSuscripcion(empresaId, options = {}) {
  return inTransaction(async connection => {
    const { empresa, suscripcion } = await getSubscriptionLocked(connection, empresaId);
    const estadoSuscripcion = subscriptionAccess.calcularEstadoSuscripcion(suscripcion, options.hoy);
    const estado = suscripcion.tipo === 'prueba' ? 'prueba' : 'activa';
    const anterior = snapshot(empresa, suscripcion);
    await connection.query('UPDATE empresas SET estado = ? WHERE id = ?', [estado, empresa.id]);
    const nuevo = { ...anterior, estado_empresa: estado, estado: estadoSuscripcion };
    await registrarHistorial(connection, {
      empresa, suscripcion, anterior, nuevo,
      tipoEvento: 'REACTIVACION_EMPRESA', motivo: options.motivo,
      superAdminId: options.superAdminId,
    });
    return {
      anterior,
      nuevo,
      acceso_permitido: ESTADOS_CON_ACCESO.suscripcion.includes(estadoSuscripcion),
      requiere_renovacion: estadoSuscripcion === 'vencida',
    };
  });
}

async function renovarSuscripcionTransaccional(connection, {
  empresaId, meses, diasGracia = 0, motivo = null, planId = null,
  superAdminId = null, hoy = subscriptionAccess.todayString(),
}) {
  const { empresa, suscripcion } = await getSubscriptionLocked(connection, empresaId);
  const anterior = snapshot(empresa, suscripcion);
  const estadoAnterior = subscriptionAccess.calcularEstadoSuscripcion(suscripcion, hoy);
  const puedeExtender = anterior.fecha_vencimiento &&
    ['vigente', 'prueba', 'gracia'].includes(estadoAnterior) &&
    subscriptionAccess.diffDays(hoy, anterior.fecha_vencimiento) >= 0;
  const base = puedeExtender ? anterior.fecha_vencimiento : hoy;
  const fechaVencimiento = subscriptionAccess.addMonths(base, meses);
  let plan = null;
  if (planId) plan = await planAccess.obtenerPlanPorId(planId, connection);
  if (planId && (!plan || !plan.activo || !plan.asignable)) {
    throw lifecycleError('Plan no disponible para asignación', 409, 'PLAN_NOT_ASSIGNABLE');
  }
  const planCodigo = plan?.codigo || suscripcion.plan;
  const planCatalogoId = plan?.id || suscripcion.plan_id;
  const nuevo = {
    ...anterior,
    plan: planCodigo,
    plan_id: Number(planCatalogoId),
    tipo: 'comercial',
    estado: 'vigente',
    fecha_inicio: anterior.fecha_inicio || hoy,
    fecha_vencimiento: fechaVencimiento,
    dias_gracia: diasGracia,
    fecha_fin_gracia: subscriptionAccess.calcularFechaFinGracia(fechaVencimiento, diasGracia),
    duracion_meses: meses,
    // Renovar nunca modifica el estado operativo de la empresa.
    estado_empresa: empresa.estado,
  };
  await connection.query(
    `UPDATE suscripciones SET plan = ?, plan_id = ?, tipo = 'comercial', estado = 'vigente',
       fecha_inicio = ?, fecha_vencimiento = ?, dias_gracia = ?, fecha_fin_gracia = ?, duracion_meses = ?
     WHERE id = ?`,
    [nuevo.plan, nuevo.plan_id, nuevo.fecha_inicio, nuevo.fecha_vencimiento,
      nuevo.dias_gracia, nuevo.fecha_fin_gracia, meses, suscripcion.id]
  );
  await connection.query(
    'UPDATE empresas SET plan = ?, fecha_inicio = ?, fecha_vencimiento = ? WHERE id = ?',
    [nuevo.plan, nuevo.fecha_inicio, nuevo.fecha_vencimiento, empresa.id]
  );
  await registrarHistorial(connection, {
    empresa, suscripcion, anterior, nuevo, tipoEvento: 'RENOVACION', motivo,
    superAdminId, meses,
  });
  return {
    empresa, suscripcion, previous: anterior, next: nuevo,
    estado_empresa: empresa.estado,
    requiere_reactivacion_explicita: ['cancelada', 'suspendida'].includes(String(empresa.estado).toLowerCase()),
  };
}

function renovarSuscripcion(empresaId, options) {
  return inTransaction(connection => renovarSuscripcionTransaccional(connection, { empresaId, ...options }));
}

async function aplicarVencimientosPendientes({ hoy = subscriptionAccess.todayString() } = {}) {
  const [rows] = await db.query(
    `SELECT empresa_id FROM suscripciones
     WHERE fecha_vencimiento IS NOT NULL
       AND fecha_vencimiento < ?`,
    [hoy]
  );
  const resultados = [];
  for (const row of rows) {
    resultados.push(await inTransaction(async connection => {
      const { empresa, suscripcion } = await getSubscriptionLocked(connection, row.empresa_id);
      const anterior = snapshot(empresa, suscripcion);
      const estado = subscriptionAccess.calcularEstadoSuscripcion(suscripcion, hoy);
      if (estado === suscripcion.estado) return { empresa_id: row.empresa_id, aplicado: false };
      await connection.query('UPDATE suscripciones SET estado = ? WHERE id = ?', [estado, suscripcion.id]);
      const nuevo = { ...anterior, estado };
      await registrarHistorial(connection, {
        empresa, suscripcion, anterior, nuevo, tipoEvento: 'VENCIMIENTO_AUTOMATICO',
        motivo: 'Procesamiento de vencimientos pendientes', origen: 'automatico',
      });
      return { empresa_id: row.empresa_id, aplicado: true, estado };
    }));
  }
  return resultados;
}

async function aplicarCambiosPlanProgramados({ hoy = subscriptionAccess.todayString() } = {}) {
  const [rows] = await db.query(
    `SELECT empresa_id FROM suscripciones
     WHERE plan_programado_id IS NOT NULL AND cambio_plan_efectivo_en <= ?`,
    [hoy]
  );
  const resultados = [];
  for (const row of rows) {
    resultados.push(await inTransaction(connection =>
      planAccess.aplicarCambioPlanProgramadoTransaccional(connection, row.empresa_id, { hoy })));
  }
  return resultados;
}

async function procesarPendientes(options = {}) {
  const vencimientos = await aplicarVencimientosPendientes(options);
  const cambiosPlan = await aplicarCambiosPlanProgramados(options);
  return {
    vencimientos,
    cambios_plan: cambiosPlan,
    resumen: {
      vencimientos_aplicados: vencimientos.filter(item => item.aplicado).length,
      cambios_plan_aplicados: cambiosPlan.filter(item => item.aplicado).length,
    },
  };
}

module.exports = {
  ESTADOS_EMPRESA,
  ESTADOS_SUSCRIPCION,
  ESTADOS_CON_ACCESO,
  suspenderEmpresaConSuscripcion,
  cancelarEmpresaConSuscripcion,
  reactivarEmpresaConSuscripcion,
  renovarSuscripcion,
  renovarSuscripcionTransaccional,
  aplicarVencimientosPendientes,
  aplicarCambiosPlanProgramados,
  procesarPendientes,
};
