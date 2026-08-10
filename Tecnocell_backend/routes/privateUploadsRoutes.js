const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const { verifyToken } = require('../middleware/authMiddleware');
const tenantScope = require('../middleware/tenantScope');
const branchScope = require('../middleware/branchScope');
const permisoService = require('../services/permisoService');
const { resolveContainedPath } = require('../utils/repairUploadPath');

const router = express.Router();
const UPLOADS_BASE = path.resolve(__dirname, '..', 'uploads');

function normalizeRelativeUploadPath(rawPath) {
  let decoded;
  try { decoded = decodeURIComponent(String(rawPath || '')); } catch { return null; }
  if (!decoded || decoded.includes('\0') || decoded.includes('\\') || path.isAbsolute(decoded)) return null;
  const segments = decoded.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) return null;
  return segments.join('/');
}

function branchSql(scope, alias = 'r') {
  if (scope.mode === 'specific') return { sql: ` AND ${alias}.sucursal_id = ?`, params: [scope.sucursalId] };
  const ids = scope.allowedSucursalIds.map(Number).filter(Number.isInteger);
  if (!ids.length) return { sql: ' AND 1 = 0', params: [] };
  return { sql: ` AND ${alias}.sucursal_id IN (${ids.map(() => '?').join(',')})`, params: ids };
}

async function repairFileIsAuthorized(req, relativePath) {
  if (!(await permisoService.hasPermission(req, 'reparaciones.ver'))) return false;
  const empresaId = Number(req.tenant.empresa_id);
  const scope = branchSql(req.branchScope);
  const storedUrl = `/uploads/${relativePath}`;
  const [byImage] = await db.query(
    `SELECT r.id FROM reparaciones_imagenes ri
     INNER JOIN reparaciones r ON r.id = ri.reparacion_id
     WHERE ri.url_path = ? AND r.empresa_id = ?${scope.sql} LIMIT 1`,
    [storedUrl, empresaId, ...scope.params]
  );
  if (byImage.length) return true;
  const signature = relativePath.match(/^firmas\/reparaciones\/([1-9]\d*)\/firma_cliente\.png$/);
  if (!signature) return false;
  const [byRepair] = await db.query(
    `SELECT r.id FROM reparaciones r WHERE r.id = ? AND r.empresa_id = ?${scope.sql} LIMIT 1`,
    [Number(signature[1]), empresaId, ...scope.params]
  );
  return byRepair.length > 0;
}

async function companyFileIsAuthorized(req, relativePath) {
  const empresaId = Number(req.tenant.empresa_id);
  const parts = relativePath.split('/');
  if (parts[0] === 'empresas' || parts[0] === 'ventas') return Number(parts[1]) === empresaId;
  if (parts[0] === 'usuarios') {
    const [rows] = await db.query('SELECT id FROM users WHERE id = ? AND empresa_id = ? LIMIT 1', [Number(parts[1]), empresaId]);
    return rows.length > 0;
  }
  if (parts[0] === 'productos') {
    const [rows] = await db.query('SELECT id FROM productos WHERE id = ? AND empresa_id = ? LIMIT 1', [Number(parts[1]), empresaId]);
    return rows.length > 0;
  }
  if (parts[0] === 'repuestos') {
    const [rows] = await db.query(
      'SELECT id FROM repuestos WHERE empresa_id = ? AND imagenes LIKE ? LIMIT 1',
      [empresaId, `%/uploads/${relativePath}%`]
    );
    return rows.length > 0;
  }
  return false;
}

router.use(verifyToken, tenantScope, branchScope);
router.get('/*', async (req, res) => {
  try {
    const relativePath = normalizeRelativeUploadPath(req.params[0]);
    if (!relativePath) return res.status(400).json({ message: 'Ruta de archivo no valida' });
    const repairFile = relativePath.startsWith('reparaciones/') || relativePath.startsWith('firmas/reparaciones/');
    const authorized = repairFile
      ? await repairFileIsAuthorized(req, relativePath)
      : await companyFileIsAuthorized(req, relativePath);
    if (!authorized) return res.status(404).json({ message: 'Archivo no encontrado' });
    const filePath = resolveContainedPath(UPLOADS_BASE, ...relativePath.split('/'));
    const stat = await fs.promises.stat(filePath).catch(() => null);
    if (!stat?.isFile()) return res.status(404).json({ message: 'Archivo no encontrado' });
    res.set({
      'Cache-Control': 'private, no-store, max-age=0',
      'Content-Disposition': `inline; filename="${path.basename(filePath).replace(/["\\\r\n]/g, '_')}"`,
      'X-Content-Type-Options': 'nosniff',
    });
    return res.sendFile(filePath);
  } catch (error) {
    console.error('Error sirviendo archivo privado:', error.message);
    return res.status(404).json({ message: 'Archivo no encontrado' });
  }
});

module.exports = router;
