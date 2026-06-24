const assert = require('assert');
const fs = require('fs');
const path = require('path');

const form = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'pages', 'SuperAdmin', 'SuperAdminEmpresaFormPage.tsx'),
  'utf8'
);

assert.match(form, /form\.fecha_inicio > form\.fecha_vencimiento/);
assert.match(form, /Number\(form\.dias_gracia\) < 0/);
assert.match(form, /type="date"/);
assert.match(form, /min=\{form\.fecha_inicio\}/);
assert.match(form, /tipo_suscripcion/);

console.log('OK subscriptionFrontendForm: validaciones mínimas del formulario presentes');
