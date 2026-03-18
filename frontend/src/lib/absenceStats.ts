export type AbsencePeriod = { fra: string; til: string | null }

export const WORK_DAYS_PER_YEAR = 230

const MONTH_NAMES_NO = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']
export function monthName(month: number): string { return MONTH_NAMES_NO[month - 1] }

/** Count calendar days that periods cover within [rangeStart, rangeEnd] (inclusive, YYYY-MM-DD strings).
 *  Uses union to avoid double-counting overlapping periods. Caps at today. */
export function unionDaysInRange(periods: AbsencePeriod[], rangeStart: string, rangeEnd: string): number {
  const today = new Date().toISOString().split('T')[0]
  const effectiveEnd = rangeEnd > today ? today : rangeEnd
  if (rangeStart > effectiveEnd) return 0

  const normalized = periods
    .map(p => ({ fra: p.fra, til: p.til ?? today }))
    .filter(p => p.fra <= effectiveEnd && p.til >= rangeStart)
    .map(p => ({
      fra: p.fra > rangeStart ? p.fra : rangeStart,
      til: p.til < effectiveEnd ? p.til : effectiveEnd
    }))
    .sort((a, b) => a.fra.localeCompare(b.fra))

  const merged: { fra: string; til: string }[] = []
  for (const p of normalized) {
    if (merged.length === 0 || p.fra > merged[merged.length - 1].til) {
      merged.push({ ...p })
    } else if (p.til > merged[merged.length - 1].til) {
      merged[merged.length - 1].til = p.til
    }
  }

  return merged.reduce((sum, p) => {
    const from = new Date(p.fra + 'T00:00:00')
    const to = new Date(p.til + 'T00:00:00')
    return sum + Math.round((to.getTime() - from.getTime()) / 86400000) + 1
  }, 0)
}

export type MonthStats = { name: string; syke: number; perm: number; ledig: number; total: number }
export type YearStats = { syke: number; perm: number; ledig: number; total: number; months: MonthStats[] }

export function computeYearStats(
  sykemeldtPerioder: AbsencePeriod[],
  permittertPerioder: AbsencePeriod[],
  ledigPerioder: AbsencePeriod[],
  year: number
): YearStats {
  const all = [...sykemeldtPerioder, ...permittertPerioder, ...ledigPerioder]
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const months: MonthStats[] = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const monthStart = `${year}-${String(m).padStart(2, '0')}-01`
    const lastDay = new Date(year, m, 0).getDate()
    const monthEnd = `${year}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return {
      name: MONTH_NAMES_NO[i],
      syke: unionDaysInRange(sykemeldtPerioder, monthStart, monthEnd),
      perm: unionDaysInRange(permittertPerioder, monthStart, monthEnd),
      ledig: unionDaysInRange(ledigPerioder, monthStart, monthEnd),
      total: unionDaysInRange(all, monthStart, monthEnd)
    }
  })

  return {
    syke: unionDaysInRange(sykemeldtPerioder, yearStart, yearEnd),
    perm: unionDaysInRange(permittertPerioder, yearStart, yearEnd),
    ledig: unionDaysInRange(ledigPerioder, yearStart, yearEnd),
    total: unionDaysInRange(all, yearStart, yearEnd),
    months
  }
}

export function availableYears(
  sykemeldtPerioder: AbsencePeriod[],
  permittertPerioder: AbsencePeriod[],
  ledigPerioder: AbsencePeriod[]
): number[] {
  const currentYear = new Date().getFullYear()
  const all = [...sykemeldtPerioder, ...permittertPerioder, ...ledigPerioder]
  const years = new Set<number>([currentYear])
  for (const p of all) {
    years.add(parseInt(p.fra.slice(0, 4)))
    if (p.til) years.add(parseInt(p.til.slice(0, 4)))
  }
  return [...years].sort()
}
