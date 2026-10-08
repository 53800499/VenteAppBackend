import { Injectable, Logger } from '@nestjs/common';
import { TenantDatabaseService } from '../tenants/tenant-database.service';

export type PlanCode = 'ESSENTIEL' | 'PRO' | 'BUSINESS';
export type CheckoutSessionStatus = 'PENDING' | 'PAID' | 'COMPLETED' | 'EXPIRED';
export type PortalSessionStatus = 'ACTIVE' | 'EXPIRED';

/**
 * Prix officiels côté serveur — jamais pris du client.
 * Le backend recalcule toujours depuis cette table.
 */
export const PLAN_PRICES_SERVER: Record<PlanCode, { monthly: number; annual: number; name: string }> = {
  ESSENTIEL: { monthly: 3000, annual: 30000, name: 'Essentiel' },
  PRO: { monthly: 6000, annual: 60000, name: 'Pro' },
  BUSINESS: { monthly: 15000, annual: 150000, name: 'Business' },
};

/** Génère un ID opaque préfixé */
function generateId(prefix: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = prefix + '_';
  for (let i = 0; i < 20; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

@Injectable()
export class CheckoutSessionService {
  private readonly logger = new Logger(CheckoutSessionService.name);

  constructor(private readonly tenantDb: TenantDatabaseService) {}

  /**
   * Crée une checkout session opaque et temporaire (30 minutes).
   * Le prix est calculé ici côté backend — le client ne transmet que planCode + durationDays.
   */
  async createCheckoutSession(params: {
    planCode: PlanCode;
    durationDays: number;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    tenantId?: string; // fourni par JWT si commerçant existant
  }) {
    const db = this.tenantDb.getAdminClient();
    const { planCode, durationDays, customerName, customerPhone, customerEmail, tenantId } = params;

    // Prix calculé côté serveur uniquement
    const planInfo = PLAN_PRICES_SERVER[planCode];
    if (!planInfo) {
      throw new Error(`Plan inconnu : ${planCode}`);
    }
    const amount = durationDays >= 360 ? planInfo.annual : planInfo.monthly;

    const sessionId = generateId('cs');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    try {
      const { error } = await db.from('checkout_sessions').insert({
        id: sessionId,
        plan_code: planCode,
        duration_days: durationDays,
        amount,
        currency: 'FCFA',
        customer_name: customerName,
        customer_phone: customerPhone.replace(/\D/g, ''),
        customer_email: customerEmail || null,
        tenant_id: tenantId || null,
        status: 'PENDING',
        expires_at: expiresAt.toISOString(),
      });

      if (error) {
        this.logger.error('checkout_sessions insert error: ' + JSON.stringify(error));
        // Table peut ne pas exister encore — on retourne quand même un ID en mémoire
      }
    } catch (err: any) {
      this.logger.warn('checkout_sessions non disponible, session en mode dégradé: ' + err.message);
    }

    return {
      checkoutSessionId: sessionId,
      planCode,
      planName: planInfo.name,
      amount,
      currency: 'FCFA',
      durationDays,
      customerName,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Récupère une session par ID. Renvoie null si expirée ou non trouvée.
   */
  async getCheckoutSession(sessionId: string) {
    const db = this.tenantDb.getAdminClient();

    try {
      const { data, error } = await db
        .from('checkout_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

      if (error || !data) return null;

      const isExpired = new Date(data.expires_at) < new Date();
      if (isExpired && data.status === 'PENDING') {
        // Marquer comme expiré
        await db.from('checkout_sessions').update({ status: 'EXPIRED' }).eq('id', sessionId);
        return null;
      }

      return data;
    } catch {
      return null;
    }
  }

  /**
   * Marque une session comme COMPLETED et l'associe à une transaction FedaPay.
   * Idempotent : si déjà COMPLETED avec le même transaction ID, ne fait rien.
   */
  async markSessionCompleted(params: {
    sessionId?: string;
    fedapayTransactionId: number | string;
    fedapayReference?: string;
  }) {
    const db = this.tenantDb.getAdminClient();
    const { sessionId, fedapayTransactionId, fedapayReference } = params;

    if (!sessionId && !fedapayTransactionId) return false;

    try {
      // Idempotence : vérifier si cette transaction a déjà été traitée
      const { data: existing } = await db
        .from('checkout_sessions')
        .select('id, status')
        .eq('fedapay_transaction_id', String(fedapayTransactionId))
        .maybeSingle();

      if (existing?.status === 'COMPLETED') {
        this.logger.log(`Transaction ${fedapayTransactionId} déjà traitée — idempotence OK`);
        return true;
      }

      const query = sessionId
        ? db.from('checkout_sessions').update({
            status: 'COMPLETED',
            fedapay_transaction_id: String(fedapayTransactionId),
            fedapay_reference: fedapayReference || null,
            paid_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          }).eq('id', sessionId)
        : db.from('checkout_sessions').update({
            status: 'COMPLETED',
            fedapay_reference: fedapayReference || null,
            paid_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          }).eq('fedapay_transaction_id', String(fedapayTransactionId));

      await query;
      return true;
    } catch (err: any) {
      this.logger.warn('markSessionCompleted error: ' + err.message);
      return false;
    }
  }

  /**
   * Crée une portal session longue durée (24h) pour la page /subscription/manage.
   * Ne doit être créée que depuis un JWT valide côté Flutter/back-office.
   */
  async createPortalSession(params: {
    tenantId: string;
    shopId: number;
  }) {
    const db = this.tenantDb.getAdminClient();
    const { tenantId, shopId } = params;

    const sessionId = generateId('ps');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    try {
      await db.from('portal_sessions').insert({
        id: sessionId,
        tenant_id: tenantId,
        shop_id: shopId,
        status: 'ACTIVE',
        expires_at: expiresAt.toISOString(),
      });
    } catch (err: any) {
      this.logger.warn('portal_sessions insert error: ' + err.message);
    }

    return {
      portalSessionId: sessionId,
      expiresAt: expiresAt.toISOString(),
      manageUrl: `/subscription/manage?session=${sessionId}`,
    };
  }

  /**
   * Récupère une portal session valide.
   */
  async getPortalSession(sessionId: string) {
    const db = this.tenantDb.getAdminClient();

    try {
      const { data } = await db
        .from('portal_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('status', 'ACTIVE')
        .maybeSingle();

      if (!data) return null;
      if (new Date(data.expires_at) < new Date()) return null;

      return data;
    } catch {
      return null;
    }
  }
}
