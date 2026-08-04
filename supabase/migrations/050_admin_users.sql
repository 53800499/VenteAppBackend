-- Migration 050: Admin Users Schema for ARIKE Back-Office
-- Manages back-office administrative accounts and roles (SUPER_ADMIN, BILLING_ADMIN, SUPPORT_ADMIN, READ_ONLY_ADMIN)

CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'SUPPORT_ADMIN',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on email for fast authentication lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON public.admin_users(role);

COMMENT ON TABLE public.admin_users IS 'Comptes administrateurs du back-office de la plateforme ARIKE';
