-- Sprint 2H-3: agenda_eventos deja de crear/alterar estructura durante requests.
CREATE TABLE IF NOT EXISTS agenda_eventos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT(11) NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  fecha DATE NOT NULL,
  hora TIME DEFAULT NULL,
  descripcion TEXT DEFAULT NULL,
  tipo ENUM('nota','cita','recordatorio','otro') NOT NULL DEFAULT 'nota',
  color VARCHAR(20) DEFAULT NULL,
  creado_por VARCHAR(100) DEFAULT NULL,
  creado_por_id INT DEFAULT NULL,
  para_rol VARCHAR(50) DEFAULT NULL,
  para_usuario_id INT DEFAULT NULL,
  para_usuario_nombre VARCHAR(150) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_agenda_eventos_empresa_id (empresa_id),
  INDEX idx_agenda_eventos_empresa_fecha (empresa_id, fecha),
  INDEX idx_agenda_eventos_empresa_usuario (empresa_id, para_usuario_id),
  CONSTRAINT fk_agenda_eventos_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Compatibilidad con instalaciones historicas donde la tabla ya existia.
ALTER TABLE agenda_eventos ADD COLUMN IF NOT EXISTS empresa_id INT(11) NULL AFTER id;
ALTER TABLE agenda_eventos ADD COLUMN IF NOT EXISTS creado_por_id INT DEFAULT NULL;
ALTER TABLE agenda_eventos ADD COLUMN IF NOT EXISTS para_rol VARCHAR(50) DEFAULT NULL;
ALTER TABLE agenda_eventos ADD COLUMN IF NOT EXISTS para_usuario_id INT DEFAULT NULL;
ALTER TABLE agenda_eventos ADD COLUMN IF NOT EXISTS para_usuario_nombre VARCHAR(150) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_agenda_eventos_empresa_id ON agenda_eventos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_agenda_eventos_empresa_fecha ON agenda_eventos (empresa_id, fecha);
CREATE INDEX IF NOT EXISTS idx_agenda_eventos_empresa_usuario ON agenda_eventos (empresa_id, para_usuario_id);
