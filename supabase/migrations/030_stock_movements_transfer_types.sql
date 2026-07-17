-- Autoriser les mouvements de stock liés aux transferts inter-boutiques.
-- Le backend enregistre type = 'transfer_out' (expédition) et 'transfer_in' (réception).

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['stock_movements', 'stock_mouvements']
  LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
        tbl,
        tbl || '_type_check'
      );

      EXECUTE format(
        $fmt$
        ALTER TABLE %I ADD CONSTRAINT %I
          CHECK (type IN (
            'sale',
            'restock',
            'adjustment',
            'loss',
            'return',
            'initial',
            'sale_cancel',
            'transfer_out',
            'transfer_in'
          ))
        $fmt$,
        tbl,
        tbl || '_type_check'
      );
    END IF;
  END LOOP;
END $$;
