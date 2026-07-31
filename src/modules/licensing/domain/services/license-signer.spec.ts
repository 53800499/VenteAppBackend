import { LicenseSignerService, LicensePayloadData } from './license-signer.service';
import * as crypto from 'crypto';

describe('LicenseSignerService', () => {
  let signerService: LicenseSignerService;

  const mockPayloadData: LicensePayloadData = {
    licenseId: 'lic_test_123',
    licenseSequence: 1,
    licenseVersion: 1,
    tenantId: 'tnt_abc_99',
    plan: 'PREMIUM',
    modules: ['SALES', 'INVENTORY', 'REPORTS'],
    quotas: {
      maxUsers: 5,
      maxShops: 2,
    },
    validity: {
      issuedAt: new Date().toISOString(),
      startsAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
      gracePeriodDays: 7,
    },
    status: 'ACTIVE',
  };

  beforeEach(() => {
    signerService = new LicenseSignerService();
  });

  it('should sign and verify license using HMAC dev fallback', () => {
    const signed = signerService.signLicense(mockPayloadData);

    expect(signed.header.schemaVersion).toBe(1);
    expect(signed.header.algorithm).toBe('HMAC-SHA256');
    expect(signed.signature).toBeDefined();

    const isValid = signerService.verifyLicenseSignature(signed);
    expect(isValid).toBe(true);
  });

  it('should fail verification if payload is tampered', () => {
    const signed = signerService.signLicense(mockPayloadData);

    // Tamper payload
    const tamperedSigned = {
      ...signed,
      payload: {
        ...signed.payload,
        quotas: { maxUsers: 999, maxShops: 99 },
      },
    };

    const isValid = signerService.verifyLicenseSignature(tamperedSigned);
    expect(isValid).toBe(false);
  });

  it('should sign and verify license using Ed25519 asymmetric keys', () => {
    // Generate temporary Ed25519 key pair for test
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const signed = signerService.signLicense(mockPayloadData, privateKey, 'ed25519-test-key');

    expect(signed.header.algorithm).toBe('Ed25519');
    expect(signed.header.keyId).toBe('ed25519-test-key');

    const isValid = signerService.verifyLicenseSignature(signed, publicKey);
    expect(isValid).toBe(true);
  });
});
