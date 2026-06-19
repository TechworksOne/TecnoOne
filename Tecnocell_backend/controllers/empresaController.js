const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { imageFileFilter, getSafeImageExtension } = require('../utils/uploadSecurity');
const { validatePhone } = require('../utils/phoneValidation');
const auditoriaService = require('../services/auditoriaService');

const UPLOADS_BASE = path.join(__dirname, '..', 'uploads');
const MONEDAS_PERMITIDAS = {
  GTQ: 'Q',
  USD: '$',
  MXN: '$',
  HNL: 'L',
  CRC: '₡',
  NIO: 'C$',
  PAB: 'B/.',
};

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

const normalizeCurrencyCode = (value) => {
  const text = normalizeText(value);
  if (!text) return null;
  return text.toUpperCase();
};

const buildEmpresaSelect = () => `
  SELECT
    id,
    nombre,
    nombre_comercial,
    razon_social,
    nit,
    slug,
    estado,
    plan,
    fecha_inicio,
    fecha_vencimiento,
    telefono,
    email,
    correo,
    direccion,
    logo_url,
    color_primario,
    color_principal,
    moneda_codigo,
    moneda_simbolo,
    zona_horaria,
    precio_revision_default,
    condiciones_servicio_contrato,
    created_at,
    updated_at
  FROM empresas
  WHERE id = ?
  LIMIT 1
`;

const formatEmpresaResponse = (empresa) => ({
  ...empresa,
  nombre_comercial: empresa.nombre_comercial || empresa.nombre,
  correo: empresa.correo || empresa.email || null,
  color_principal: empresa.color_principal || empresa.color_primario || '#2563eb',
  color_primario: empresa.color_primario || empresa.color_principal || '#2563eb',
  moneda_codigo: empresa.moneda_codigo || 'GTQ',
  moneda_simbolo: empresa.moneda_simbolo || MONEDAS_PERMITIDAS[empresa.moneda_codigo] || 'Q',
  zona_horaria: empresa.zona_horaria || 'America/Guatemala',
  precio_revision_default: empresa.precio_revision_default != null ? Number(empresa.precio_revision_default) : null,
  condiciones_servicio_contrato: empresa.condiciones_servicio_contrato || null,
});

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const empresaId = getTenantEmpresaId(req);
    const destDir = path.join(UPLOADS_BASE, 'empresas', String(empresaId), 'logo');
    fs.mkdirSync(destDir, { recursive: true });
    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    const ext = getSafeImageExtension(file, '.png');
    cb(null, `logo_${Date.now()}${ext}`);
  },
});

const uploadLogo = multer({
  storage: logoStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 3 * 1024 * 1024 },
});

const getEmpresaMe = async (req, res) => {
  try {
    const empresaId = getTenantEmpresaId(req);

    if (!empresaId) {
      return res.status(403).json({
        success: false,
        message: 'No hay empresa asignada para este usuario',
      });
    }

    const [[empresa]] = await db.query(buildEmpresaSelect(), [empresaId]);

    if (!empresa) {
      return res.status(404).json({
        success: false,
        message: 'Empresa no encontrada',
      });
    }

    return res.json({
      success: true,
      data: formatEmpresaResponse(empresa),
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
      nombre_comercial,
      razon_social,
      nit,
      telefono,
      email,
      correo,
      direccion,
      logo_url,
      color_primario,
      color_principal,
      moneda_codigo,
      moneda_simbolo,
      zona_horaria,
      precio_revision_default,
      condiciones_servicio_contrato,
    } = req.body || {};

    const telefonoValidado = validatePhone(telefono, {
      label: 'El teléfono de la empresa',
    });

    if (!telefonoValidado.ok) {
      return res.status(400).json({
        success: false,
        message: telefonoValidado.message,
      });
    }

    const telefonoNormalizado = telefonoValidado.value;

    const updates = [];
    const params = [];
    const correoValue = correo !== undefined ? correo : email;
    const colorValue = color_principal !== undefined ? color_principal : color_primario;
    const monedaCodigoValue = moneda_codigo === undefined ? undefined : normalizeCurrencyCode(moneda_codigo);
    const monedaSimboloValue = moneda_simbolo === undefined ? undefined : normalizeText(moneda_simbolo);

    const allowedFields = {
      nombre: nombre === undefined ? undefined : normalizeText(nombre),
      nombre_comercial: nombre_comercial === undefined ? undefined : normalizeText(nombre_comercial),
      razon_social: razon_social === undefined ? undefined : normalizeText(razon_social),
      nit: nit === undefined ? undefined : normalizeText(nit),
      telefono: telefono === undefined ? undefined : telefonoNormalizado,
      email: correoValue === undefined ? undefined : normalizeText(correoValue),
      correo: correoValue === undefined ? undefined : normalizeText(correoValue),
      direccion: direccion === undefined ? undefined : normalizeText(direccion),
      logo_url: logo_url === undefined ? undefined : normalizeText(logo_url),
      color_primario: colorValue === undefined ? undefined : normalizeColor(colorValue),
      color_principal: colorValue === undefined ? undefined : normalizeColor(colorValue),
      moneda_codigo: monedaCodigoValue,
      moneda_simbolo: monedaSimboloValue,
      zona_horaria: zona_horaria === undefined ? undefined : normalizeText(zona_horaria),
      precio_revision_default: precio_revision_default === undefined
        ? undefined
        : (precio_revision_default === null || precio_revision_default === '')
          ? null
          : parseFloat(precio_revision_default),
      condiciones_servicio_contrato: condiciones_servicio_contrato === undefined
        ? undefined
        : (condiciones_servicio_contrato === null ? null : String(condiciones_servicio_contrato)),
    };

    if (colorValue !== undefined && allowedFields.color_principal === null && normalizeText(colorValue)) {
      return res.status(400).json({
        success: false,
        message: 'El color principal debe tener formato hexadecimal, por ejemplo #2563eb',
      });
    }

    if (monedaCodigoValue && !MONEDAS_PERMITIDAS[monedaCodigoValue]) {
      return res.status(400).json({
        success: false,
        message: 'La moneda seleccionada no es válida',
      });
    }

    if (allowedFields.moneda_codigo && moneda_simbolo === undefined) {
      allowedFields.moneda_simbolo = MONEDAS_PERMITIDAS[allowedFields.moneda_codigo];
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

    const [[empresa]] = await db.query(buildEmpresaSelect(), [empresaId]);

    await auditoriaService.registrar({
      req,
      empresaId,
      accion: 'EDITAR',
      entidad: 'EMPRESA',
      entidadId: empresaId,
      descripcion: 'Configuración de empresa actualizada',
      datosNuevos: allowedFields,
    });
    return res.json({
      success: true,
      message: 'Empresa actualizada correctamente',
      data: formatEmpresaResponse(empresa),
    });
  } catch (error) {
    console.error('Error en updateEmpresaMe:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar la empresa',
    });
  }
};

const updateEmpresaLogo = async (req, res) => {
  try {
    const empresaId = getTenantEmpresaId(req);

    if (!empresaId) {
      return res.status(403).json({
        success: false,
        message: 'No hay empresa asignada para este usuario',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Debes seleccionar una imagen para el logo',
      });
    }

    const logoUrl = `/uploads/empresas/${empresaId}/logo/${req.file.filename}`;

    await db.query(
      'UPDATE empresas SET logo_url = ? WHERE id = ?',
      [logoUrl, empresaId]
    );

    const [[empresa]] = await db.query(buildEmpresaSelect(), [empresaId]);

    return res.json({
      success: true,
      message: 'Logo actualizado correctamente',
      data: formatEmpresaResponse(empresa),
    });
  } catch (error) {
    console.error('Error en updateEmpresaLogo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar el logo de la empresa',
    });
  }
};

module.exports = {
  uploadLogo,
  getEmpresaMe,
  updateEmpresaMe,
  updateEmpresaLogo,
};
