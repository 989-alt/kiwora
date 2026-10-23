import { useState } from 'react'
import { hasProgress, toSave, type Action, type AppState } from '../../store'
import { Modal } from '../Modal'
import { PlantView } from '../PlantView'
import '../HomeMenu.css'
import './Screens.css'
import './TitleScreen.css'

type Props = { state: AppState; dispatch: (a: Action) => void }

const PLAY = 'M8 5.5v13l10.5-6.5z'
const SPROUT = ['M12 21v-9', 'M12 12c0-4 3-6.5 7.5-6.5 0 4.5-3 6.5-7.5 6.5z', 'M12 14.5c0-3.2-2.4-5.5-6.5-5.5 0 3.4 2.4 5.5 6.5 5.5z']

/** The main screen the app opens on: go on from the save, or start over. */
export function TitleScreen({ state, dispatch }: Props) {
  const saved = hasProgress(toSave(state))
  const [asking, setAsking] = useState(false)
  const startOver = () => (saved ? setAsking(true) : dispatch({ type: 'reset', to: 'pick' }))
  return (
    <section className="sc tt" aria-labelledby="tt-title">
      <div className="tt-scene" aria-hidden="true">
        <PlantView speciesId="balsam" stage="flower" heightCm={34} health={100} lightLow={false} place="window" winter={false} />
      </div>

      <div className="tt-body">
        <h1 id="tt-title" className="tt-h1">
          <span className="tt-kicker">키워라!</span>
          <span className="tt-name">식물 한살이</span>
        </h1>
        <p className="tt-sub">씨를 심고 돌보며, 식물이 자라는 모습을 지켜보아요.</p>

        <div className="tt-actions">
          <button
            type="button"
            className="sc-big sc-big--primary tt-btn"
            aria-disabled={!saved}
            aria-describedby={saved ? undefined : 'tt-none'}
            onClick={() => saved && dispatch({ type: 'continue' })}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d={PLAY} />
            </svg>
            이어하기
          </button>
          {!saved && (
            <p id="tt-none" className="tt-note">
              아직 저장된 기록이 없어요
            </p>
          )}
          <button type="button" className="sc-big tt-btn" onClick={startOver}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {SPROUT.map((d) => (
                <path key={d} d={d} />
              ))}
            </svg>
            새로 시작하기
          </button>
        </div>
      </div>

      {asking && (
        <Modal role="alertdialog" labelledBy="tt-confirm-title" onClose={() => setAsking(false)} tapGuardMs={400}>
          <p id="tt-confirm-title" className="bk-dialog-title">
            지금까지의 기록이 모두 지워져요. 새로 시작할까요?
          </p>
          <div className="bk-dialog-actions">
            <button
              type="button"
              className="sc-big sc-big--danger"
              onClick={() => {
                setAsking(false)
                dispatch({ type: 'reset', to: 'pick' })
              }}
            >
              새로 시작하기
            </button>
            <button type="button" className="sc-big" autoFocus onClick={() => setAsking(false)}>
              취소
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}
