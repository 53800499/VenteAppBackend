-- Corrige settings.id : DEFAULT 1 bloquait toute 2e boutique (conflit settings_pkey).
-- Chaque boutique doit avoir sa propre ligne settings avec un id unique.

ALTER TABLE settings ALTER COLUMN id DROP DEFAULT;

CREATE SEQUENCE IF NOT EXISTS settings_id_seq;

SELECT setval(
  'settings_id_seq',
  COALESCE((SELECT MAX(id) FROM settings), 0) + 1,
  false
);

ALTER TABLE settings
  ALTER COLUMN id SET DEFAULT nextval('settings_id_seq');

ALTER SEQUENCE settings_id_seq OWNED BY settings.id;
