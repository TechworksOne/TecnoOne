const tenantScope = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  const empresa_id = req.user.empresaId ?? req.user.empresa_id ?? null;
  const tipoUsuario = req.user.tipoUsuario ?? req.user.tipo_usuario ?? 'EMPRESA';
  const esSuperAdmin = Boolean(req.user.esSuperAdmin ?? req.user.es_super_admin);

  if (tipoUsuario === 'PLATAFORMA' || esSuperAdmin) {
    return res.status(403).json({
      message: 'Los usuarios de plataforma no pueden acceder a rutas empresariales',
    });
  }

  if (empresa_id === null) {
    return res.status(403).json({ message: 'Empresa no asignada al usuario' });
  }

  req.tenant = { empresa_id, isSuperadmin: false };
  return next();
};

module.exports = tenantScope;
