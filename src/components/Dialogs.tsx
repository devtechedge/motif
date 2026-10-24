import { Dialog } from './Dialog'

const SHORTCUTS: Array<[string, string]> = [
  ['Space', 'Play or pause'],
  ['M', 'Mute or unmute'],
  ['S', 'Stop and reset'],
  ['?', 'This dialog'],
  ['Tab', 'Move between controls'],
]

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} label="Keyboard shortcuts" title="Keyboard shortcuts" onClose={onClose}>
      <ul className="shortcut-list">
        {SHORTCUTS.map(([key, action]) => (
          <li key={key}>
            <kbd>{key}</kbd>
            <span>{action}</span>
          </li>
        ))}
      </ul>
      <p className="dialog-note">Shortcuts never fire while you are typing in a field.</p>
    </Dialog>
  )
}

export function HowItWorksDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} label="How MOTIF works" title="How MOTIF works" onClose={onClose}>
      <div className="dialog-prose">
        <p>
          Pick a scene, shape its five layers with the mixer, and press play. Every sound is synthesized
          live by your browser with the Web Audio API: no recordings, no network calls, no accounts.
        </p>
        <p>
          The canvas field listens to the actual audio and to your mix, so sound and light move together.
          Save the mixes you love on the shelf, copy a link to share one, and set a session timer for a
          gentle fade-out.
        </p>
        <p>
          Privacy: nothing is collected, uploaded, or tracked. Your mixes live in this browser only.
        </p>
      </div>
    </Dialog>
  )
}
