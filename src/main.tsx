import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted fonts (no Google Fonts request): the app works fully offline after the first load.
import '@fontsource/jua/400.css'
import '@fontsource/gowun-dodum/400.css'
import App from './App'
import { AppErrorBoundary } from './ui/screens/CrashScreen'
import { requestPersist } from './sim/save'
import './styles/tokens.css'

void requestPersist()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
