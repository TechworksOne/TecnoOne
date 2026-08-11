param(
  [Parameter(Mandatory = $true)]
  [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $resolvedOutput -Force | Out-Null

$containerId = (docker compose ps -q mysql).Trim()
if (-not $containerId) { throw 'El servicio mysql de Docker Compose no esta activo.' }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupName = "tecnoone-$stamp.sql"
$backupPath = Join-Path $resolvedOutput $backupName
$remoteBackup = "/tmp/$backupName"
$temporaryDb = "tecnoone_restore_verify_$($stamp.Replace('-', '_'))"

try {
  docker compose exec -T mysql sh -lc "mariadb-dump -uroot -p`"`$MARIADB_ROOT_PASSWORD`" --single-transaction --routines --triggers `"`$MARIADB_DATABASE`" > '$remoteBackup'"
  if ($LASTEXITCODE -ne 0) { throw 'Fallo la generacion del backup.' }
  docker cp "${containerId}:$remoteBackup" $backupPath
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo copiar el backup al host.' }

  $checksum = Get-FileHash -Algorithm SHA256 -LiteralPath $backupPath
  $checksum | Format-List Algorithm, Hash, Path | Out-File -LiteralPath "$backupPath.sha256.txt" -Encoding ascii

  docker cp $backupPath "${containerId}:/tmp/restore-verify.sql"
  docker compose exec -T mysql sh -lc "mariadb -uroot -p`"`$MARIADB_ROOT_PASSWORD`" -e 'CREATE DATABASE ``$temporaryDb`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'"
  docker compose exec -T mysql sh -lc "mariadb -uroot -p`"`$MARIADB_ROOT_PASSWORD`" '$temporaryDb' < /tmp/restore-verify.sql"
  docker compose exec -T mysql sh -lc "mariadb -uroot -p`"`$MARIADB_ROOT_PASSWORD`" '$temporaryDb' -e \"SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema='$temporaryDb' AND table_name IN ('empresas','users','sucursales','ventas','compras','reparaciones','auditoria_logs') ORDER BY table_name\""
  if ($LASTEXITCODE -ne 0) { throw 'La validacion de la restauracion fallo.' }

  Write-Output "Backup verificado: $backupPath"
  Write-Output "SHA256: $($checksum.Hash)"
} finally {
  docker compose exec -T mysql sh -lc "mariadb -uroot -p`"`$MARIADB_ROOT_PASSWORD`" -e 'DROP DATABASE IF EXISTS ``$temporaryDb``'" | Out-Null
  docker compose exec -T mysql sh -lc "rm -f '$remoteBackup' /tmp/restore-verify.sql" | Out-Null
}
