'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'src', 'pages', 'CajaBancos', 'CajaBancosPage.tsx'),
  'utf8',
);

assert.match(page, /const \{ user, hasModule, hasPermission \} = useAuth\(\)/);
for (const permission of [
  'caja.ver',
  'caja.arquear',
  'caja.reponer',
  'caja.reponer_manual',
  'bancos.administrar',
]) {
  assert.match(page, new RegExp(`hasPermission\\('${permission.replace('.', '\\.')}\\'\\)`));
}

assert.match(page, /canReponerBanco[\s\S]{0,160}caja\.reponer[\s\S]{0,160}bancos\.administrar/);
assert.match(page, /disabled=\{!isSpecificBranch\}/);
assert.match(page, /Consolidado · historial de solo lectura/);
assert.match(page, /caja\/caja-chica\/arqueos/);
assert.match(page, /caja\/caja-chica\/reposiciones\/banco/);
assert.match(page, /caja\/caja-chica\/reposiciones\/manual/);
assert.match(page, /monto_contado/);
assert.match(page, /CUADRADO/);
assert.match(page, /SOBRANTE/);
assert.match(page, /FALTANTE/);
assert.match(page, /No ajusta ni mueve dinero/);
assert.match(page, /Historial de arqueos/);
assert.match(page, /params:\s*\{[\s\S]{0,100}pagina,[\s\S]{0,100}limite:/);
assert.match(page, /response\.data\.pagination\?\.pagina/);
assert.match(page, /response\.data\.pagination\?\.total/);
assert.match(page, />Anterior</);
assert.match(page, />Siguiente</);
assert.match(page, /Página \{paginacion\.pagina\} de \{totalPaginas\}/);
assert.match(page, /loadData\(1\)/);
assert.match(page, /saldo_teorico/);
assert.match(page, /usuario_nombre/);
assert.match(page, /Observaciones \{origenReposicion === 'MANUAL' \? '\(obligatorias\)'/);
assert.match(page, /La observación debe justificar la reposición manual/);
assert.match(page, /Impacto de la operación/);
assert.match(page, />Banco<[\s\S]{0,100}>-Q/);
assert.match(page, />Caja Chica<[\s\S]{0,100}>\+Q/);
assert.match(page, /await loadData\(\)/);
assert.doesNotMatch(page, /label: 'Reponer fondo'/);
assert.doesNotMatch(page, /sucursal_id\s*:/);

console.log('OK cajaChicaFrontend2D5: permisos efectivos, ALL read-only, arqueos y reposiciones');
