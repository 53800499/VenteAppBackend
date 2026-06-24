export function nowMs(): number {
  return Date.now();
}

export function msFromMinutes(minutes: number): number {
  return minutes * 60 * 1000;
}
