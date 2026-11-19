import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { UserSession } from '../../domain/entities/user-session.entity';
import {
  CreateUserSessionData,
  UserSessionRepository,
} from '../../domain/repositories/user-session.repository';
import { UserSessionMapper } from '../mappers/user-session.mapper';
import { UserSessionRow } from '../persistence/user-session.row';

@Injectable()
export class SupabaseUserSessionRepository extends UserSessionRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async findById(id: string): Promise<UserSession | null> {
    const { data, error } = await this.supabase.db
      .from('user_sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data ? UserSessionMapper.toDomain(data as UserSessionRow) : null;
  }

  async findByIdAndShop(id: string, shopId: number): Promise<UserSession | null> {
    const { data, error } = await this.supabase.db
      .from('user_sessions')
      .select('*')
      .eq('id', id)
      .eq('shop_id', shopId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data ? UserSessionMapper.toDomain(data as UserSessionRow) : null;
  }

  async findByRefreshTokenHash(hash: string): Promise<UserSession | null> {
    const { data, error } = await this.supabase.db
      .from('user_sessions')
      .select('*')
      .eq('refresh_token_hash', hash)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data ? UserSessionMapper.toDomain(data as UserSessionRow) : null;
  }

  async create(data: CreateUserSessionData): Promise<UserSession> {
    const { data: row, error } = await this.supabase.db
      .from('user_sessions')
      .insert(data)
      .select('*')
      .single();
    if (error || !row) {
      throw new BadRequestException(error?.message ?? 'Création session impossible.');
    }
    return UserSessionMapper.toDomain(row as UserSessionRow);
  }

  async findByDevice(
    shopId: number,
    userId: number,
    deviceId: string,
  ): Promise<UserSession | null> {
    const { data, error } = await this.supabase.db
      .from('user_sessions')
      .select('*')
      .eq('shop_id', shopId)
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .order('last_seen_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data ? UserSessionMapper.toDomain(data as UserSessionRow) : null;
  }

  async upsertSessionForDevice(data: CreateUserSessionData): Promise<UserSession> {
    // 1. Chercher si une session existe déjà pour cet appareil
    const existing = await this.findByDevice(data.shop_id, data.user_id, data.device_id);

    if (existing) {
      // Nettoyer les doublons historiques éventuels pour cet appareil afin de ne garder qu'une seule ligne
      try {
        await this.supabase.db
          .from('user_sessions')
          .delete()
          .eq('shop_id', data.shop_id)
          .eq('user_id', data.user_id)
          .eq('device_id', data.device_id)
          .neq('id', existing.id);
      } catch {
        // Ignorer si contrainte
      }

      // Mettre à jour la session existante sans surcharger la base de données
      const { data: updated, error } = await this.supabase.db
        .from('user_sessions')
        .update({
          device_label: data.device_label || existing.deviceLabel,
          refresh_token_hash: data.refresh_token_hash,
          pin_verified_at: data.pin_verified_at,
          last_seen_at: data.last_seen_at,
          session_expires_at: data.session_expires_at,
          refresh_expires_at: data.refresh_expires_at,
          revoked_at: null, // Réactive la session sur cette reconnexion
        })
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error || !updated) {
        throw new BadRequestException(error?.message ?? 'Mise à jour session impossible.');
      }
      return UserSessionMapper.toDomain(updated as UserSessionRow);
    }

    // 2. Première connexion de cet appareil : insertion unique
    return this.create(data);
  }

  async updateRefreshToken(
    id: string,
    refreshTokenHash: string,
    refreshExpiresAt: number,
    sessionExpiresAt: number,
    lastSeenAt: number,
  ): Promise<void> {
    const { data, error } = await this.supabase.db
      .from('user_sessions')
      .update({
        refresh_token_hash: refreshTokenHash,
        refresh_expires_at: refreshExpiresAt,
        session_expires_at: sessionExpiresAt,
        last_seen_at: lastSeenAt,
      })
      .eq('id', id)
      .is('revoked_at', null)
      .select('id')
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Session introuvable ou révoquée.');
  }

  async updateActiveShop(
    id: string,
    shopId: number,
    lastSeenAt: number,
    sessionExpiresAt: number,
  ): Promise<void> {
    const { data, error } = await this.supabase.db
      .from('user_sessions')
      .update({
        shop_id: shopId,
        last_seen_at: lastSeenAt,
        session_expires_at: sessionExpiresAt,
      })
      .eq('id', id)
      .is('revoked_at', null)
      .select('id')
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Session introuvable ou révoquée.');
  }

  async touchById(id: string, lastSeenAt: number, sessionExpiresAt: number): Promise<void> {
    const { data, error } = await this.supabase.db
      .from('user_sessions')
      .update({ last_seen_at: lastSeenAt, session_expires_at: sessionExpiresAt })
      .eq('id', id)
      .is('revoked_at', null)
      .select('id')
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Session introuvable ou révoquée.');
  }

  async revokeById(id: string, revokedAt: number): Promise<void> {
    const { data, error } = await this.supabase.db
      .from('user_sessions')
      .update({ revoked_at: revokedAt })
      .eq('id', id)
      .is('revoked_at', null)
      .select('id')
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Session introuvable ou déjà révoquée.');
  }

  async revokeActiveByDevice(
    userId: number,
    shopId: number,
    deviceId: string,
    revokedAt: number,
  ): Promise<void> {
    const { error } = await this.supabase.db
      .from('user_sessions')
      .update({ revoked_at: revokedAt })
      .eq('user_id', userId)
      .eq('shop_id', shopId)
      .eq('device_id', deviceId)
      .is('revoked_at', null);
    if (error) throw new BadRequestException(error.message);
  }

  async listActiveByUser(userId: number): Promise<UserSession[]> {
    const now = Date.now();
    const { data, error } = await this.supabase.db
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .gt('refresh_expires_at', now)
      .order('last_seen_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => UserSessionMapper.toDomain(row as UserSessionRow));
  }

  async listActiveByShop(shopId: number): Promise<UserSession[]> {
    const now = Date.now();
    const { data, error } = await this.supabase.db
      .from('user_sessions')
      .select('*')
      .eq('shop_id', shopId)
      .is('revoked_at', null)
      .gt('refresh_expires_at', now)
      .order('last_seen_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => UserSessionMapper.toDomain(row as UserSessionRow));
  }
}
