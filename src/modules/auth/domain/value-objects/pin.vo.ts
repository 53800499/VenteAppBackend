import { BadRequestException } from '@nestjs/common';

export class Pin {
  private constructor(public readonly value: string) {}

  static create(raw: string): Pin {
    if (!/^\d{4,6}$/.test(raw)) {
      throw new BadRequestException('Le PIN doit comporter entre 4 et 6 chiffres numériques.');
    }
    return new Pin(raw);
  }
}
