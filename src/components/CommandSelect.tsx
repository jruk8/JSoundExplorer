import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { JmhCommand } from '../lib/scripting.ts'
import { JMH_COMMANDS } from '../lib/scripting.ts'

export interface CommandSelectProps {
  command: JmhCommand
  onChange: (command: JmhCommand) => void
}

/** Custom command dropdown: native selects ignore option highlight styling. */
export function CommandSelect({ command, onChange }: CommandSelectProps) {
  const [open, setOpen] = useState(false)
  const [focusIndex, setFocusIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)

  function openList() {
    setFocusIndex(Math.max(0, JMH_COMMANDS.indexOf(command)))
    setOpen(true)
  }

  function select(choice: JmhCommand) {
    onChange(choice)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    listRef.current?.focus()
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Swallow so the global stop-on-Escape does not also fire.
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function onToggleKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      openList()
    }
  }

  function onListKeyDown(e: ReactKeyboardEvent<HTMLUListElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIndex((i) => (i + 1) % JMH_COMMANDS.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIndex((i) => (i + JMH_COMMANDS.length - 1) % JMH_COMMANDS.length)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      select(JMH_COMMANDS[focusIndex] ?? command)
    }
  }

  return (
    <div ref={rootRef} className="command-select">
      <button
        type="button"
        data-testid="jmhscript-command"
        aria-label="JMHScript command"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="jmhscript-command"
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onToggleKeyDown}
      >
        {command}
      </button>
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label="JMHScript command"
          tabIndex={-1}
          className="command-list"
          onKeyDown={onListKeyDown}
        >
          {JMH_COMMANDS.map((c, i) => (
            <li key={c} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={c === command}
                data-testid={`jmhscript-command-option-${c}`}
                className={[
                  'command-option',
                  c === command && 'selected',
                  i === focusIndex && 'focused',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => select(c)}
                onMouseEnter={() => setFocusIndex(i)}
              >
                {c}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
