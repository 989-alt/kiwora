import { SPECIES, type SpeciesId } from '../../sim/species'
import type { Action, AppState } from '../../store'
import { plantSrc } from '../PlantView'
import './Screens.css'

const IDS = Object.keys(SPECIES) as SpeciesId[]

const GROUPS: { life: 'annual' | 'perennial'; title: string; note: string }[] = [
  { life: 'annual', title: '한해살이식물', note: '한 해 동안 한살이를 마쳐요' },
  { life: 'perennial', title: '여러해살이식물', note: '겨울을 지내고 봄에 다시 새순이 나와요' },
]

type Props = { state: AppState; dispatch: (a: Action) => void }

export function PickScreen({ state, dispatch }: Props) {
  const done = new Set(state.dex)
  return (
    <div className="sc pk">
      <header className="sc-head">
        <div>
          <h1 className="sc-h1 pk-h1">어떤 식물을 키워 볼까요?</h1>
          <p className="sc-sub">씨부터 키워서 다시 씨를 얻어 보아요.</p>
        </div>
        <nav className="sc-nav" aria-label="메뉴">
          <button type="button" className="sc-btn" onClick={() => dispatch({ type: 'open', screen: 'dex' })}>
            씨 도감 <span>{state.dex.length}/{IDS.length}</span>
          </button>
          <button type="button" className="sc-btn" onClick={() => dispatch({ type: 'open', screen: 'backup' })}>
            기록 지키기
          </button>
        </nav>
      </header>

      {GROUPS.map((g) => (
        <section key={g.life} className={`pk-group pk-group--${g.life}`} aria-label={g.title}>
          <h2 className="pk-h2">
            {g.title} <span>{g.note}</span>
          </h2>
          <div className="pk-grid">
            {IDS.filter((id) => SPECIES[id].life === g.life).map((id) => (
              <button key={id} type="button" className="pk-card" onClick={() => dispatch({ type: 'pick', id })}>
                <span className="pk-art">
                  <img src={plantSrc(id, 'flower')} alt="" draggable={false} />
                  {done.has(id) && <span className="pk-badge">완성</span>}
                </span>
                <span className="pk-name">{SPECIES[id].name}</span>
                <span className="pk-blurb">{SPECIES[id].blurb}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
