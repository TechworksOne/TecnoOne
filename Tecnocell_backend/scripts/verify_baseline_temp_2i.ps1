param([string]$TemporaryDatabase = 'tecnoone_baseline_verify_2i')

$ErrorActionPreference = 'Stop'
if ($TemporaryDatabase -notmatch '^tecnoone_baseline_verify_[a-zA-Z0-9_]+$') {
  throw 'El nombre temporal debe iniciar con tecnoone_baseline_verify_.'
}

$baseline = (Resolve-Path (Join-Path $PSScriptRoot '..\database\tecnoone_baseline.sql')).Path
$containerId = (docker compose ps -q mysql).Trim()
if (-not $containerId) { throw 'El servicio mysql de Docker Compose no esta activo.' }

$verifyFile = New-TemporaryFile
$verifySql = @"
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$TemporaryDatabase' AND table_type='BASE TABLE';
SELECT COUNT(*) FROM modulos;
SELECT COUNT(*) FROM permisos;
SELECT COUNT(*) FROM planes;
SELECT COUNT(*) FROM plan_modulos;
SELECT SUM(total) FROM (
  SELECT COUNT(*) total FROM empresas UNION ALL SELECT COUNT(*) FROM sucursales
  UNION ALL SELECT COUNT(*) FROM users UNION ALL SELECT COUNT(*) FROM roles
  UNION ALL SELECT COUNT(*) FROM rol_permisos UNION ALL SELECT COUNT(*) FROM user_roles
  UNION ALL SELECT COUNT(*) FROM ventas UNION ALL SELECT COUNT(*) FROM reparaciones
  UNION ALL SELECT COUNT(*) FROM deudores UNION ALL SELECT COUNT(*) FROM auditoria_logs
) tenant_data;
SELECT COUNT(*) FROM information_schema.triggers
 WHERE trigger_schema='$TemporaryDatabase'
   AND trigger_name IN ('trg_auditoria_logs_append_only_update','trg_auditoria_logs_append_only_delete');
SELECT COUNT(*) FROM information_schema.key_column_usage
 WHERE table_schema='$TemporaryDatabase' AND referenced_table_name IS NOT NULL
   AND table_name='deudores' AND column_name='sucursal_id';
"@
Set-Content -LiteralPath $verifyFile -Value $verifySql -Encoding utf8

try {
  docker cp $baseline "${containerId}:/tmp/tecnoone_baseline.sql"
  docker cp $verifyFile "${containerId}:/tmp/verify_baseline.sql"
  docker compose exec -T mysql sh -lc "mariadb -uroot -p`"`$MARIADB_ROOT_PASSWORD`" -e 'DROP DATABASE IF EXISTS ``$TemporaryDatabase``; CREATE DATABASE ``$TemporaryDatabase`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'"
  docker compose exec -T mysql sh -lc "mariadb -uroot -p`"`$MARIADB_ROOT_PASSWORD`" '$TemporaryDatabase' < /tmp/tecnoone_baseline.sql"
  $actual = @(docker compose exec -T mysql sh -lc "mariadb -uroot -p`"`$MARIADB_ROOT_PASSWORD`" '$TemporaryDatabase' --batch --skip-column-names < /tmp/verify_baseline.sql")
  $expected = @('70', '20', '55', '5', '95', '0', '2', '1')
  if (($actual -join ',') -ne ($expected -join ',')) {
    throw "Conteos inesperados. Esperado=$($expected -join ',') Actual=$($actual -join ',')"
  }
  Write-Output "Baseline temporal verificada: $($actual -join ',')"
} finally {
  docker compose exec -T mysql sh -lc "mariadb -uroot -p`"`$MARIADB_ROOT_PASSWORD`" -e 'DROP DATABASE IF EXISTS ``$TemporaryDatabase``'" | Out-Null
  docker compose exec -T mysql sh -lc 'rm -f /tmp/tecnoone_baseline.sql /tmp/verify_baseline.sql' | Out-Null
  Remove-Item -LiteralPath $verifyFile -Force -ErrorAction SilentlyContinue
}
