const db = require('../config/db');

async function columnExists(table, column) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS total
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column]
  );

  return Number(rows[0]?.total || 0) > 0;
}

async function addColumnIfMissing(table, column, definition) {
  const exists = await columnExists(table, column);

  if (exists) {
    console.log(`OK: ${table}.${column} ya existe`);
    return;
  }

  await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  console.log(`OK: agregada columna ${table}.${column}`);
}

async function main() {
  await addColumnIfMissing(
    'empresas',
    'precio_revision_default',
    'DECIMAL(10,2) NULL AFTER zona_horaria'
  );

  await addColumnIfMissing(
    'empresas',
    'condiciones_servicio_contrato',
    'TEXT NULL AFTER precio_revision_default'
  );

  await addColumnIfMissing(
    'reparaciones',
    'precio_revision_contrato',
    'DECIMAL(10,2) NULL'
  );

  await addColumnIfMissing(
    'reparaciones',
    'condiciones_servicio_contrato',
    'TEXT NULL'
  );

  console.log('Migración aplicada correctamente');
}

main()
  .catch((error) => {
    console.error('ERROR aplicando migración:', error);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await db.end();
    } catch (_) {}
  });
