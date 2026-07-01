/** Bornes de période pour rapports — fuseau Bénin (UTC+1). */

export type ReportPeriodPreset = 'today' | 'week' | 'month' | 'custom';

const BENIN_OFFSET_MS = 60 * 60 * 1000;

export interface ResolvedReportPeriod {
  preset: ReportPeriodPreset;
  fromMs: number;
  toMs: number;
  label: string;
}

function beninLocalMidnight(nowMs: number): number {
  const localMs = nowMs + BENIN_OFFSET_MS;
  const localMidnight = Math.floor(localMs / 86_400_000) * 86_400_000;
  return localMidnight - BENIN_OFFSET_MS;
}

function beninMonthStart(nowMs: number): number {
  const local = new Date(nowMs + BENIN_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  return Date.UTC(y, m, 1) - BENIN_OFFSET_MS;
}

export function beninDayKey(nowMs: number = Date.now()): string {
  return formatBeninDate(nowMs);
}

export function beninDayStart(nowMs: number = Date.now()): number {
  return beninLocalMidnight(nowMs);
}

export function beninMonthStartMs(nowMs: number = Date.now()): number {
  return beninMonthStart(nowMs);
}

function formatBeninDate(ms: number): string {
  const local = new Date(ms + BENIN_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const d = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function resolveReportPeriod(
  preset: ReportPeriodPreset,
  nowMs: number = Date.now(),
  customFrom?: number,
  customTo?: number,
): ResolvedReportPeriod {
  if (preset === 'custom') {
    if (customFrom == null || customTo == null || customFrom > customTo) {
      throw new Error('Période personnalisée : from et to requis (from <= to).');
    }
    return {
      preset,
      fromMs: customFrom,
      toMs: customTo,
      label: `${formatBeninDate(customFrom)} → ${formatBeninDate(customTo)}`,
    };
  }

  if (preset === 'today') {
    const dayStart = beninLocalMidnight(nowMs);
    return {
      preset,
      fromMs: dayStart,
      toMs: nowMs,
      label: `Aujourd'hui (${formatBeninDate(nowMs)})`,
    };
  }

  if (preset === 'week') {
    const dayStart = beninLocalMidnight(nowMs);
    const fromMs = dayStart - 6 * 86_400_000;
    return {
      preset,
      fromMs,
      toMs: nowMs,
      label: '7 derniers jours',
    };
  }

  const fromMs = beninMonthStart(nowMs);
  return {
    preset: 'month',
    fromMs,
    toMs: nowMs,
    label: `Mois en cours (${formatBeninDate(fromMs)} → ${formatBeninDate(nowMs)})`,
  };
}
