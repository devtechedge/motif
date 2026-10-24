# Scene Builder - Design Brief (not yet implemented)

Status: proposal. No code ships from this document until Dev approves the UX.

## Problem

MOTIF's promise is an atelier, but today a visitor can only mix prebuilt
recipes. The five layer voices are parameterized per scene (`src/types.ts`
models `AirParams`, `WaterParams`, `DroneParams`, `TextureParams`, and
`PulseParams`), yet those parameters are hardcoded in `src/scenes.ts` and never
exposed. The gap between "mix what you were given" and "compose your own
atmosphere" is the product's largest untapped surface.

## Proposal

A per-layer tuning drawer, reachable from each mixer row:

- Each layer row grows a "tune" affordance that opens a compact panel of that
  layer's scene-specific parameters (for Water: mode, bed level, rate, droplet
  range and decay; for Pulse: bpm, pattern, decay, filter).
- Every parameter gets a bounded range derived from the invariants the scene
  tests already enforce (`tests/scenes.test.ts` is the source of truth for
  musical ranges: air tone 80-1600 Hz, drone root 40-90 Hz, pulse bpm 30-120,
  voice levels 0-0.7).
- Changes apply live to the running voice (the engine already owns per-scene
  params; a `retune(layerId, params)` entry point would crossfade like a scene
  change but keep the voice graph).
- A tuned scene becomes a first-class saved object: the shelf currently stores
  scene + layer mix; it would store scene + mix + overrides, and share links
  would carry the same payload (the `#m1.` hash format gets a `v2` with an
  optional `tuning` field; `sanitize.ts` learns per-parameter clamps).

## Non-goals for v1

- No free-form oscillator editing, no MIDI, no waveforms drawn by hand.
- No new layer types; tuning only covers parameters the synthesis voices
  already implement.
- No cloud sync; everything stays in the URL hash and localStorage.

## Open questions for Dev

1. Should tuned scenes be variants of a curated scene (palette and field mode
   inherited) or fully standalone? Variants keep the visual identity coherent;
   standalone scenes need a palette picker too.
2. Presets per parameter (a "tide fast / tide slow" style shorthand) or raw
   sliders only?
3. Do tuned scenes appear in the scene library row, or only on the shelf?

## Why gate this

The engine and persistence layers were deliberately built scene-shaped; bolting
on editing without a UX pass would produce a synthesizer panel instead of an
atelier. This brief is the smallest document that lets an implementer build the
right thing.
