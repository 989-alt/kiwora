import { useState } from 'react'
import { mulberry32 } from '../../sim/rng'
import { pop } from '../sound'
import './tools.css'

/** Points on leaves of the stand-in plant picture (source px of plants/balsam/flower.png). */
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
  disabled: boolean
  sound: boolean
  onCatch: () => void
}

function placements(seed: number) {
  const rng = mulberry32(seed)
  const order = LEAF_SPOTS.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order.map((i) => ({ spot: LEAF_SPOTS[i], tilt: Math.round(rng() * 50 - 25) }))
}

/** `count` bugs on the leaves; each is a ≥48 px button. Give it `key={seed}` so a new day resets it. */
export function Bugs({ count, seed, scale, disabled, sound, onCatch }: Props) {
  // Indices tapped today: the tapped bug disappears (not just the last one).
  const [gone, setGone] = useState<number[]>([])
  const all = placements(seed)
  const shown = Math.min(all.length, count + gone.length)
  return (
    <>
      {all.slice(0, shown).map((b, i) =>
        gone.includes(i) ? null : (
          <button
            key={i}
            type="button"
            className="bug"
            aria-label="벌레 잡기"
            data-tut="bug"
            disabled={disabled}
            style={{ left: b.spot[0] * scale - BUTTON / 2, top: b.spot[1] * scale - BUTTON / 2, width: BUTTON, height: BUTTON }}
            onClick={() => {
              setGone((g) => [...g, i])
              onCatch()
              pop(sound)
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <img src="/bugs/aphid.png" alt="" draggable={false} style={{ transform: `rotate(${b.tilt}deg)` }} />
          </button>
        ),
      )}
    </>
  )
}
