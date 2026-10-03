import type { JmhCommand } from '../lib/scripting.ts'
import type { PlayHistoryEntry } from '../lib/preferences.ts'
import { CommandSelect } from './CommandSelect.tsx'
import { HistoryList } from './HistoryList.tsx'
import { CheckIcon, ClipboardIcon } from './icons.tsx'

export interface OptionsPanelProps {
  jmhText: string
  jmhCopied: boolean
  onCopy: () => void
  command: JmhCommand
  onCommandChange: (command: JmhCommand) => void
  entries: PlayHistoryEntry[]
  onHistorySelect: (entry: PlayHistoryEntry) => void
  onHistoryInstant: (entry: PlayHistoryEntry) => void
}

export function OptionsPanel({
  jmhText,
  jmhCopied,
  onCopy,
  command,
  onCommandChange,
  entries,
  onHistorySelect,
  onHistoryInstant,
}: OptionsPanelProps) {
  return (
    <aside className="options" aria-label="Options" data-testid="options">
      <h2 className="options-title">Options</h2>
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
      <CommandSelect command={command} onChange={onCommandChange} />
      <hr className="nav-separator" />
      <h3 className="history-title">History</h3>
      <HistoryList entries={entries} onSelect={onHistorySelect} onInstant={onHistoryInstant} />
    </aside>
  )
}
