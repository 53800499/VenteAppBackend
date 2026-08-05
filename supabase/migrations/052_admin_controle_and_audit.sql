-- Migration 052: Admin Audit Logs, Alerts, Sync Conflicts & Incidents Schema

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id VARCHAR(100) PRIMARY KEY DEFAULT ('aud-' || gen_random_uuid()),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    admin_email VARCHAR(255) NOT NULL DEFAULT 'superadmin@arike.app',
    admin_role VARCHAR(100) NOT NULL DEFAULT 'SUPER_ADMIN',
    action VARCHAR(100) NOT NULL,
    target VARCHAR(255) NOT NULL,
    ip_address VARCHAR(50) DEFAULT '127.0.0.1',
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    result VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_alerts (
    id VARCHAR(100) PRIMARY KEY DEFAULT ('alt-' || gen_random_uuid()),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    severity VARCHAR(20) NOT NULL DEFAULT 'WARNING',
    target VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_by VARCHAR(255),
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_sync_conflicts (
    id VARCHAR(100) PRIMARY KEY DEFAULT ('cnf-' || gen_random_uuid()),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    shop_id BIGINT,
    entity_table VARCHAR(100),
    entity_id VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    resolution_strategy VARCHAR(100),
    resolved_by VARCHAR(255),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_incidents (
    id VARCHAR(100) PRIMARY KEY DEFAULT ('inc-' || gen_random_uuid()),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL DEFAULT 'HIGH',
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    reported_by VARCHAR(255) NOT NULL DEFAULT 'SuperAdmin',
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Initial seed for admin_audit_logs
INSERT INTO public.admin_audit_logs (id, timestamp, admin_email, admin_role, action, target, ip_address, old_value, new_value, reason, result)
VALUES
  ('aud-01', NOW() - INTERVAL '10 minutes', 'admin@arike.app', 'SUPER_ADMIN', 'UPDATE_GENERAL_SETTINGS', 'Plateforme ARIKE', '197.234.221.15', 'ARIKE v1.0', 'ARIKE v2.0', 'Mise à jour des paramètres de la plateforme', 'SUCCESS'),
  ('aud-02', NOW() - INTERVAL '45 minutes', 'admin@arike.app', 'SUPER_ADMIN', 'UPDATE_SECURITY_SETTINGS', 'Politique Sécurité', '197.234.221.15', 'Require2FA: false', 'Require2FA: true', 'Renforcement de la sécurité système', 'SUCCESS'),
  ('aud-03', NOW() - INTERVAL '2 hours', 'tech@arike.app', 'TECH_ADMIN', 'TRIGGER_BACKUP', 'Sauvegarde Système', '41.85.12.8', NULL, 'arike_prod_dump.sql.gz', 'Sauvegarde automatique pré-maintenance', 'SUCCESS')
ON CONFLICT (id) DO NOTHING;

-- Initial seed for admin_alerts
INSERT INTO public.admin_alerts (id, timestamp, severity, target, message, acknowledged)
VALUES
  ('alt-01', NOW() - INTERVAL '15 minutes', 'WARNING', 'Queue de Synchronisation', 'Accumulation de 125 opérations hors-ligne en attente d''ingestion NestJS.', false),
  ('alt-02', NOW() - INTERVAL '2 hours', 'INFO', 'Service Ed25519', '4 licences Ed25519 régénérées suite au renouvellement annuel Boulangerie Sikirou.', true)
ON CONFLICT (id) DO NOTHING;

-- Initial seed for admin_sync_conflicts
INSERT INTO public.admin_sync_conflicts (id, title, description, shop_id, status)
VALUES
  ('cnf-01', 'Vente simultanée Caisse 1 et Caisse 2', 'Décalage de stock détecté sur le produit Pain Baguette #45', 1, 'PENDING')
ON CONFLICT (id) DO NOTHING;

-- Initial seed for admin_incidents
INSERT INTO public.admin_incidents (id, title, description, severity, status, reported_by)
VALUES
  ('inc-01', 'Ralentissement API Moov Money Bénin', 'Temps de réponse élevé sur le webhooks d''encaissement Mobile Money.', 'MEDIUM', 'OPEN', 'SupportTechnique')
ON CONFLICT (id) DO NOTHING;
