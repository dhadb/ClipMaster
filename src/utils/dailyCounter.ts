export interface DailyCounter {
  date: string
  count: number
}

export function getLocalDateKey(at = new Date()): string {
  const year = at.getFullYear()
  const month = String(at.getMonth() + 1).padStart(2, '0')
  const day = String(at.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function normalizeDailyCounter(date: unknown, count: unknown, now = new Date()): DailyCounter {
  const currentDate = getLocalDateKey(now)
  if (date !== currentDate) return { date: currentDate, count: 0 }
  const numericCount = Number(count)
  return { date: currentDate, count: Number.isFinite(numericCount) ? Math.max(0, Math.floor(numericCount)) : 0 }
}
