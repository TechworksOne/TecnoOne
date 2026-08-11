# Sprint 2I - UAT / Release Candidate

Base validada: `sprint/2i-uat-release` en `7aba30c`.

## Matriz UAT

Marcar cada caso como `PASS`, `FAIL` o `BLOCKED` y adjuntar empresa, usuario, sucursal, hora y evidencia.

| Area | Caso UAT concreto | Cobertura automatica | Manual |
|---|---|---|---|
| A Empresa/Super Admin | Empresa, plan/modulos y limite de sucursales | `superAdmin*`, `planEnforcement`, `limiteSucursales*` | [ ] |
| B Sucursales | Crear/editar, principal, asignacion, cambio specific/ALL | `sucursal*`, `usuarioSucursales*`, `branchScope` | [ ] |
| C RBAC | Roles, permisos, usuarios y acceso permitido/403 | `rbac*` | [ ] |
| D Inventario | Producto/repuesto, entrada/salida y no contaminacion A/B | `*Inventory*`, `inventarioMultisucursalMigration` | [ ] |
| E Caja Operativa | Apertura, efectivo, movimientos, cierre/diferencia e historial | `cajaSesion*`, `saleInventoryService` | [ ] |
| F Caja Chica | Movimiento, confirmacion, arqueo, reposicion y scope | `cajaChica*` | [ ] |
| G Bancos/Tarjetas | Movimiento, confirmacion unica, saldo y sucursal | `bancoConfirmacionConcurrencia2H2`, `tarjetaCajaChica2D2` | [ ] |
| H Ventas | Venta, metodos, inventario, anulacion, auditoria y total servidor | `ventasMultisucursal*`, `saleInventoryService`, `auditoriaFinanciera2F1BA` | [ ] |
| I Compras | Crear, origen, inventario, anulacion y ALL bloqueado | `compras*`, `purchaseInventoryService` | [ ] |
| J Reparaciones | Recepcion, imagenes/credenciales, repuestos, pagos, completar/cancelar, historial y ALL | `reparaciones*`, `flujoReparacion*`, `seguridadCriticaUploads2H1` | [ ] |
| K Deudores | Crear, pago/anulacion, scope, ALL y auditoria | `integridadFinancieraDeudores2H2` | [ ] |
| L Auditoria | Company/branch, specific/ALL y append-only | `auditoria*` | [ ] |
| M Reportes | Specific/ALL, por_sucursal, metricas, descuentos/anuladas, historial y CSV | `reportesMultisucursal2GA`, `reportesFrontend2GB`, `hardening2H3` | [ ] |
| N Agenda | Crear/consultar/editar/eliminar sin DDL runtime | `hardening2H3`, `uatRelease2I` | [ ] |
| O Seguridad | Upload sin token, cross-tenant/branch, rutas privadas y 500 seguro | `seguridadCriticaUploads2H1`, `hardening2H3`, `uatRelease2I` | [ ] |

## Instalacion nueva

1. Iniciar MariaDB 10.6 con una base completamente vacia.
2. Importar `Tecnocell_backend/database/tecnoone_baseline.sql`.
3. Crear la primera empresa mediante el flujo soportado.
4. Iniciar la aplicacion.

La baseline contiene estructura completa, PK/FK, indices, triggers y routines/events existentes. Sus unicos datos son los catalogos globales `modulos`, `permisos`, `planes` y `plan_modulos`. Se genera desde una DB actual validada con `npm run baseline:generate`.

## Instalaciones existentes

Nunca aplicar la baseline encima. Aplicar solamente migraciones posteriores que correspondan a la version instalada. Las migraciones legacy en `scripts/` son historia de upgrade, no bootstrap de instalaciones nuevas.

## Verificacion temporal de baseline

Con Docker Compose y la baseline generada:

```text
powershell -File Tecnocell_backend/scripts/verify_baseline_temp_2i.ps1
```

El script crea exclusivamente una DB con prefijo `tecnoone_baseline_verify_`, importa la baseline, comprueba 70 tablas, conteos globales, cero filas tenant, triggers/FK criticas y elimina la DB temporal. Nunca opera sobre `tecnoone_demo`.

## Backup y restauracion

Ejecutar `powershell -File Tecnocell_backend/scripts/backup_restore_verify_2i.ps1 -OutputDirectory C:\ruta\segura`. Genera dump consistente, SHA-256, restaura en una DB temporal, valida tablas esenciales y elimina exclusivamente esa DB temporal.

## Release readiness

- Requeridas: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`.
- No se admiten placeholders ni credenciales predeterminadas.
- Produccion usa `VITE_API_URL=/api`; `/api` y `/uploads` se proxyean al backend.
- Uploads deben ser persistentes y escribibles por UID 1001.
- `/health` exige proceso y DB saludables.
- Antes de release: importacion temporal de baseline, backup/restore y matriz manual completa.
