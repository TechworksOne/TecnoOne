const db = require('../config/database');

const SELECT = `SELECT c.id, c.empresa_id, c.sucursal_id, c.nombre, c.codigo,
  c.descripcion, c.activa, c.created_at, c.updated_at, s.nombre AS sucursal_nombre
  FROM cajas c INNER JOIN sucursales s ON s.id = c.sucursal_id AND s.empresa_id = c.empresa_id`;

exports.listar = async ({ empresaId, sucursalId, allowedSucursalIds }) => {
  const params = [empresaId];
  let where = ' WHERE c.empresa_id = ?';
  if (sucursalId) { where += ' AND c.sucursal_id = ?'; params.push(sucursalId); }
  else if (Array.isArray(allowedSucursalIds)) {
    if (!allowedSucursalIds.length) return [];
    where += ` AND c.sucursal_id IN (${allowedSucursalIds.map(() => '?').join(',')})`;
    params.push(...allowedSucursalIds);
  }
  const [rows] = await db.query(`${SELECT}${where} ORDER BY c.nombre, c.id`, params);
  return rows;
};

exports.buscar = async ({ id, empresaId, sucursalId }) => {
  const params = [id, empresaId];
  let where = ' WHERE c.id = ? AND c.empresa_id = ?';
  if (sucursalId) { where += ' AND c.sucursal_id = ?'; params.push(sucursalId); }
  const [[row]] = await db.query(`${SELECT}${where} LIMIT 1`, params);
  return row || null;
};

exports.sucursalPertenece = async (empresaId, sucursalId) => {
  const [[row]] = await db.query(
    'SELECT id FROM sucursales WHERE id = ? AND empresa_id = ? LIMIT 1',
    [sucursalId, empresaId]
  );
  return Boolean(row);
};

exports.crear = async ({ empresaId, sucursalId, nombre, codigo, descripcion }) => {
  const [result] = await db.query(
    `INSERT INTO cajas (empresa_id, sucursal_id, nombre, codigo, descripcion)
     VALUES (?, ?, ?, ?, ?)`,
    [empresaId, sucursalId, nombre, codigo, descripcion]
  );
  return exports.buscar({ id: result.insertId, empresaId, sucursalId });
};

exports.editar = async ({ id, empresaId, sucursalId, nombre, codigo, descripcion }) => {
  const [result] = await db.query(
    `UPDATE cajas SET nombre = ?, codigo = ?, descripcion = ?
     WHERE id = ? AND empresa_id = ? AND sucursal_id = ?`,
    [nombre, codigo, descripcion, id, empresaId, sucursalId]
  );
  if (!result.affectedRows) return null;
  return exports.buscar({ id, empresaId, sucursalId });
};

exports.cambiarEstado = async ({ id, empresaId, sucursalId, activa }) => {
  const [result] = await db.query(
    'UPDATE cajas SET activa = ? WHERE id = ? AND empresa_id = ? AND sucursal_id = ?',
    [activa ? 1 : 0, id, empresaId, sucursalId]
  );
  if (!result.affectedRows) return null;
  return exports.buscar({ id, empresaId, sucursalId });
};

exports.eliminar = async ({ id, empresaId, sucursalId }) => {
  const [result] = await db.query(
    'DELETE FROM cajas WHERE id = ? AND empresa_id = ? AND sucursal_id = ?',
    [id, empresaId, sucursalId]
  );
  return result.affectedRows > 0;
};

