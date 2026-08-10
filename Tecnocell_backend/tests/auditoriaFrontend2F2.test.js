'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = relative => fs.readFileSync(path.join(__dirname, '..', '..', relative), 'utf8');
const page = read('src/pages/Auditoria/AuditoriaPage.tsx');
const service = read('src/services/auditoriaService.ts');
const routes = read('src/routes.tsx');
const sidebar = read('src/components/common/Sidebar.tsx');

assert.match(routes, /path: "\/auditoria"[\s\S]{0,140}PERMISSIONS\.AUDITORIA_VER/);
assert.match(sidebar, /to: "\/auditoria"[\s\S]{0,140}permission: "auditoria\.ver"/);
assert.doesNotMatch(page, /role\s*===|ADMINISTRADOR|isAdmin/);

assert.match(service, /ACTIVE_BRANCH_STORAGE_KEY/);
assert.match(service, /headers\['X-Sucursal-Id'\]\s*=\s*sucursalId/);
assert.match(page, /useSucursalContext\(state => state\.mode\)/);
assert.match(page, /useSucursalContext\(state => state\.sucursalActiva\)/);
assert.match(page, /useSucursalContext\(state => state\.sucursales\)/);
assert.match(page, /useSucursalContext\(state => state\.contextVersion\)/);
assert.match(page, /mode === 'specific'[\s\S]{0,180}selected !== Number\(sucursalActiva\?\.id\)/);
assert.match(page, /mode === 'consolidated'[\s\S]{0,100}Todas las sucursales permitidas/);
assert.match(page, /allowedSucursalIds\.has\(selected\)/);
assert.doesNotMatch(page, /sucursal_id:\s*e\.target\.value/);

assert.match(page, /if \(sucursalId === null\) return 'Empresa'/);
assert.match(page, /sucursalNombre\(log\.sucursal_id\)/);
assert.match(page, /sucursalNombre\(detail\.sucursal_id\)/);
assert.match(page, /<JsonBlock label="Metadata" value=\{detail\.metadata\}/);
assert.match(page, /Datos anteriores/);
assert.match(page, /Datos nuevos/);
assert.match(page, /Object\.keys\(value as object\)\.length === 0/);

assert.match(page, /useEffect\(\(\) => \{ loadLogs\(filters\); \}, \[filters, contextVersion\]\)/);
assert.match(page, /setDraft\(\{\}\)[\s\S]{0,120}setFilters\(\{ page: 1, limit: 25 \}\)/);
assert.match(service, /sucursal_id: number \| null/);
assert.match(service, /metadata\?: unknown/);

console.log('OK auditoriaFrontend2F2: permiso, contexto, filtros, tabla y detalle multisucursal');
