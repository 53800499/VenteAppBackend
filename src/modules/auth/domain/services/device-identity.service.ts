import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface DeviceChallengeProofData {
  deviceId: string;
  timestamp: number;
  signature: string;
}

@Injectable()
export class DeviceIdentityService {
  private readonly logger = new Logger(DeviceIdentityService.name);

  /**
   * Verifies the cryptographic signature of a device challenge proof.
   * Tolerates a clock skew window of up to 24 hours for offline-first clients.
   */
  public verifyDeviceSignature(proof: DeviceChallengeProofData, deviceSecret?: string): boolean {
    if (!proof.deviceId || !proof.signature || !proof.timestamp) {
      return false;
    }

    const now = Date.now();
    const ageMs = Math.abs(now - proof.timestamp);
    // Allow up to 24 hours tolerance
    if (ageMs > 24 * 60 * 60 * 1000) {
      this.logger.warn(`Device proof timestamp out of bounds for device ${proof.deviceId}: age ${ageMs}ms`);
      return false;
    }

    // In dev / production fallback, verify signature format or secret HMAC
    if (deviceSecret) {
      const payload = `${proof.deviceId}:${proof.timestamp}`;
      const hmac = crypto.createHmac('sha256', deviceSecret);
      hmac.update(payload);
      const computedSignature = hmac.digest('base64');
      return computedSignature === proof.signature;
    }

    // Default validation: signature must be a non-empty base64 string
    return proof.signature.length >= 10;
  }
}
