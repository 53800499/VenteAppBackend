import { Injectable, Logger } from '@nestjs/common';
import { TenantDatabaseService } from '../../../tenants/tenant-database.service';

export interface AdminUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class AdminUserRepository {
  private readonly logger = new Logger(AdminUserRepository.name);

  constructor(private readonly tenantDb: TenantDatabaseService) {}

  private mapRowToRecord(row: any): AdminUserRecord {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      fullName: row.full_name,
      role: row.role,
      isActive: row.is_active ?? true,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  async findByEmail(email: string): Promise<AdminUserRecord | null> {
    try {
      const db = this.tenantDb.getAdminClient();
      const { data, error } = await db
        .from('admin_users')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle();

      if (error) {
        this.logger.warn(`Erreur BDD lors de la recherche dans admin_users: ${error.message} (Code: ${error.code})`);
        return null;
      }
      if (!data) {
        return null;
      }
      return this.mapRowToRecord(data);
    } catch (err: any) {
      this.logger.error(`Exception lors de la recherche admin par email: ${err?.message || err}`);
      return null;
    }
  }

  async findById(id: string): Promise<AdminUserRecord | null> {
    try {
      const db = this.tenantDb.getAdminClient();
      const { data, error } = await db
        .from('admin_users')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        return null;
      }
      return this.mapRowToRecord(data);
    } catch {
      return null;
    }
  }

  async findAll(): Promise<AdminUserRecord[]> {
    try {
      const db = this.tenantDb.getAdminClient();
      const { data, error } = await db
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) {
        return [];
      }
      return data.map((row) => this.mapRowToRecord(row));
    } catch {
      return [];
    }
  }

  async create(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    role: string;
    isActive?: boolean;
  }): Promise<AdminUserRecord> {
    const db = this.tenantDb.getAdminClient();
    const payload = {
      email: data.email.toLowerCase().trim(),
      password_hash: data.passwordHash,
      full_name: data.fullName,
      role: data.role,
      is_active: data.isActive ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await db
      .from('admin_users')
      .insert(payload)
      .select('*')
      .single();

    if (error || !inserted) {
      throw new Error(`Impossible de créer l'administrateur: ${error?.message || 'Erreur BDD'}`);
    }

    return this.mapRowToRecord(inserted);
  }

  async update(
    id: string,
    data: {
      fullName?: string;
      role?: string;
      passwordHash?: string;
      isActive?: boolean;
    },
  ): Promise<AdminUserRecord> {
    const db = this.tenantDb.getAdminClient();
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (data.fullName !== undefined) updatePayload.full_name = data.fullName;
    if (data.role !== undefined) updatePayload.role = data.role;
    if (data.passwordHash !== undefined) updatePayload.password_hash = data.passwordHash;
    if (data.isActive !== undefined) updatePayload.is_active = data.isActive;

    const { data: updated, error } = await db
      .from('admin_users')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !updated) {
      throw new Error(`Impossible de modifier l'administrateur: ${error?.message || 'Erreur BDD'}`);
    }

    return this.mapRowToRecord(updated);
  }

  async delete(id: string): Promise<boolean> {
    try {
      const db = this.tenantDb.getAdminClient();
      const { error } = await db.from('admin_users').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  }

  async count(): Promise<number> {
    try {
      const db = this.tenantDb.getAdminClient();
      const { count, error } = await db
        .from('admin_users')
        .select('*', { count: 'exact', head: true });

      if (error || count === null) return 0;
      return count;
    } catch {
      return 0;
    }
  }
}
