-- ================================================================
-- TecnoOne - Migración: firma digital en perfiles de usuario
-- ================================================================
-- Agrega la columna firma en user_profiles.
-- Necesaria porque el login carga el perfil del usuario e incluye firma.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS firma TEXT NULL AFTER foto_perfil;
