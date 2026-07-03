export type WhatsappDeliveryChannel = 'whatsapp' | 'dev';

export interface WhatsappSendResult {
  channel: WhatsappDeliveryChannel;
  /** Message utilisateur lorsque le canal n'est pas WhatsApp. */
  warning?: string;
  /** Code OTP visible uniquement en mode développement (WHATSAPP_DEV_LOG_CODES). */
  devCode?: string;
}
