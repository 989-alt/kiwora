import { useMemo, useRef, useState } from 'react'
import { exportCode, importCode, isShortCode, shortCode, type SaveData } from '../../sim/save'
import { toSave, type Action, type AppState, type Screen } from '../../store'
import { Modal } from '../Modal'
import { HomeButton } from '../HomeMenu'
import './Screens.css'

type Props = {
  state: AppState
  dispatch: (a: Action) => void
  /** Screen the back button returns to. */
  back: Screen
}

type CopyState = 'idle' | 'copied' | 'selected'

const WARNING_LINE: Record<string, string> = {
  corrupt: '기록을 불러오지 못했어요. 적어 둔 기록 코드가 있으면 넣어 주세요.',
  unavailable: '이 기기에는 기록을 저장할 수 없어요. 적어 둔 기록 코드가 있으면 넣어 주세요.',
}

/** Nothing worth keeping yet: no plant, no dex, no past tries, no kept journals. */
function isEmpty(d: SaveData): boolean {
  return d.plant === null && d.dex.length === 0 && d.pastTries.length === 0 && Object.keys(d.finished ?? {}).length === 0
}

export function BackupPanel({ state, dispatch, back }: Props) {
  const data = useMemo(() => toSave(state), [state])
  // The long code holds everything (journals too) and is for copying; the short one is for writing down.
  const code = useMemo(() => exportCode(data), [data])
  const short = useMemo(() => shortCode(data), [data])
  const codeRef = useRef<HTMLDivElement>(null)
  const [copy, setCopy] = useState<CopyState>('idle')
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  // The code to restore; `keep` = a short code, which replaces only the plant (journals and past tries stay).
  const [pending, setPending] = useState<{ data: SaveData; keep: boolean } | null>(null)

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
    setPending({ data: r.data, keep: isShortCode(input) })
  }

  const goBack = () => {
    dispatch({ type: 'open', screen: back })
    if (state.warning) dispatch({ type: 'clearWarning' })
  }

  const warningLine = state.warning ? (WARNING_LINE[state.warning] ?? WARNING_LINE.corrupt) : null
  // Nothing to write down while the save is empty or could not be read (its code would be an empty one).
  const showSave = !warningLine && !isEmpty(data)

  return (
    <div className="sc bk">
      <header className="sc-head">
        <h1 className="sc-h1">기록 지키기</h1>
        <nav className="sc-nav" aria-label="메뉴">
          <button type="button" className="sc-btn" onClick={goBack}>
            돌아가기
          </button>
          <HomeButton className="sc-btn" dispatch={dispatch} />
        </nav>
      </header>

      {warningLine && <p className="bk-warning">{warningLine}</p>}

      <div className={`bk-cols${showSave ? '' : ' bk-cols--one'}`}>
        {showSave && (
          <section className="sc-card bk-save" aria-label="기록 코드 적어 두기">
            <h2 className="jr-h2">내 기록 코드</h2>
            <p className="bk-help">이 짧은 기록 코드를 실험관찰에 적어 두세요. 기록이 사라져도 코드로 되살릴 수 있어요.</p>
            <div className="bk-short" role="textbox" aria-readonly="true" aria-label="짧은 기록 코드" tabIndex={0}>
              {short.split('-').map((g, i) => (
                <span key={i} className="bk-group">
                  {g}
                </span>
              ))}
            </div>
            <p className="bk-note">짧은 기록 코드는 식물과 도감만 되살려요.</p>

            <h3 className="bk-h3">관찰 일지까지 모두 지키려면</h3>
            <p className="bk-help">전체 기록 코드를 복사해서 메모장 같은 곳에 붙여 두세요.</p>
            <div className="bk-code" ref={codeRef} role="textbox" aria-readonly="true" aria-label="전체 기록 코드" tabIndex={0}>
              <span className="bk-code-text">{code}</span>
            </div>
            <div className="bk-row">
              <button type="button" className="sc-btn" onClick={doCopy}>
                복사하기
              </button>
              <span className="bk-copied" role="status">
                {copy === 'copied' && '복사했어요!'}
                {copy === 'selected' && '코드를 선택했어요. 길게 눌러 복사해 주세요.'}
              </span>
            </div>
          </section>
        )}

        <section className="sc-card bk-restore" aria-label="기록 되살리기">
          <h2 className="jr-h2">기록 되살리기</h2>
          <label className="bk-help" htmlFor="bk-input">
            적어 둔 짧은 기록 코드나 복사해 둔 전체 기록 코드를 여기에 넣어 주세요.
          </label>
          <textarea
            id="bk-input"
            className="bk-input"
            aria-label="되살릴 기록 코드"
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
        <Modal role="alertdialog" labelledBy="bk-dialog-title" onClose={() => setPending(null)}>
          <p id="bk-dialog-title" className="bk-dialog-title">
            {pending.keep ? '지금 키우는 식물이 기록 코드의 식물로 바뀌어요. 계속할까요?' : '지금 기록이 바뀌어요. 계속할까요?'}
          </p>
          {pending.keep && <p className="bk-help">끝낸 관찰 일지와 지난 시도는 그대로 남아요.</p>}
          <div className="bk-dialog-actions">
            <button
              type="button"
              className="sc-big sc-big--primary"
              onClick={() => dispatch(pending.keep ? { type: 'restore', data: pending.data, keep: true } : { type: 'restore', data: pending.data })}
            >
              바꾸기
            </button>
            <button type="button" className="sc-big" autoFocus onClick={() => setPending(null)}>
              그만두기
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
