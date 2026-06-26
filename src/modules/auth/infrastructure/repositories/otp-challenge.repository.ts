import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import {
  OtpChallengeRecord,
  OtpChallengeRepository,
} from '../../domain/repositories/otp-challenge.repository';

interface OtpChallengeRow {
  id: string;
  phone: string;
  code_hash: string;
  expires_at: number;
  attempts: number;
  consumed_at: number | null;
  created_at: number;
}

@Injectable()
export class SupabaseOtpChallengeRepository extends OtpChallengeRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async create(input: {
    phone: string;
    codeHash: string;
    expiresAt: number;
    createdAt: number;
  }): Promise<OtpChallengeRecord> {
    const { data, error } = await this.supabase.db
      .from('otp_challenges')
      .insert({
        phone: input.phone,
        code_hash: input.codeHash,
        expires_at: input.expiresAt,
        created_at: input.createdAt,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new BadRequestException(error?.message ?? 'Création OTP impossible.');
    }

    return this.toRecord(data as OtpChallengeRow);
  }

  async findLatestActive(phone: string, now: number): Promise<OtpChallengeRecord | null> {
    const { data, error } = await this.supabase.db
      .from('otp_challenges')
      .select('*')
      .eq('phone', phone)
      .is('consumed_at', null)
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    return data ? this.toRecord(data as OtpChallengeRow) : null;
  }

  async incrementAttempts(id: string, attempts: number): Promise<void> {
    const { error } = await this.supabase.db
      .from('otp_challenges')
      .update({ attempts })
      .eq('id', id);
    if (error) throw new BadRequestException(error.message);
  }

  async markConsumed(id: string, consumedAt: number): Promise<void> {
    const { error } = await this.supabase.db
      .from('otp_challenges')
      .update({ consumed_at: consumedAt })
      .eq('id', id);
    if (error) throw new BadRequestException(error.message);
  }

  async findLastCreatedAt(phone: string): Promise<number | null> {
    const { data, error } = await this.supabase.db
      .from('otp_challenges')
      .select('created_at')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    return data?.created_at ?? null;
  }

  private toRecord(row: OtpChallengeRow): OtpChallengeRecord {
    return {
      id: row.id,
      phone: row.phone,
      codeHash: row.code_hash,
      expiresAt: row.expires_at,
      attempts: row.attempts,
      consumedAt: row.consumed_at,
      createdAt: row.created_at,
    };
  }
}
