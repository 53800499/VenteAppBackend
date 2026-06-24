/** Bornes de la journée civile au Bénin (UTC+1, sans DST). */
export function getBeninDayBounds(nowMs: number = Date.now()): {
  dayStartMs: number;
  dayEndMs: number;
} {
  const BENIN_OFFSET_MS = 60 * 60 * 1000;
  const localMs = nowMs + BENIN_OFFSET_MS;
  const localMidnight = Math.floor(localMs / 86_400_000) * 86_400_000;
  return {
    dayStartMs: localMidnight - BENIN_OFFSET_MS,
    dayEndMs: nowMs,
  };
}
