import clsx from 'clsx'
import { useEffect, useRef } from 'react'

interface QuestionBarProps {
  value: string
  onChange: (value: string) => void
  onAsk: () => void
  quickQuestions: string[]
  placeholder: string
  disableAsk?: boolean
  isAnswering?: boolean
  className?: string
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** Always-visible AI question entry; ⌘K / Ctrl+K focuses it from anywhere. */
export function QuestionBar({
  value,
  onChange,
  onAsk,
  quickQuestions,
  placeholder,
  disableAsk,
  isAnswering,
  className,
}: QuestionBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const canAsk = !disableAsk && !isAnswering

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <section className={clsx('panel-card flex min-w-0 flex-col gap-2 px-3 py-2.5', className)}>
      {quickQuestions.length > 0 ? (
        <div className="min-w-0 overflow-x-auto">
          <div className="flex w-max gap-1.5">
            {quickQuestions.map((item) => (
              <button
                className="btn-ghost px-2 py-1 text-xs"
                key={item}
                onClick={() => {
                  onChange(item)
                  inputRef.current?.focus()
                }}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <form
        className="flex min-w-0 items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (canAsk) onAsk()
        }}
      >
        <input
          className="theme-input min-w-0 flex-1 rounded-[var(--radius-control)] px-3 py-2 text-sm outline-none transition"
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder={placeholder}
          ref={inputRef}
          value={value}
        />
        <kbd className="theme-muted hidden shrink-0 text-xs lg:inline">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        <button
          className="btn-primary shrink-0 px-3 py-1.5 text-xs"
          disabled={!canAsk}
          type="submit"
        >
          {isAnswering ? '回答中...' : '提问'}
        </button>
      </form>
    </section>
  )
}
