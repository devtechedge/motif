import { useEffect, useRef, useState } from 'react'
import type { SavedMix } from '../types'
import { getScene } from '../scenes'
import { describeMix } from '../lib/gain'
import { formatRelative } from '../lib/format'
import { CopyIcon, DownloadIcon, LinkIcon, PencilIcon, SaveIcon, TrashIcon, UploadIcon } from './icons'

export const MAX_SAVED = 24

interface SavedMixesProps {
  saved: SavedMix[]
  suggestedName: string
  storageOk: boolean
  onSave: (name: string) => void
  onLoad: (mix: SavedMix) => void
  onDelete: (mix: SavedMix) => void
  onRename: (id: string, name: string) => void
  onDuplicate: (entry: SavedMix) => void
  onImport: (entries: SavedMix[]) => void
  onCopyLink: () => void
}

export function SavedMixes({
  saved,
  suggestedName,
  storageOk,
  onSave,
  onLoad,
  onDelete,
  onRename,
  onDuplicate,
  onImport,
  onCopyLink,
}: SavedMixesProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const importRef = useRef<HTMLInputElement | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  // where focus should land after the next shelf mutation removes the focused row
  const pendingFocusRef = useRef<{ rowId: string | null } | null>(null)

  useEffect(() => {
    const pending = pendingFocusRef.current
    if (!pending) return
    pendingFocusRef.current = null
    if (pending.rowId) {
      const row = document.getElementById(`saved-row-${pending.rowId}`)
      row?.querySelector<HTMLButtonElement>('button')?.focus()
    } else {
      headingRef.current?.focus()
    }
  }, [saved])

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

  const handleDelete = (entry: SavedMix) => {
    const index = saved.findIndex((s) => s.id === entry.id)
    const neighbor = saved[index + 1] ?? saved[index - 1]
    pendingFocusRef.current = { rowId: neighbor ? neighbor.id : null }
    onDelete(entry)
  }

  const exportShelf = () => {
    const payload = JSON.stringify({ motif: 'shelf', version: 1, saved }, null, 2)
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'motif-shelf.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const importShelf = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text())
      const rawList = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.saved) ? parsed.saved : []
      // sanitizeSavedMixes runs inside the handler; hand it the raw list
      onImport(rawList as SavedMix[])
    } catch {
      onImport([])
    }
  }

  const atCap = saved.length >= MAX_SAVED

  return (
    <section className="saved" aria-label="Saved mixes">
      <header className="section-head">
        <h3 className="overline" ref={headingRef} tabIndex={-1}>
          Shelf
        </h3>
        <p className="section-sub">
          Keep the mixes you love, come back to them anytime
          {saved.length > 0 ? ` (${saved.length}/${MAX_SAVED})` : ''}
        </p>
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
        <button type="button" className="btn-primary save-btn" onClick={submit} disabled={atCap} title={atCap ? `Shelf is full (${MAX_SAVED}). Remove a mix to save another.` : undefined}>
          <SaveIcon />
          <span>Save mix</span>
        </button>
        <button type="button" className="icon-btn" onClick={onCopyLink} aria-label="Copy a link to this mix" title="Copy a link to this mix">
          <LinkIcon />
        </button>
        <button type="button" className="icon-btn" onClick={exportShelf} disabled={saved.length === 0} aria-label="Export the shelf as JSON" title="Export the shelf as JSON">
          <DownloadIcon />
        </button>
        <button type="button" className="icon-btn" onClick={() => importRef.current?.click()} aria-label="Import mixes from a JSON file" title="Import mixes from a JSON file">
          <UploadIcon />
        </button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Import mixes from a JSON file"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void importShelf(file)
            e.target.value = ''
          }}
        />
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
            const editing = editingId === mix.id
            return (
              <li key={mix.id} className="saved-item" id={`saved-row-${mix.id}`}>
                <span className="saved-dot" aria-hidden="true" style={{ background: scene.palette.accent }} />
                <span className="saved-meta">
                  {editing ? (
                    <RenameInput
                      initialName={mix.name}
                      onCommit={(value) => {
                        if (value) onRename(mix.id, value)
                        setEditingId(null)
                      }}
                      onCancel={() => setEditingId(null)}
                      label={`Rename ${mix.name}`}
                    />
                  ) : (
                    <span className="saved-name">{mix.name}</span>
                  )}
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
                    onClick={() => setEditingId(mix.id)}
                    aria-label={`Rename ${mix.name}`}
                    title={`Rename ${mix.name}`}
                  >
                    <PencilIcon />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => onDuplicate(mix)}
                    aria-label={`Duplicate ${mix.name}`}
                    title={`Duplicate ${mix.name}`}
                  >
                    <CopyIcon />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => handleDelete(mix)}
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

interface RenameInputProps {
  initialName: string
  label: string
  onCommit: (value: string) => void
  onCancel: () => void
}

function RenameInput({ initialName, label, onCommit, onCancel }: RenameInputProps) {
  const ref = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  return (
    <input
      ref={ref}
      type="text"
      className="rename-input text-input"
      defaultValue={initialName}
      maxLength={48}
      spellCheck={false}
      aria-label={label}
      onBlur={() => onCommit(ref.current?.value.trim() ?? '')}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(ref.current?.value.trim() ?? '')
        if (e.key === 'Escape') onCancel()
      }}
    />
  )
}
