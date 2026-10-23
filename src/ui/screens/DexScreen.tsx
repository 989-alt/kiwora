import { SPECIES, type SpeciesId } from '../../sim/species'
import { growing, isComplete, type Action, type AppState } from '../../store'
import { seedSizeText } from '../journalText'
import { ModeBadge } from '../ModeBadge'
import { plantSrc } from '../PlantView'
import { HomeButton } from '../HomeMenu'
import './Screens.css'

const IDS = Object.keys(SPECIES) as SpeciesId[]

type Props = { state: AppState; dispatch: (a: Action) => void }

export function DexScreen({ state, dispatch }: Props) {
  const done = new Set(state.dex)
  // Opened from the grow screen: a look at the kept journals; a new plant waits until this one is done.
  const busy = growing(state.plant)
  return (
    <div className="sc dx">
      <header className="sc-head">
        <div className="dx-title">
          <h1 className="sc-h1">씨 도감</h1>
          <span className="dx-count">
            {state.dex.length}/{IDS.length}
          </span>
        </div>
        <nav className="sc-nav" aria-label="메뉴">
          {busy && (
            <button type="button" className="sc-btn" onClick={() => dispatch({ type: 'open', screen: 'grow' })}>
              돌아가기
            </button>
          )}
          {state.plant && !state.plant.dead && isComplete(state.plant) && (
            <button type="button" className="sc-btn" onClick={() => dispatch({ type: 'open', screen: 'journal' })}>
              관찰 일지 다시 보기
            </button>
          )}
          {!busy && (
            <button type="button" className="sc-btn sc-btn--primary" onClick={() => dispatch({ type: 'open', screen: 'pick' })}>
              다른 식물 고르기
            </button>
          )}
          <HomeButton className="sc-btn" dispatch={dispatch} />
        </nav>
      </header>

      <ul className="dx-grid" aria-label="씨 도감">
        {IDS.map((id) => {
          const sp = SPECIES[id]
          if (!done.has(id)) {
            return (
              <li key={id} className="dx-slot dx-slot--empty">
                <span className="dx-art">
                  <img className="dx-silhouette" src={plantSrc(id, 'flower')} alt="" draggable={false} />
                </span>
                <span className="dx-name">{sp.name}</span>
                <span className="dx-note">아직 못 얻었어요</span>
              </li>
            )
          }
          return (
            <li key={id} className="dx-slot dx-slot--done">
              <span className="dx-art">
                <img src={plantSrc(id, 'seed')} alt="" draggable={false} />
              </span>
              <span className="seed-mm">{seedSizeText(id)}</span>
              <span className="dx-name">{sp.name}</span>
              {state.finished?.[id]?.mode && <ModeBadge mode={state.finished[id]!.mode!} />}
              <ul className="dx-strip" aria-label={`${sp.name} 한살이`}>
                {sp.stages.map((stage, i) => (
                  <li key={`${stage}-${i}`}>
                    <img src={plantSrc(id, stage)} alt="" draggable={false} />
                  </li>
                ))}
              </ul>
              {state.finished?.[id] && (
                <button
                  type="button"
                  className="sc-btn dx-record"
                  aria-label={`${sp.name} 관찰 일지 보기`}
                  onClick={() => dispatch({ type: 'openRecord', id })}
                >
                  관찰 일지 보기
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
