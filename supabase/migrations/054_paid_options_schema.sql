-- Migration 054: Paid Options & Add-ons Schema for ARIKE SaaS
-- Handles commercial add-on options (boutiques supplémentaires, packs d'utilisateurs, IA, change, formation, etc.)

CREATE TABLE IF NOT EXISTS public.paid_options (
    id VARCHAR(100) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    price_display VARCHAR(100) NOT NULL DEFAULT '0 FCFA',
    billing_type VARCHAR(50) NOT NULL DEFAULT 'MONTHLY', -- 'MONTHLY', 'ONE_TIME', 'CUSTOM', 'YEARLY'
    unit VARCHAR(50) DEFAULT 'service',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial paid options requested for ARIKE
INSERT INTO public.paid_options (id, code, name, description, price, price_display, billing_type, unit, is_active)
VALUES
  ('opt-extra-shop', 'EXTRA_SHOP', 'Boutique supplémentaire', 'Ajoute un emplacement ou point de vente supplémentaire à votre entreprise.', 1500.00, '1 500 FCFA/mois', 'MONTHLY', 'boutique', true),
  ('opt-user-pack-5', 'USER_PACK_5', 'Pack de 5 utilisateurs supplémentaires', 'Étendez l''accès de votre équipe avec 5 comptes d''utilisateurs en plus.', 1000.00, '1 000 FCFA/mois', 'MONTHLY', 'pack_5_utilisateurs', true),
  ('opt-ai-assistant', 'AI_ASSISTANT', 'Assistant ARIKE intelligent', 'Conseils IA de réassort, prévisions des ventes et alertes d''optimisation de stock.', 1500.00, '1 500 à 2 000 FCFA/mois', 'MONTHLY', 'service', true),
  ('opt-fx-change', 'FX_CHANGE', 'Bureau de change', 'Module de gestion des devises, taux de change en direct et comptabilité multi-devises.', 2000.00, '2 000 FCFA/mois', 'MONTHLY', 'service', true),
  ('opt-initial-training', 'INITIAL_TRAINING', 'Formation et accompagnement initial', 'Prise en main guidée sur site ou à distance, paramétrage initial et formation de votre équipe.', 25000.00, 'Paiement unique', 'ONE_TIME', 'prestation', true),
  ('opt-premium-support', 'PREMIUM_SUPPORT', 'Support premium', 'Assistance prioritaire 24/7 par téléphone et WhatsApp avec un gestionnaire de compte dédié.', 0.00, 'Selon besoin (Sur devis)', 'CUSTOM', 'sur_devis', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  price_display = EXCLUDED.price_display,
  billing_type = EXCLUDED.billing_type,
  unit = EXCLUDED.unit,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
