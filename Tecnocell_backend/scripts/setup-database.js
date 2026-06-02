const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

async function setupDatabase() {
  let connection;

  try {
    console.log('🔄 Conectando a MySQL...');

    // Conectar sin especificar base de datos para poder crearla
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      multipleStatements: true
    });

    console.log('✅ Conectado a MySQL');

    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, 'schema.sql');
    const sqlScript = fs.readFileSync(sqlPath, 'utf8');

    console.log('🔄 Ejecutando script SQL...');

    // Ejecutar el script
    const [results] = await connection.query(sqlScript);

    console.log('✅ Base de datos creada exitosamente');
    console.log('📊 Tablas creadas: users, customers');

    // Verificar usuarios creados
    await connection.query(`USE ${process.env.DB_NAME}`);
    const [users] = await connection.query('SELECT username, name, role FROM users');

    console.log('\n👥 Usuarios creados:');
    users.forEach(user => {
      console.log(`   - ${user.username} (${user.name}) - Rol: ${user.role}`);
    });

    console.log('\n🔑 Credenciales de acceso:');
    console.log('   Usuario: admin');
    console.log('   Contraseña: admin123');
    console.log('   ');
    console.log('   Usuario: empleado');
    console.log('   Contraseña: admin123');

  } catch (error) {
    console.error('❌ Error al configurar la base de datos:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Conexión cerrada');
    }
  }
}

// Ejecutar
setupDatabase();
