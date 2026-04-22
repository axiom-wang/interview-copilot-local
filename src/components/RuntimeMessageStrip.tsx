import clsx from 'clsx'

type RuntimeMessageTone = 'info' | 'warning' | 'error'

interface RuntimeMessageStripProps {
  tone: RuntimeMessageTone
  message: string
  className?: string
}

const toneClassNames: Record<RuntimeMessageTone, string> = {
  info: 'border-cyan-300/18 bg-cyan-300/10 text-[color:var(--button-primary-text)]',
  warning:
    'border-amber-300/24 bg-amber-300/10 text-[color:var(--button-warning-text)]',
  error: 'border-rose-300/22 bg-rose-300/10 text-[color:var(--button-danger-text)]',
}

const toneLabels: Record<RuntimeMessageTone, string> = {
  info: 'Info',
  warning: 'Warning',
  error: 'Error',
}

export function RuntimeMessageStrip({
  tone,
  message,
  className,
}: RuntimeMessageStripProps) {
  return (
    <div
      className={clsx(
        'rounded-[22px] border px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
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
