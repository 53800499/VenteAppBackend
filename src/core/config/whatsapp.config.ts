import { registerAs } from '@nestjs/config';

export default registerAs('whatsapp', () => ({
  enabled: process.env.WHATSAPP_ENABLED === 'true',
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
  apiVersion: process.env.WHATSAPP_API_VERSION ?? 'v21.0',
  /** Nom du modèle d'authentification Meta (ex. venteapp_otp). */
  otpTemplateName: process.env.WHATSAPP_OTP_TEMPLATE ?? 'venteapp_otp',
  /** Langue du modèle WhatsApp. */
  templateLanguage: process.env.WHATSAPP_TEMPLATE_LANG ?? 'fr',
  /** En dev : journaliser le code OTP si WhatsApp n'est pas activé ou si l'API échoue. */
  devLogCodes: process.env.WHATSAPP_DEV_LOG_CODES !== 'false',
  /** Si true (défaut = devLogCodes), ne pas bloquer l'OTP quand l'API Meta échoue (ex. token 401 en local). */
  fallbackOnError: process.env.WHATSAPP_FALLBACK_ON_ERROR
    ? process.env.WHATSAPP_FALLBACK_ON_ERROR === 'true'
    : process.env.WHATSAPP_DEV_LOG_CODES !== 'false',
}));
