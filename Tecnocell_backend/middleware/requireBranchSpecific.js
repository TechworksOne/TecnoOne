/**
 * Rechaza escrituras cuando el contexto no es una sucursal específica.
 * No depende de ningún servicio de inventario: valida req.branchScope directamente.
 */
function requireBranchSpecific(req, res, next) {
  if (req.branchScope?.mode === 'specific' && req.branchScope?.sucursalId) {
    return next();
  }
  return res.status(400).json({
    success: false,
    code: 'BRANCH_SPECIFIC_REQUIRED',
    message: 'Seleccione una sucursal específica para realizar esta operación.',
  });
}

module.exports = requireBranchSpecific;
