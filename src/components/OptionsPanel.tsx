import type { JmhCommand } from '../lib/scripting.ts'
import type { DayPoint, HourPoint, MonthPoint } from '../lib/hourly.ts'
import { formatPlays } from '../lib/playcounts.ts'
import type { PlayHistoryEntry } from '../lib/preferences.ts'
import { en } from '../locales/en.ts'
import { CommandSelect } from './CommandSelect.tsx'
import { HistoryList } from './HistoryList.tsx'
import { DailyChart, HourlyChart, MonthlyChart } from './TrendChart.tsx'
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
  hourly: HourPoint[]
  daily: DayPoint[]
  monthly: MonthPoint[]
  globalPlays: number
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
  hourly,
  daily,
  monthly,
  globalPlays,
}: OptionsPanelProps) {
  return (
    <aside className="options" aria-label={en.options.panelLabel} data-testid="options">
      <h2 className="options-title">{en.options.title}</h2>
      <label className="jmhscript-label" htmlFor="jmhscript-box">
        {en.options.jmhLabel}
      </label>
      <div className="jmhscript-row">
        <button
          type="button"
          data-testid="jmhscript-copy"
          className="jmhscript-copy"
          aria-label={en.options.copyLabel}
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
      <h3 className="history-title">{en.options.historyTitle}</h3>
      <HistoryList entries={entries} onSelect={onHistorySelect} onInstant={onHistoryInstant} />
      <hr className="nav-separator" />
      <p data-testid="global-plays" className="global-plays">
        {en.options.globalPlaysLabel}{' '}
        <span className="global-plays-total">{formatPlays(globalPlays)}</span>
      </p>
      <h3 className="history-title">{en.options.hourlyTitle}</h3>
      <HourlyChart points={hourly} />
      <hr className="nav-separator" />
      <h3 className="history-title">{en.options.dailyTitle}</h3>
      <DailyChart points={daily} />
      <hr className="nav-separator" />
      <h3 className="history-title">{en.options.monthlyTitle}</h3>
      <MonthlyChart points={monthly} />
    </aside>
  )
}
