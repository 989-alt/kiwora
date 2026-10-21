/** Short WebAudio effects. Every call takes `on` (settings.sound); off = silent. Never throws. */

type Ctor = typeof AudioContext
let ctx: AudioContext | null = null

function audio(on: boolean): AudioContext | null {
  if (!on || typeof window === 'undefined') return null
  try {
    const C: Ctor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext
    if (!C) return null
    ctx ??= new C()
    if (ctx.state !== 'running') ctx.resume().catch(() => {})
    return ctx
  } catch {
    return null
  }
}

/**
 * iPad Safari only starts audio from a user gesture: create/resume the context on the first
 * pointerup or click anywhere (while sound is on). Returns a cleanup function.
 */
export function installAudioUnlock(isOn: () => boolean): () => void {
  if (typeof document === 'undefined') return () => {}
  const unlock = () => {
    const a = audio(isOn())
    if (a && a.state === 'running') remove()
  }
  const remove = () => {
    document.removeEventListener('pointerup', unlock, true)
    document.removeEventListener('click', unlock, true)
  }
  document.addEventListener('pointerup', unlock, true)
  document.addEventListener('click', unlock, true)
  return remove
}

function noiseBuffer(a: AudioContext, seconds: number): AudioBuffer {
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * seconds), a.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buf
}

/** Starts a soft running-water hiss; returns the stop function. */
export function startWater(on: boolean): () => void {
  const a = audio(on)
  if (!a) return () => {}
  try {
    const src = a.createBufferSource()
    src.buffer = noiseBuffer(a, 1)
    src.loop = true
    const band = a.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 1400
    band.Q.value = 0.8
    const gain = a.createGain()
    gain.gain.setValueAtTime(0, a.currentTime)
    gain.gain.linearRampToValueAtTime(0.12, a.currentTime + 0.08)
    src.connect(band).connect(gain).connect(a.destination)
    src.start()
    return () => {
      try {
        const t = a.currentTime
        gain.gain.cancelScheduledValues(t)
        gain.gain.setValueAtTime(gain.gain.value, t)
        gain.gain.linearRampToValueAtTime(0, t + 0.1)
        src.stop(t + 0.12)
      } catch {
        // already stopped
      }
    }
  } catch {
    return () => {}
  }
}

function blip(on: boolean, from: number, to: number, dur: number, vol: number) {
  const a = audio(on)
  if (!a) return
  try {
    const osc = a.createOscillator()
    const gain = a.createGain()
    const t = a.currentTime
    osc.type = 'sine'
    osc.frequency.setValueAtTime(from, t)
    osc.frequency.exponentialRampToValueAtTime(to, t + dur)
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.connect(gain).connect(a.destination)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  } catch {
    // ignore
  }
}

/** "톡" when a bug is caught. */
export const pop = (on: boolean) => blip(on, 900, 220, 0.09, 0.3)

/** Small drop when a pellet goes into the pot. */
export const plink = (on: boolean) => blip(on, 520, 1040, 0.08, 0.18)
