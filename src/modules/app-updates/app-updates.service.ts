import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { AppReleaseResponseDto, CreateReleaseDto, SupportedPlatform } from './dto/app-update.dto';

@Injectable()
export class AppUpdatesService {
  private readonly logger = new Logger(AppUpdatesService.name);

  // Fallback initial releases if not present in DB
  private inMemoryReleases: AppReleaseResponseDto[] = [
    {
      platform: 'ANDROID',
      latestVersion: '1.0.1',
      latestBuild: 2,
      minimumSupportedBuild: 1,
      downloadUrl: 'android/arike-v1.0.1.apk',
      checksumSha256: '',
      fileSizeBytes: 42000000,
      forceUpdate: false,
      releaseNotes: '• Gestion intelligente des ventes avec stock insuffisant\n• Sauvegarde automatique Google Drive\n• Corrections de synchronisation et stabilité caisse',
      publishedAt: new Date().toISOString(),
    },
    {
      platform: 'WINDOWS',
      latestVersion: '1.0.1',
      latestBuild: 2,
      minimumSupportedBuild: 1,
      downloadUrl: 'windows/arike-setup-v1.0.1.exe',
      checksumSha256: '',
      fileSizeBytes: 65000000,
      forceUpdate: false,
      releaseNotes: '• Gestion intelligente des ventes avec stock insuffisant\n• Sauvegarde automatique Google Drive\n• Corrections et optimisations desktop',
      publishedAt: new Date().toISOString(),
    },
  ];

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Résout une URL publique Supabase Storage pour le bucket 'releases'
   * Si la valeur est déjà une URL complète (http:// ou https://), elle est retournée telle quelle.
   */
  getPublicUrlForStoragePath(pathOrUrl: string): string {
    if (!pathOrUrl) return '';
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return pathOrUrl;
    }
    try {
      const client = this.supabase.getClient();
      const cleanPath = pathOrUrl.replace(/^\/+/, '');
      const { data } = client.storage.from('releases').getPublicUrl(cleanPath);
      return data?.publicUrl || pathOrUrl;
    } catch (_) {
      return pathOrUrl;
    }
  }

  async getLatestRelease(platformStr: string): Promise<AppReleaseResponseDto | null> {
    const platform = platformStr.toUpperCase() as SupportedPlatform;
    if (platform !== 'ANDROID' && platform !== 'WINDOWS') {
      return null;
    }

    try {
      const client = this.supabase.getClient();
      const { data, error } = await client
        .from('app_releases')
        .select('*')
        .eq('platform', platform)
        .eq('is_published', true)
        .order('build_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return {
          platform: data.platform,
          latestVersion: data.version,
          latestBuild: data.build_number,
          minimumSupportedBuild: data.minimum_build ?? 1,
          downloadUrl: this.getPublicUrlForStoragePath(data.download_url),
          checksumSha256: data.checksum_sha256,
          fileSizeBytes: data.file_size_bytes,
          forceUpdate: !!data.force_update,
          releaseNotes: data.release_notes,
          publishedAt: data.created_at,
        };
      }
    } catch (err) {
      this.logger.warn(`Could not fetch from app_releases table, using fallback: ${err}`);
    }

    // Fallback to in-memory/latest known releases
    const found = this.inMemoryReleases.find((r) => r.platform === platform);
    if (!found) return null;
    return {
      ...found,
      downloadUrl: this.getPublicUrlForStoragePath(found.downloadUrl),
    };
  }

  async getAllReleases(): Promise<AppReleaseResponseDto[]> {
    try {
      const client = this.supabase.getClient();
      const { data, error } = await client
        .from('app_releases')
        .select('*')
        .order('build_number', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((d) => ({
          platform: d.platform,
          latestVersion: d.version,
          latestBuild: d.build_number,
          minimumSupportedBuild: d.minimum_build ?? 1,
          downloadUrl: this.getPublicUrlForStoragePath(d.download_url),
          checksumSha256: d.checksum_sha256,
          fileSizeBytes: d.file_size_bytes,
          forceUpdate: !!d.force_update,
          releaseNotes: d.release_notes,
          publishedAt: d.created_at,
        }));
      }
    } catch (_) {}

    return this.inMemoryReleases.map((r) => ({
      ...r,
      downloadUrl: this.getPublicUrlForStoragePath(r.downloadUrl),
    }));
  }

  async publishRelease(dto: CreateReleaseDto): Promise<AppReleaseResponseDto> {
    const resolvedUrl = this.getPublicUrlForStoragePath(dto.downloadUrl);
    const release: AppReleaseResponseDto = {
      platform: dto.platform,
      latestVersion: dto.version,
      latestBuild: dto.buildNumber,
      minimumSupportedBuild: dto.minimumBuild,
      downloadUrl: resolvedUrl,
      checksumSha256: dto.checksumSha256,
      fileSizeBytes: dto.fileSizeBytes,
      forceUpdate: !!dto.forceUpdate,
      releaseNotes: dto.releaseNotes,
      publishedAt: new Date().toISOString(),
    };

    try {
      const client = this.supabase.getClient();
      await client.from('app_releases').upsert(
        {
          platform: dto.platform,
          version: dto.version,
          build_number: dto.buildNumber,
          minimum_build: dto.minimumBuild,
          download_url: resolvedUrl,
          checksum_sha256: dto.checksumSha256,
          file_size_bytes: dto.fileSizeBytes,
          force_update: !!dto.forceUpdate,
          release_notes: dto.releaseNotes,
          is_published: true,
        },
        { onConflict: 'platform,build_number' },
      );
    } catch (err) {
      this.logger.warn(`Could not insert into app_releases: ${err}`);
    }

    // Update in-memory
    const idx = this.inMemoryReleases.findIndex((r) => r.platform === dto.platform);
    if (idx >= 0) {
      this.inMemoryReleases[idx] = release;
    } else {
      this.inMemoryReleases.push(release);
    }

    return release;
  }
}

