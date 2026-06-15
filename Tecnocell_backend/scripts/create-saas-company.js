const bcrypt = require('bcrypt');
const db = require('../config/database');

const REQUIRED_ARGS = ['nombre', 'slug', 'username', 'email', 'password', 'adminName'];
const DEFAULT_PLAN = 'pro';
const DEFAULT_ESTADO = 'activa';
const DEFAULT_COLOR_PRIMARIO = '#2563eb';

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];

    if (!current.startsWith('--')) {
      continue;
    }

    const raw = current.slice(2);
    const equalIndex = raw.indexOf('=');

    if (equalIndex !== -1) {
      const key = raw.slice(0, equalIndex);
      const value = raw.slice(equalIndex + 1);
      args[key] = value.trim();
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[raw] = '';
      continue;
    }

    args[raw] = next.trim();
    i += 1;
  }

  return args;
}

function getMissingArgs(args) {
  return REQUIRED_ARGS.filter((key) => !args[key]);
}

function normalizeNullable(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return value;
}

function validateFechaVencimiento(fechaVencimiento) {
  if (!fechaVencimiento) {
    return;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaVencimiento)) {
    throw new Error('fechaVencimiento debe tener formato YYYY-MM-DD');
  }
}

async function assertNotExists(connection, sql, params, message) {
  const [rows] = await connection.query(sql, params);
  if (rows.length > 0) {
    throw new Error(message);
  }
}

async function createSaasCompany() {
  const args = parseArgs(process.argv.slice(2));
  const missing = getMissingArgs(args);

  if (missing.length > 0) {
    throw new Error(`Argumentos requeridos faltantes: ${missing.map((arg) => `--${arg}`).join(', ')}`);
  }

  validateFechaVencimiento(args.fechaVencimiento);

  const empresa = {
    nombre: args.nombre,
    razonSocial: normalizeNullable(args.razonSocial),
    nit: normalizeNullable(args.nit),
    slug: args.slug,
    telefono: normalizeNullable(args.telefono),
    direccion: normalizeNullable(args.direccion),
    plan: args.plan || DEFAULT_PLAN,
    estado: args.estado || DEFAULT_ESTADO,
    fechaVencimiento: normalizeNullable(args.fechaVencimiento),
    colorPrimario: DEFAULT_COLOR_PRIMARIO,
  };

  const admin = {
    username: args.username,
    email: args.email,
    password: args.password,
    nombres: args.adminName,
    apellidos: normalizeNullable(args.apellidos),
  };

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    await assertNotExists(
      connection,
      'SELECT id FROM empresas WHERE slug = ? LIMIT 1',
      [empresa.slug],
      `Ya existe una empresa con slug: ${empresa.slug}`
    );

    await assertNotExists(
      connection,
      'SELECT id FROM users WHERE username = ? LIMIT 1',
      [admin.username],
      `Ya existe un usuario con username: ${admin.username}`
    );

    await assertNotExists(
      connection,
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [admin.email],
      `Ya existe un usuario con email: ${admin.email}`
    );

    const [roles] = await connection.query(
      'SELECT id, nombre FROM roles WHERE nombre = ? LIMIT 1',
      ['ADMINISTRADOR']
    );

    if (roles.length === 0) {
      throw new Error('No existe el rol ADMINISTRADOR en la tabla roles');
    }

    const administradorRoleId = roles[0].id;

    const [empresaResult] = await connection.query(
      `
        INSERT INTO empresas (
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
          color_primario
        )
        VALUES (?, ?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?)
      `,
      [
        empresa.nombre,
        empresa.razonSocial,
        empresa.nit,
        empresa.slug,
        empresa.estado,
        empresa.plan,
        empresa.fechaVencimiento,
        empresa.telefono,
        admin.email,
        empresa.direccion,
        empresa.colorPrimario,
      ]
    );

    const empresaId = empresaResult.insertId;
    const passwordHash = await bcrypt.hash(admin.password, 10);

    const [userResult] = await connection.query(
      `
        INSERT INTO users (
          username,
          email,
          password,
          name,
          role,
          empresa_id,
          active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        admin.username,
        admin.email,
        passwordHash,
        admin.nombres,
        'admin',
        empresaId,
        1,
      ]
    );

    const adminUserId = userResult.insertId;

    await connection.query(
      `
        INSERT INTO user_profiles (
          user_id,
          nombres,
          apellidos,
          telefono,
          direccion
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        adminUserId,
        admin.nombres,
        admin.apellidos,
        empresa.telefono,
        empresa.direccion,
      ]
    );

    await connection.query(
      'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
      [adminUserId, administradorRoleId]
    );

    await connection.commit();

    console.log('Empresa SaaS creada correctamente');
    console.log(`empresa_id: ${empresaId}`);
    console.log(`nombre empresa: ${empresa.nombre}`);
    console.log(`slug: ${empresa.slug}`);
    console.log(`admin_user_id: ${adminUserId}`);
    console.log(`username: ${admin.username}`);
    console.log(`email: ${admin.email}`);
    console.log(`plan: ${empresa.plan}`);
    console.log(`estado: ${empresa.estado}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await db.end();
  }
}

createSaasCompany().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
