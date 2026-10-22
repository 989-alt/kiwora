import { useState } from 'react'
import { isApproved } from '../../sim/approved'
import { SPECIES, type SpeciesId } from '../../sim/species'
import type { Mode } from '../../sim/types'
import { journalWouldBeLost, type Action, type AppState } from '../../store'
import { plantSrc } from '../PlantView'
import { Modal } from '../Modal'
import './Screens.css'

const IDS = Object.keys(SPECIES) as SpeciesId[]

const GROUPS: { life: 'annual' | 'perennial'; title: string; note: string }[] = [
  { life: 'annual', title: '한해살이식물', note: '한 해 동안 한살이를 마쳐요' },
  { life: 'perennial', title: '여러해살이식물', note: '겨울을 지내고 봄에 다시 새순이 나와요' },
]

type Props = { state: AppState; dispatch: (a: Action) => void }

export function PickScreen({ state, dispatch }: Props) {
  const done = new Set(state.dex)
  // A finished journal is kept per species, so this only asks for one that somehow was not kept.
  const [asking, setAsking] = useState<SpeciesId | null>(null)
  // After that (if asked at all) the student chooses how to grow it: every new plant starts here.
  const [choosing, setChoosing] = useState<SpeciesId | null>(null)
  const pick = (id: SpeciesId) => (journalWouldBeLost(state) ? setAsking(id) : setChoosing(id))
  const start = (id: SpeciesId, mode: Mode) => {
    setChoosing(null)
    dispatch({ type: 'pick', id, mode })
  }
  return (
    <div className="sc pk">
      <header className="sc-head">
        <div>
          <h1 className="sc-h1 pk-h1">어떤 식물을 키워 볼까요?</h1>
          <p className="sc-sub">씨부터 키워서 다시 씨를 얻어 보아요.</p>
        </div>
        <nav className="sc-nav" aria-label="메뉴">
          <button type="button" className="sc-btn" onClick={() => dispatch({ type: 'open', screen: 'dex' })}>
            씨 도감 <span>{state.dex.length}/{IDS.length}</span>
          </button>
          <button type="button" className="sc-btn" onClick={() => dispatch({ type: 'open', screen: 'backup' })}>
            기록 지키기
          </button>
        </nav>
      </header>

      {GROUPS.map((g) => (
        <section key={g.life} className={`pk-group pk-group--${g.life}`} aria-label={g.title}>
          <h2 className="pk-h2">
            {g.title} <span>{g.note}</span>
          </h2>
          <div className="pk-grid">
            {IDS.filter((id) => SPECIES[id].life === g.life).map((id) => {
              // The shipped app only offers species whose pictures the teacher has approved.
              const soon = import.meta.env.PROD && !isApproved(id)
              return (
                <button
                  key={id}
                  type="button"
                  className={`pk-card${soon ? ' pk-card--soon' : ''}`}
                  disabled={soon}
                  onClick={() => pick(id)}
                >
                  <span className="pk-art">
                    <img src={plantSrc(id, 'flower')} alt="" draggable={false} />
                    {done.has(id) && <span className="pk-badge">완성</span>}
                    {soon && <span className="pk-soon">준비 중</span>}
                  </span>
                  <span className="pk-name">{SPECIES[id].name}</span>
                  <span className="pk-blurb">{SPECIES[id].blurb}</span>
                </button>
              )
            })}
          </div>
        </section>
      ))}

      {asking && (
        <Modal role="alertdialog" labelledBy="pk-dialog-title" onClose={() => setAsking(null)}>
          <p id="pk-dialog-title" className="bk-dialog-title">
            새로 키우면 지금 관찰 일지가 사라져요. 계속할까요?
          </p>
          <div className="bk-dialog-actions">
            <button type="button" className="sc-big sc-big--primary" onClick={() => { setChoosing(asking); setAsking(null) }}>
              새로 키우기
            </button>
            <button type="button" className="sc-big" autoFocus onClick={() => setAsking(null)}>
              그만두기
            </button>
          </div>
        </Modal>
      )}

      {choosing && (
        <Modal role="dialog" labelledBy="pk-mode-title" onClose={() => setChoosing(null)} tapGuardMs={400}>
          <p id="pk-mode-title" className="bk-dialog-title">
            {SPECIES[choosing].name}, 어떻게 키울까요?
          </p>
          <div className="pk-mode">
            <button type="button" className="sc-big sc-big--primary" onClick={() => start(choosing, 'daily')}>
              <span>매일 키우기</span>
              <span className="pk-mode-note">하루에 한 번, 진짜 날짜처럼</span>
            </button>
            <button type="button" className="sc-big" onClick={() => start(choosing, 'quick')}>
              <span>한 번에 키우기</span>
              <span className="pk-mode-note">하루 마치기를 누르면 바로 다음 날</span>
            </button>
            <button type="button" className="sc-big" autoFocus onClick={() => setChoosing(null)}>
              그만두기
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
