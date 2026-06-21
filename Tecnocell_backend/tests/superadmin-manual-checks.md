# Pruebas manuales Sprint 1.15.1

Variables:

```bash
export API_URL=http://localhost:3000/api
export TOKEN_SUPER_ADMIN="<token>"
export TOKEN_ADMIN_EMPRESA="<token>"
export TOKEN_TECNICO="<token>"
export TOKEN_VENTAS="<token>"
```

## Acceso

```bash
curl -i -H "Authorization: Bearer $TOKEN_SUPER_ADMIN" "$API_URL/superadmin/me"
curl -i -H "Authorization: Bearer $TOKEN_ADMIN_EMPRESA" "$API_URL/superadmin/me"
curl -i -H "Authorization: Bearer $TOKEN_TECNICO" "$API_URL/superadmin/me"
curl -i -H "Authorization: Bearer $TOKEN_VENTAS" "$API_URL/superadmin/me"
curl -i -H "Authorization: Bearer token-invalido" "$API_URL/superadmin/me"
```

Esperado: `200`, `403`, `403`, `403`, `401`.

## Empresas

```bash
curl -i -H "Authorization: Bearer $TOKEN_SUPER_ADMIN" \
  "$API_URL/superadmin/empresas?page=1&limit=20&search=demo&estado=activa&order_by=created_at&order_dir=desc"

curl -i -H "Authorization: Bearer $TOKEN_SUPER_ADMIN" \
  "$API_URL/superadmin/empresas/1"

curl -i -X POST \
  -H "Authorization: Bearer $TOKEN_SUPER_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Empresa QA","slug":"empresa-qa","nit":"QA-001","estado":"demo","plan":"demo"}' \
  "$API_URL/superadmin/empresas"

curl -i -X PUT \
  -H "Authorization: Bearer $TOKEN_SUPER_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"nombre_comercial":"Empresa QA Actualizada","telefono":"55555555"}' \
  "$API_URL/superadmin/empresas/3"

curl -i -X PATCH \
  -H "Authorization: Bearer $TOKEN_SUPER_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"estado":"suspendida"}' \
  "$API_URL/superadmin/empresas/3/estado"
```

## Administrador principal

```bash
curl -i -X POST \
  -H "Authorization: Bearer $TOKEN_SUPER_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin.qa","email":"admin.qa@example.com","password":"Cambiar-123","nombres":"Admin","apellidos":"QA"}' \
  "$API_URL/superadmin/empresas/3/administrador"
```

Repetir el comando debe devolver `409` y no crear registros parciales.

## SQL de verificación

```sql
SELECT id, username, email, role, tipo_usuario, es_super_admin, empresa_id, active
FROM users
ORDER BY id;

SELECT id, nombre, slug, estado, plan, created_at
FROM empresas
ORDER BY id;

SELECT u.id, u.username, u.empresa_id, r.nombre AS rol
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
ORDER BY u.id;

SELECT empresa_id, rol_id, COUNT(*) AS permisos
FROM rol_permisos
GROUP BY empresa_id, rol_id;

SELECT id, super_admin_id, accion, entidad, entidad_id, fecha_creacion
FROM auditoria_super_admin
ORDER BY id DESC;

SELECT COUNT(*) AS plataforma_con_empresa
FROM users
WHERE tipo_usuario = 'PLATAFORMA' AND empresa_id IS NOT NULL;

SELECT COUNT(*) AS super_admin_invalido
FROM users
WHERE es_super_admin = 1
  AND (tipo_usuario <> 'PLATAFORMA' OR empresa_id IS NOT NULL OR active <> 1);
```
