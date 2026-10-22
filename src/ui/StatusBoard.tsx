import type { ReactNode } from 'react'
import { LEVEL_LABEL, dirLabel } from '../sim/levels'
import type { ConditionKey, Level, Status, WeatherId } from '../sim/types'
import { weatherArt } from './art'
import { WEATHER_NAME } from './weatherText'
import { BugIcon, DropletIcon, HeartIcon, SproutIcon, SunIcon, ThermometerIcon } from './icons'
import './StatusBoard.css'

type Props = {
  statuses: Record<ConditionKey, Status>
  health: number
  bugs: number
  layout: 'side' | 'bottom'
  /**
   * Today's weather and whether the plant is ready for it; null = a calm day (맑아요). Left out = no weather
   * row (old callers).
   */
  weather?: { kind: WeatherId; prepared: boolean } | null
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

/** '오늘의 날씨': the weather picture, its name and whether the plant is ready (one line, to save height). */
function WeatherRow({ weather }: { weather: { kind: WeatherId; prepared: boolean } | null }) {
  if (weather === null) {
    return (
      <div role="group" aria-label="오늘의 날씨 맑아요" className="sb-weather">
        <SunIcon size={36} />
        <span className="sb-wtext">
          <span className="sb-wlabel">오늘의 날씨</span>
          <span className="sb-wname">맑아요</span>
        </span>
      </div>
    )
  }
  const art = weatherArt(weather.kind)
  const name = WEATHER_NAME[weather.kind]
  const state = weather.prepared ? '대비했어요' : '대비가 필요해요'
  const tone = weather.prepared ? 'ready' : 'need'
  return (
    <div role="group" aria-label={`오늘의 날씨 ${name} ${state}`} className={`sb-weather sb-weather--${tone}`} data-weather={weather.kind}>
      {art.real ? <img className="sb-wicon" src={art.src} alt="" width={44} height={44} draggable={false} /> : <SunIcon size={36} />}
      <span className="sb-wtext">
        <span className="sb-wlabel">오늘의 날씨</span>
        <span className="sb-wname">{name}</span>
      </span>
      <span className={`sb-wbadge sb-wbadge--${tone}`}>{state}</span>
    </div>
  )
}

export function StatusBoard({ statuses, health, bugs, layout, weather }: Props) {
  // A broken (non-finite) health reads as full, as the plant picture does (plantLook).
  const h = Math.max(0, Math.min(100, Math.round(Number.isFinite(health) ? health : 100)))
  const danger = h < 30
  return (
    <section className={`sb sb--${layout}`} aria-label="내 식물 상태">
      <h2 className="sb-title">내 식물 상태</h2>
      <div role="group" aria-label={`건강 ${h}${danger ? ' 위험해요' : ''}`} className="sb-health">
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
      {weather !== undefined && <WeatherRow weather={weather} />}
      <div className="sb-rows">
        {ROWS.map((r) => (
          <Row key={r.key} condKey={r.key} name={r.name} icon={r.icon} status={statuses[r.key]} bugs={bugs} />
        ))}
      </div>
    </section>
  )
}
