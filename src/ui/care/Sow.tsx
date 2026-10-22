import { useRef, useState } from 'react'
import type { SpeciesId } from '../../sim/species'
import { propArt } from '../art'
import type { SceneLayout } from '../PlantView'
import { plink, pop } from '../sound'
import { CareHint, Target, type CareProps, type Pt } from './parts'
import { usePress } from './press'
import { careGeo, hits } from './targets'

export const SEEDS = 3
/** Rubbing this far (px) over the soil covers all the seeds; one tap on the soil covers one seed. */
export const RUB_PX = 240
const PER_SEED = RUB_PX / SEEDS

/** Seed colour of each species (a seed is a few px on screen: its colour is what tells it apart). */
const SEED_COLOR: Record<SpeciesId, string> = {
  morningGlory: '#3b2a20',
  bean: '#a3263a',
  rice: '#e8d49a',
  corn: '#f2c14e',
  balsam: '#6b4a2b',
  apple: '#5a3418',
  persimmon: '#7a4a24',
  forsythia: '#8a6a3a',
  dandelion: '#9a7b4f',
}

/** Where the seeds lie on the soil (scene px). */
export function seedSpots(L: SceneLayout): Pt[] {
  const g = careGeo(L)
  const y = g.ground - 14 * g.u
  return [
    { x: g.cx - 42 * g.u, y: y - 2 * g.u },
    { x: g.cx + 2 * g.u, y: y + 4 * g.u },
    { x: g.cx + 44 * g.u, y: y - 3 * g.u },
  ]
}

export function Seed({ at, u, id, ghost }: { at: Pt; u: number; id: SpeciesId; ghost?: boolean }) {
  const w = Math.max(14, 20 * u) * (ghost ? 1.5 : 1)
  return (
    <span
      className={`care-seed${ghost ? ' care-seed--ghost' : ''}`}
      style={{ left: at.x - w / 2, top: at.y - w * 0.35, width: w, height: w * 0.7, background: SEED_COLOR[id] }}
    />
  )
}

/** A little heap of soil over a covered seed. */
export function SoilBump({ at, u, fresh }: { at: Pt; u: number; fresh?: boolean }) {
  const w = Math.max(24, 34 * u)
  return (
    <span
      className={`care-bump${fresh ? ' care-bump--fresh' : ''}`}
      style={{ left: at.x - w / 2, top: at.y - w * 0.3, width: w, height: w * 0.5 }}
    />
  )
}

/** sow: drag seeds from the packet onto the soil (or tap the soil 3 times), then rub the soil to cover them (or tap 3 times). */
export function Sow({ L, rects, speciesId, disabled, sound, onDone, toScene }: CareProps) {
  const [soilR, packetR] = rects
  const [seeds, setSeeds] = useState(0)
  const [rub, setRub] = useState(0)
  const [ghost, setGhost] = useState<Pt | null>(null)
  // the true counts (several pointer moves can come between two renders)
  const now = useRef({ seeds: 0, rub: 0, finished: false })
  const covering = seeds >= SEEDS
  const u = L.unit
  const spots = seedSpots(L)

  const addSeed = () => {
    const n = now.current
    if (n.seeds >= SEEDS) return
    n.seeds += 1
    setSeeds(n.seeds)
    plink(sound)
  }
  const addRub = (px: number, snap: boolean) => {
    const n = now.current
    if (n.finished || n.seeds < SEEDS) return
    const next = Math.min(RUB_PX, snap ? (Math.floor(n.rub / PER_SEED) + 1) * PER_SEED : n.rub + px)
    if (Math.floor(next / PER_SEED) > Math.floor(n.rub / PER_SEED)) pop(sound)
    n.rub = next
    setRub(next)
    if (next >= RUB_PX) {
      n.finished = true
      onDone()
    }
  }

  const soil = usePress({
    disabled,
    onTap: () => (covering ? addRub(0, true) : addSeed()),
    onMove: (step) => {
      if (covering) addRub(step, false)
    },
  })
  const packet = usePress({
    disabled: disabled || covering,
    onTap: addSeed,
    onMove: (_step, at, dragging) => {
      if (dragging) setGhost(toScene(at))
    },
    onDrop: (at) => {
      const p = toScene(at)
      if (hits(soilR, p.x, p.y)) addSeed()
    },
    onEnd: () => setGhost(null),
  })
  const covered = Math.floor(rub / PER_SEED)
  const pk = propArt('seedPacket')

  return (
    <>
      {spots.slice(0, seeds).map((at, i) =>
        i < covered ? <SoilBump key={i} at={at} u={u} fresh /> : <Seed key={i} at={at} u={u} id={speciesId} />,
      )}
      <Target r={soilR} label={covering ? '흙 덮기' : '흙에 씨 놓기'} disabled={disabled} press={soil} className="care-soil">
        {covering && (
          <svg className="care-rub" viewBox="0 0 100 40" aria-hidden="true">
            <path d="M14 20h72M14 20l12-10M14 20l12 10M86 20l-12-10M86 20l-12 10" />
          </svg>
        )}
      </Target>
      {!covering && (
        <Target r={packetR} label="씨 봉투" disabled={disabled} press={packet} mark={false} className="care-source">
          <img src={pk.src} alt="" draggable={false} />
        </Target>
      )}
      {ghost && <Seed at={ghost} u={u} id={speciesId} ghost />}
      <CareHint>{covering ? '흙을 문질러 씨를 덮어요' : `씨를 흙에 놓아요 ${seeds}/${SEEDS}`}</CareHint>
    </>
  )
}
