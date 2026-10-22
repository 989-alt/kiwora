import { useEffect, useRef, useState } from 'react'
import { currentStatuses } from '../../sim/day'
import { seedFor } from '../../sim/rng'
import { phaseOf, SPECIES } from '../../sim/species'
import type { PlantState } from '../../sim/types'
import { morningShown, type Action, type AppState } from '../../store'
import { PlantView, faceFor, isYardPlace } from '../PlantView'
import { potArt } from '../art'
import { StatusBoard } from '../StatusBoard'
import { Tutorial, type TipTarget } from '../Tutorial'
import { installAudioUnlock } from '../sound'
import { Bugs } from '../tools/Bugs'
import { Fertilizer } from '../tools/Fertilizer'
import { PlaceSlots, usePotDrag } from '../tools/PlaceSlots'
import { WaterStream, WateringCan } from '../tools/WateringCan'
import { stageName } from '../journalText'
import { MorningCard } from './MorningCard'
import './GrowScreen.css'

const PORTRAIT = '(max-width: 899px)'
const YARD_TIPS: TipTarget[] = ['water', 'bug']
const ROOM = ['window', 'desk', 'shade']

function useMedia(query: string): boolean {
  const get = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches
  const [match, setMatch] = useState(get)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(query)
    const on = () => setMatch(mq.matches)
    on()
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [query])
  return match
}

const Icon = ({ d, size = 24 }: { d: string[]; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d.map((p) => (
      <path key={p} d={p} />
    ))}
  </svg>
)
const LEAF = ['M7 20h10', 'M12 20v-8', 'M12 12c0-4 3-6 7-6 0 4-3 6-7 6z', 'M12 14c0-3-2-5-6-5 0 3 2 5 6 5z']
const SOUND_ON = ['M11 5 6 9H2v6h4l5 4V5z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M19 5a10 10 0 0 1 0 14']
const SOUND_OFF = ['M11 5 6 9H2v6h4l5 4V5z', 'm22 9-6 6', 'm16 9 6 6']
const BOOK = ['M4 19.5V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z', 'M8 7h8', 'M8 11h6']
const SEED = ['M12 21c-4 0-7-3.5-7-8.5C5 7 8.5 3 12 3s7 4 7 9.5c0 5-3 8.5-7 8.5z', 'M12 7c-1.5 2-1.5 8 0 11']
const SHIELD = ['M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z', 'm9 12 2 2 4-4']
const MOON = ['M20 15.5A8 8 0 1 1 8.5 4a6.5 6.5 0 0 0 11.5 11.5z']

type Props = { state: AppState; dispatch: (a: Action) => void }

export function GrowScreen({ state, dispatch }: Props) {
  const plant = state.plant as PlantState
  const rootRef = useRef<HTMLDivElement>(null)
  const portrait = useMedia(PORTRAIT)
  const [pouring, setPouring] = useState(false)
  const [pelletDrag, setPelletDrag] = useState(false)
  const locked = state.dayDone
  const sound = state.settings.sound
  const drag = usePotDrag(locked, (place) => dispatch({ type: 'move', place }), state.plant?.place)
  const soundRef = useRef(sound)
  soundRef.current = sound
  useEffect(() => installAudioUnlock(() => soundRef.current), [])

  const species = SPECIES[plant.speciesId]
  const stage = species.stages[plant.stageIndex]
  const statuses = currentStatuses(plant)
  const light = statuses.light
  const lightLow = light.level !== null && light.level <= 2 && light.dir === 'low'
  const title = `${species.name} · ${plant.day}일째 · ${stageName(plant.speciesId, stage, 'long')}`
  const inRoom = ROOM.includes(plant.place)
  const yard = isYardPlace(plant.place)
  const winter = phaseOf(stage) === 'winter'
  // A grown tree shows how long it has been growing: first half of the stage = 1 year, second half = 2.
  const yearsLater = stage === 'grownTree' ? (plant.growth < 2 ? '1년 뒤' : '2년 뒤') : null

  const endButton = (
    <button type="button" className="gs-end" disabled={locked} onClick={() => dispatch({ type: 'endDay' })}>
      <Icon d={MOON} size={30} />
      {locked ? '내일 다시 만나요' : '하루 마치기'}
    </button>
  )

  return (
    <div ref={rootRef} className={`gs${portrait ? ' gs--portrait' : ''}`}>
      <header className="gs-header">
        <h1 className="gs-title" aria-label={title}>
          <span className="gs-title-icon">
            <Icon d={LEAF} />
          </span>
          <span className="gs-name">{species.name}</span>
          <span className="gs-day">{plant.day}일째</span>
          <span className="gs-stage">{stageName(plant.speciesId, stage, 'long')}</span>
          {yearsLater && <span className="gs-years">{yearsLater}</span>}
        </h1>
        <nav className="gs-menu" aria-label="메뉴">
          <button
            type="button"
            className="gs-menu-btn gs-menu-btn--icon"
            aria-label="소리"
            aria-pressed={sound}
            onClick={() => dispatch({ type: 'toggleSound' })}
          >
            <Icon d={sound ? SOUND_ON : SOUND_OFF} size={26} />
          </button>
          <button type="button" className="gs-menu-btn" onClick={() => dispatch({ type: 'open', screen: 'journal' })}>
            <Icon d={BOOK} />
            관찰 일지
          </button>
          <button type="button" className="gs-menu-btn" onClick={() => dispatch({ type: 'open', screen: 'dex' })}>
            <Icon d={SEED} />
            씨 도감
          </button>
          <button type="button" className="gs-menu-btn" onClick={() => dispatch({ type: 'open', screen: 'backup' })}>
            <Icon d={SHIELD} />
            기록 지키기
          </button>
        </nav>
      </header>

      <div className="gs-body">
        <section className="gs-left" aria-label="식물">
          <div className="gs-scene">
            <PlantView
              speciesId={plant.speciesId}
              stage={stage}
              health={plant.health}
              lightLow={lightLow}
              place={plant.place}
              winter={winter}
              potHighlight={pelletDrag}
              potProps={{
                ...(inRoom ? drag.potProps : {}),
                role: 'img',
                // In the yard the soil around the trunk is only a place to drop fertilizer.
                'aria-label': yard ? '나무 밑동' : '화분 끌기',
                'data-drop': 'pot',
                ...(yard ? {} : { 'data-tut': 'pot' }),
              }}
              plantOverlay={(scale, spots) => (
                <Bugs
                  key={seedFor(plant.day, plant.speciesId)}
                  count={plant.bugs}
                  seed={seedFor(plant.day, plant.speciesId)}
                  scale={scale}
                  spots={spots?.points}
                  measured={spots?.measured}
                  disabled={locked}
                  sound={sound}
                  onCatch={() => dispatch({ type: 'removeBug' })}
                />
              )}
              sceneOverlay={(L) => (pouring ? <WaterStream layout={L} /> : null)}
            />
            {state.morning && !morningShown(state) && (
              <MorningCard
                key={`${plant.day}-${locked}`}
                report={state.morning}
                day={plant.day}
                dayDone={locked}
                stage={stage}
                health={plant.health}
                onClose={() => dispatch({ type: 'morningSeen' })}
              />
            )}
          </div>

          <div className="gs-tools">
            {inRoom && (
              <PlaceSlots
                place={plant.place}
                disabled={locked}
                dragging={drag.ghost !== null}
                hover={drag.hover}
                onPick={(place) => dispatch({ type: 'move', place })}
              />
            )}
            <WateringCan
              disabled={locked}
              sound={sound}
              onWater={(amount) => dispatch({ type: 'water', amount })}
              onPourChange={setPouring}
            />
            <Fertilizer
              disabled={locked}
              sound={sound}
              onPellet={() => dispatch({ type: 'pellet' })}
              onDragChange={setPelletDrag}
              target={yard ? '땅' : '화분'}
            />
          </div>
        </section>

        <aside className="gs-aside" aria-label="상태판">
          <StatusBoard statuses={statuses} health={plant.health} bugs={plant.bugs} layout={portrait ? 'bottom' : 'side'} />
          {!portrait && endButton}
        </aside>
      </div>

      {/* Portrait: the page scrolls, so 하루 마치기 rides along in a bar stuck to the bottom of the screen. */}
      {portrait && <div className="gs-endbar">{endButton}</div>}

      {drag.ghost && (
        <img
          className="pot-ghost"
          src={potArt(faceFor(plant.health)).src}
          alt=""
          aria-hidden="true"
          style={{ left: drag.ghost.x, top: drag.ghost.y }}
        />
      )}
      {!state.settings.tutorialSeen && (
        // In the yard there is no pot to move: only the watering can and bug tips.
        <Tutorial rootRef={rootRef} steps={yard ? YARD_TIPS : undefined} onDone={() => dispatch({ type: 'tutorialDone' })} />
      )}
    </div>
  )
}
