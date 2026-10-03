import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'

export interface DropdownOption<T extends string> {
  value: T
  label: string
}

export interface DropdownProps<T extends string> {
  value: T
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  testId: string
  ariaLabel: string
  selectClassName: string
  toggleClassName: string
  optionTestId: (value: T) => string
  renderToggle: (label: string) => ReactNode
}

/** Custom dropdown: native selects ignore option highlight styling. */
export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  testId,
  ariaLabel,
  selectClassName,
  toggleClassName,
  optionTestId,
  renderToggle,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const [focusIndex, setFocusIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)

  function openList() {
    setFocusIndex(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }

  function select(choice: T) {
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
      setFocusIndex((i) => (i + 1) % options.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIndex((i) => (i + options.length - 1) % options.length)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      select(options[focusIndex]?.value ?? value)
    }
  }

  const label = options.find((o) => o.value === value)?.label ?? value

  return (
    <div ref={rootRef} className={selectClassName}>
      <button
        type="button"
        data-testid={testId}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={toggleClassName}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onToggleKeyDown}
      >
        {renderToggle(label)}
      </button>
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          className="command-list"
          onKeyDown={onListKeyDown}
        >
          {options.map((o, i) => (
            <li key={o.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                data-testid={optionTestId(o.value)}
                className={[
                  'command-option',
                  o.value === value && 'selected',
                  i === focusIndex && 'focused',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => select(o.value)}
                onMouseEnter={() => setFocusIndex(i)}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
