import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AudioEngine } from './audio/engine'
import { Mixer } from './components/Mixer'
import { NowPlaying } from './components/NowPlaying'
import { SavedMixes } from './components/SavedMixes'
import { SceneLibrary } from './components/SceneLibrary'
import { SessionTimer } from './components/SessionTimer'
import { SoundField } from './components/SoundField'
import { Toasts, type Toast } from './components/Toasts'
import { Transport } from './components/Transport'
import { suggestMixName } from './lib/gain'
import {
  PLAYED_KEY,
  SAVED_MIXES_KEY,
  SESSION_KEY,
  detectStorage,
  type StorageAdapter,
} from './lib/persistence'
import { SCENES, getScene } from './scenes'
import { cloneMix, type LayerId, type LayerMix, type PlayState, type SavedMix, type TimerKind } from './types'

const FADE_SECONDS = 3.2
const TICK_MS = 250

interface SessionSnapshot {
  sceneId: string
  mix: LayerMix
  volume: number
}

function vibrate(ms: number): void {
  try {
    navigator.vibrate?.(ms)
  } catch {
    // not supported — purely optional
  }
}

export function App() {
  const storage = useMemo<StorageAdapter>(() => detectStorage(), [])

  const restored = useMemo(() => storage.get<SessionSnapshot>(SESSION_KEY), [storage])
  const [sceneId, setSceneId] = useState(() => restored?.sceneId ?? SCENES[0].id)
  const scene = getScene(sceneId)
  const [mix, setMix] = useState<LayerMix>(() => restored?.mix ?? cloneMix(getScene(restored?.sceneId ?? SCENES[0].id).defaultMix))
  const [volume, setVolume] = useState(() => restored?.volume ?? 0.75)
  const [muted, setMuted] = useState(false)
  const [playing, setPlaying] = useState<PlayState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [hasEverPlayed, setHasEverPlayed] = useState(() => storage.get<boolean>(PLAYED_KEY) === true)

  const [saved, setSaved] = useState<SavedMix[]>(() => storage.get<SavedMix[]>(SAVED_MIXES_KEY) ?? [])
  const [timerMinutes, setTimerMinutes] = useState<number | null>(null)
  const [timerKind, setTimerKind] = useState<TimerKind>('off')
  const [remaining, setRemaining] = useState(0)
  const [fieldVisible, setFieldVisible] = useState(true)
  const [toasts, setToasts] = useState<Toast[]>([])

  // ---- engine (lazy; the AudioContext itself is only created on play) ----
  const engineRef = useRef<AudioEngine | null>(null)
  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      const engine = new AudioEngine()
      engine.onExternalSuspend = () => setPlaying('paused')
      engineRef.current = engine
    }
    return engineRef.current
  }, [])

  useEffect(() => () => engineRef.current?.dispose(), [])

  // mirrors for event handlers — no stale closures, no side effects in updaters
  const mixRef = useRef(mix)
  const sceneIdRef = useRef(sceneId)
  useEffect(() => {
    mixRef.current = mix
  }, [mix])
  useEffect(() => {
    sceneIdRef.current = sceneId
  }, [sceneId])

  // keep engine in sync with scene selection (mix tweaks go through setLayer)
  useEffect(() => {
    getEngine().setScene(getScene(sceneId), mixRef.current)
  }, [sceneId, getEngine])

  useEffect(() => {
    getEngine().setVolume(volume)
  }, [volume, getEngine])

  useEffect(() => {
    getEngine().setMuted(muted)
  }, [muted, getEngine])

  // ------------------------------------------------------------- persistence
  useEffect(() => {
    storage.set(SESSION_KEY, { sceneId, mix, volume } satisfies SessionSnapshot)
  }, [storage, sceneId, mix, volume])

  useEffect(() => {
    storage.set(SAVED_MIXES_KEY, saved)
  }, [storage, saved])

  // ------------------------------------------------------------------ toasts
  const toastId = useRef(0)
  const pushToast = useCallback((kind: Toast['kind'], text: string) => {
    const id = ++toastId.current
    setToasts((prev) => [...prev.slice(-2), { id, kind, text }])
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200)
  }, [])

  // --------------------------------------------------------------- transport
  const hasEverPlayedRef = useRef(hasEverPlayed)
  useEffect(() => {
    hasEverPlayedRef.current = hasEverPlayed
  }, [hasEverPlayed])

  const togglePlay = useCallback(() => {
    const engine = getEngine()
    if (!engine.supported) {
      setAudioError('Web Audio is unavailable in this browser, so MOTIF stays silent — but the instrument still works.')
      pushToast('warn', 'Audio is unavailable here. The field still breathes, just quietly.')
      return
    }
    if (engine.playing) {
      engine.pause()
      setPlaying('paused')
      vibrate(5)
      return
    }
    engine
      .play()
      .then(() => {
        setPlaying('playing')
        setAudioError(null)
        vibrate(8)
        if (!hasEverPlayedRef.current) {
          hasEverPlayedRef.current = true
          setHasEverPlayed(true)
          storage.set(PLAYED_KEY, true)
        }
        if (timerKind === 'done') setTimerKind('off')
      })
      .catch(() => {
        setPlaying('paused')
        setAudioError('Audio could not start on this device. Check sound output, then press play again.')
        pushToast('warn', 'Audio could not start — press play again in a moment.')
      })
  }, [getEngine, pushToast, storage, timerKind])

  const stop = useCallback(() => {
    const engine = getEngine()
    engine.stop()
    if (engine.playing === false) {
      setPlaying('idle')
      setElapsed(0)
    }
    setTimerMinutes(null)
    setTimerKind('off')
    setRemaining(0)
    vibrate(4)
  }, [getEngine])

  // ------------------------------------------------------------- timer logic
  const timerTotalRef = useRef(0)
  const timerStartElapsedRef = useRef(0)
  const chimeTimerRef = useRef<number | null>(null)

  const selectTimer = useCallback(
    (minutes: number | null) => {
      if (chimeTimerRef.current !== null) {
        window.clearTimeout(chimeTimerRef.current)
        chimeTimerRef.current = null
      }
      setTimerMinutes(minutes)
      if (minutes === null) {
        setTimerKind('off')
        setRemaining(0)
        return
      }
      timerTotalRef.current = minutes * 60
      timerStartElapsedRef.current = getEngine().getElapsed()
      setRemaining(minutes * 60)
      setTimerKind('running')
    },
    [getEngine],
  )

  useEffect(() => {
    if (timerKind !== 'running' && timerKind !== 'fading') return
    const id = window.setInterval(() => {
      const engine = getEngine()
      const e = engine.getElapsed()
      setElapsed(e)
      const used = e - timerStartElapsedRef.current
      const rem = Math.max(0, timerTotalRef.current - used)
      setRemaining(rem)
      if (timerKind === 'running' && rem <= FADE_SECONDS) {
        setTimerKind('fading')
        engine.beginFade(FADE_SECONDS)
      }
      if (rem <= 0) {
        // session complete
        setPlaying('idle')
        setTimerKind('done')
        setElapsed(timerTotalRef.current)
        engine.chime()
        pushToast('success', 'Session complete — the sound faded out gently.')
        chimeTimerRef.current = window.setTimeout(() => {
          chimeTimerRef.current = null
          if (!engine.playing) engine.stop()
        }, 2900)
      }
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [timerKind, getEngine, pushToast])

  // plain elapsed ticker when playing without a timer
  useEffect(() => {
    if (timerKind === 'running' || timerKind === 'fading' || playing !== 'playing') return
    const id = window.setInterval(() => setElapsed(getEngine().getElapsed()), TICK_MS)
    return () => window.clearInterval(id)
  }, [playing, timerKind, getEngine])

  // -------------------------------------------------------------- interactions
  const selectScene = useCallback(
    (id: string) => {
      if (id === sceneIdRef.current) return
      const next = getScene(id)
      const nextMix = cloneMix(next.defaultMix)
      sceneIdRef.current = id
      mixRef.current = nextMix
      setSceneId(id)
      setMix(nextMix)
      getEngine().setScene(next, nextMix)
    },
    [getEngine],
  )

  const toggleLayer = useCallback(
    (id: LayerId) => {
      const prev = mixRef.current[id]
      const nextMix = { ...mixRef.current, [id]: { ...prev, enabled: !prev.enabled } }
      mixRef.current = nextMix
      setMix(nextMix)
      getEngine().setLayer(id, nextMix[id])
    },
    [getEngine],
  )

  const setLayerGain = useCallback(
    (id: LayerId, gain: number) => {
      const prev = mixRef.current[id]
      const nextMix = { ...mixRef.current, [id]: { ...prev, gain } }
      mixRef.current = nextMix
      setMix(nextMix)
      getEngine().setLayer(id, nextMix[id])
    },
    [getEngine],
  )

  const changeVolume = useCallback((v: number) => setVolume(v), [])

  const saveCurrent = useCallback(
    (name: string) => {
      const entry: SavedMix = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        sceneId: sceneIdRef.current,
        mix: cloneMix(mixRef.current),
        volume,
        createdAt: Date.now(),
      }
      setSaved((prev) => [entry, ...prev])
      if (!storage.set(SAVED_MIXES_KEY, [entry, ...saved])) {
        // adapter rejected the write; keep in-memory list, inform honestly
        pushToast('warn', 'Could not write to storage — kept for this session only.')
      } else {
        pushToast('success', `Saved “${name}” to the shelf.`)
      }
    },
    [volume, saved, storage, pushToast],
  )

  const loadSaved = useCallback(
    (entry: SavedMix) => {
      const next = getScene(entry.sceneId)
      sceneIdRef.current = next.id
      mixRef.current = cloneMix(entry.mix)
      setSceneId(next.id)
      setMix(cloneMix(entry.mix))
      setVolume(entry.volume)
      getEngine().setScene(next, entry.mix)
      getEngine().setVolume(entry.volume)
      pushToast('info', `Loaded “${entry.name}”.`)
    },
    [getEngine, pushToast],
  )

  const deleteSaved = useCallback(
    (entry: SavedMix) => {
      setSaved((prev) => prev.filter((s) => s.id !== entry.id))
      pushToast('info', `Removed “${entry.name}”.`)
    },
    [pushToast],
  )

  // space bar toggles playback when not in a control
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      const el = e.target as HTMLElement | null
      if (el && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(el.tagName)) return
      e.preventDefault()
      togglePlay()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay])

  // now-playing bar appears once the field scrolls away
  const fieldElRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = fieldElRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setFieldVisible(entry.isIntersecting), { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const suggestedName = useMemo(() => suggestMixName(scene.name, saved.length), [scene.name, saved.length])
  const getLevel = useCallback(() => engineRef.current?.getLevel() ?? 0, [])

  return (
    <div
      className="app"
      data-scene={scene.id}
      style={{ '--accent': scene.palette.accent } as CSSProperties}
    >
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">
            <span className="brand-mark">MOTIF</span>
            <span className="brand-sub">soundscape atelier</span>
          </span>
          <span className="topbar-status" aria-label="Playback status">
            {playing === 'playing' && !muted && <span className="status-live">● live</span>}
            {muted && playing === 'playing' && <span className="status-muted">muted</span>}
          </span>
        </div>
      </header>

      <main className="stage">
        <div className="studio-grid">
          <SoundField
            scene={scene}
            playing={playing === 'playing'}
            muted={muted}
            mix={mix}
            timerKind={timerKind}
            remaining={remaining}
            hasEverPlayed={hasEverPlayed}
            audioError={audioError}
            onTogglePlay={togglePlay}
            getLevel={getLevel}
            fieldRef={(el) => (fieldElRef.current = el)}
          />
          <div className="rail">
            <Transport
              playing={playing}
              muted={muted}
              volume={volume}
              elapsed={elapsed}
              onToggle={togglePlay}
              onStop={stop}
              onMute={() => setMuted((m) => !m)}
              onVolume={changeVolume}
            />
            <Mixer mix={mix} onToggle={toggleLayer} onGain={setLayerGain} />
            <SessionTimer kind={timerKind} minutes={timerMinutes} remaining={remaining} onSelect={selectTimer} />
          </div>
        </div>

        <SceneLibrary scenes={SCENES} activeId={sceneId} onSelect={selectScene} />
        <SavedMixes
          saved={saved}
          suggestedName={suggestedName}
          storageOk={storage.ok}
          onSave={saveCurrent}
          onLoad={loadSaved}
          onDelete={deleteSaved}
        />
      </main>

      <footer className="foot">
        <p>
          Every sound is synthesized live in your browser — no recordings, no network, nothing collected.
        </p>
      </footer>

      <NowPlaying
        scene={scene}
        playing={playing === 'playing'}
        muted={muted}
        elapsed={elapsed}
        visible={playing === 'playing' && !fieldVisible}
        onToggle={togglePlay}
        onMute={() => setMuted((m) => !m)}
      />
      <Toasts toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  )
}
