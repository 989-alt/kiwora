import { useState } from 'react'
import { mulberry32 } from '../../sim/rng'
import { asset, fillSpots } from '../art'
import { pop } from '../sound'
import './tools.css'

/** Points on leaves of the stand-in plant picture (source px of plants/standin.png). A species' own pictures bring their own spots (anchors.json). */
const LEAF_SPOTS: [number, number][] = [
  [300, 360],
  [780, 280],
  [330, 500],
  [820, 640],
  [260, 780],
  [720, 860],
  [300, 960],
  [760, 1000],
  [420, 1180],
  [180, 820],
  [560, 140],
  [870, 1080],
]

/** 58 px so the button stays ≥ 48 px under the low-light scaleX(0.85) of the plant overlay. */
const BUTTON = 58

type Props = {
  count: number
  /** Fixed per plant day, so bugs keep their places. */
  seed: number
  /** Plant picture px per source px. */
  scale: number
  /** Places on the leaves of the current plant picture (source px); the stand-in's spots when absent. Padded to 12. */
  spots?: [number, number][]
  /** How many of `spots` (the first ones) are measured leaf spots; bugs take these first. Default: all of them. */
  measured?: number
  disabled: boolean
  sound: boolean
  onCatch: () => void
}

/** Shuffles the measured places and the padded places separately, measured first. */
function placements(seed: number, spots: [number, number][], measured: number) {
  const rng = mulberry32(seed)
  const shuffle = (from: number, to: number) => {
    const part = Array.from({ length: to - from }, (_, k) => from + k)
    for (let i = part.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[part[i], part[j]] = [part[j], part[i]]
    }
    return part
  }
  const cut = Math.min(Math.max(0, measured), spots.length)
  const order = [...shuffle(0, cut), ...shuffle(cut, spots.length)]
  return order.map((i) => ({
    spot: spots[i],
    tilt: Math.round(rng() * 50 - 25),
    kind: rng() < 0.6 ? 'aphid' : 'caterpillar',
  }))
}

/**
 * Button centres (overlay px) of the bugs on screen, pushed apart until no button covers another's middle:
 * a small plant (drawn at its height) has its leaf spots close together, and every bug must stay tappable.
 */
export function spreadApart(pts: [number, number][], min = BUTTON + 2): [number, number][] {
  const ps = pts.map(([x, y]): [number, number] => [x, y])
  for (let round = 0; round < 40; round++) {
    let moved = false
    for (let i = 0; i < ps.length; i++)
      for (let j = i + 1; j < ps.length; j++) {
        const [a, b] = [ps[i], ps[j]]
        const dx = b[0] - a[0]
        const dy = b[1] - a[1]
        if (Math.max(Math.abs(dx), Math.abs(dy)) >= min) continue
        moved = true
        // apart along the axis they are already furthest apart on (the same place: across, by order)
        const k = Math.abs(dx) >= Math.abs(dy) ? 0 : 1
        const d = k === 0 ? dx : dy
        const dir = d === 0 ? (j % 2 === 0 ? 1 : -1) : Math.sign(d)
        const push = (min - Math.abs(d)) / 2
        a[k] -= dir * push
        b[k] += dir * push
      }
    if (!moved) break
  }
  return ps
}

/** `count` bugs on the leaves; each is a ≥48 px button. Give it `key={seed}` so a new day resets it. */
export function Bugs({ count, seed, scale, spots, measured, disabled, sound, onCatch }: Props) {
  // Indices tapped today: the tapped bug disappears (not just the last one).
  const [gone, setGone] = useState<number[]>([])
  const base = spots && spots.length > 0 ? spots : LEAF_SPOTS
  // A place for every bug the sim can count, so no counted bug is ever left untappable.
  const all = placements(seed, fillSpots(base), measured ?? base.length)
  // count + gone is the same all day, so the places stay put while bugs are caught
  const shown = Math.min(all.length, count + gone.length)
  const at = spreadApart(all.slice(0, shown).map((b) => [b.spot[0] * scale, b.spot[1] * scale]))
  return (
    <>
      {all.slice(0, shown).map((b, i) =>
        gone.includes(i) ? null : (
          <button
            key={i}
            type="button"
            className="bug"
            aria-label={`벌레 잡기 ${i + 1}`}
            data-tut="bug"
            disabled={disabled}
            style={{ left: at[i][0] - BUTTON / 2, top: at[i][1] - BUTTON / 2, width: BUTTON, height: BUTTON }}
            onClick={() => {
              setGone((g) => [...g, i])
              onCatch()
              pop(sound)
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <img src={asset(`bugs/${b.kind}.webp`)} alt="" draggable={false} style={{ transform: `rotate(${b.tilt}deg)` }} />
          </button>
        ),
      )}
    </>
  )
}
