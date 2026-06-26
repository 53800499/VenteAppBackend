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
