import { useCallback, useEffect, useState } from 'react'

/**
 * Tracks an element's own size so layout can react to the space it actually
 * has, which a viewport media query would miss. The node may mount later, so
 * observation follows the element, not the first effect run.
 */
export function useElementSize<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const ref = useCallback((node: T | null) => {
    setElement(node)
  }, [])

  useEffect(() => {
    if (!element) {
      return
    }

    // ResizeObserver reports the initial size as soon as observation starts.
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]

      if (entry) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return { ref, width: size.width, height: size.height }
}
