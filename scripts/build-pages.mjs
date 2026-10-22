// GitHub Pages build: https://989-alt.github.io/kiwora/ serves the app under /kiwora/.
// Builds with that base, then adds 404.html (a copy of index.html) and .nojekyll.
import { execSync } from 'node:child_process'
import { copyFileSync, writeFileSync } from 'node:fs'

const env = { ...process.env, VITE_BASE: process.env.VITE_BASE ?? '/kiwora/' }
execSync('npx tsc --noEmit', { stdio: 'inherit', env })
execSync('npx vite build', { stdio: 'inherit', env })
copyFileSync('dist/index.html', 'dist/404.html')
writeFileSync('dist/.nojekyll', '')
console.log(`build:pages done (base ${env.VITE_BASE}) -> dist/`)
