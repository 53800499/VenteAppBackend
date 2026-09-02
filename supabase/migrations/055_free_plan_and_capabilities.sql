-- Migration 055: Permanent FREE Plan, System Capabilities and Module Clean-up

-- 1. Add capabilities column to subscription_plans
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Clean up 'SYNC' from granted_modules and configure standard plans with capabilities
INSERT INTO public.subscription_plans (
    code,
    name,
    description,
    price_monthly,
    price_yearly,
    granted_modules,
    capabilities,
    max_users,
    max_shops,
    is_active
) VALUES
  (
    'FREE',
    'ARIKE Gratuit (Starter)',
    '100% Hors-ligne local — 1 boutique — 1 utilisateur — Zéro frais à vie',
    0.00,
    0.00,
    '["SALES", "INVENTORY", "CUSTOMERS", "DEBTS"]'::jsonb,
    '[]'::jsonb,
    1,
    1,
    true
  ),
  (
    'ESSENTIEL',
    'ARIKE Essentiel',
    'Petit commerce — Sauvegarde cloud — 1 boutique — 3 utilisateurs',
    3000.00,
    30000.00,
    '["SALES", "INVENTORY", "CUSTOMERS", "DEBTS", "EXPENSES", "CASH_SESSIONS", "REPORTS_BASIC"]'::jsonb,
    '["CLOUD_SYNC"]'::jsonb,
    3,
    1,
    true
  ),
  (
    'PRO',
    'ARIKE Pro',
    'Boutique en croissance — Multi-boutiques & Stocks avancés — 2 boutiques — 10 utilisateurs',
    6000.00,
    60000.00,
    '["SALES", "INVENTORY", "CUSTOMERS", "DEBTS", "EXPENSES", "CASH_SESSIONS", "REPORTS_BASIC", "SALES_ORDERS", "PROCUREMENT", "REPORTS_ADVANCED", "AUDIT_LOG"]'::jsonb,
    '["CLOUD_SYNC", "AI_ASSISTANT", "MULTI_DEVICE"]'::jsonb,
    10,
    2,
    true
  ),
  (
    'BUSINESS',
    'ARIKE Business',
    'Entreprise commerciale — Transferts inter-boutiques — 5 boutiques — 30 utilisateurs',
    10000.00,
    100000.00,
    '["SALES", "INVENTORY", "CUSTOMERS", "DEBTS", "EXPENSES", "CASH_SESSIONS", "REPORTS_BASIC", "SALES_ORDERS", "PROCUREMENT", "REPORTS_ADVANCED", "AUDIT_LOG", "STOCK_TRANSFERS", "FX_EXCHANGE", "MULTI_SHOP"]'::jsonb,
    '["CLOUD_SYNC", "AI_ASSISTANT", "MULTI_DEVICE", "MULTI_SHOP", "API_EXPORT"]'::jsonb,
    30,
    5,
    true
  ),
  (
    'ENTERPRISE',
    'ARIKE Enterprise',
    'Grand réseau & distributeurs — quotas illimités et intégrations sur-mesure',
    0.00,
    0.00,
    '["ALL_MODULES", "SALES", "INVENTORY", "CUSTOMERS", "DEBTS", "EXPENSES", "CASH_SESSIONS", "REPORTS_BASIC", "SALES_ORDERS", "PROCUREMENT", "REPORTS_ADVANCED", "AUDIT_LOG", "STOCK_TRANSFERS", "FX_EXCHANGE", "MULTI_SHOP"]'::jsonb,
    '["CLOUD_SYNC", "AI_ASSISTANT", "MULTI_DEVICE", "MULTI_SHOP", "API_EXPORT", "CUSTOM_INTEGRATIONS", "DEDICATED_SUPPORT"]'::jsonb,
    999,
    999,
    true
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  granted_modules = EXCLUDED.granted_modules,
  capabilities = EXCLUDED.capabilities,
  max_users = EXCLUDED.max_users,
  max_shops = EXCLUDED.max_shops,
  is_active = EXCLUDED.is_active;

-- 3. Add default FREE country price entry
INSERT INTO public.country_prices (country_code, country_name, currency, monthly_price, annual_price)
VALUES
  ('BJ_FREE', 'Bénin (Gratuit)', 'FCFA', 0.00, 0.00),
  ('TG_FREE', 'Togo (Gratuit)', 'FCFA', 0.00, 0.00),
  ('CI_FREE', 'Côte d''Ivoire (Gratuit)', 'FCFA', 0.00, 0.00)
ON CONFLICT (country_code) DO NOTHING;
