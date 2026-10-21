import { SPECIES, type SpeciesId } from './sim/species'
import { useApp, type Screen } from './store'
import { GrowScreen } from './ui/screens/GrowScreen'
import { TransplantScreen } from './ui/screens/TransplantScreen'
import './App.css'

const SCREEN_NAME: Record<Exclude<Screen, 'grow' | 'transplant'>, string> = {
  pick: '식물 고르기',
  dead: '식물이 죽었어요',
  journal: '관찰 일지',
  dex: '씨 도감',
  backup: '기록 지키기',
}

/** Screens the grow screen opens; placeholders until Task 11 replaces them. */
const FROM_GROW: Screen[] = ['journal', 'dex', 'backup']

export default function App() {
  const [s, dispatch] = useApp()

  if (s.screen === 'grow' && s.plant) {
    return (
      <main>
        <GrowScreen state={s} dispatch={dispatch} />
      </main>
    )
  }

  if (s.screen === 'transplant' && s.plant && !s.plant.dead) {
    return (
      <main>
        <TransplantScreen plant={s.plant} dispatch={dispatch} />
      </main>
    )
  }

  const screen = s.screen === 'grow' || s.screen === 'transplant' ? 'pick' : s.screen
  const p = s.plant
  const stage = p ? SPECIES[p.speciesId].stages[p.stageIndex] : null
  const canReturn = p !== null && !p.dead && stage !== 'seedDone' && stage !== 'newShoot' && FROM_GROW.includes(screen)
  return (
    <main>
      <section className="ph" aria-label={SCREEN_NAME[screen]}>
        <h1>{SCREEN_NAME[screen]}</h1>
        {screen === 'pick' && (
          <div className="ph-grid">
            {(Object.keys(SPECIES) as SpeciesId[]).map((id) => (
              <button key={id} type="button" onClick={() => dispatch({ type: 'pick', id })}>
                {SPECIES[id].name}
              </button>
            ))}
          </div>
        )}
        {canReturn && (
          <button type="button" onClick={() => dispatch({ type: 'open', screen: 'grow' })}>
            돌아가기
          </button>
        )}
      </section>
    </main>
  )
}
