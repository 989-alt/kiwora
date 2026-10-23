import { useEffect, useRef, useState } from 'react'
import { OBSERVATIONS, observeChoices, type ObsPart } from '../../data/observations'
import { measureAnswer, rulerChoices } from '../../sim/measure'
import { seedFor } from '../../sim/rng'
import type { PendingObs } from '../../sim/save'
import { SPECIES } from '../../sim/species'
import type { PlantState } from '../../sim/types'
import type { Action } from '../../store'
import { propArt } from '../art'
import { usePress } from '../care/press'
import { rulerFits } from '../remaining'
import { plink } from '../sound'
import './observe.css'

export type ObsTool = 'ruler' | 'magnifier'

type Ui = {
  /** Which plant day this is for: a new day starts over. */
  key: string
  open: boolean
  tool: ObsTool | null
  /** Middle of the ruler in scene px; null = beside the plant. */
  rulerX: number | null
  misses: Record<ObsTool, number>
}

const closed = (key: string): Ui => ({ key, open: false, tool: null, rulerX: null, misses: { ruler: 0, magnifier: 0 } })

/** A miss after this many shows the answer (the lit mark / sentence); then only the answer can be picked. */
export const MISSES_FOR_HINT = 2

/**
 * Today's observing (spec §6): what is open on screen and the misses so far, and what today's pendingObs
 * says is done. The ruler is only out from the sprout on and when the plant is at least 1 cm tall.
 */
export function useObserve(plant: PlantState, pendingObs: PendingObs | null | undefined, dispatch: (a: Action) => void, sound: boolean) {
  const key = `${plant.speciesId}:${plant.day}`
  const [raw, setUi] = useState<Ui>(() => closed(key))
  const ui = raw.key === key ? raw : closed(key)
  const set = (f: (u: Ui) => Ui) => setUi((u) => f(u.key === key ? u : closed(key)))

  const id = plant.speciesId
  const stage = SPECIES[id].stages[plant.stageIndex]
  const seed = seedFor(plant.day, id)
  const rulerOk = rulerFits(plant)
  const measured = pendingObs?.measuredCm
  const observed = pendingObs?.observed
  const done = observed !== undefined && (measured !== undefined || !rulerOk)

  const ruler = rulerOk ? { options: rulerChoices(plant.heightCm, seed), answer: measureAnswer(plant.heightCm) } : null
  const sentences = observeChoices(id, stage, seed + 1)
  const part: ObsPart = OBSERVATIONS[id][stage]?.part ?? 'leaf'

  const miss = (t: ObsTool) => set((u) => ({ ...u, misses: { ...u.misses, [t]: u.misses[t] + 1 } }))
  const pick = (t: ObsTool, value: string) => {
    if (t === 'ruler' && ruler) {
      if (measured !== undefined) return
      if (Number(value) === ruler.answer) {
        dispatch({ type: 'measure', cm: ruler.answer, helped: ui.misses.ruler >= MISSES_FOR_HINT })
        plink(sound)
      } else if (ui.misses.ruler < MISSES_FOR_HINT) miss('ruler')
    } else if (t === 'magnifier') {
      if (observed !== undefined) return
      if (value === sentences.answer) {
        dispatch({ type: 'observe', text: value })
        plink(sound)
      } else if (ui.misses.magnifier < MISSES_FOR_HINT) miss('magnifier')
    }
  }

  return {
    ui,
    stage,
    part,
    rulerOk,
    ruler,
    sentences,
    measured,
    observed,
    done,
    open: () => set((u) => ({ ...u, open: true })),
    close: () => set((u) => ({ ...u, open: false, tool: null })),
    placeRuler: (x: number | null) => set((u) => ({ ...u, tool: 'ruler', rulerX: x })),
    moveRuler: (x: number) => set((u) => ({ ...u, rulerX: x })),
    showMagnifier: () => set((u) => ({ ...u, tool: 'magnifier' })),
    pick,
  }
}

export type Observe = ReturnType<typeof useObserve>

const MAG = propArt('magnifier')

/**
 * [관찰하기] in the tool row: once a day; when today's observing is done it says so. `pulse` = the class that
 * makes it pulse while the '남은 활동' bubble is up.
 */
export function ObserveButton({ obs, disabled, pulse = '' }: { obs: Observe; disabled: boolean; pulse?: string }) {
  const label = obs.done ? '오늘 관찰 끝' : '관찰하기'
  return (
    <button type="button" className={`tool tool--obs${pulse && !obs.done ? ` ${pulse}` : ''}`} aria-label={label} disabled={disabled || obs.done} onClick={obs.open}>
      <img src={MAG.src} alt="" draggable={false} />
      <span className="tool-name">{label}</span>
    </button>
  )
}

/** A ruler drawn for the tool button and the drag ghost. */
function RulerIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="22" y="2" width="20" height="60" rx="4" fill="#fde68a" stroke="#b45309" strokeWidth="3" />
      {[10, 18, 26, 34, 42, 50].map((y, i) => (
        <line key={y} x1="22" x2={i % 2 === 0 ? 34 : 29} y1={y} y2={y} stroke="#78350f" strokeWidth="2.5" />
      ))}
    </svg>
  )
}

type ToolsProps = {
  obs: Observe
  disabled: boolean
  /** The pulse class while the '남은 활동' bubble is up: the tools still to use pulse. */
  pulse?: string
  /** The ruler was dropped at this client point (null = tapped: it stands beside the plant). */
  onDropRuler: (at: { x: number; y: number } | null) => void
}

/** The tool row while observing: drag the ruler to the plant, tap the magnifier, or stop. */
export function ObserveTools({ obs, disabled, onDropRuler, pulse = '' }: ToolsProps) {
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null)
  const rulerDone = obs.measured !== undefined
  const press = usePress({
    disabled: disabled || rulerDone,
    onTap: () => onDropRuler(null),
    onMove: (_s, at, dragging) => {
      if (dragging) setGhost(at)
    },
    onDrop: (at) => onDropRuler(at),
    onEnd: () => setGhost(null),
  })
  return (
    <>
      {obs.rulerOk && (
        <button type="button" className={`tool tool--ruler${obs.ui.tool === 'ruler' ? ' tool--on' : ''}${pulse && !rulerDone ? ` ${pulse}` : ''}`} aria-label="자" disabled={disabled || rulerDone} {...press}>
          <RulerIcon />
          <span className="tool-text">
            <span className="tool-name">자</span>
            <span className="tool-hint">{rulerDone ? '오늘 다 쟀어요' : '끌어서 식물 옆에 대요'}</span>
          </span>
        </button>
      )}
      <button
        type="button"
        className={`tool tool--mag${obs.ui.tool === 'magnifier' ? ' tool--on' : ''}${pulse && obs.observed === undefined ? ` ${pulse}` : ''}`}
        aria-label="돋보기"
        disabled={disabled}
        onClick={obs.showMagnifier}
      >
        <img src={MAG.src} alt="" draggable={false} />
        <span className="tool-text">
          <span className="tool-name">돋보기</span>
          <span className="tool-hint">{obs.observed !== undefined ? '오늘 다 봤어요' : '눌러서 자세히 봐요'}</span>
        </span>
      </button>
      <button type="button" className="tool tool--obs-end" onClick={obs.close}>
        <span className="tool-name">관찰 마치기</span>
      </button>
      {ghost && (
        <span className="obs-ghost" style={{ left: ghost.x, top: ghost.y }} aria-hidden="true">
          <RulerIcon size={96} />
        </span>
      )}
    </>
  )
}

type Choice = { label: string; value: string; right: boolean }

/** The choices beside the scene (spec §6): closing it never blocks anything. */
export function ObservePanel({ obs, disabled }: { obs: Observe; disabled: boolean }) {
  const ref = useRef<HTMLElement>(null)
  const t = obs.ui.tool
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [t])

  let title = '관찰하기'
  let question = obs.rulerOk ? '자를 끌어 식물 옆에 대 보아요. 돋보기를 누르면 자세히 보여요.' : '돋보기를 눌러 자세히 보아요.'
  let choices: Choice[] = []
  let picked: string | undefined
  let misses = 0
  if (t === 'ruler' && obs.ruler) {
    const r = obs.ruler
    title = '자로 키 재기'
    question = '식물 꼭대기가 몇 cm 눈금에 닿았나요?'
    choices = r.options.map((v) => ({ label: `${v} cm`, value: String(v), right: v === r.answer }))
    picked = obs.measured !== undefined ? String(obs.measured) : undefined
    misses = obs.ui.misses.ruler
  } else if (t === 'magnifier') {
    title = '돋보기로 보기'
    question = '돋보기 속을 보고 맞는 문장을 골라요.'
    choices = obs.sentences.options.map((s) => ({ label: s, value: s, right: s === obs.sentences.answer }))
    picked = obs.observed
    misses = obs.ui.misses.magnifier
  }
  const hint = picked === undefined && misses >= MISSES_FOR_HINT
  let say = ''
  if (picked !== undefined) say = t === 'ruler' ? `내가 잰 키는 ${picked} cm예요. 일지에 적었어요.` : '일지에 적었어요.'
  else if (hint) say = t === 'ruler' ? '빛나는 눈금을 보고 눌러요' : '빛나는 문장을 눌러요'
  else if (misses === 1) say = '다시 보아요'

  return (
    <section ref={ref} className="obs-panel" aria-label="관찰하기">
      <div className="obs-head">
        <h2 className="obs-title">{title}</h2>
        <button type="button" className="obs-close" onClick={obs.close}>
          닫기
        </button>
      </div>
      <p className="obs-q">{question}</p>
      {choices.length > 0 && (
        <div className={`obs-choices${t === 'magnifier' ? ' obs-choices--text' : ''}`}>
          {choices.map((c) => {
            const isPicked = picked !== undefined && c.value === picked
            const cls = ['obs-choice', hint && c.right ? 'obs-choice--hint' : '', isPicked ? 'obs-choice--right' : ''].filter(Boolean).join(' ')
            return (
              <button
                key={c.value}
                type="button"
                className={cls}
                disabled={disabled || picked !== undefined || (hint && !c.right)}
                onClick={() => obs.pick(t as ObsTool, c.value)}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      )}
      {say && (
        <p className={`obs-say${picked !== undefined ? ' obs-say--done' : ''}`} aria-live="polite">
          {say}
        </p>
      )}
    </section>
  )
}
