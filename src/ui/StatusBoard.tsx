import type { ReactNode } from 'react'
import { LEVEL_LABEL, dirLabel } from '../sim/levels'
import type { ConditionKey, Level, Status } from '../sim/types'
import { BugIcon, DropletIcon, HeartIcon, SproutIcon, SunIcon, ThermometerIcon } from './icons'
import './StatusBoard.css'

type Props = {
  statuses: Record<ConditionKey, Status>
  health: number
  bugs: number
  layout: 'side' | 'bottom'
}

const ROWS: { key: ConditionKey; name: string; icon: ReactNode }[] = [
  { key: 'water', name: '물', icon: <DropletIcon /> },
  { key: 'light', name: '햇빛', icon: <SunIcon /> },
  { key: 'temp', name: '온도', icon: <ThermometerIcon /> },
  { key: 'nutrient', name: '영양', icon: <SproutIcon /> },
  { key: 'pest', name: '병충해', icon: <BugIcon /> },
]

function Row({ condKey, name, icon, status, bugs }: { condKey: ConditionKey; name: string; icon: ReactNode; status: Status; bugs: number }) {
  if (status.level === null) {
    const note = condKey === 'pest' ? '아직 걱정 없어요' : '지금은 필요 없어요'
    return (
      <div role="group" aria-label={`${name} ${note}`} className="sb-row sb-row--off">
        <div className="sb-head">
          {icon}
          <span className="sb-name">{name}</span>
          <span className="sb-note">{note}</span>
        </div>
        <div className="sb-cells" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="sb-cell sb-cell--off" data-filled="false" />
          ))}
        </div>
      </div>
    )
  }

  const level: Level = status.level
  const label = LEVEL_LABEL[level]
  const dir = condKey === 'pest' ? `벌레 ${bugs}마리` : dirLabel(condKey, status.dir)
  const spoken = dir.replace('← ', '')
  return (
    <div role="group" aria-label={[name, label, spoken].filter(Boolean).join(' ')} className="sb-row">
      <div className="sb-head">
        {icon}
        <span className="sb-name">{name}</span>
        <span className={`sb-badge sb-badge--${level}`}>{label}</span>
        {dir && <span className={`sb-dir sb-dir--${level}`}>{dir}</span>}
      </div>
      <div className="sb-cells" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => {
          const on = i <= level
          return <span key={i} className="sb-cell" data-filled={on} style={on ? { background: `var(--lv-${level})` } : undefined} />
        })}
      </div>
    </div>
  )
}

export function StatusBoard({ statuses, health, bugs, layout }: Props) {
  const h = Math.max(0, Math.min(100, Math.round(health)))
  const danger = h < 30
  return (
    <section className={`sb sb--${layout}`} aria-label="내 식물 상태">
      <h2 className="sb-title">내 식물 상태</h2>
      <div role="group" aria-label={`건강 ${h}`} className="sb-health">
        <div className="sb-head">
          <HeartIcon size={26} />
          <span className="sb-name">건강</span>
          {danger && <span className="sb-warn">위험해요!</span>}
          <span className={`sb-num${danger ? ' sb-num--danger' : ''}`}>{h}</span>
        </div>
        <div className="sb-hbar" aria-hidden="true">
          <div className={`sb-hfill${danger ? ' sb-hfill--danger' : ''}`} style={{ width: `${h}%` }} />
        </div>
      </div>
      <div className="sb-rows">
        {ROWS.map((r) => (
          <Row key={r.key} condKey={r.key} name={r.name} icon={r.icon} status={statuses[r.key]} bugs={bugs} />
        ))}
      </div>
    </section>
  )
}
