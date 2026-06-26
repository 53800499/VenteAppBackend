export function nowMs(): number {
  return Date.now();
}

export function msFromMinutes(minutes: number): number {
  return minutes * 60 * 1000;
}

export function msFromDays(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}
