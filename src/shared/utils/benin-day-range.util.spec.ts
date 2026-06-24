import { getBeninDayBounds } from './benin-day-range.util';

describe('getBeninDayBounds', () => {
  it('démarre à minuit Bénin (UTC+1)', () => {
  // 2026-06-24 10:30 UTC = 11:30 Bénin
    const nowMs = Date.UTC(2026, 5, 24, 10, 30, 0, 0);
    const { dayStartMs, dayEndMs } = getBeninDayBounds(nowMs);
    // Minuit Bénin = 2026-06-23 23:00 UTC
    expect(dayStartMs).toBe(Date.UTC(2026, 5, 23, 23, 0, 0, 0));
    expect(dayEndMs).toBe(nowMs);
  });
});
