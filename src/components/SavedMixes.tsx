import { useRef } from 'react'
import type { SavedMix } from '../types'
import { getScene } from '../scenes'
import { describeMix } from '../lib/gain'
import { formatRelative } from '../lib/format'
import { SaveIcon, TrashIcon } from './icons'

interface SavedMixesProps {
  saved: SavedMix[]
  suggestedName: string
  storageOk: boolean
  onSave: (name: string) => void
  onLoad: (mix: SavedMix) => void
  onDelete: (mix: SavedMix) => void
}

export function SavedMixes({ saved, suggestedName, storageOk, onSave, onLoad, onDelete }: SavedMixesProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const submit = () => {
    const value = inputRef.current?.value.trim() ?? ''
    if (!value) {
      inputRef.current?.focus()
      return
    }
    onSave(value)
    inputRef.current?.blur()
  }

  const resetName = () => {
    if (inputRef.current) inputRef.current.value = suggestedName
    inputRef.current?.blur()
  }

  return (
    <section className="saved" aria-label="Saved mixes">
      <header className="section-head">
        <h3 className="overline">Shelf</h3>
        <p className="section-sub">Keep the mixes you love, come back to them anytime</p>
      </header>

      <div className="save-row">
        <input
          ref={inputRef}
          /* keyed by suggestion so a scene change or a fresh save offers a fresh name */
          key={suggestedName}
          type="text"
          className="save-input text-input"
          defaultValue={suggestedName}
          maxLength={48}
          spellCheck={false}
          aria-label="Name for this mix"
          placeholder="Name this mix"
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') resetName()
          }}
        />
        <button type="button" className="btn-primary save-btn" onClick={submit}>
          <SaveIcon />
          <span>Save mix</span>
        </button>
      </div>

      {!storageOk && (
        <p className="storage-note">
          Storage is unavailable in this browser. Saved mixes last for this session only.
        </p>
      )}

      {saved.length === 0 ? (
        <p className="saved-empty">
          Nothing on the shelf yet. Shape a scene until it feels like yours, then save it here.
        </p>
      ) : (
        <ul className="saved-list">
          {saved.map((mix) => {
            const scene = getScene(mix.sceneId)
            return (
              <li key={mix.id} className="saved-item">
                <span className="saved-dot" aria-hidden="true" style={{ background: scene.palette.accent }} />
                <span className="saved-meta">
                  <span className="saved-name">{mix.name}</span>
                  <span className="saved-sub">
                    {scene.name} · {describeMix(mix.mix)} · {formatRelative(mix.createdAt)}
                  </span>
                </span>
                <span className="saved-actions">
                  <button type="button" className="btn-ghost" onClick={() => onLoad(mix)}>
                    Load
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => onDelete(mix)}
                    aria-label={`Delete ${mix.name}`}
                    title={`Delete ${mix.name}`}
                  >
                    <TrashIcon />
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
