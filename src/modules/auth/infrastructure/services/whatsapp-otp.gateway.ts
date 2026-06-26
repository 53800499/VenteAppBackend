import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappSendFailedException } from '../../../../shared/exceptions/auth.exceptions';

interface WhatsappApiError {
  error?: {
    message?: string;
    code?: number;
    type?: string;
  };
}

@Injectable()
export class WhatsappOtpGateway {
  private readonly logger = new Logger(WhatsappOtpGateway.name);

  constructor(private readonly configService: ConfigService) {}

  async sendOtpCode(phoneDigits: string, code: string): Promise<void> {
    const enabled = this.configService.get<boolean>('whatsapp.enabled', false);
    const devLog = this.configService.get<boolean>('whatsapp.devLogCodes', true);
    const fallbackOnError = this.configService.get<boolean>('whatsapp.fallbackOnError', devLog);

    if (!enabled) {
      this.logDevCode(phoneDigits, code, 'WHATSAPP_ENABLED=false');
      return;
    }

    const accessToken = this.configService.get<string>('whatsapp.accessToken', '').trim();
    const phoneNumberId = this.configService.get<string>('whatsapp.phoneNumberId', '').trim();
    const apiVersion = this.configService.get<string>('whatsapp.apiVersion', 'v21.0');
    const templateName = this.configService.get<string>('whatsapp.otpTemplateName', 'venteapp_otp');
    const templateLanguage = this.configService.get<string>('whatsapp.templateLanguage', 'fr');

    if (!accessToken || !phoneNumberId) {
      if (fallbackOnError) {
        this.logDevCode(phoneDigits, code, 'configuration WhatsApp incomplète');
        return;
      }
      throw new WhatsappSendFailedException(
        'Définissez WHATSAPP_ACCESS_TOKEN et WHATSAPP_PHONE_NUMBER_ID, ou WHATSAPP_ENABLED=false en local.',
      );
    }

    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      to: phoneDigits,
      type: 'template',
      template: {
        name: templateName,
        language: { code: templateLanguage },
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: code }],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: code }],
          },
        ],
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      return;
    }

    const detail = await response.text();
    let parsed: WhatsappApiError | null = null;
    try {
      parsed = JSON.parse(detail) as WhatsappApiError;
    } catch {
      parsed = null;
    }

    const metaMessage = parsed?.error?.message ?? detail;
    const metaCode = parsed?.error?.code;
    const metaSubcode = (parsed?.error as { error_subcode?: number } | undefined)?.error_subcode;
    this.logger.error(
      `WhatsApp API error: ${response.status} ${metaMessage}${metaCode ? ` (code ${metaCode})` : ''}`,
    );

    if (fallbackOnError) {
      const reason =
        metaSubcode === 131030 || metaMessage.includes('not in allowed list')
          ? 'numéro destinataire non autorisé en mode test Meta (131030)'
          : response.status === 401
            ? 'token Meta invalide ou expiré (401)'
            : `erreur API ${response.status}`;
      this.logDevCode(phoneDigits, code, reason);
      return;
    }

    const hint =
      metaSubcode === 131030 || metaMessage.includes('not in allowed list')
        ? 'Ajoutez ce numéro dans Meta Developer → WhatsApp → API Setup → section destinataires de test.'
        : response.status === 401
          ? 'Token Meta invalide ou expiré : régénérez un token permanent dans Meta Business Suite (WhatsApp > API Setup).'
          : 'Vérifiez le modèle OTP, le phone_number_id et les permissions whatsapp_business_messaging.';

    throw new WhatsappSendFailedException(hint);
  }

  private logDevCode(phoneDigits: string, code: string, reason: string): void {
    this.logger.warn(
      `[DEV] Code WhatsApp pour +${phoneDigits} : ${code} (${reason} — message non envoyé via Meta)`,
    );
  }
}
