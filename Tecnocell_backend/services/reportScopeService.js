function reportScopeError(message, statusCode = 403, code = 'REPORT_SCOPE_REQUIRED') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function validateDate(value, name) {
  if (value === undefined || value === null || value === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw reportScopeError(`${name} debe usar formato YYYY-MM-DD`, 400, 'INVALID_DATE');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw reportScopeError(`${name} no es una fecha válida`, 400, 'INVALID_DATE');
  }
  return value;
}

function validateRange(desde, hasta) {
  const start = validateDate(desde, 'desde');
  const end = validateDate(hasta, 'hasta');
  if (start && end && start > end) throw reportScopeError('desde no puede ser posterior a hasta', 400, 'INVALID_DATE_RANGE');
  return { desde: start, hasta: end };
}

function normalizeScope(req) {
  if (req.user?.esSuperAdmin || req.user?.es_super_admin || req.tenant?.isSuperadmin) {
    throw reportScopeError('Super Admin no utiliza reportes empresariales', 403, 'SUPERADMIN_REPORTS_FORBIDDEN');
  }
  const scope = req.branchScope;
  const tenantEmpresaId = Number(req.tenant?.empresa_id ?? req.user?.empresaId ?? req.user?.empresa_id);
  const empresaId = Number(scope?.empresaId);
  if (!Number.isInteger(empresaId) || empresaId <= 0 || !scope) {
    throw reportScopeError('Contexto empresarial y de sucursal requerido');
  }
  if (!Number.isInteger(tenantEmpresaId) || tenantEmpresaId !== empresaId) {
    throw reportScopeError('Contexto empresarial inconsistente', 403, 'REPORT_TENANT_MISMATCH');
  }
  if (scope.mode === 'specific') {
    const sucursalId = Number(scope.sucursalId);
    if (!Number.isInteger(sucursalId) || sucursalId <= 0) throw reportScopeError('Sucursal específica requerida');
    return { mode: 'specific', empresaId, sucursalIds: [sucursalId], sucursalId };
  }
  if (scope.mode === 'consolidated') {
    const sucursalIds = [...new Set((scope.allowedSucursalIds || []).map(Number)
      .filter(id => Number.isInteger(id) && id > 0))];
    return { mode: 'consolidated', empresaId, sucursalIds, sucursalId: null };
  }
  throw reportScopeError('Modo de sucursal inválido');
}

function reportScopeClause(req, alias = null) {
  const scope = normalizeScope(req);
  const prefix = alias ? `${alias}.` : '';
  if (!scope.sucursalIds.length) return { sql: ' AND 1 = 0', params: [], scope };
  const placeholders = scope.sucursalIds.map(() => '?').join(',');
  return {
    sql: ` AND ${prefix}empresa_id = ? AND ${prefix}sucursal_id IN (${placeholders})`,
    params: [scope.empresaId, ...scope.sucursalIds],
    scope,
  };
}

function inventoryStockClause(scope, alias, idColumn) {
  if (!scope.sucursalIds.length) return { sql: '0', params: [] };
  const table = idColumn === 'producto_id' ? 'producto_existencias' : 'repuesto_existencias';
  const itemAlias = idColumn === 'producto_id' ? 'pe' : 're';
  return {
    sql: `COALESCE((SELECT SUM(${itemAlias}.existencia) FROM ${table} ${itemAlias}
      WHERE ${itemAlias}.empresa_id = ${alias}.empresa_id
        AND ${itemAlias}.${idColumn} = ${alias}.id
        AND ${itemAlias}.sucursal_id IN (${scope.sucursalIds.map(() => '?').join(',')})), 0)`,
    params: scope.sucursalIds,
  };
}

module.exports = {
  normalizeScope, reportScopeClause, inventoryStockClause, reportScopeError,
  validateDate, validateRange,
};
