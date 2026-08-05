-- Migration 053: Update & Harmonize SaaS Plans, Columns and Regional Country Prices according to official ARIKE Grid

-- 0. Ensure columns exist on shops and organizations tables
ALTER TABLE public.country_prices ALTER COLUMN country_code TYPE VARCHAR(50);

ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'ESSENTIEL';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days');
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS last_extended_by VARCHAR(100);
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS last_extension_reason TEXT;

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'ESSENTIEL';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days');

-- 1. Ensure Subscription Plans have exact official rates
INSERT INTO public.subscription_plans (code, name, description, price_monthly, price_yearly, granted_modules, max_users, max_shops)
VALUES
  ('ESSENTIEL', 'ARIKE Essentiel', 'Petit commerce — 1 boutique — 3 utilisateurs', 3000.00, 30000.00, '["SALES", "INVENTORY", "CUSTOMERS", "DEBTS", "EXPENSES", "CASH_SESSIONS", "REPORTS_BASIC", "SYNC"]'::jsonb, 3, 1),
  ('PRO', 'ARIKE Pro', 'Boutique en croissance — 2 boutiques — 10 utilisateurs', 6000.00, 60000.00, '["SALES", "INVENTORY", "CUSTOMERS", "DEBTS", "EXPENSES", "CASH_SESSIONS", "REPORTS_BASIC", "SYNC", "SALES_ORDERS", "PROCUREMENT", "REPORTS_ADVANCED", "AUDIT_LOG"]'::jsonb, 10, 2),
  ('BUSINESS', 'ARIKE Business', 'Entreprise avec plusieurs boutiques — 5 boutiques — 30 utilisateurs', 10000.00, 100000.00, '["SALES", "INVENTORY", "CUSTOMERS", "DEBTS", "EXPENSES", "CASH_SESSIONS", "REPORTS_BASIC", "SYNC", "SALES_ORDERS", "PROCUREMENT", "REPORTS_ADVANCED", "AUDIT_LOG", "STOCK_TRANSFERS", "MULTI_SHOP"]'::jsonb, 30, 5),
  ('ENTERPRISE', 'ARIKE Enterprise', 'Grand réseau — sur devis — quotas et services personnalisés', 0.00, 0.00, '["ALL_MODULES", "CUSTOM_INTEGRATIONS", "DEDICATED_SUPPORT"]'::jsonb, 999, 999)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  granted_modules = EXCLUDED.granted_modules,
  max_users = EXCLUDED.max_users,
  max_shops = EXCLUDED.max_shops;

-- 2. Ensure Country Prices table has harmonized prices per plan/country
INSERT INTO public.country_prices (country_code, country_name, currency, monthly_price, annual_price)
VALUES
  ('BJ_ESSENTIEL', 'Bénin (Essentiel)', 'FCFA', 3000.00, 30000.00),
  ('BJ_PRO', 'Bénin (Pro)', 'FCFA', 6000.00, 60000.00),
  ('BJ_BUSINESS', 'Bénin (Business)', 'FCFA', 10000.00, 100000.00),
  ('BJ_ENTERPRISE', 'Bénin (Enterprise)', 'FCFA', 0.00, 0.00),

  ('TG_ESSENTIEL', 'Togo (Essentiel)', 'FCFA', 3000.00, 30000.00),
  ('TG_PRO', 'Togo (Pro)', 'FCFA', 6000.00, 60000.00),
  ('TG_BUSINESS', 'Togo (Business)', 'FCFA', 10000.00, 100000.00),
  ('TG_ENTERPRISE', 'Togo (Enterprise)', 'FCFA', 0.00, 0.00),

  ('CI_ESSENTIEL', 'Côte d''Ivoire (Essentiel)', 'FCFA', 3500.00, 35000.00),
  ('CI_PRO', 'Côte d''Ivoire (Pro)', 'FCFA', 7000.00, 70000.00),
  ('CI_BUSINESS', 'Côte d''Ivoire (Business)', 'FCFA', 12000.00, 120000.00),
  ('CI_ENTERPRISE', 'Côte d''Ivoire (Enterprise)', 'FCFA', 0.00, 0.00)
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  currency = EXCLUDED.currency,
  monthly_price = EXCLUDED.monthly_price,
  annual_price = EXCLUDED.annual_price;
