import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PinHasherService } from './pin-hasher.service';

@Injectable()
export class RecoveryTokenService {
  constructor(private readonly pinHasher: PinHasherService) {}

  generate(): { token: string; hash: Promise<string> } {
    const token = randomBytes(32).toString('hex');
    return {
      token,
      hash: this.pinHasher.hash(token),
    };
  }
}
