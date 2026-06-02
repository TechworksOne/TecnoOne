const bcrypt = require('bcrypt');
const db = require('../config/database');

(async () => {
  try {
    console.log('🔐 Generando nuevas contraseñas hasheadas...\n');

    const password = 'admin123';
    const hash = await bcrypt.hash(password, 10);

    console.log(`Password: ${password}`);
    console.log(`Hash generado: ${hash}\n`);

    console.log('📝 Actualizando usuarios...\n');

    // Actualizar admin
    await db.query('UPDATE users SET password = ? WHERE username = ?', [hash, 'admin']);
    console.log('✅ Usuario "admin" actualizado');

    // Actualizar empleado
    await db.query('UPDATE users SET password = ? WHERE username = ?', [hash, 'empleado']);
    console.log('✅ Usuario "empleado" actualizado');

    console.log('\n🔍 Verificando...\n');

    const [users] = await db.query('SELECT username, password FROM users');

    for (const user of users) {
      const isValid = await bcrypt.compare(password, user.password);
      console.log(`${user.username}: ${isValid ? '✅' : '❌'} Password válido`);
    }

    console.log('\n✅ Contraseñas actualizadas correctamente!');
    console.log('\n🔑 Credenciales de acceso:');
    console.log('   Usuario: admin');
    console.log('   Contraseña: admin123');
    console.log('   ');
    console.log('   Usuario: empleado');
    console.log('   Contraseña: admin123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
