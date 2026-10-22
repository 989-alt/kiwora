import { SPECIES, type SpeciesId } from '../../sim/species'
import type { Mode, PlantState } from '../../sim/types'
import { growing, isComplete, type Action, type AppState } from '../../store'
import { dayReached, feelingText, journalRows, seedSizeText, stageName } from '../journalText'
import { ModeBadge } from '../ModeBadge'
import { plantSrc } from '../PlantView'
import '../../styles/print.css'
import './Screens.css'

type Props = {
  state: AppState
  dispatch: (a: Action) => void
  /** Show this species' kept finished journal (read-only) instead of the current plant's. */
  record?: SpeciesId
}

const Arrow = () => (
  <svg className="jr-arrow" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </svg>
)

/** Where the back button leads while the record is not finished (a finished one leads on to the dex). */
function backTarget(plant: PlantState | null): { label: string; screen: 'grow' | 'dead' | 'pick' } {
  if (plant === null) return { label: '식물 고르기', screen: 'pick' }
  if (plant.dead) return { label: '돌아가기', screen: 'dead' }
  return { label: '돌아가기', screen: 'grow' }
}

export function JournalScreen({ state, dispatch, record }: Props) {
  const kept = record ? state.finished?.[record] : undefined
  // A kept record is finished and read-only; it does not depend on the plant growing now.
  const plant = kept ? null : state.plant
  const speciesId: SpeciesId | null = kept ? (record as SpeciesId) : (plant?.speciesId ?? null)
  const journal = kept ? kept.journal : state.journal
  const species = speciesId ? SPECIES[speciesId] : null
  const complete = kept !== undefined || (plant !== null && isComplete(plant))
  const rows = speciesId ? journalRows(journal, speciesId) : []
  // Without a journal (a plant restored from the short code) the plant itself counts the finished days:
  // a living plant is on the day after its last finished one, a dead plant keeps the day it died on.
  const lastDay =
    journal.length > 0 ? journal[journal.length - 1].day : plant?.dead ? plant.day : Math.max(0, (plant?.day ?? 1) - 1)
  const back = backTarget(plant)
  // A kept record shows its own mode; one without (kept by a short code) reads as daily.
  const mode: Mode = (kept ? kept.mode : plant?.mode) ?? 'daily'
  const pastTries = kept ? state.pastTries.filter((t) => t.speciesId === speciesId) : state.pastTries

  let sub = '아직 키우는 식물이 없어요'
  if (species) {
    if (complete) sub = `${lastDay}일 만에 ${species.life === 'annual' ? '씨를 얻었어요' : '새순이 나왔어요'}!`
    else if (plant && growing(plant)) sub = `${plant.day}일째 키우는 중이에요`
    else sub = `${lastDay}일 동안 키웠어요`
  }

  return (
    <div className="sc jr">
      <header className="sc-head">
        <div className="jr-title">
          <h1 className="sc-h1">{species ? `${species.name} 한살이 관찰 일지` : '관찰 일지'}</h1>
          {species && <ModeBadge mode={mode} />}
          <span className="jr-sub">{sub}</span>
        </div>
        <nav className="sc-nav no-print" aria-label="메뉴">
          {!complete && (
            <button type="button" className="sc-btn" onClick={() => dispatch({ type: 'open', screen: back.screen })}>
              {back.label}
            </button>
          )}
          <button type="button" className="sc-btn" onClick={() => window.print()}>
            인쇄하기
          </button>
          {complete && !kept && (
            <button type="button" className="sc-btn sc-btn--primary" onClick={() => dispatch({ type: 'open', screen: 'dex' })}>
              씨 도감에 넣기
            </button>
          )}
          {kept && (
            <button type="button" className="sc-btn sc-btn--primary" onClick={() => dispatch({ type: 'open', screen: 'dex' })}>
              씨 도감
            </button>
          )}
        </nav>
      </header>

      {speciesId && species && (
        <>
          <section className="sc-card jr-strip-card">
            <ul className="jr-strip" aria-label="한살이 단계">
              {species.stages.map((stage, i) => {
                const day = dayReached(journal, stage)
                return (
                  <li key={`${stage}-${i}`} className={`jr-stage${day === null ? ' jr-stage--todo' : ''}`}>
                    <img src={plantSrc(speciesId, stage)} alt="" draggable={false} />
                    <span className="jr-stage-name">{stageName(speciesId, stage)}</span>
                    <span className="jr-stage-day">{day === null ? '아직' : `${day}일째`}</span>
                    {stage === 'seed' && <span className="seed-mm jr-seed-mm">{seedSizeText(speciesId)}</span>}
                    {i < species.stages.length - 1 && <Arrow />}
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="sc-card jr-table-card" aria-label="날짜별 기록">
            <table className="jr-table">
              <thead>
                <tr>
                  <th scope="col">며칠째</th>
                  <th scope="col">단계</th>
                  <th scope="col">키</th>
                  <th scope="col">잎</th>
                  <th scope="col">한 일</th>
                  <th scope="col">어땠나요</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ entry, did }) => (
                  <tr key={entry.day}>
                    <td>{entry.day}일째</td>
                    <td>{stageName(speciesId, entry.stage)}</td>
                    <td>{Math.round(entry.heightCm)}cm</td>
                    <td>{Math.round(entry.leaves)}장</td>
                    <td>{did}</td>
                    <td>{feelingText(entry.statuses)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className="jr-empty">하루를 마치면 여기에 기록이 쌓여요.</p>}
          </section>
        </>
      )}

      {pastTries.length > 0 && (
        <section className="sc-card jr-past" aria-label="지난 시도">
          <h2 className="jr-h2">지난 시도</h2>
          <ul>
            {pastTries.map((t, i) => (
              <li key={i}>
                <b>{SPECIES[t.speciesId].name}</b> · {t.days}일째 · {stageName(t.speciesId, t.stage)} 단계까지 · {t.cause}
                {t.mode && <> <ModeBadge mode={t.mode} /></>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
