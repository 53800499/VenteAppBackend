export interface OtpChallengeRecord {
  id: string;
  phone: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  consumedAt: number | null;
  createdAt: number;
}

export abstract class OtpChallengeRepository {
  abstract create(input: {
    phone: string;
    codeHash: string;
    expiresAt: number;
    createdAt: number;
  }): Promise<OtpChallengeRecord>;

  abstract findLatestActive(phone: string, now: number): Promise<OtpChallengeRecord | null>;

  abstract incrementAttempts(id: string, attempts: number): Promise<void>;

  abstract markConsumed(id: string, consumedAt: number): Promise<void>;

  abstract findLastCreatedAt(phone: string): Promise<number | null>;
}
