import { useState } from 'react'
import type { Action } from '../store'
import { Modal } from './Modal'
import './HomeMenu.css'

/** The same line-icon style as the other header buttons: a house. */
export const HOME_ICON = ['M3 11.5 12 4l9 7.5', 'M5.5 10v10h13V10', 'M10 20v-5.5h4V20']

export function HomeIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {HOME_ICON.map((p) => (
        <path key={p} d={p} />
      ))}
    </svg>
  )
}

type Props = {
  dispatch: (a: Action) => void
  /** The class of the header's buttons ('gs-menu-btn' on the grow screen, 'sc-btn' elsewhere). */
  className: string
  disabled?: boolean
}

/**
 * [메인화면으로] in a screen's header: asks first, in a dialog in the middle of the screen, whether to keep the
 * records (just go to the title screen) or wipe them (a second step asks again).
 */
export function HomeButton({ dispatch, className, disabled = false }: Props) {
  const [step, setStep] = useState<'ask' | 'confirm' | null>(null)
  const close = () => setStep(null)
  return (
    <>
      <button type="button" className={`${className} home-btn`} disabled={disabled} onClick={() => setStep('ask')}>
        <HomeIcon />
        <span className="home-btn-label">메인화면으로</span>
      </button>
      {step === 'ask' && (
        <Modal key="ask" role="dialog" labelledBy="home-title" onClose={close} tapGuardMs={400}>
          <p id="home-title" className="bk-dialog-title">
            메인화면으로 갈까요?
          </p>
          <div className="home-actions">
            <button
              type="button"
              className="sc-big sc-big--primary"
              autoFocus
              onClick={() => {
                close()
                dispatch({ type: 'open', screen: 'title' })
              }}
            >
              기록 유지하고 메인 화면으로
            </button>
            <button type="button" className="sc-big sc-big--danger" onClick={() => setStep('confirm')}>
              기록 초기화하기
            </button>
            <button type="button" className="sc-big" onClick={close}>
              취소
            </button>
          </div>
        </Modal>
      )}
      {step === 'confirm' && (
        <Modal key="confirm" role="alertdialog" labelledBy="home-confirm-title" onClose={close} tapGuardMs={400}>
          <p id="home-confirm-title" className="bk-dialog-title">
            기록이 모두 지워져요. 정말 초기화할까요?
          </p>
          <div className="bk-dialog-actions">
            <button
              type="button"
              className="sc-big sc-big--danger"
              onClick={() => {
                close()
                dispatch({ type: 'reset', to: 'title' })
              }}
            >
              초기화하기
            </button>
            <button type="button" className="sc-big" autoFocus onClick={close}>
              취소
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
