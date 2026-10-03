import type { JmhCommand } from '../lib/scripting.ts'
import { JMH_COMMANDS } from '../lib/scripting.ts'
import { en } from '../locales/en.ts'
import { Dropdown } from './Dropdown.tsx'

export interface CommandSelectProps {
  command: JmhCommand
  onChange: (command: JmhCommand) => void
}

export function CommandSelect({ command, onChange }: CommandSelectProps) {
  return (
    <Dropdown
      value={command}
      options={JMH_COMMANDS.map((c) => ({ value: c, label: c }))}
      onChange={onChange}
      testId="jmhscript-command"
      ariaLabel={en.options.commandLabel}
      selectClassName="command-select"
      toggleClassName="jmhscript-command"
      optionTestId={(c) => `jmhscript-command-option-${c}`}
      renderToggle={(label) => label}
    />
  )
}
