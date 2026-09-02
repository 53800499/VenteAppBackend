-- Migration 056: Subscription History, Payment Details & Plan Switch Proration

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'FCFA',
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'Mobile Money',
ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100),
ADD COLUMN IF NOT EXISTS scheduled_plan_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS bonus_days INT DEFAULT 0;

-- Index to quickly query history for a shop
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_created 
ON public.subscriptions(tenant_id, created_at DESC);
