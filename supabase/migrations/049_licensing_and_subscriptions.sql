-- Migration 049: Licensing & Subscription Module Schema
-- Handles commercial subscriptions, plan definitions, payments, and signed cryptographic Ed25519 licenses.

CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL, -- 'FREE', 'STANDARD', 'PREMIUM_PRO', 'ENTERPRISE'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price_monthly NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    price_yearly NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    granted_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
    max_users INT NOT NULL DEFAULT 1,
    max_shops INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
    plan_code VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'TRIAL', -- 'TRIAL', 'ACTIVE', 'GRACE', 'EXPIRED', 'RESTRICTED', 'SUSPENDED'
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    grace_until TIMESTAMPTZ NOT NULL,
    auto_renew BOOLEAN NOT NULL DEFAULT true,
    current_sequence INT NOT NULL DEFAULT 1, -- Monotonically increasing anti-replay sequence number
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_subscription_tenant FOREIGN KEY (tenant_id) REFERENCES public.shops(server_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.shops(server_id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    license_sequence INT NOT NULL,
    license_version INT NOT NULL DEFAULT 1,
    key_id VARCHAR(50) NOT NULL DEFAULT 'ed25519-2026-v1',
    payload_json JSONB NOT NULL, -- Exact canonical JSON representation signed
    signature TEXT NOT NULL,      -- Base64 encoded Ed25519 signature
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    starts_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    grace_until TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ NULL,
    revoked_reason VARCHAR(100) NULL, -- 'CHARGEBACK', 'FRAUD', 'CANCELLATION', etc.
    revoked_by VARCHAR(100) NULL,     -- User ID or 'SYSTEM'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_sequence UNIQUE (tenant_id, license_sequence)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON public.subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_licenses_tenant_seq ON public.licenses(tenant_id, license_sequence DESC);

-- Seed African Market Tailored Subscription Plans for ARIKE
INSERT INTO public.subscription_plans (code, name, description, price_monthly, price_yearly, granted_modules, max_users, max_shops)
VALUES
  ('STARTER', 'ARIKE Starter', 'Idéal pour vendeur seul, petite boutique ou marché', 1000.00, 10000.00, '["SALES", "INVENTORY_SIMPLE", "CUSTOMERS", "DEBTS"]'::jsonb, 1, 1),
  ('ESSENTIEL', 'ARIKE Essentiel', 'Pour boutiques, magasins et petits grossistes', 2500.00, 25000.00, '["SALES", "INVENTORY_ADVANCED", "EXPENSES", "CUSTOMERS", "DEBTS", "PROCUREMENT", "SALES_ORDERS"]'::jsonb, 3, 2),
  ('PRO', 'ARIKE Pro', 'Pour commerces structurés, demi-grossistes et cambistes', 5000.00, 50000.00, '["SALES", "INVENTORY_ADVANCED", "EXPENSES", "CUSTOMERS", "DEBTS", "PROCUREMENT", "SALES_ORDERS", "STOCK_TRANSFER", "FX_EXCHANGE", "ASSISTANT", "REPORTS_ADVANCED"]'::jsonb, 10, 5),
  ('BUSINESS', 'ARIKE Business', 'Pour grossistes, distributeurs et chaînes de magasins', 15000.00, 150000.00, '["SALES", "INVENTORY_ADVANCED", "EXPENSES", "CUSTOMERS", "DEBTS", "PROCUREMENT", "SALES_ORDERS", "STOCK_TRANSFER", "FX_EXCHANGE", "ASSISTANT", "REPORTS_ADVANCED", "MULTI_TENANT_API"]'::jsonb, 999, 999)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  granted_modules = EXCLUDED.granted_modules,
  max_users = EXCLUDED.max_users,
  max_shops = EXCLUDED.max_shops;

