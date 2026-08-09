'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(
  __dirname,
  '..',
  '..',
);

function read(relative) {
  return fs.readFileSync(
    path.join(root, relative),
    'utf8',
  );
}

const controller = read(
  'Tecnocell_backend/controllers/cajaController.js',
);

const routes = read(
  'Tecnocell_backend/routes/cajaRoutes.js',
);

const migration = read(
  'Tecnocell_backend/scripts/migration_caja_chica_multisucursal_sprint_2d1.sql',
);

const page = read(
  'src/pages/CajaBancos/CajaBancosPage.tsx',
);

// Migración estructural.
assert.match(
  migration,
  /ADD COLUMN IF NOT EXISTS sucursal_id BIGINT UNSIGNED NULL/,
);

assert.match(
  migration,
  /idx_caja_chica_empresa_sucursal/,
);

assert.match(
  migration,
  /idx_caja_chica_scope_estado/,
);

assert.doesNotMatch(
  migration,
  /\bUPDATE\s+caja_chica\b/i,
  'La migración no debe reasignar históricos',
);

// Branch middleware.
assert.match(
  routes,
  /require\('\.\.\/middleware\/branchScope'\)/,
);

assert.match(
  routes,
  /require\('\.\.\/middleware\/requireBranchSpecific'\)/,
);

assert.match(
  routes,
  /router\.use\(branchScope\)/,
);

assert.match(
  routes,
  /\/caja-chica\/movimiento[\s\S]{0,180}requireBranchSpecific/,
);

assert.match(
  routes,
  /\/caja-chica\/confirmar\/:id[\s\S]{0,180}requireBranchSpecific/,
);

// Scope backend.
assert.match(
  controller,
  /function cajaChicaScope/,
);

assert.match(
  controller,
  /scope\?\.mode === 'specific'/,
);

assert.match(
  controller,
  /scope\?\.mode === 'consolidated'/,
);

assert.match(
  controller,
  /allowedSucursalIds/,
);

assert.match(
  controller,
  /sucursal_id IN/,
);

assert.match(
  controller,
  /sucursal_id IS NULL/,
);

// Las escrituras toman sucursal desde branchScope.
assert.match(
  controller,
  /scope\.sucursalId/,
);

assert.match(
  controller,
  /INSERT INTO caja_chica \([\s\S]{0,180}sucursal_id/,
);

assert.doesNotMatch(
  controller,
  /const\s*\{[^}]*sucursal_id[^}]*\}\s*=\s*req\.body/,
  'No se debe confiar en sucursal_id del body',
);

// Lecturas incluyen nombre de sucursal.
assert.match(
  controller,
  /s\.nombre AS sucursal_nombre/,
);

// Frontend responde al contexto global.
assert.match(
  page,
  /useSucursalContext/,
);

assert.match(
  page,
  /contextVersion/,
);

assert.match(
  page,
  /branchMode === 'specific'/,
);

assert.match(
  page,
  /Consolidado · solo lectura/,
);

assert.match(
  page,
  /disabled=\{!isSpecificBranch\}/,
);

assert.match(
  page,
  /const branchHeaderValue/,
);

assert.match(
  page,
  /'X-Sucursal-Id': branchHeaderValue/,
);

assert.match(
  page,
  /getFinancialRequestConfig\(token\)/,
);

assert.match(
  page,
  /sucursalActiva\?\.id/,
);


console.log(
  'OK cajaChicaMultisucursal2D1: scope por sucursal, consolidado read-only y migración sin backfill',
);
