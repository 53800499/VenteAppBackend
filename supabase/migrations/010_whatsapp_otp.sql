-- VenteApp — Authentification WhatsApp OTP + téléphone utilisateur

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE INDEX IF NOT EXISTS idx_users_phone
  ON users (phone)
  WHERE phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS otp_challenges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        TEXT        NOT NULL,
  code_hash    TEXT        NOT NULL,
  expires_at   BIGINT      NOT NULL,
  attempts     INTEGER     NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  consumed_at  BIGINT,
  created_at   BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_otp_challenges_phone_created
  ON otp_challenges (phone, created_at DESC);
