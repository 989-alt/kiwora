import QRCode from 'qrcode'
import { useEffect, useMemo, useRef, useState } from 'react'
import { exportCode, importCode, type SaveData } from '../../sim/save'
import { toSave, type Action, type AppState, type Screen } from '../../store'
import './Screens.css'

type Props = {
  state: AppState
  dispatch: (a: Action) => void
  /** Screen the back button returns to. */
  back: Screen
}

type CopyState = 'idle' | 'copied' | 'selected'

const WARNING_LINE: Record<string, string> = {
  corrupt: '기록을 불러오지 못했어요. 적어 둔 코드가 있으면 넣어 주세요.',
  unavailable: '이 기기에는 기록을 저장할 수 없어요. 적어 둔 코드가 있으면 넣어 주세요.',
}

export function BackupPanel({ state, dispatch, back }: Props) {
  const code = useMemo(() => exportCode(toSave(state)), [state])
  const codeRef = useRef<HTMLDivElement>(null)
  const [copy, setCopy] = useState<CopyState>('idle')
  const [qr, setQr] = useState<string | null>(null)
  const [qrFailed, setQrFailed] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<SaveData | null>(null)

  useEffect(() => {
    let alive = true
    setQr(null)
    setQrFailed(false)
    QRCode.toDataURL(code, { errorCorrectionLevel: 'L', margin: 2, width: 260 })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQrFailed(true))
    return () => {
      alive = false
    }
  }, [code])

  const selectCode = (): boolean => {
    const el = codeRef.current
    const sel = window.getSelection?.()
    if (!el || !sel) return false
    const range = document.createRange()
    range.selectNodeContents(el)
    sel.removeAllRanges()
    sel.addRange(range)
    return true
  }

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopy('copied')
      return
    } catch {
      // clipboard blocked: select the text and try the old way
    }
    let ok = false
    if (selectCode()) {
      try {
        ok = document.execCommand('copy')
      } catch {
        ok = false
      }
    }
    setCopy(ok ? 'copied' : 'selected')
  }

  const askRestore = () => {
    const r = importCode(input)
    if (!r.ok) {
      setError(r.message)
      return
    }
    setError(null)
    setPending(r.data)
  }

  const goBack = () => {
    dispatch({ type: 'open', screen: back })
    if (state.warning) dispatch({ type: 'clearWarning' })
  }

  const warningLine = state.warning ? (WARNING_LINE[state.warning] ?? WARNING_LINE.corrupt) : null

  return (
    <div className="sc bk">
      <header className="sc-head">
        <h1 className="sc-h1">기록 지키기</h1>
        <nav className="sc-nav" aria-label="메뉴">
          <button type="button" className="sc-btn" onClick={goBack}>
            돌아가기
          </button>
        </nav>
      </header>

      {warningLine && <p className="bk-warning">{warningLine}</p>}

      <div className="bk-cols">
        <section className="sc-card bk-save" aria-label="코드 적어 두기">
          <h2 className="jr-h2">내 기록 코드</h2>
          <p className="bk-help">이 코드를 실험관찰에 적어 두세요. 기록이 사라져도 코드로 되살릴 수 있어요.</p>
          <div className="bk-code" ref={codeRef} role="textbox" aria-readonly="true" aria-label="복원 코드" tabIndex={0}>
            {code}
          </div>
          <div className="bk-row">
            <button type="button" className="sc-btn" onClick={doCopy}>
              복사하기
            </button>
            <span className="bk-copied" role="status">
              {copy === 'copied' && '복사했어요!'}
              {copy === 'selected' && '글자를 골랐어요. 길게 눌러 복사해 주세요.'}
            </span>
          </div>
          <div className="bk-qr">
            {qr && <img src={qr} alt="기록 코드 QR" width={200} height={200} draggable={false} />}
            {qrFailed && <p className="bk-help">코드가 길어서 QR을 만들지 못했어요. 위의 글자 코드를 적어 두세요.</p>}
          </div>
        </section>

        <section className="sc-card bk-restore" aria-label="기록 되살리기">
          <h2 className="jr-h2">기록 되살리기</h2>
          <label className="bk-help" htmlFor="bk-input">
            적어 둔 코드를 여기에 넣어요.
          </label>
          <textarea
            id="bk-input"
            className="bk-input"
            aria-label="되살릴 코드"
            aria-invalid={error !== null}
            aria-describedby={error ? 'bk-error' : undefined}
            rows={5}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setError(null)
            }}
          />
          {error && (
            <p id="bk-error" className="bk-error" role="alert">
              {error}
            </p>
          )}
          <button type="button" className="sc-big sc-big--primary" onClick={askRestore}>
            기록 되살리기
          </button>
        </section>
      </div>

      {pending && (
        <div className="bk-overlay">
          <div
            className="bk-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="bk-dialog-title"
            onKeyDown={(e) => e.key === 'Escape' && setPending(null)}
          >
            <p id="bk-dialog-title" className="bk-dialog-title">
              지금 기록이 바뀌어요. 계속할까요?
            </p>
            <div className="bk-dialog-actions">
              <button type="button" className="sc-big sc-big--primary" onClick={() => dispatch({ type: 'restore', data: pending })}>
                바꾸기
              </button>
              <button type="button" className="sc-big" autoFocus onClick={() => setPending(null)}>
                그만두기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
