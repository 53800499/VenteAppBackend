import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { AuthSession } from '../../domain/entities/auth-session.entity';
import { AuthSessionRepository } from '../../domain/repositories/auth-session.repository';
import { AuthSessionMapper } from '../mappers/auth-session.mapper';
import { AuthSessionRow } from '../persistence/auth-session.row';

@Injectable()
export class SupabaseAuthSessionRepository extends AuthSessionRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async findById(id: string): Promise<AuthSession | null> {
    const { data, error } = await this.supabase.db
      .from('auth_sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data ? AuthSessionMapper.toDomain(data as AuthSessionRow) : null;
  }

  async findByIdAndShop(id: string, shopId: number): Promise<AuthSession | null> {
    const { data, error } = await this.supabase.db
      .from('auth_sessions')
      .select('*')
      .eq('id', id)
      .eq('shop_id', shopId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data ? AuthSessionMapper.toDomain(data as AuthSessionRow) : null;
  }

  async create(data: Record<string, unknown>): Promise<AuthSession> {
    const { data: row, error } = await this.supabase.db
      .from('auth_sessions')
      .insert(data)
      .select('*')
      .single();
    if (error || !row) {
      throw new BadRequestException(error?.message ?? 'Création de session impossible.');
    }
    return AuthSessionMapper.toDomain(row as AuthSessionRow);
  }

  async touchInShop(
    id: string,
    shopId: number,
    lastActivityAt: number,
    expiresAt: number,
  ): Promise<void> {
    const { data: row, error } = await this.supabase.db
      .from('auth_sessions')
      .update({ last_activity_at: lastActivityAt, expires_at: expiresAt })
      .eq('id', id)
      .eq('shop_id', shopId)
      .select('id')
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!row) {
      throw new NotFoundException('Session introuvable pour cette boutique.');
    }
  }
}
