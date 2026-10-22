import { Component, useState, type ErrorInfo, type ReactNode } from 'react'
import { loadSave, SAVE_KEY, writeSave } from '../../sim/save'
import { BACKUP_KEY, keepRecords, toSave, type Action, type AppState } from '../../store'
import { BackupPanel } from './BackupPanel'
import { Modal } from '../Modal'
import './Screens.css'

const reloadPage = () => window.location.reload()

function storedText(): string | null {
  try {
    return globalThis.localStorage?.getItem(SAVE_KEY) ?? null
  } catch {
    return null
  }
}

/** The save exactly as stored, for copying when it cannot be read (or the backup panel itself fails). */
function RawSave() {
  const raw = storedText()
  if (raw === null) return null
  return (
    <section className="sc-card cr-raw" aria-label="저장된 기록">
      <p className="bk-help">이 글자를 모두 복사해서 선생님께 보여 주세요.</p>
      <textarea className="bk-input" aria-label="저장된 기록 그대로" readOnly rows={5} value={raw} spellCheck={false} />
    </section>
  )
}

/** The backup panel over the save in storage (not the state that crashed). */
function StoredBackup({ onBack, onReload }: { onBack: () => void; onReload: () => void }) {
  const [state] = useState<AppState>(() => {
    const { data, warning } = loadSave()
    return { ...data, screen: 'backup', morning: null, ...(warning ? { warning } : {}) }
  })
  const dispatch = (a: Action) => {
    if (a.type === 'open') onBack()
    if (a.type === 'restore') {
      writeSave(a.keep ? keepRecords(toSave(state), a.data) : a.data)
      onReload()
    }
  }
  return (
    <>
      <BackupPanel state={state} dispatch={dispatch} back="pick" />
      {state.warning === 'corrupt' && <RawSave />}
    </>
  )
}

/** If the backup panel itself fails, the raw save is still there to copy. */
class BackupGuard extends Component<{ children: ReactNode; onBack: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="sc">
        <RawSave />
        <button type="button" className="sc-big" onClick={this.props.onBack}>
          돌아가기
        </button>
      </div>
    )
  }
}

function clearAndRestart(onReload: () => void) {
  try {
    const raw = globalThis.localStorage?.getItem(SAVE_KEY)
    // keep a copy, as the load does for an unreadable save
    if (raw !== null && raw !== undefined) globalThis.localStorage.setItem(BACKUP_KEY, raw)
    globalThis.localStorage?.removeItem(SAVE_KEY)
  } catch {
    // storage unavailable: a reload starts fresh anyway
  }
  onReload()
}

export function CrashScreen({ onReload = reloadPage }: { onReload?: () => void }) {
  const [mode, setMode] = useState<'home' | 'backup'>('home')
  const [asking, setAsking] = useState(false)

  if (mode === 'backup') {
    const back = () => setMode('home')
    return (
      <main>
        <BackupGuard onBack={back}>
          <StoredBackup onBack={back} onReload={onReload} />
        </BackupGuard>
      </main>
    )
  }

  return (
    <main>
      <section className="sc cr" aria-labelledby="cr-title">
        <h1 id="cr-title" className="sc-h1">
          앗, 문제가 생겼어요
        </h1>
        <p className="sc-sub">먼저 ‘기록 지키기’에서 코드를 적어 두고, 그래도 안 되면 처음부터 다시 해요.</p>
        <div className="cr-actions">
          <button type="button" className="sc-big sc-big--primary" onClick={() => setMode('backup')}>
            기록 지키기
          </button>
          <button type="button" className="sc-big" onClick={() => setAsking(true)}>
            처음부터 다시 하기
          </button>
        </div>
      </section>
      {asking && (
        <Modal role="alertdialog" labelledBy="cr-dialog-title" onClose={() => setAsking(false)}>
          <p id="cr-dialog-title" className="bk-dialog-title">
            지금 기록이 모두 지워져요. 처음부터 다시 할까요?
          </p>
          <div className="bk-dialog-actions">
            <button type="button" className="sc-big sc-big--primary" onClick={() => clearAndRestart(onReload)}>
              지우고 다시 하기
            </button>
            <button type="button" className="sc-big" autoFocus onClick={() => setAsking(false)}>
              그만두기
            </button>
          </div>
        </Modal>
      )}
    </main>
  )
}

/** Around the whole app: a render crash shows CrashScreen instead of a blank page. */
export class AppErrorBoundary extends Component<{ children: ReactNode; onReload?: () => void }, { crashed: boolean }> {
  state = { crashed: false }
  static getDerivedStateFromError() {
    return { crashed: true }
  }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('키워라! crashed', error, info.componentStack)
  }
  render() {
    return this.state.crashed ? <CrashScreen onReload={this.props.onReload} /> : this.props.children
  }
}
