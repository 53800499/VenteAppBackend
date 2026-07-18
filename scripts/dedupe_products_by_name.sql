-- Fusionne les produits en doublon par boutique (même nom, insensible à la casse).
--
-- Usage :
--   1. Exécuter d'abord avec dry_run = TRUE pour prévisualiser.
--   2. Puis dry_run = FALSE pour appliquer.
--   3. shop_filter = NULL traite toutes les boutiques ; sinon une boutique précise.
--
-- Critère de conservation (keeper) :
--   server_id renseigné > non archivé > stock le plus élevé > plus petit id.

DO $$
DECLARE
  dry_run BOOLEAN := TRUE;
  shop_filter BIGINT := NULL;
  rec RECORD;
  keep_id BIGINT;
  dup_id BIGINT;
  stock_delta INTEGER;
  updated_rows INTEGER;
  total_groups INTEGER := 0;
  total_removed INTEGER := 0;
BEGIN
  RAISE NOTICE '=== Déduplication produits par nom (dry_run=%) ===', dry_run;

  FOR rec IN
    SELECT
      p.shop_id,
      lower(trim(p.name)) AS norm_name,
      array_agg(p.id ORDER BY
        CASE WHEN p.server_id IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN p.is_archived THEN 1 ELSE 0 END,
        p.quantity_in_stock DESC,
        p.id ASC
      ) AS product_ids
    FROM products p
    WHERE (shop_filter IS NULL OR p.shop_id = shop_filter)
      AND trim(p.name) <> ''
    GROUP BY p.shop_id, lower(trim(p.name))
    HAVING COUNT(*) > 1
  LOOP
    keep_id := rec.product_ids[1];
    total_groups := total_groups + 1;
    stock_delta := 0;

    RAISE NOTICE 'Boutique % — « % » : keeper=%',
      rec.shop_id, rec.norm_name, keep_id;

    FOR i IN 2..array_length(rec.product_ids, 1) LOOP
      dup_id := rec.product_ids[i];

      SELECT quantity_in_stock
      INTO stock_delta
      FROM products
      WHERE id = dup_id;

      IF dry_run THEN
        RAISE NOTICE '  [dry-run] supprimerait #% (stock=%)', dup_id, stock_delta;
        total_removed := total_removed + 1;
        CONTINUE;
      END IF;

      -- sale_items : fusion si même vente, sinon réassignation simple
      UPDATE sale_items si_keep
      SET
        quantity = si_keep.quantity + si_dup.quantity,
        line_total = si_keep.line_total + si_dup.line_total
      FROM sale_items si_dup
      WHERE si_dup.product_id = dup_id
        AND si_keep.sale_id = si_dup.sale_id
        AND si_keep.product_id = keep_id;

      DELETE FROM sale_items si_dup
      USING sale_items si_keep
      WHERE si_dup.product_id = dup_id
        AND si_keep.sale_id = si_dup.sale_id
        AND si_keep.product_id = keep_id;

      UPDATE sale_items
      SET product_id = keep_id
      WHERE product_id = dup_id;

      UPDATE stock_movements SET product_id = keep_id WHERE product_id = dup_id;
      UPDATE inventory_lots SET product_id = keep_id WHERE product_id = dup_id;
      UPDATE purchase_order_items SET product_id = keep_id WHERE product_id = dup_id;
      UPDATE purchase_receipt_items SET product_id = keep_id WHERE product_id = dup_id;

      DELETE FROM calculator_product_data dup
      USING calculator_product_data keep
      WHERE dup.product_id = dup_id
        AND keep.shop_id = dup.shop_id
        AND keep.product_id = keep_id;

      UPDATE calculator_product_data
      SET product_id = keep_id
      WHERE product_id = dup_id;

      UPDATE stock_transfer_items
      SET source_product_id = keep_id
      WHERE source_product_id = dup_id;

      UPDATE stock_transfer_items
      SET destination_product_id = keep_id
      WHERE destination_product_id = dup_id;

      UPDATE products
      SET
        quantity_in_stock = quantity_in_stock + COALESCE(stock_delta, 0),
        updated_at = (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
      WHERE id = keep_id;

      DELETE FROM products WHERE id = dup_id;
      total_removed := total_removed + 1;

      RAISE NOTICE '  supprimé #% (stock=% fusionné)', dup_id, stock_delta;
    END LOOP;
  END LOOP;

  RAISE NOTICE '=== Terminé : % groupe(s), % produit(s) % ===',
    total_groups,
    total_removed,
    CASE WHEN dry_run THEN 'à supprimer' ELSE 'supprimé(s)' END;
END $$;
