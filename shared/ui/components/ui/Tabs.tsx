import clsx from 'clsx'
import { useState, type ReactNode } from 'react'

export interface TabItem {
  id: string
  label: string
  content: ReactNode
}

interface TabsProps {
  items: TabItem[]
  defaultTabId?: string
  activeId?: string
  onActiveIdChange?: (id: string) => void
  className?: string
}

export function Tabs({ items, defaultTabId, activeId, onActiveIdChange, className }: TabsProps) {
  const [localActiveId, setLocalActiveId] = useState(defaultTabId ?? items[0]?.id ?? '')
  const currentId = activeId ?? localActiveId
  const activeItem = items.find((item) => item.id === currentId) ?? items[0]

  if (!activeItem) {
    return null
  }

  const select = (id: string) => {
    setLocalActiveId(id)
    onActiveIdChange?.(id)
  }

  return (
    <div className={clsx('flex min-h-0 w-full min-w-0 max-w-full flex-col gap-3', className)}>
      <div className="tabs-list shrink-0" role="tablist">
        {items.map((item) => (
          <button
            aria-selected={item.id === activeItem.id}
            className="tabs-trigger"
            data-active={item.id === activeItem.id}
            key={item.id}
            onClick={() => select(item.id)}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        className="flex w-full min-w-0 flex-col lg:min-h-0 lg:h-full lg:flex-1 lg:overflow-hidden lg:[&>*]:h-full lg:[&>*]:max-h-full lg:[&>*]:min-h-0 lg:[&>*]:w-full lg:[&>*]:min-w-0 lg:[&>*]:flex-1 [&>*]:w-full [&>*]:min-w-0"
        role="tabpanel"
      >
        {activeItem.content}
      </div>
    </div>
  )
}
