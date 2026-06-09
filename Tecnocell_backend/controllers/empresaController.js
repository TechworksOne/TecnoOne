const db = require('../config/database');

const getTenantEmpresaId = (req) => {
  const empresaId = req.tenant?.empresa_id ?? null;
  return empresaId;
};

const normalizeText = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
};

const normalizeColor = (value) => {
  const text = normalizeText(value);
  if (!text) return null;

  // Acepta colores hex simples: #2563eb, #fff
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(text)) {
    return text;
  }

  return null;
};

const getEmpresaMe = async (req, res) => {
  try {
    const empresaId = getTenantEmpresaId(req);

    if (!empresaId) {
      return res.status(403).json({
        success: false,
        message: 'No hay empresa asignada para este usuario',
      });
    }

    const [[empresa]] = await db.query(
      `SELECT
         id,
         nombre,
         razon_social,
         nit,
         slug,
         estado,
         plan,
         fecha_inicio,
         fecha_vencimiento,
         telefono,
         email,
         direccion,
         logo_url,
         color_primario,
         created_at,
         updated_at
       FROM empresas
       WHERE id = ?
       LIMIT 1`,
      [empresaId]
    );

    if (!empresa) {
      return res.status(404).json({
        success: false,
        message: 'Empresa no encontrada',
      });
    }

    return res.json({
      success: true,
      data: empresa,
    });
  } catch (error) {
    console.error('Error en getEmpresaMe:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener la empresa',
    });
  }
};

const updateEmpresaMe = async (req, res) => {
  try {
    const empresaId = getTenantEmpresaId(req);

    if (!empresaId) {
      return res.status(403).json({
        success: false,
        message: 'No hay empresa asignada para este usuario',
      });
    }

    const {
      nombre,
      razon_social,
      nit,
      telefono,
      email,
      direccion,
      logo_url,
      color_primario,
    } = req.body || {};

    const updates = [];
    const params = [];

    const allowedFields = {
      nombre: normalizeText(nombre),
      razon_social: normalizeText(razon_social),
      nit: normalizeText(nit),
      telefono: normalizeText(telefono),
      email: normalizeText(email),
      direccion: normalizeText(direccion),
      logo_url: normalizeText(logo_url),
      color_primario: color_primario === undefined ? undefined : normalizeColor(color_primario),
    };

    if (color_primario !== undefined && allowedFields.color_primario === null && normalizeText(color_primario)) {
      return res.status(400).json({
        success: false,
        message: 'El color primario debe tener formato hexadecimal, por ejemplo #2563eb',
      });
    }

    Object.entries(allowedFields).forEach(([field, value]) => {
      if (value !== undefined) {
        updates.push(`${field} = ?`);
        params.push(value);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se enviaron campos válidos para actualizar',
      });
    }

    if (allowedFields.nombre !== undefined && !allowedFields.nombre) {
      return res.status(400).json({
        success: false,
        message: 'El nombre de la empresa no puede quedar vacío',
      });
    }

    params.push(empresaId);

    const [result] = await db.query(
      `UPDATE empresas
       SET ${updates.join(', ')}
       WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Empresa no encontrada',
      });
    }

    const [[empresa]] = await db.query(
      `SELECT
         id,
         nombre,
         razon_social,
         nit,
         slug,
         estado,
         plan,
         fecha_inicio,
         fecha_vencimiento,
         telefono,
         email,
         direccion,
         logo_url,
         color_primario,
         created_at,
         updated_at
       FROM empresas
       WHERE id = ?
       LIMIT 1`,
      [empresaId]
    );

    return res.json({
      success: true,
      message: 'Empresa actualizada correctamente',
      data: empresa,
    });
  } catch (error) {
    console.error('Error en updateEmpresaMe:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar la empresa',
    });
  }
};

module.exports = {
  getEmpresaMe,
  updateEmpresaMe,
};
