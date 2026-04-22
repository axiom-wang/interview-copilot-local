import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { Background, Controls, ReactFlow } from '@xyflow/react'
import type { Edge, Node } from '@xyflow/react'
import type { MindMapNodeType, MindMapSnapshot } from '../types/mindmap'

interface MindMapPanelProps {
  snapshot: MindMapSnapshot | null
  className?: string
  isGenerating?: boolean
  isStale?: boolean
  onGenerate?: () => Promise<boolean> | boolean | void
  disableGenerate?: boolean
}

type FlowNodeData = Record<string, unknown> & {
  label: string
}

const formatTimestamp = (timestamp: number | null | undefined) =>
  timestamp
    ? new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(timestamp)
    : '未生成'

const getThemeToken = (name: string, fallback: string) => {
  if (typeof window === 'undefined') {
    return fallback
  }

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()

  return value || fallback
}

const getNodeStyle = (type: MindMapNodeType) => ({
  borderRadius: 18,
  border: `1px solid ${getThemeToken('--panel-border', 'rgba(148, 163, 184, 0.16)')}`,
  background:
    type === 'root'
      ? getThemeToken('--button-primary-bg', 'rgba(34, 211, 238, 0.14)')
      : type === 'branch'
        ? getThemeToken('--surface-inline-strong', 'rgba(2, 8, 23, 0.56)')
        : getThemeToken('--surface-inline', 'rgba(15, 23, 42, 0.44)'),
  color: getThemeToken('--text-primary', '#f8fbff'),
  padding: 10,
  minWidth: type === 'root' ? 180 : 140,
  boxShadow: getThemeToken('--shadow-soft', '0 12px 30px rgba(2, 8, 23, 0.18)'),
})

const buildMindMapElements = (snapshot: MindMapSnapshot | null) => {
  const nodes: Node<FlowNodeData>[] =
    snapshot?.nodes.map((node) => ({
      id: node.id,
      position: node.position,
      data: {
        label: node.data.label,
      },
      draggable: false,
      selectable: false,
      style: getNodeStyle(node.type),
    })) ?? []

  const edges: Edge[] =
    snapshot?.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: false,
      style: {
        stroke: getThemeToken('--panel-border-strong', 'rgba(125, 211, 252, 0.38)'),
        strokeWidth: 1.4,
      },
    })) ?? []

  return { nodes, edges }
}

export function MindMapPanel({
  snapshot,
  className,
  isGenerating = false,
  isStale = false,
  onGenerate,
  disableGenerate = false,
}: MindMapPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const canExpand = Boolean(snapshot)
  const expanded = canExpand && isExpanded
  const { nodes, edges } = buildMindMapElements(snapshot)

  useEffect(() => {
    if (!expanded) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExpanded(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [expanded])

  const handleGenerate = async () => {
    if (!onGenerate || disableGenerate || isGenerating) {
      return
    }

    const shouldOpen = await onGenerate()

    if (shouldOpen === false) {
      return
    }

    setIsExpanded(true)
  }

  const gridColor = getThemeToken('--viz-grid', 'rgba(148, 163, 184, 0.14)')

  return (
    <section className={clsx('panel-card p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="kicker theme-muted text-[11px]">产出预览</p>
          <h2 className="theme-title mt-2 font-heading text-2xl">思维导图</h2>
          <p className="theme-muted mt-2 text-sm">
            直接在应用内预览讨论结构，必要时再放大查看。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {snapshot ? (
            <span className="status-badge">生成于 {formatTimestamp(snapshot.capturedAt)}</span>
          ) : null}
          {isStale && snapshot ? (
            <span className="status-badge" data-tone="warning">
              内容可能过期
            </span>
          ) : null}
          {onGenerate ? (
            <button
              className={clsx(
                'rounded-full border px-4 py-2 text-sm transition',
                disableGenerate || isGenerating
                  ? 'theme-button-neutral border cursor-not-allowed'
                  : 'theme-button-primary border',
              )}
              disabled={disableGenerate || isGenerating}
              onClick={() => {
                void handleGenerate()
              }}
              type="button"
            >
              {isGenerating ? '生成中...' : '生成 / 刷新并查看'}
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={clsx(
          'theme-viz-surface group mt-5 h-[320px] overflow-hidden rounded-[24px] border',
          'theme-divider',
          canExpand ? 'cursor-zoom-in' : '',
        )}
        onClick={() => {
          if (canExpand) {
            setIsExpanded(true)
          }
        }}
      >
        {isGenerating && !snapshot ? (
          <div className="flex h-full flex-col justify-between p-5">
            <div className="panel-skeleton h-8 w-40 rounded-full" />
            <div className="grid flex-1 grid-cols-2 gap-4 py-6">
              <div className="panel-skeleton rounded-[24px]" />
              <div className="panel-skeleton rounded-[24px]" />
            </div>
            <div className="panel-skeleton h-6 w-56 rounded-full" />
          </div>
        ) : snapshot ? (
          <div className="relative h-full">
            <ReactFlow
              defaultViewport={{ x: 180, y: 90, zoom: 0.85 }}
              edges={edges}
              fitView
              fitViewOptions={{ padding: 0.18 }}
              nodes={nodes}
              nodesDraggable={false}
              panOnDrag={false}
              zoomOnScroll={false}
            >
              <Background color={gridColor} gap={22} />
            </ReactFlow>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/20 to-transparent px-4 py-3 text-right text-xs text-[color:var(--viz-overlay-text)] opacity-0 transition group-hover:opacity-100">
              点击放大查看
            </div>
          </div>
        ) : (
          <div className="theme-muted flex h-full items-center justify-center px-8 text-center text-sm leading-7">
            {onGenerate
              ? '思维导图已从弹窗改为应用内预览。点击右上角按钮后，会基于当前转写生成并直接展示。'
              : '当前回放快照还没有思维导图。'}
          </div>
        )}
      </div>

      {snapshot && expanded ? (
        <div
          className="theme-overlay fixed inset-0 z-[1200] flex items-center justify-center p-4 md:p-6"
          onClick={() => {
            setIsExpanded(false)
          }}
        >
          <div
            className="theme-overlay-card panel-card mx-auto flex h-[calc(100vh-32px)] w-full max-w-[1800px] flex-col overflow-hidden border md:h-[calc(100vh-48px)]"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className="theme-divider flex items-center justify-between border-b px-5 py-4">
              <div>
                <p className="kicker theme-muted text-[11px]">Full Preview</p>
                <h3 className="theme-title mt-2 text-lg font-semibold">
                  {snapshot.topic || '当前讨论导图'}
                </h3>
              </div>
              <button
                className="theme-button-neutral rounded-full border px-3 py-1.5 text-sm transition"
                onClick={() => {
                  setIsExpanded(false)
                }}
                type="button"
              >
                关闭
              </button>
            </div>
            <div className="theme-viz-surface-strong flex-1">
              <ReactFlow
                defaultViewport={{ x: 180, y: 90, zoom: 0.95 }}
                edges={edges}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                nodes={nodes}
                nodesDraggable={false}
                panOnDrag
                zoomOnScroll
              >
                <Background color={gridColor} gap={22} />
                <Controls showInteractive={false} />
              </ReactFlow>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
