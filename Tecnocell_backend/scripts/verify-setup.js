const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function verifySetup() {
  let connection;

  console.log('🔍 VERIFICANDO CONFIGURACIÓN DEL SISTEMA TECNOCELL\n');
  console.log('='.repeat(60));

  try {
    // 1. Verificar conexión a MySQL
    console.log('\n1️⃣  Verificando conexión a MySQL...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });
    console.log('   ✅ Conexión a MySQL exitosa');

    // 2. Verificar base de datos
    console.log('\n2️⃣  Verificando base de datos...');
    const [databases] = await connection.query(
      `SHOW DATABASES LIKE '${process.env.DB_NAME}'`
    );
    if (databases.length > 0) {
      console.log(`   ✅ Base de datos '${process.env.DB_NAME}' existe`);
    } else {
      console.log(`   ❌ Base de datos '${process.env.DB_NAME}' NO existe`);
      return;
    }

    // 3. Verificar tabla users
    console.log('\n3️⃣  Verificando tabla users...');
    const [usersTables] = await connection.query(
      `SHOW TABLES LIKE 'users'`
    );
    if (usersTables.length > 0) {
      console.log('   ✅ Tabla users existe');

      // Contar usuarios
      const [usersCount] = await connection.query(
        'SELECT COUNT(*) as total FROM users'
      );
      console.log(`   📊 Total de usuarios: ${usersCount[0].total}`);

      // Listar usuarios
      const [users] = await connection.query(
        'SELECT id, username, name, email, role, active FROM users'
      );
      console.log('\n   👥 Usuarios en el sistema:');
      users.forEach(user => {
        const status = user.active ? '✅' : '❌';
        console.log(`      ${status} ${user.username.padEnd(15)} | ${user.name.padEnd(25)} | ${user.role.padEnd(10)} | ${user.email}`);
      });
    } else {
      console.log('   ❌ Tabla users NO existe');
    }

    // 4. Verificar tabla customers
    console.log('\n4️⃣  Verificando tabla customers...');
    const [customersTables] = await connection.query(
      `SHOW TABLES LIKE 'customers'`
    );
    if (customersTables.length > 0) {
      console.log('   ✅ Tabla customers existe');

      const [customersCount] = await connection.query(
        'SELECT COUNT(*) as total FROM customers'
      );
      console.log(`   📊 Total de clientes: ${customersCount[0].total}`);
    } else {
      console.log('   ❌ Tabla customers NO existe');
    }

    // 5. Verificar configuración JWT
    console.log('\n5️⃣  Verificando configuración JWT...');
    if (process.env.JWT_SECRET) {
      console.log('   ✅ JWT_SECRET configurado');
    } else {
      console.log('   ⚠️  JWT_SECRET no configurado');
    }

    // 6. Resumen
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ VERIFICACIÓN COMPLETADA\n');
    console.log('🔑 Credenciales de acceso:');
    console.log('   Usuario: admin');
    console.log('   Contraseña: admin123');
    console.log('\n📍 URLs del sistema:');
    console.log(`   Backend:  http://localhost:${process.env.PORT || 3000}`);
    console.log('   Frontend: http://localhost:5173');
    console.log('\n🚀 Para iniciar el sistema:');
    console.log('   1. Backend:  npm run dev');
    console.log('   2. Frontend: npm run dev (en otra terminal)');
    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Solución: Verifica que XAMPP esté corriendo y MySQL esté activo');
    } else if (error.code === 'ER_DBACCESS_DENIED_ERROR') {
      console.log('\n💡 Solución: Verifica las credenciales en el archivo .env');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('\n💡 Solución: Ejecuta "npm run setup-db" para crear la base de datos');
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

verifySetup();
