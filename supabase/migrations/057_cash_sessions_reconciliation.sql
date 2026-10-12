-- VenteApp — Migration 057: Rapprochement de caisse, écarts et remises de fonds
-- Statuts de cycle de vie: open -> submitted -> review_required / justified -> approved / reopened / closed

-- 1. Extension des statuts de cash_sessions
ALTER TABLE cash_sessions DROP CONSTRAINT IF EXISTS cash_sessions_status_check;
ALTER TABLE cash_sessions ADD CONSTRAINT cash_sessions_status_check
  CHECK (status IN ('open', 'submitted', 'review_required', 'justified', 'approved', 'reopened', 'closed'));

-- 2. Colonnes d'audit, de justification et de review
ALTER TABLE cash_sessions
  ADD COLUMN IF NOT EXISTS submitted_at BIGINT,
  ADD COLUMN IF NOT EXISTS submitted_by BIGINT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at BIGINT,
  ADD COLUMN IF NOT EXISTS approved_by BIGINT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS justification_category TEXT,
  ADD COLUMN IF NOT EXISTS justification_note TEXT,
  ADD COLUMN IF NOT EXISTS review_note TEXT;

-- 3. Nouveaux types de mouvements de caisse (remise de fonds au patron, dépôt banque)
ALTER TABLE cash_movements DROP CONSTRAINT IF EXISTS cash_movements_movement_type_check;
ALTER TABLE cash_movements ADD CONSTRAINT cash_movements_movement_type_check
  CHECK (movement_type IN ('deposit', 'withdrawal', 'owner_drop', 'bank_deposit'));

-- 4. Supports / registres de paiement étendus (Celtis, banque, etc.)
ALTER TABLE cash_movements DROP CONSTRAINT IF EXISTS cash_movements_register_type_check;
ALTER TABLE cash_movements ADD CONSTRAINT cash_movements_register_type_check
  CHECK (register_type IN ('cash', 'momo', 'mtn_momo', 'moov_money', 'celtis', 'bank', 'other'));

-- 5. Permission d'approbation des clôtures de caisse (Patron / Gérant)
INSERT INTO permissions (code, module_code, action, label, description, sort_order) VALUES
  ('cash_sessions:approve', 'cash_sessions', 'approve', 'Approuver clôture', 'Valider les clôtures de caisse et arbitrer les écarts', 5)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, effect)
SELECT 'owner', 'cash_sessions:approve', 'allow'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, effect)
SELECT 'manager', 'cash_sessions:approve', 'allow'
FROM roles WHERE code = 'manager'
ON CONFLICT DO NOTHING;
