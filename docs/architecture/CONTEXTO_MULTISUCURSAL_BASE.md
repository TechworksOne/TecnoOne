# Base global del contexto multisucursal

## Contrato implementado

Las rutas que adopten `branchScope` aceptan el encabezado compatible `X-Sucursal-Id`:

- `<id>` crea contexto `specific` después de validar empresa, estado y asignación.
- `ALL` crea contexto `consolidated` si el usuario tiene `sucursales.contexto_consolidado`.

El middleware expone:

```js
req.branchScope = {
  mode: 'specific' | 'consolidated',
  empresaId,
  sucursalId,
  allowedSucursalIds,
};
```

`allowedSucursalIds` contiene únicamente sucursales activas asignadas. Los alias `req.sucursal`, `req.sucursal_id` y `req.sucursal_context` se conservan temporalmente en modo específico.

## Alcance inicial

Solo el catálogo de Cajas consume el contrato nuevo. En consolidado lista las cajas de las sucursales autorizadas y bloquea mutaciones. Inventario, ventas, compras, reparaciones, dashboard y Usuarios permanecen sin cambios funcionales.

El endpoint `/auth/mis-sucursales` devuelve `sucursales`, `canUseConsolidated` y `defaultSucursalId`. El topbar persiste un ID o `ALL` por usuario y emite un evento de invalidación al cambiar de contexto.
