const db = require('../config/database');

(async () => {
  try {
    console.log('🔍 Consultando usuarios en la base de datos...\n');

    const [users] = await db.query('SELECT id, username, email, name, role, active FROM users');

    console.log('👥 USUARIOS ENCONTRADOS:');
    console.log('========================\n');

    users.forEach(user => {
      console.log(`ID: ${user.id}`);
      console.log(`Username: ${user.username}`);
      console.log(`Email: ${user.email}`);
      console.log(`Name: ${user.name}`);
      console.log(`Role: ${user.role}`);
      console.log(`Active: ${user.active ? 'Sí' : 'No'}`);
      console.log('------------------------\n');
    });

    // Probar login con bcrypt
    const bcrypt = require('bcrypt');
    const testPassword = 'admin123';
    const [testUser] = await db.query('SELECT username, password FROM users WHERE username = ?', ['admin']);

    if (testUser.length > 0) {
      console.log('🔐 PRUEBA DE CONTRASEÑA:');
      console.log(`Usuario: ${testUser[0].username}`);
      console.log(`Password hash en BD: ${testUser[0].password.substring(0, 30)}...`);
      console.log(`Password a probar: ${testPassword}`);

      const isValid = await bcrypt.compare(testPassword, testUser[0].password);
      console.log(`¿Password válido?: ${isValid ? '✅ SÍ' : '❌ NO'}\n`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
