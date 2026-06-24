import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PinHasherService {
  constructor(private readonly configService: ConfigService) {}

  hash(value: string): Promise<string> {
    const cost = this.configService.get<number>('auth.bcryptCost', 10);
    return bcrypt.hash(value, cost);
  }

  compare(value: string, hash: string): Promise<boolean> {
    return bcrypt.compare(value, hash);
  }
}
