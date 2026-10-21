import { useState } from 'react'
import type { DayReport } from '../../sim/types'

/** One short line about yesterday (most important first, at most two parts). */
export function morningSummary(r: DayReport): string {
  const parts: string[] = []
  if (r.stageChanged) parts.push('단계가 바뀌었어요')
  if (r.heightDelta > 0) parts.push(`키가 ${r.heightDelta}cm 자랐어요`)
  if (r.newBugs > 0) parts.push(`벌레가 ${r.newBugs}마리 생겼어요`)
  if (r.healthDelta < 0) parts.push('잎이 처졌어요')
  if (parts.length === 0) return '오늘도 잘 돌봐 주세요'
  return parts.slice(0, 2).join(', ')
}

type Props = { report: DayReport; day: number; dayDone: boolean }

/** Non-blocking card over the scene; a tap closes it. Remount with a new key for each report. */
export function MorningCard({ report, day, dayDone }: Props) {
  const [open, setOpen] = useState(true)
  if (!open) return null
  const head = dayDone ? '오늘 결과:' : `${day}일째 아침!`
  return (
    <button type="button" className="morning" onClick={() => setOpen(false)}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <span>
        {head} {morningSummary(report)}
      </span>
    </button>
  )
}
