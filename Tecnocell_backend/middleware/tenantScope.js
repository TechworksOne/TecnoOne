const tenantScope = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  const empresa_id = req.user.empresa_id ?? null;
  const isSuperadmin = req.user.role === 'superadmin';

  if (isSuperadmin && empresa_id === null) {
    req.tenant = { empresa_id, isSuperadmin };
    return next();
  }

  if (!isSuperadmin && empresa_id === null) {
    return res.status(403).json({ message: 'Empresa no asignada al usuario' });
  }

  req.tenant = { empresa_id, isSuperadmin };
  return next();
};

module.exports = tenantScope;
