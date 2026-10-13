import clsx from 'clsx'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDismiss } from '../../hooks/useDismiss'

export interface ActionMenuItem {
  label: string
  onSelect: () => void
  tone?: 'danger'
}

interface ActionMenuProps {
  items: ActionMenuItem[]
  label: string
  className?: string
  /** Shows a text button instead of the default "more" icon. */
  triggerText?: string
}

const MENU_WIDTH = 144

export function ActionMenu({ items, label, className, triggerText }: ActionMenuProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setPosition(null), [])
  const open = position !== null
  useDismiss(rootRef, open, close)

  const placeMenu = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    const visible =
      rect !== undefined &&
      rect.bottom > 0 &&
      rect.top < window.innerHeight &&
      rect.right > 0 &&
      rect.left < window.innerWidth

    if (!rect || !visible) {
      setPosition(null)
      return
    }

    const estimatedHeight = items.length * 32 + 8
    const top =
      rect.bottom + 4 + estimatedHeight > window.innerHeight
        ? Math.max(8, rect.top - 4 - estimatedHeight)
        : rect.bottom + 4
    const left = Math.max(8, rect.right - MENU_WIDTH)

    setPosition((current) =>
      current && current.top === top && current.left === left ? current : { top, left },
    )
  }, [items.length])

  useEffect(() => {
    if (!open) {
      return
    }

    window.addEventListener('scroll', placeMenu, true)
    window.addEventListener('resize', placeMenu)
    return () => {
      window.removeEventListener('scroll', placeMenu, true)
      window.removeEventListener('resize', placeMenu)
    }
  }, [open, placeMenu])

  if (items.length === 0) {
    return null
  }

  const toggle = () => {
    if (open) {
      close()
      return
    }

    placeMenu()
  }

  return (
    <div className={clsx('relative', className)} data-open={open} ref={rootRef}>
      {triggerText ? (
        <button
          aria-expanded={open}
          aria-haspopup="menu"
          className="btn-secondary text-xs"
          onClick={toggle}
          ref={buttonRef}
          type="button"
        >
          {triggerText}
          <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16">
            <path d="M4 6.5 8 10.5 12 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          </svg>
        </button>
      ) : (
        <button
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={label}
          className={clsx(
            'theme-muted flex h-6 w-6 items-center justify-center rounded-[var(--radius-control)] transition hover:bg-[color:var(--surface-inline-hover)] hover:text-[color:var(--text-primary)]',
            open && 'bg-[color:var(--surface-inline-hover)]',
          )}
          onClick={toggle}
          ref={buttonRef}
          title={label}
          type="button"
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
            <circle cx="3.5" cy="8" r="1.25" />
            <circle cx="8" cy="8" r="1.25" />
            <circle cx="12.5" cy="8" r="1.25" />
          </svg>
        </button>
      )}
      {position ? (
        <div
          className="panel-card fixed z-50 p-1"
          role="menu"
          style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
        >
          {items.map((item) => (
            <button
              className={clsx(
                'block w-full rounded-[var(--radius-control)] px-2.5 py-1.5 text-left text-sm transition',
                item.tone === 'danger'
                  ? 'text-[color:var(--danger-text)] hover:bg-[color:var(--danger-soft)]'
                  : 'theme-body hover:bg-[color:var(--surface-inline-hover)]',
              )}
              key={item.label}
              onClick={() => {
                item.onSelect()
                close()
              }}
              role="menuitem"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
