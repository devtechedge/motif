import type { CSSProperties } from 'react'
import { LAYERS, type LayerId, type LayerMix } from '../types'
import { LAYER_ICONS } from './icons'

interface MixerProps {
  mix: LayerMix
  onToggle: (id: LayerId) => void
  onGain: (id: LayerId, gain: number) => void
}

export function Mixer({ mix, onToggle, onGain }: MixerProps) {
  const allOff = LAYERS.every((l) => !mix[l.id].enabled)
  return (
    <section className="panel mixer" aria-label="Layer mixer">
      <header className="panel-head">
        <h3>Layers</h3>
        <p className="panel-sub">Each layer is a living voice in the scene</p>
      </header>
      <ul className="mix-rows">
        {LAYERS.map((layer) => {
          const state = mix[layer.id]
          const Icon = LAYER_ICONS[layer.id]
          return (
            <li key={layer.id} className="mix-row" data-on={state.enabled}>
              <span className="mix-icon" aria-hidden="true">
                <Icon />
              </span>
              <span className="mix-name">{layer.name}</span>
              <button
                type="button"
                className="switch"
                role="switch"
                aria-checked={state.enabled}
                aria-label={`${layer.name} ${state.enabled ? 'on' : 'off'}`}
                title={layer.hint}
                onClick={() => onToggle(layer.id)}
              >
                <span className="switch-knob" aria-hidden="true" />
              </button>
              <label className="level">
                <span className="sr-only">{layer.name} level</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(state.gain * 100)}
                  onChange={(e) => onGain(layer.id, Number(e.target.value) / 100)}
                  aria-valuetext={`${Math.round(state.gain * 100)} percent`}
                  style={{ '--fill': `${Math.round(state.gain * 100)}%` } as CSSProperties}
                />
              </label>
              <span className="level-val" aria-hidden="true">
                {Math.round(state.gain * 100)}
              </span>
            </li>
          )
        })}
      </ul>
      {allOff && (
        <p className="mix-note" role="status">
          Every layer is off. The scene will be silent until you switch one on.
        </p>
      )}
    </section>
  )
}
