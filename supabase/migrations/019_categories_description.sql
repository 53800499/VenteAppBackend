-- Description optionnelle sur les catégories produits
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS description TEXT NULL;
