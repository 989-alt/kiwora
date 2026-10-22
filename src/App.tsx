import { useRef, type ReactNode } from 'react'
import { screenFor, useApp, type Screen } from './store'
import { BackupPanel } from './ui/screens/BackupPanel'
import { DeathScreen } from './ui/screens/DeathScreen'
import { DexScreen } from './ui/screens/DexScreen'
import { GrowScreen } from './ui/screens/GrowScreen'
import { JournalScreen } from './ui/screens/JournalScreen'
import { PickScreen } from './ui/screens/PickScreen'
import { TransplantScreen } from './ui/screens/TransplantScreen'

/** The screen visited before the current one (UI only: sends the backup panel's back button home). */
function usePreviousScreen(current: Screen): Screen | null {
  const cur = useRef(current)
  const prev = useRef<Screen | null>(null)
  if (cur.current !== current) {
    prev.current = cur.current
    cur.current = current
  }
  return prev.current
}

/** Told once when this device could not save (storage full or blocked); a tap closes it. */
function SaveNotice({ onClose }: { onClose: () => void }) {
  return (
    <div className="save-notice" role="alert">
      <span>이 기기에는 기록을 저장할 수 없어요. ‘기록 지키기’에서 코드를 적어 두세요.</span>
      <button type="button" className="sc-btn" onClick={onClose}>
        알겠어요
      </button>
    </div>
  )
}

export default function App() {
  const [s, dispatch] = useApp()
  const previous = usePreviousScreen(s.screen)
  const p = s.plant
  const notice = s.notice === 'saveFailed' ? <SaveNotice onClose={() => dispatch({ type: 'clearNotice' })} /> : null

  if (s.screen === 'grow' && p) {
    return (
      <main>
        <GrowScreen state={s} dispatch={dispatch} />
        {notice}
      </main>
    )
  }

  if (s.screen === 'transplant' && p && !p.dead) {
    return (
      <main>
        <TransplantScreen plant={p} dispatch={dispatch} />
        {notice}
      </main>
    )
  }

  // What the plant calls for; a grow/transplant/dead screen without a matching plant would be empty.
  const home = screenFor(p)
  const fallback: Screen = home === 'grow' || home === 'transplant' ? 'pick' : home
  const screen: Screen =
    s.screen === 'grow' || s.screen === 'transplant' || (s.screen === 'dead' && !p?.dead) ? fallback : s.screen

  let body: ReactNode
  switch (screen) {
    case 'dead':
      body = <DeathScreen state={s} dispatch={dispatch} />
      break
    case 'journal':
      body = <JournalScreen state={s} dispatch={dispatch} />
      break
    case 'record':
      // A kept finished journal; without one (e.g. after a restore) the dex is the place to be.
      body =
        s.record && s.finished?.[s.record] ? (
          <JournalScreen state={s} dispatch={dispatch} record={s.record} />
        ) : (
          <DexScreen state={s} dispatch={dispatch} />
        )
      break
    case 'dex':
      body = <DexScreen state={s} dispatch={dispatch} />
      break
    case 'backup': {
      // Back goes to where the panel was opened from, when that screen still makes sense.
      const usable = previous === 'pick' || previous === 'journal' || previous === 'dex' || previous === home
      body = <BackupPanel state={s} dispatch={dispatch} back={previous && usable ? previous : home} />
      break
    }
    default:
      body = <PickScreen state={s} dispatch={dispatch} />
  }
  return (
    <main>
      {body}
      {notice}
    </main>
  )
}
