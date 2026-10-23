# MOTIF — a soundscape atelier

A premium, immersive instrument for composing atmospheres: focus, calm, reading,
creative work, and drift. Less a dashboard, more an instrument you enter.

Every sound is **synthesized live in your browser** with the Web Audio API — no
recordings, no network requests, nothing collected. The visual field is original
generative canvas art that breathes with the actual audio signal and the mix you
shape.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command           | What it does                          |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Vite dev server                       |
| `npm run build`   | Type-check + production build to dist |
| `npm run preview` | Serve the production build            |
| `npm run typecheck` | `tsc --noEmit`                      |
| `npm run lint`    | ESLint (typescript-eslint + react-hooks) |
| `npm test`        | Vitest unit suite (29 tests)          |

## The instrument

- **Sound field** — a generative canvas at the center. Rain streaks, tidal bands,
  light shafts, dusk stars, or neon orbs, depending on the scene; a core glow that
  swells with the Low Drone layer and the actual master-bus level (read through an
  `AnalyserNode`). Paused, muted, or with reduced motion preferred, it settles
  gracefully instead of freezing.
- **Five scenes** — Rain on Glass, Lunar Tide, Moss Cathedral, Blue Hour, Neon
  Drift. Each is a different synthesis recipe, palette, and field renderer.
- **Five layers** — Air, Water, Low Drone, Texture, Pulse. Toggle and level for
  each; every control changes the real gain of a real synthesis voice.
- **Transport** — play/pause, stop/reset, mute, master volume, elapsed clock.
  Audio starts only on an explicit gesture; every transition is ramped to avoid
  clicks; a gentle compressor keeps levels conservative.
- **Session timer** — 15/30/45/60 minutes with a slow fade-out and a quiet
  two-note bell on completion.
- **Shelf** — save named mixes (scene + layer mix + master volume) to
  `localStorage`; load and delete them. If storage is blocked, the app says so
  and keeps saves for the session.
- **Now-playing bar** — appears whenever the field scrolls out of view, so
  transport is always reachable while exploring.

## How the sound is made

`src/audio/` contains a small procedural engine:

- **Air** — pink noise through a slowly-swept bandpass.
- **Water** — three modes: rain (steady hiss bed + Poisson-scheduled glassy
  droplets with random pan and downward pitch bend), tide (LFO-swollen filtered
  noise with foam hiss), drip (sparse drops into a damped feedback delay).
- **Low Drone** — detuned sine partials, sub-octave, fifth, slow amplitude
  breathing and cent-level detune drift so the chord never sits still.
- **Texture** — vinyl crackle (filtered noise ticks), shimmer (pentatonic sine
  partials with slow attack), or choir (detuned saws through formant band-passes
  with vibrato and breath).
- **Pulse** — a rhythmic sine pluck pattern per scene (heartbeat lub-dub for Blue
  Hour, an arpeggio for Neon Drift).

Voices are built per scene on a layer-bus → master → compressor → destination
graph, cross-faded on scene change, and disposed cleanly (timers cleared,
sources stopped, nodes disconnected). Event schedulers use a look-ahead loop that
widens automatically when the tab is hidden.

## Architecture

```
src/
  audio/      engine.ts (graph + transport), voices.ts (synth recipes), noise.ts
  field/      renderer.ts (canvas field, 5 mode renderers)
  scenes.ts   the five curated presets (audio params + palettes + default mix)
  lib/        gain curves, formatting, storage adapter with graceful fallback
  components/ SoundField, Mixer, Transport, SessionTimer, SceneLibrary,
              SavedMixes, NowPlaying, Toasts, icons
  styles/     tokens, fonts (self-hosted woff2), base, components
tests/        unit tests: gains, scenes, persistence, format, field renderer
```

React state lives in `App.tsx` and drives the engine imperatively (no audio
graphs in render); the canvas reads a lightweight `FieldInput` and the engine's
live level meter, so sound and visuals stay in agreement without re-render
storms.

## Notes

- Fonts (Fraunces, Instrument Sans, Spline Sans Mono) are self-hosted; the app
  has zero network dependencies at runtime.
- `prefers-reduced-motion` calms the field and CSS transitions; motion is never
  the only state indicator.
- Keyboard: Space toggles playback; every control is labelled and reachable.
