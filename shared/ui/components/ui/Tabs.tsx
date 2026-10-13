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
  className?: string
}

export function Tabs({ items, defaultTabId, className }: TabsProps) {
  const [activeId, setActiveId] = useState(defaultTabId ?? items[0]?.id ?? '')
  const activeItem = items.find((item) => item.id === activeId) ?? items[0]

  if (!activeItem) {
    return null
  }

  return (
    <div className={clsx('flex min-h-0 flex-col gap-3', className)}>
      <div className="tabs-list" role="tablist">
        {items.map((item) => (
          <button
            className="tabs-trigger"
            data-active={item.id === activeItem.id}
            key={item.id}
            onClick={() => setActiveId(item.id)}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden" role="tabpanel">
        {activeItem.content}
      </div>
    </div>
  )
}
