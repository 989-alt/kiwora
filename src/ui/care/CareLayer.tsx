import { useRef, useState } from 'react'
import { careTasks, pendingCare } from '../../sim/care'
import { SPECIES } from '../../sim/species'
import type { CareTaskId, PlantState } from '../../sim/types'
import { plantArt } from '../art'
import type { SceneLayout } from '../PlantView'
import { Dish, Drain } from './Drain'
import { Heaps, HillUp, HILL_TAPS } from './HillUp'
import type { CareProps, Pt } from './parts'
import { Pinch } from './Pinch'
import { SoilBump, Sow, seedSpots } from './Sow'
import { PlantedStake, Stake, Wraps, WRAPS } from './Stake'
import { Thin } from './Thin'
import { careTargets } from './targets'
import './care.css'

type Props = {
  plant: PlantState
  layout: SceneLayout
  disabled: boolean
  sound: boolean
  onDone: (t: CareTaskId) => void
}

/** What a finished care leaves in the scene for the rest of its stage (`fresh` = finished just now). */
function Done({ task, L, fresh }: { task: CareTaskId; L: SceneLayout; fresh: boolean }) {
  switch (task) {
    case 'sow':
      return (
        <>
          {seedSpots(L).map((at, i) => (
            <SoilBump key={i} at={at} u={L.unit} />
          ))}
        </>
      )
    case 'stake':
      return <PlantedStake L={L} />
    case 'stakeTwine':
      return (
        <>
          <PlantedStake L={L} />
          <Wraps L={L} n={WRAPS} />
        </>
      )
    case 'hillUp':
      return <Heaps L={L} sizes={[HILL_TAPS, HILL_TAPS]} />
    case 'drainCheck':
      return <Dish L={L} wet dripping={fresh} />
    default:
      return null
  }
}

/**
 * The stage care in the scene (drawn through PlantView.sceneOverlay): the pending care's own direct
 * manipulation, and what the stage's finished care left behind (a stake, heaps of soil ...).
 * Every care can be finished by dragging or by taps alone.
 */
export function CareLayer({ plant, layout: L, disabled, sound, onDone }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [fresh, setFresh] = useState<CareTaskId | null>(null)
  const stage = SPECIES[plant.speciesId].stages[plant.stageIndex]
  const pic = plantArt(plant.speciesId, stage)
  const task = pendingCare(plant)
  const done = careTasks(plant.speciesId, stage).slice(0, plant.careDone)

  const toScene = (p: Pt): Pt => {
    const r = ref.current?.getBoundingClientRect()
    return r ? { x: p.x - r.left, y: p.y - r.top } : p
  }
  const props = (t: CareTaskId): CareProps => ({
    L,
    rects: careTargets(t, L, pic),
    pic,
    speciesId: plant.speciesId,
    disabled,
    sound,
    toScene,
    onDone: () => {
      setFresh(t)
      onDone(t)
    },
  })
  // A new day (or a new task) starts the manipulation over.
  const key = `${plant.day}-${stage}-${task}`
  let active = null
  switch (task) {
    case 'sow':
      active = <Sow key={key} {...props(task)} />
      break
    case 'thin':
      active = <Thin key={key} {...props(task)} />
      break
    case 'stake':
    case 'stakeTwine':
      active = <Stake key={key} {...props(task)} twine={task === 'stakeTwine'} />
      break
    case 'hillUp':
      active = <HillUp key={key} {...props(task)} />
      break
    case 'pinch':
      active = <Pinch key={key} {...props(task)} />
      break
    case 'drainCheck':
      active = <Drain key={key} {...props(task)} />
      break
  }

  return (
    <div ref={ref} className="care" data-care={task ?? undefined}>
      {done.map((t) => (
        <Done key={t} task={t} L={L} fresh={fresh === t} />
      ))}
      {active}
    </div>
  )
}
