import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface LicensePayloadHeader {
  schemaVersion: number;
  keyId: string;
  algorithm: 'Ed25519' | 'HMAC-SHA256';
}

export interface LicenseValidity {
  issuedAt: string;
  startsAt: string;
  expiresAt: string;
  gracePeriodDays: number;
}

export interface LicenseQuotas {
  maxUsers: number;
  maxShops: number;
}

export interface LicensePayloadData {
  licenseId: string;
  licenseSequence: number;
  licenseVersion: number;
  tenantId: string;
  plan: string;
  modules: string[];
  quotas: LicenseQuotas;
  validity: LicenseValidity;
  status: string;
}

export interface SignedLicensePayload {
  header: LicensePayloadHeader;
  payload: LicensePayloadData;
  signature: string;
}

@Injectable()
export class LicenseSignerService {
  private readonly logger = new Logger(LicenseSignerService.name);

  /**
   * Sorts object keys recursively to produce a deterministic canonical JSON string.
   */
  public toCanonicalJson(obj: any): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map((item) => this.toCanonicalJson(item)).join(',') + ']';
    }
    const sortedKeys = Object.keys(obj).sort();
    const parts = sortedKeys.map((key) => `${JSON.stringify(key)}:${this.toCanonicalJson(obj[key])}`);
    return '{' + parts.join(',') + '}';
  }

  /**
   * Generates a signed license using Ed25519 Asymmetric Private Key or SHA256 HMAC fallback
   */
  public signLicense(payloadData: LicensePayloadData, privateKeyPem?: string, keyId = 'ed25519-2026-v1'): SignedLicensePayload {
    const activePrivateKey = privateKeyPem || process.env.LICENSE_ED25519_PRIVATE_KEY;
    const jsonString = this.toCanonicalJson(payloadData);

    if (activePrivateKey) {
      try {
        const signature = crypto.sign(null, Buffer.from(jsonString, 'utf8'), activePrivateKey).toString('base64');
        return {
          header: {
            schemaVersion: 1,
            keyId,
            algorithm: 'Ed25519',
          },
          payload: payloadData,
          signature,
        };
      } catch (err) {
        this.logger.error(`Failed to sign with Ed25519 private key: ${(err as Error).message}. Falling back to HMAC.`);
      }
    }

    // Fallback for development if Ed25519 private key is not configured in .env
    const devSecret = process.env.LICENSE_SIGNING_SECRET || 'arike_dev_key_2026_ed25519';
    const signature = crypto.createHmac('sha256', devSecret).update(jsonString).digest('base64');

    return {
      header: {
        schemaVersion: 1,
        keyId: 'dev-hmac-v1',
        algorithm: 'HMAC-SHA256',
      },
      payload: payloadData,
      signature,
    };
  }

  /**
   * Verifies a signed license payload against a public key or HMAC secret
   */
  public verifyLicenseSignature(signedLicense: SignedLicensePayload, publicKeyPem?: string): boolean {
    const jsonString = this.toCanonicalJson(signedLicense.payload);

    if (signedLicense.header.algorithm === 'Ed25519') {
      const activePublicKey = publicKeyPem || process.env.LICENSE_ED25519_PUBLIC_KEY;
      if (!activePublicKey) {
        this.logger.warn('No Ed25519 public key available for signature verification');
        return false;
      }
      try {
        return crypto.verify(
          null,
          Buffer.from(jsonString, 'utf8'),
          activePublicKey,
          Buffer.from(signedLicense.signature, 'base64')
        );
      } catch (err) {
        this.logger.error(`Ed25519 signature verification error: ${(err as Error).message}`);
        return false;
      }
    }

    if (signedLicense.header.algorithm === 'HMAC-SHA256') {
      const devSecret = process.env.LICENSE_SIGNING_SECRET || 'arike_dev_key_2026_ed25519';
      const expectedSignature = crypto.createHmac('sha256', devSecret).update(jsonString).digest('base64');
      return crypto.timingSafeEqual(Buffer.from(signedLicense.signature), Buffer.from(expectedSignature));
    }

    return false;
  }
}

