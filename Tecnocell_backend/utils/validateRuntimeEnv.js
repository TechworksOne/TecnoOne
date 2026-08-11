'use strict';

const REQUIRED = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'];

function validateRuntimeEnv(env = process.env) {
  const missing = REQUIRED.filter(name => !String(env[name] || '').trim());
  const placeholders = REQUIRED.filter(name => /CAMBIAR|CHANGE_ME/i.test(String(env[name] || '')));
  if (missing.length || placeholders.length) {
    const details = [
      missing.length ? `faltantes: ${missing.join(', ')}` : null,
      placeholders.length ? `valores de ejemplo: ${placeholders.join(', ')}` : null,
    ].filter(Boolean).join('; ');
    throw new Error(`Configuracion de entorno invalida (${details})`);
  }
}

module.exports = { REQUIRED, validateRuntimeEnv };
