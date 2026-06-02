const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

// Crear pool de conexiones (más eficiente que conexiones individuales)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Convertir a promesas para usar async/await
const promisePool = pool.promise();

// Probar la conexión
promisePool.query('SELECT 1')
  .then(() => {
    console.log('✅ Conectado a MySQL correctamente');
  })
  .catch((err) => {
    console.error('❌ Error al conectar a MySQL:', err.message);
  });

module.exports = promisePool;
