/**
 * Transforme les erreurs PostgreSQL / Supabase en messages métier français.
 */
export function humanizePostgresError(
  message: string,
  code?: string,
): string | null {
  const lower = message.toLowerCase();
  const isDuplicate =
    code === '23505' ||
    lower.includes('duplicate key') ||
    lower.includes('unique constraint');

  if (!isDuplicate) {
    return null;
  }

  if (
    lower.includes('users_name_shop_id') ||
    (lower.includes('users') && lower.includes('name') && lower.includes('shop'))
  ) {
    return 'Un utilisateur avec ce nom existe déjà dans cette boutique.';
  }

  if (lower.includes('settings_shop_id')) {
    return 'Les paramètres de cette boutique existent déjà sur le serveur.';
  }

  if (lower.includes('settings_pkey')) {
    return 'Erreur serveur lors de l\'enregistrement des paramètres. Redémarrez le backend et réessayez, ou connectez-vous avec WhatsApp si l\'installation a déjà réussi.';
  }

  if (lower.includes('phone')) {
    return 'Ce numéro WhatsApp est déjà enregistré. Connectez-vous avec WhatsApp.';
  }

  if (lower.includes('shops') || lower.includes('server_id')) {
    return 'Cette boutique existe déjà sur le serveur.';
  }

  return 'Ces informations existent déjà. Si la boutique a déjà été créée, connectez-vous avec WhatsApp.';
}
