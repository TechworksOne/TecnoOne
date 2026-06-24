const db = require('../config/database');
const permisoService = require('../services/permisoService');
const planAccessService = require('../services/planAccessService');
const auditoriaService = require('../services/auditoriaService');

function requireEmpresa(req, res) {
  const empresaId = req.tenant?.empresa_id;
  if (!empresaId) {
    res.status(403).json({ success: false, message: 'Se requiere un contexto de empresa válido' });
    return null;
  }
  return empresaId;
}

exports.getCatalogo = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, codigo, modulo, accion, nombre, descripcion
       FROM permisos ORDER BY modulo, nombre`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('getCatalogo permisos error:', error);
    res.status(500).json({ success: false, message: 'Error al obtener permisos' });
  }
};

exports.getMisPermisos = async (req, res) => {
  try {
    const permisos = await permisoService.getEffectivePermissions(req);
    res.json({ success: true, data: permisos });
  } catch (error) {
    console.error('getMisPermisos error:', error);
    res.status(500).json({ success: false, message: 'Error al obtener permisos efectivos' });
  }
};


exports.getMisModulos = async (req, res) => {
  try {
    const empresaId = requireEmpresa(req, res);
    if (!empresaId) return;

    const resumen =
      await planAccessService.obtenerResumenPlanEmpresa(
        empresaId
      );

    if (!resumen) {
      return res.status(404).json({
        success: false,
        code: 'EMPRESA_PLAN_NOT_FOUND',
        message: 'La empresa no tiene un plan configurado.'
      });
    }

    return res.json({
      success: true,
      data: {
        plan: {
          id: resumen.plan.id,
          codigo: resumen.plan.codigo,
          nombre: resumen.plan.nombre,
          max_usuarios: resumen.plan.max_usuarios,
          max_sucursales: resumen.plan.max_sucursales
        },
        modulos: resumen.modulos_habilitados
      }
    });
  } catch (error) {
    console.error('getMisModulos error:', error);

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      code: error.code || 'MODULES_LOAD_ERROR',
      message: 'Error al obtener los módulos contratados'
    });
  }
};

exports.getRoles = async (req, res) => {
  try {
    const empresaId = requireEmpresa(req, res);
    if (!empresaId) return;
    const [rows] = await db.query(
      `SELECT r.id, r.nombre, r.descripcion, r.activo, COUNT(DISTINCT u.id) AS total_usuarios
       FROM roles r
       INNER JOIN user_roles ur ON ur.role_id = r.id
       INNER JOIN users u ON u.id = ur.user_id AND u.empresa_id = ?
       GROUP BY r.id, r.nombre, r.descripcion, r.activo
       ORDER BY r.nombre`,
      [empresaId]
    );
    res.json({ success: true, data: rows.map(row => ({ ...row, activo: Boolean(row.activo) })) });
  } catch (error) {
    console.error('getRoles permisos error:', error);
    res.status(500).json({ success: false, message: 'Error al obtener roles' });
  }
};

exports.getRolPermisos = async (req, res) => {
  try {
    const empresaId = requireEmpresa(req, res);
    if (!empresaId) return;
    const [[role]] = await db.query(
      `SELECT r.id, r.nombre, r.descripcion
       FROM roles r
       WHERE r.id = ?
         AND EXISTS (
           SELECT 1 FROM user_roles ur
           INNER JOIN users u ON u.id = ur.user_id
           WHERE ur.role_id = r.id AND u.empresa_id = ?
         )
       LIMIT 1`,
      [req.params.rolId, empresaId]
    );
    if (!role) return res.status(404).json({ success: false, message: 'Rol no encontrado para la empresa' });

    const [permissions] = await db.query(
      `SELECT p.codigo
       FROM rol_permisos rp
       INNER JOIN permisos p ON p.id = rp.permiso_id
       WHERE rp.empresa_id = ? AND rp.rol_id = ?
       ORDER BY p.codigo`,
      [empresaId, role.id]
    );
    res.json({ success: true, data: { role, permisos: permissions.map(item => item.codigo) } });
  } catch (error) {
    console.error('getRolPermisos error:', error);
    res.status(500).json({ success: false, message: 'Error al obtener permisos del rol' });
  }
};

exports.updateRolPermisos = async (req, res) => {
  let connection;
  try {
    const empresaId = requireEmpresa(req, res);
    if (!empresaId) return;
    const codigos = Array.isArray(req.body?.permisos)
      ? [...new Set(req.body.permisos.map(code => String(code).trim()).filter(Boolean))]
      : null;
    if (!codigos) return res.status(400).json({ success: false, message: 'permisos debe ser una lista de códigos' });

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [[role]] = await connection.query(
      `SELECT r.id, r.nombre
       FROM roles r
       WHERE r.id = ?
         AND EXISTS (
           SELECT 1 FROM user_roles ur
           INNER JOIN users u ON u.id = ur.user_id
           WHERE ur.role_id = r.id AND u.empresa_id = ?
         )
       FOR UPDATE`,
      [req.params.rolId, empresaId]
    );
    if (!role) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Rol no encontrado para la empresa' });
    }

    const placeholders = codigos.map(() => '?').join(',');
    const [permissionRows] = codigos.length
      ? await connection.query(`SELECT id, codigo FROM permisos WHERE codigo IN (${placeholders})`, codigos)
      : [[]];
    if (permissionRows.length !== codigos.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Uno o más códigos de permiso no son válidos' });
    }

    const protectedCodes = ['usuarios.administrar', 'permisos.administrar'];
    if (String(role.nombre).toUpperCase() === 'ADMINISTRADOR' &&
        protectedCodes.some(code => !codigos.includes(code))) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'El rol ADMINISTRADOR debe conservar la administración de usuarios y permisos',
      });
    }

    const [previousRows] = await connection.query(
      `SELECT p.codigo FROM rol_permisos rp
       INNER JOIN permisos p ON p.id = rp.permiso_id
       WHERE rp.empresa_id = ? AND rp.rol_id = ?`,
      [empresaId, role.id]
    );

    await connection.query('DELETE FROM rol_permisos WHERE empresa_id = ? AND rol_id = ?', [empresaId, role.id]);
    for (const permission of permissionRows) {
      await connection.query(
        'INSERT INTO rol_permisos (empresa_id, rol_id, permiso_id) VALUES (?, ?, ?)',
        [empresaId, role.id, permission.id]
      );
    }
    await connection.commit();

    await auditoriaService.registrar({
      req,
      empresaId,
      accion: 'CAMBIAR_PERMISOS',
      entidad: 'ROL',
      entidadId: role.id,
      descripcion: `Permisos del rol ${role.nombre} actualizados`,
      datosAnteriores: { permisos: previousRows.map(item => item.codigo) },
      datosNuevos: { permisos: codigos },
    });
    res.json({ success: true, message: 'Permisos actualizados correctamente' });
  } catch (error) {
    if (connection) try { await connection.rollback(); } catch (_) {}
    console.error('updateRolPermisos error:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar permisos' });
  } finally {
    if (connection) connection.release();
  }
};
