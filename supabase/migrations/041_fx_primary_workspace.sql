-- ARIKE — Mode workspace FX prioritaire (onglet Change en racine)

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS fx_primary_workspace BOOLEAN NOT NULL DEFAULT FALSE;
