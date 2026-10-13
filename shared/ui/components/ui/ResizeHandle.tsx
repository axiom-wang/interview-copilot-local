import clsx from 'clsx'
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

interface ResizeHandleProps {
  orientation: 'horizontal' | 'vertical'
  ariaLabel: string
  onDelta: (delta: number) => void
  onReset?: () => void
  className?: string
}

export function ResizeHandle({
  orientation,
  ariaLabel,
  onDelta,
  onReset,
  className,
}: ResizeHandleProps) {
  const [dragging, setDragging] = useState(false)
  const lastPositionRef = useRef(0)

  const readPosition = (event: { clientX: number; clientY: number }) =>
    orientation === 'vertical' ? event.clientX : event.clientY

  // Pointer capture keeps every move event on this element, so the listener is
  // installed once per drag instead of being re-bound on each React render.
  const startDragging = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    lastPositionRef.current = readPosition(event)
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return
    }

    const position = readPosition(event)
    const delta = position - lastPositionRef.current

    if (delta !== 0) {
      lastPositionRef.current = position
      onDelta(delta)
    }
  }

  return (
    <button
      aria-label={ariaLabel}
      className={clsx(
        'resize-handle',
        orientation === 'vertical'
          ? 'resize-handle--vertical'
          : 'resize-handle--horizontal',
        dragging && 'resize-handle--dragging',
        className,
      )}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 40 : 12
        const delta =
          orientation === 'vertical'
            ? event.key === 'ArrowLeft'
              ? -step
              : event.key === 'ArrowRight'
                ? step
                : 0
            : event.key === 'ArrowUp'
              ? -step
              : event.key === 'ArrowDown'
                ? step
                : 0

        if (delta !== 0) {
          event.preventDefault()
          onDelta(delta)
        }
      }}
      onLostPointerCapture={() => setDragging(false)}
      onPointerDown={startDragging}
      onPointerMove={handlePointerMove}
      title={`${ariaLabel}；双击恢复默认`}
      type="button"
    >
      <span aria-hidden="true" className="resize-handle__line" />
    </button>
  )
}
