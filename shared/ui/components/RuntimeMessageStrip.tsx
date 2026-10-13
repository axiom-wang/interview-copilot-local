import clsx from 'clsx'

type RuntimeMessageTone = 'info' | 'warning' | 'error'

interface RuntimeMessageStripProps {
  tone: RuntimeMessageTone
  message: string
  className?: string
}

const toneClassNames: Record<RuntimeMessageTone, string> = {
  info: 'border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent-text)]',
  warning:
    'border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning-text)]',
  error:
    'border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger-text)]',
}

const toneLabels: Record<RuntimeMessageTone, string> = {
  info: '提示',
  warning: '注意',
  error: '错误',
}

export function RuntimeMessageStrip({
  tone,
  message,
  className,
}: RuntimeMessageStripProps) {
  return (
    <div
      className={clsx(
        'rounded-[var(--radius-panel)] border px-4 py-3',
        toneClassNames[tone],
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className="status-badge shrink-0"
          data-tone={
            tone === 'info' ? 'primary' : tone === 'warning' ? 'warning' : 'danger'
          }
        >
          {toneLabels[tone]}
        </span>
        <p className="text-sm leading-6">{message}</p>
      </div>
    </div>
  )
}
