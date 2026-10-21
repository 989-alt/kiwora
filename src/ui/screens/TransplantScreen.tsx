import { SPECIES } from '../../sim/species'
import type { Place, PlantState } from '../../sim/types'
import type { Action } from '../../store'
import './TransplantScreen.css'

type YardPlace = Extract<Place, 'yardSunny' | 'yardPartial' | 'yardShade'>

const CARDS: { place: YardPlace; name: string; line: string; sun: number }[] = [
  { place: 'yardSunny', name: '양지', line: '햇빛이 하루 종일', sun: 1 },
  { place: 'yardPartial', name: '반그늘', line: '햇빛이 반나절', sun: 0.66 },
  { place: 'yardShade', name: '그늘', line: '햇빛이 조금', sun: 0.36 },
]

type Props = { plant: PlantState; dispatch: (a: Action) => void }

/** The only way on is to choose one of the three yard spots (a real button each). */
export function TransplantScreen({ plant, dispatch }: Props) {
  return (
    <section className="tp" aria-label="땅에 옮겨 심기">
      <h1 className="tp-title">
        <span className="tp-name">{SPECIES[plant.speciesId].name}</span>
        <span className="tp-copy">나무가 커서 화분이 좁아요. 마당에 옮겨 심어요!</span>
      </h1>
      <div className="tp-cards">
        {CARDS.map((c) => (
          <button
            key={c.place}
            type="button"
            className={`tp-card tp-card--${c.place}`}
            onClick={() => dispatch({ type: 'chooseYard', place: c.place })}
          >
            <span className="tp-art" aria-hidden="true" style={{ ['--sun' as string]: c.sun }}>
              <span className="tp-sun" />
              <span className="tp-cloud" />
              <span className="tp-grass" />
            </span>
            <span className="tp-name-line">{c.name}</span>
            <span className="tp-line">{c.line}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
