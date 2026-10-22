import { useState } from 'react'
import type { StageId } from '../../sim/species'
import type { DayReport } from '../../sim/types'

/**
 * One short line about yesterday (most important first, at most two parts). `stage` is the plant's stage now:
 * a seed still under the soil gets its own line, and a plant that spent the day as a seed never droops.
 */
export function morningSummary(r: DayReport, stage?: StageId): string {
  if (stage === 'seed') return r.healthDelta < 0 ? '흙 속에서 씨가 힘들어하고 있어요' : '흙 속에서 씨가 싹이 틀 준비를 하고 있어요'
  const wasSeed = stage === 'sprout' && r.stageChanged
  const parts: string[] = []
  if (r.stageChanged) parts.push('단계가 바뀌었어요')
  if (r.heightDelta > 0) {
    // whole cm only (a 3rd grader reads "2cm", not "2.3cm"); less than half a cm is "조금"
    const cm = Math.round(r.heightDelta)
    parts.push(cm >= 1 ? `키가 ${cm}cm 자랐어요` : '키가 조금 자랐어요')
  }
  if (r.newBugs > 0) parts.push(`벌레가 ${r.newBugs}마리 생겼어요`)
  if (r.healthDelta < 0) parts.push(wasSeed ? '씨가 힘들어했어요' : '잎이 처졌어요')
  if (parts.length === 0) return '오늘도 잘 돌봐 주세요'
  return parts.slice(0, 2).join(', ')
}

/** Health below this is the danger zone (the status board says 위험해요!). */
const DANGER_HEALTH = 30

type Props = {
  report: DayReport
  day: number
  dayDone: boolean
  /** The plant's stage now. */
  stage?: StageId
  /** The plant's health now: under 30 the card adds a danger line. */
  health?: number
  /** Called once when the student closes the card (so it stays closed after a reload). */
  onClose?: () => void
}

/** Non-blocking card over the scene; a tap closes it. Remount with a new key for each report. */
export function MorningCard({ report, day, dayDone, stage, health, onClose }: Props) {
  const [open, setOpen] = useState(true)
  if (!open) return null
  const head = dayDone ? '오늘 자란 모습이에요' : `${day}일째 아침이에요!`
  const danger = health !== undefined && Number.isFinite(health) && health < DANGER_HEALTH
  return (
    <button
      type="button"
      className={`morning${danger ? ' morning--danger' : ''}`}
      onClick={() => {
        setOpen(false)
        onClose?.()
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <span className="morning-text">
        <span>
          {head} {morningSummary(report, stage)}
        </span>
        {danger && <span className="morning-danger">식물이 많이 아파요! 상태판을 살펴봐요.</span>}
      </span>
    </button>

  )
}
