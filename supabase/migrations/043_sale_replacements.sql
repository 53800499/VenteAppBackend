-- Remplacements post-vente (échange stock sans caisse)

CREATE TABLE IF NOT EXISTS sale_replacements (
  id              BIGSERIAL PRIMARY KEY,
  shop_id         BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  sale_id         BIGINT      NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  number          TEXT        NOT NULL,
  replaced_at     BIGINT      NOT NULL,
  replaced_by     BIGINT      NOT NULL REFERENCES users(id),
  notes           TEXT,
  version         INTEGER     NOT NULL DEFAULT 1,
  server_id       UUID        DEFAULT gen_random_uuid() UNIQUE,
  synced_at       BIGINT,
  sync_status     TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  UNIQUE (shop_id, number)
);

CREATE INDEX IF NOT EXISTS idx_sale_replacements_sale
  ON sale_replacements(shop_id, sale_id);

CREATE TABLE IF NOT EXISTS sale_replacement_items (
  id                    BIGSERIAL PRIMARY KEY,
  shop_id               BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  replacement_id        BIGINT      NOT NULL REFERENCES sale_replacements(id) ON DELETE CASCADE,
  returned_sale_item_id BIGINT      NOT NULL REFERENCES sale_items(id),
  returned_product_id   BIGINT      NOT NULL REFERENCES products(id),
  quantity_returned     INTEGER     NOT NULL CHECK (quantity_returned > 0),
  issued_product_id     BIGINT      NOT NULL REFERENCES products(id),
  quantity_issued       INTEGER     NOT NULL CHECK (quantity_issued > 0),
  unit_price_issued     BIGINT      NOT NULL CHECK (unit_price_issued >= 0),
  reason                TEXT        NOT NULL,
  version               INTEGER     NOT NULL DEFAULT 1,
  server_id             UUID        DEFAULT gen_random_uuid() UNIQUE,
  synced_at             BIGINT,
  sync_status           TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict'))
);

CREATE INDEX IF NOT EXISTS idx_sale_replacement_items_rx
  ON sale_replacement_items(replacement_id);

COMMENT ON TABLE sale_replacements IS
  'Échange post-vente : retour + nouvelle sortie stock, sans mouvement caisse';
