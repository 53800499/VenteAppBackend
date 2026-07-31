import { Injectable, Logger } from '@nestjs/common';
import { LicenseSignerService, LicensePayloadData, SignedLicensePayload } from './license-signer.service';

export interface SubscriptionInfo {
  tenantId: string;
  planCode: string;
  grantedModules: string[];
  maxUsers: number;
  maxShops: number;
  startsAt: Date;
  expiresAt: Date;
  gracePeriodDays?: number;
  currentSequence: number;
}

@Injectable()
export class LicenseGeneratorService {
  private readonly logger = new Logger(LicenseGeneratorService.name);

  constructor(private readonly signerService: LicenseSignerService) {}

  /**
   * Generates a new signed license for a tenant with incremented sequence number
   */
  public generateLicenseForTenant(subInfo: SubscriptionInfo): SignedLicensePayload {
    const nextSequence = subInfo.currentSequence + 1;
    const now = new Date();

    const payloadData: LicensePayloadData = {
      licenseId: `lic_${subInfo.tenantId}_${nextSequence}_${Date.now().toString(36)}`,
      licenseSequence: nextSequence,
      licenseVersion: 1,
      tenantId: subInfo.tenantId,
      plan: subInfo.planCode,
      modules: subInfo.grantedModules,
      quotas: {
        maxUsers: subInfo.maxUsers,
        maxShops: subInfo.maxShops,
      },
      validity: {
        issuedAt: now.toISOString(),
        startsAt: subInfo.startsAt.toISOString(),
        expiresAt: subInfo.expiresAt.toISOString(),
        gracePeriodDays: subInfo.gracePeriodDays ?? 7,
      },
      status: 'ACTIVE',
    };

    this.logger.log(`Generating license sequence #${nextSequence} for tenant ${subInfo.tenantId}`);
    return this.signerService.signLicense(payloadData);
  }
}
