const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(relative) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relative), 'utf8');
}

const service = read('src/services/adminUsuarioService.ts');
const page = read('src/pages/AdminUsuarios/AdminUsuariosPage.tsx');

assert.match(service, /\/admin\/usuarios\/\$\{id\}\/sucursales/);
assert.match(service, /sucursal_ids/);
assert.match(service, /predeterminada_id/);
assert.match(page, /Sucursales asignadas/);
assert.match(page, /type="checkbox"/);
assert.match(page, /type="radio"/);
assert.match(page, /Selecciona al menos una sucursal/);
assert.doesNotMatch(page, /selector de sucursal activa/i);

console.log('OK usuarioSucursalesFrontend: asignacion multiple y predeterminada validadas');
