-- Migration 051: Admin Settings, Country Prices, Promo Codes & Payment Providers Schema

CREATE TABLE IF NOT EXISTS public.platform_settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
    general_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    security_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    licensing_policy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.country_prices (
    country_code VARCHAR(10) PRIMARY KEY,
    country_name VARCHAR(100) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    monthly_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    annual_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.promo_codes (
    id VARCHAR(100) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type VARCHAR(20) NOT NULL DEFAULT 'PERCENT', -- 'PERCENT', 'AMOUNT'
    discount_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    start_date VARCHAR(20) NOT NULL,
    end_date VARCHAR(20) NOT NULL,
    max_uses INT NOT NULL DEFAULT 100,
    current_uses INT NOT NULL DEFAULT 0,
    new_customers_only BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_providers (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    logo VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    mode VARCHAR(20) NOT NULL DEFAULT 'PRODUCTION',
    countries JSONB NOT NULL DEFAULT '[]'::jsonb,
    currency VARCHAR(10) NOT NULL DEFAULT 'FCFA',
    public_key TEXT,
    secret_key_masked TEXT,
    webhook_url TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.arike_modules (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    min_version VARCHAR(20) DEFAULT 'v1.0.0',
    dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
    included_in_forfaits JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Initial seed for country prices
INSERT INTO public.country_prices (country_code, country_name, currency, monthly_price, annual_price)
VALUES
  ('BJ', 'Bénin', 'FCFA', 5000, 50000),
  ('TG', 'Togo', 'FCFA', 5000, 50000),
  ('CI', 'Côte d''Ivoire', 'FCFA', 6000, 60000),
  ('NG', 'Nigeria', 'NGN', 12500, 125000)
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  currency = EXCLUDED.currency,
  monthly_price = EXCLUDED.monthly_price,
  annual_price = EXCLUDED.annual_price;

-- Initial seed for promo codes
INSERT INTO public.promo_codes (id, code, discount_type, discount_value, start_date, end_date, max_uses, current_uses, new_customers_only, is_active)
VALUES
  ('promo-rentree-2026', 'ARIKE2026', 'PERCENT', 20, '2026-08-01', '2026-09-30', 500, 42, true, true)
ON CONFLICT (id) DO NOTHING;

-- Initial seed for modules
INSERT INTO public.arike_modules (code, name, description, icon, is_active, min_version, dependencies, included_in_forfaits)
VALUES
  ('SALES', 'Ventes et tickets', 'Caisse enregistreuse, encaissement, impression tickets et reçu.', 'shopping-bag', true, 'v1.0.0', '[]'::jsonb, '["STARTER", "ESSENTIEL", "PRO", "BUSINESS"]'::jsonb),
  ('INVENTORY', 'Gestion du stock', 'Suivi des quantités, alertes de rupture, réassort et inventaires.', 'box', true, 'v1.0.0', '[]'::jsonb, '["STARTER", "ESSENTIEL", "PRO", "BUSINESS"]'::jsonb),
  ('EXPENSES', 'Dépenses', 'Suivi des charges courantes, fournisseurs et frais opérationnels.', 'credit-card', true, 'v1.1.0', '[]'::jsonb, '["ESSENTIEL", "PRO", "BUSINESS"]'::jsonb),
  ('SALES_ORDERS', 'Commandes et livraisons', 'Gestion des devis, bons de commande et suivi de livraison.', 'truck', true, 'v1.2.0', '["SALES"]'::jsonb, '["ESSENTIEL", "PRO", "BUSINESS"]'::jsonb),
  ('PROCUREMENT', 'Approvisionnements', 'Commandes fournisseurs, réception de marchandise et factures d''achat.', 'archive', true, 'v1.2.0', '["INVENTORY"]'::jsonb, '["ESSENTIEL", "PRO", "BUSINESS"]'::jsonb),
  ('FX_EXCHANGE', 'Bureau de change', 'Gestion multi-devises, taux de change en direct et devises étrangères.', 'refresh-cw', true, 'v2.0.0', '["SALES"]'::jsonb, '["PRO", "BUSINESS"]'::jsonb),
  ('AI_ASSISTANT', 'Assistant ARIKE IA', 'Analyse prédictive des ventes, conseils de réassort et recommandations.', 'sparkles', true, 'v2.1.0', '["SALES", "INVENTORY"]'::jsonb, '["PRO", "BUSINESS"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- Initial seed for payment providers
INSERT INTO public.payment_providers (id, code, name, logo, is_active, mode, countries, currency, public_key, secret_key_masked, webhook_url)
VALUES
  ('prov-wave', 'WAVE', 'Wave Mobile Money', 'wave-logo', true, 'PRODUCTION', '["Bénin", "Côte d''Ivoire", "Sénégal"]'::jsonb, 'FCFA', 'wave_pk_live_89a7f621', '••••••••••••••••', 'https://api.arike.app/v1/webhooks/wave'),
  ('prov-moov', 'MOOV_MONEY', 'Moov Money', 'moov-logo', true, 'PRODUCTION', '["Bénin", "Togo", "Côte d''Ivoire"]'::jsonb, 'FCFA', 'moov_pk_live_45c9d102', '••••••••••••••••', 'https://api.arike.app/v1/webhooks/moov'),
  ('prov-mtn', 'MTN_MOMO', 'MTN Mobile Money', 'mtn-logo', false, 'TEST', '["Bénin", "Côte d''Ivoire", "Ghana"]'::jsonb, 'FCFA', 'mtn_pk_sandbox_11b22c33', '••••••••••••••••', 'https://api.arike.app/v1/webhooks/mtn'),
  ('prov-orange', 'ORANGE_MONEY', 'Orange Money', 'orange-logo', true, 'PRODUCTION', '["Côte d''Ivoire", "Sénégal", "Mali"]'::jsonb, 'FCFA', 'om_pk_live_99d88e77', '••••••••••••••••', 'https://api.arike.app/v1/webhooks/orange'),
  ('prov-card', 'CREDIT_CARD', 'Carte Bancaire (Visa/Mastercard)', 'card-logo', true, 'PRODUCTION', '["Tous"]'::jsonb, 'FCFA', 'stripe_pk_live_51M001122', '••••••••••••••••', 'https://api.arike.app/v1/webhooks/stripe')
ON CONFLICT (id) DO NOTHING;
