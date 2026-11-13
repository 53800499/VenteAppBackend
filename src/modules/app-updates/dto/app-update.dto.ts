export type SupportedPlatform = 'ANDROID' | 'WINDOWS';

export class CheckUpdateQueryDto {
  currentBuild?: number;
}

export class CreateReleaseDto {
  platform: SupportedPlatform;
  version: string;
  buildNumber: number;
  minimumBuild: number;
  downloadUrl: string;
  checksumSha256?: string;
  fileSizeBytes?: number;
  forceUpdate?: boolean;
  releaseNotes?: string;
}

export interface AppReleaseResponseDto {
  platform: SupportedPlatform;
  latestVersion: string;
  latestBuild: number;
  minimumSupportedBuild: number;
  downloadUrl: string;
  checksumSha256?: string;
  fileSizeBytes?: number;
  forceUpdate: boolean;
  releaseNotes?: string;
  publishedAt: string;
}

