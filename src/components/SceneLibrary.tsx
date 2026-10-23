import type { CSSProperties } from 'react'
import type { FieldMode, Scene } from '../types'

function SceneGlyph({ mode }: { mode: FieldMode }) {
  switch (mode) {
    case 'rain':
      return (
        <svg viewBox="0 0 64 40" aria-hidden="true">
          {[10, 22, 34, 46, 56].map((x, i) => (
            <line key={x} x1={x} y1={8 + (i % 2) * 4} x2={x - 4} y2={20 + (i % 3) * 5} stroke="var(--p-glow)" strokeWidth="1.4" strokeLinecap="round" opacity={0.9 - i * 0.12} />
          ))}
          <ellipse cx="34" cy="31" rx="14" ry="3.4" fill="none" stroke="var(--p-particle)" strokeWidth="1" opacity="0.55" />
          <ellipse cx="24" cy="33" rx="9" ry="2.2" fill="none" stroke="var(--p-particle)" strokeWidth="1" opacity="0.35" />
        </svg>
      )
    case 'tide':
      return (
        <svg viewBox="0 0 64 40" aria-hidden="true">
          <circle cx="44" cy="12" r="5" fill="var(--p-particle)" opacity="0.9" />
          <circle cx="44" cy="12" r="9" fill="none" stroke="var(--p-glow)" strokeWidth="1" opacity="0.4" />
          {[22, 27, 32].map((y, i) => (
            <path
              key={y}
              d={`M6 ${y} Q 16 ${y - 3.5}, 26 ${y} T 46 ${y} T 66 ${y}`}
              fill="none"
              stroke="var(--p-glow)"
              strokeWidth={1.4 - i * 0.3}
              opacity={0.8 - i * 0.22}
            />
          ))}
        </svg>
      )
    case 'moss':
      return (
        <svg viewBox="0 0 64 40" aria-hidden="true">
          {[16, 30, 44].map((x, i) => (
            <path key={x} d={`M${x} 2 L${x - 1.5} 34 L${x + 5} 34 L${x + 2.5} 2 Z`} fill="var(--p-glow)" opacity={0.28 - i * 0.06} />
          ))}
          <circle cx="22" cy="24" r="1.3" fill="var(--p-particle)" />
          <circle cx="38" cy="18" r="1" fill="var(--p-particle)" />
          <circle cx="50" cy="27" r="1.5" fill="var(--p-particle)" />
          <circle cx="12" cy="14" r="0.9" fill="var(--p-particle)" />
        </svg>
      )
    case 'dusk':
      return (
        <svg viewBox="0 0 64 40" aria-hidden="true">
          <rect x="4" y="6" width="56" height="7" fill="var(--p-fieldB)" opacity="0.8" />
          <rect x="4" y="13" width="56" height="7" fill="var(--p-glow)" opacity="0.22" />
          <rect x="4" y="20" width="56" height="7" fill="var(--p-glow)" opacity="0.38" />
          <path d="M20 22 a8 8 0 0 1 8 -8" fill="none" stroke="var(--p-particle)" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="46" cy="10" r="1" fill="var(--p-particle)" />
          <circle cx="52" cy="16" r="0.8" fill="var(--p-particle)" />
          <circle cx="40" cy="6" r="0.8" fill="var(--p-particle)" />
        </svg>
      )
    case 'drift':
      return (
        <svg viewBox="0 0 64 40" aria-hidden="true">
          <line x1="4" y1="26" x2="60" y2="26" stroke="var(--p-glow)" strokeWidth="1" opacity="0.6" />
          {[16, 30].map((x, i) => (
            <line key={x} x1="32" y1="26" x2={x} y2="40" stroke="var(--p-glow)" strokeWidth="1" opacity={0.3 - i * 0.1} />
          ))}
          <line x1="32" y1="26" x2="50" y2="40" stroke="var(--p-glow)" strokeWidth="1" opacity="0.2" />
          <circle cx="20" cy="14" r="6" fill="var(--p-glow)" opacity="0.5" />
          <circle cx="36" cy="9" r="3" fill="var(--p-particle)" opacity="0.8" />
          <circle cx="47" cy="18" r="2" fill="var(--p-particle)" opacity="0.5" />
        </svg>
      )
  }
}

interface SceneLibraryProps {
  scenes: readonly Scene[]
  activeId: string
  onSelect: (id: string) => void
}

export function SceneLibrary({ scenes, activeId, onSelect }: SceneLibraryProps) {
  return (
    <section className="scenes" aria-label="Scene library">
      <header className="section-head">
        <h3 className="overline">Scenes</h3>
        <p className="section-sub">Five atmospheres, each with its own voice and light</p>
      </header>
      <ul className="plates">
        {scenes.map((scene) => {
          const active = scene.id === activeId
          return (
            <li key={scene.id} className="plate-wrap">
              <button
                type="button"
                className="plate"
                data-active={active}
                aria-current={active ? 'true' : undefined}
                onClick={() => onSelect(scene.id)}
                style={
                  {
                    '--p-accent': scene.palette.accent,
                    '--p-glow': scene.palette.glow,
                    '--p-particle': scene.palette.particle,
                    '--p-fieldA': scene.palette.fieldA,
                    '--p-fieldB': scene.palette.fieldB,
                  } as CSSProperties
                }
              >
                <span className="plate-art" aria-hidden="true">
                  <SceneGlyph mode={scene.fieldMode} />
                </span>
                <span className="plate-text">
                  <span className="plate-name">{scene.name}</span>
                  <span className="plate-tag">{scene.tagline}</span>
                </span>
                <span className="plate-layers" aria-hidden="true">
                  {(['air', 'water', 'drone', 'texture', 'pulse'] as const).map((id) => (
                    <span key={id} className="plate-dot" data-on={scene.defaultMix[id].enabled} />
                  ))}
                </span>
                <span className="sr-only">
                  {active ? 'Currently selected. ' : ''}
                  {Object.entries(scene.defaultMix)
                    .filter(([, s]) => s.enabled)
                    .map(([id]) => id)
                    .join(', ')}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
