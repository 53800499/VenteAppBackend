import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AdminRole } from '../../../../shared/enums/admin-role.enum';
import { AdminUserRepository, AdminUserRecord } from '../../infrastructure/repositories/admin-user.repository';

export interface CreateAdminUserCommand {
  email: string;
  password: string;
  fullName: string;
  role: AdminRole;
}

export interface UpdateAdminUserCommand {
  fullName?: string;
  role?: AdminRole;
  password?: string;
  isActive?: boolean;
}

@Injectable()
export class AdminUserService {
  constructor(private readonly adminUserRepo: AdminUserRepository) {}

  async listAdmins(): Promise<Omit<AdminUserRecord, 'passwordHash'>[]> {
    const admins = await this.adminUserRepo.findAll();
    return admins.map(({ passwordHash, ...admin }) => admin);
  }

  async getAdminById(id: string): Promise<Omit<AdminUserRecord, 'passwordHash'>> {
    const admin = await this.adminUserRepo.findById(id);
    if (!admin) {
      throw new NotFoundException(`Administrateur avec l'ID "${id}" introuvable.`);
    }
    const { passwordHash, ...result } = admin;
    return result;
  }

  async getAdminByEmailWithPassword(email: string): Promise<AdminUserRecord | null> {
    return this.adminUserRepo.findByEmail(email);
  }

  async createAdmin(command: CreateAdminUserCommand): Promise<Omit<AdminUserRecord, 'passwordHash'>> {
    const existing = await this.adminUserRepo.findByEmail(command.email);
    if (existing) {
      throw new ConflictException(`Un administrateur avec l'adresse email "${command.email}" existe déjà.`);
    }

    if (!Object.values(AdminRole).includes(command.role)) {
      throw new BadRequestException(`Rôle d'administration invalide: ${command.role}`);
    }

    if (!command.password || command.password.length < 8) {
      throw new BadRequestException('Le mot de passe administrateur doit contenir au moins 8 caractères.');
    }

    const passwordHash = await bcrypt.hash(command.password, 10);

    const created = await this.adminUserRepo.create({
      email: command.email,
      passwordHash,
      fullName: command.fullName,
      role: command.role,
    });

    const { passwordHash: _, ...result } = created;
    return result;
  }

  async updateAdmin(
    id: string,
    command: UpdateAdminUserCommand,
  ): Promise<Omit<AdminUserRecord, 'passwordHash'>> {
    const existing = await this.adminUserRepo.findById(id);
    if (!existing) {
      throw new NotFoundException(`Administrateur avec l'ID "${id}" introuvable.`);
    }

    let passwordHash: string | undefined = undefined;
    if (command.password) {
      if (command.password.length < 8) {
        throw new BadRequestException('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      }
      passwordHash = await bcrypt.hash(command.password, 10);
    }

    if (command.role && !Object.values(AdminRole).includes(command.role)) {
      throw new BadRequestException(`Rôle d'administration invalide: ${command.role}`);
    }

    const updated = await this.adminUserRepo.update(id, {
      fullName: command.fullName,
      role: command.role,
      passwordHash,
      isActive: command.isActive,
    });

    const { passwordHash: _, ...result } = updated;
    return result;
  }

  async deleteAdmin(id: string): Promise<boolean> {
    const existing = await this.adminUserRepo.findById(id);
    if (!existing) {
      throw new NotFoundException(`Administrateur avec l'ID "${id}" introuvable.`);
    }
    return this.adminUserRepo.delete(id);
  }

  private readonly logger = new Logger(AdminUserService.name);

  async verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
    if (!hash || !plainPassword) return false;

    // Si le mot de passe a été inséré en texte clair directement en SQL sans bcrypt (ex: '12345678')
    if (!hash.startsWith('$2') && hash === plainPassword) {
      this.logger.warn('Mot de passe administrateur en clair détecté en base de données. Veuillez utiliser le hachage bcrypt.');
      return true;
    }

    try {
      return await bcrypt.compare(plainPassword, hash);
    } catch (err: any) {
      this.logger.warn(`Erreur lors de la vérification du mot de passe bcrypt: ${err?.message || err}`);
      return false;
    }
  }

  async getAdminCount(): Promise<number> {
    return this.adminUserRepo.count();
  }
}
