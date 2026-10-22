import { phaseOf, SPECIES } from '../../sim/species'
import type { PlantState } from '../../sim/types'
import type { Action, AppState } from '../../store'
import { stageName, withGa } from '../journalText'
import { PlantView } from '../PlantView'
import './Screens.css'

type Props = { state: AppState; dispatch: (a: Action) => void }

/** The dead plant. The last "past try" of the same species holds the day and stage it died at. */
export function DeathScreen({ state, dispatch }: Props) {
  const plant = state.plant as PlantState
  const species = SPECIES[plant.speciesId]
  const last = state.pastTries[state.pastTries.length - 1]
  const mine = last && last.speciesId === plant.speciesId ? last : null
  const stage = mine ? mine.stage : species.stages[plant.stageIndex]
  const days = mine ? mine.days : plant.day
  const cause = plant.deathCause ?? mine?.cause ?? ''
  const sceneStage = species.stages[plant.stageIndex]

  return (
    <section className="sc dt" aria-label="식물이 시들었어요">
      <div className="dt-scene">
        <PlantView
          speciesId={plant.speciesId}
          stage={sceneStage}
          heightCm={plant.heightCm}
          health={Math.min(plant.health, 10)}
          lightLow={false}
          place={plant.place}
          winter={phaseOf(sceneStage) === 'winter'}
        />
      </div>

      <div className="dt-body">
        <p className="dt-line">{`${species.name} · ${days}일째 · ${stageName(plant.speciesId, stage)} 단계까지 자랐어요`}</p>
        <h1 className="sc-h1 dt-h1">{withGa(species.name)} 시들어 버렸어요</h1>
        <div className="dt-cause">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />
          </svg>
          <div>
            <span className="dt-why">왜 그랬을까요?</span>
            <span className="dt-cause-text">{cause}</span>
          </div>
        </div>
        <div className="dt-actions">
          <button type="button" className="sc-big sc-big--primary" onClick={() => dispatch({ type: 'replant', id: plant.speciesId })}>
            {species.name} 다시 심기
          </button>
          <button type="button" className="sc-big" onClick={() => dispatch({ type: 'open', screen: 'pick' })}>
            다른 식물 고르기
          </button>
        </div>
        <p className="dt-note">이번 기록은 관찰 일지의 ‘지난 시도’에 남아요.</p>
      </div>
    </section>
  )
}
