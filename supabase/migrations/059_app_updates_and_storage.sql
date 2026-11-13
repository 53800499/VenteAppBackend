-- 059_app_updates_and_storage.sql
-- Table des versions d'applications et configuration du bucket Supabase Storage pour les APK et installeurs

CREATE TABLE IF NOT EXISTS public.app_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('ANDROID', 'WINDOWS')),
    version VARCHAR(50) NOT NULL,
    build_number INT NOT NULL,
    minimum_build INT NOT NULL DEFAULT 1,
    download_url TEXT NOT NULL,
    checksum_sha256 VARCHAR(64),
    file_size_bytes BIGINT,
    force_update BOOLEAN NOT NULL DEFAULT false,
    release_notes TEXT,
    is_published BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_platform_build UNIQUE (platform, build_number)
);

CREATE INDEX IF NOT EXISTS idx_app_releases_platform_build ON public.app_releases(platform, build_number DESC);

-- Sécurité RLS sur la table app_releases
ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

-- Lecture publique pour les versions publiées (l'application mobile vérifie sans authentification préalable)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'app_releases' AND policyname = 'Public read published app_releases'
    ) THEN
        CREATE POLICY "Public read published app_releases"
        ON public.app_releases
        FOR SELECT
        TO anon, authenticated
        USING (is_published = true);
    END IF;
END $$;

-- Gestion complète pour le service_role (backend admin)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'app_releases' AND policyname = 'Service role manage app_releases'
    ) THEN
        CREATE POLICY "Service role manage app_releases"
        ON public.app_releases
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

-- 2. Création et configuration du bucket de stockage 'releases'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'releases',
    'releases',
    true,
    209715200, -- Limite de 200 Mo par fichier
    ARRAY['application/vnd.android.package-archive', 'application/x-msdownload', 'application/octet-stream', 'application/x-msdos-program']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 209715200,
    allowed_mime_types = ARRAY['application/vnd.android.package-archive', 'application/x-msdownload', 'application/octet-stream', 'application/x-msdos-program'];

-- 3. Politiques RLS sur le bucket Storage 'releases'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Public Access Releases'
    ) THEN
        CREATE POLICY "Public Access Releases"
        ON storage.objects
        FOR SELECT
        TO anon, authenticated
        USING (bucket_id = 'releases');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Service Role Upload Releases'
    ) THEN
        CREATE POLICY "Service Role Upload Releases"
        ON storage.objects
        FOR ALL
        TO service_role
        USING (bucket_id = 'releases')
        WITH CHECK (bucket_id = 'releases');
    END IF;
END $$;

