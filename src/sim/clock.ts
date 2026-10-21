const pad = (n: number) => String(n).padStart(2, '0')

/** Device-local date as YYYY-MM-DD (not UTC). */
export function todayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** True only when today is strictly after the last played day (clock rewinds never count). */
export function isNewDay(lastDayKey: string | null, today: string): boolean {
  if (lastDayKey === null) return true
  return today > lastDayKey
}
