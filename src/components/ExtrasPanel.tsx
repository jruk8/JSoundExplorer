import { CheckIcon, ClipboardIcon } from './icons.tsx'

export interface ExtrasPanelProps {
  jmhText: string
  jmhCopied: boolean
  onCopy: () => void
}

export function ExtrasPanel({ jmhText, jmhCopied, onCopy }: ExtrasPanelProps) {
  return (
    <aside className="extras" aria-label="Extras" data-testid="extras">
      <h2 className="extras-title">Extras</h2>
      <label className="jmhscript-label" htmlFor="jmhscript-box">
        JMHScript Sound
      </label>
      <div className="jmhscript-row">
        <button
          type="button"
          data-testid="jmhscript-copy"
          className="jmhscript-copy"
          aria-label="Copy JMHScript"
          onClick={onCopy}
        >
          {jmhCopied ? <CheckIcon /> : <ClipboardIcon />}
        </button>
        <input
          id="jmhscript-box"
          data-testid="jmhscript-text"
          type="text"
          readOnly
          spellCheck={false}
          autoComplete="off"
          value={jmhText}
          className={jmhCopied ? 'jmhscript-box copied' : 'jmhscript-box'}
        />
      </div>
    </aside>
  )
}
