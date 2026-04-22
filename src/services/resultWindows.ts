import type { MeetingSummary } from '../types/analysis'
import type { MindMapNode, MindMapSnapshot } from '../types/mindmap'

const BASE_WINDOW_FEATURES = 'width=1200,height=820,resizable=yes,scrollbars=yes'

const formatTimestamp = (timestamp: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp)

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const escapeXml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')

const openResultWindow = (title: string, body: string) => {
  const popup = window.open('', '_blank', BASE_WINDOW_FEATURES)

  if (!popup) {
    throw new Error('无法打开新窗口，请检查系统是否阻止弹窗。')
  }

  popup.document.write(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: dark;
      }
      body {
        margin: 0;
        font-family: "Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif;
        background: radial-gradient(circle at top, #12324f, #020617 46%);
        color: #e2e8f0;
      }
      .container {
        max-width: 1400px;
        margin: 0 auto;
        padding: 24px;
      }
      .card {
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 20px;
        background: rgba(15, 23, 42, 0.78);
        box-shadow: 0 20px 60px rgba(2, 8, 23, 0.45);
        padding: 18px 20px;
      }
      h1 {
        margin: 0;
        font-size: 26px;
        line-height: 1.25;
      }
      .meta {
        margin-top: 8px;
        color: #93c5fd;
        font-size: 13px;
      }
      .section {
        margin-top: 16px;
      }
      .section-title {
        margin: 0 0 8px;
        color: #bae6fd;
        font-size: 14px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .speech {
        margin: 0;
        white-space: pre-wrap;
        line-height: 1.8;
      }
      ul {
        margin: 0;
        padding-left: 22px;
        line-height: 1.9;
      }
      img {
        width: 100%;
        height: auto;
        display: block;
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(2, 6, 23, 0.75);
      }
    </style>
  </head>
  <body>
    ${body}
  </body>
</html>`)
  popup.document.close()
}

type MindMapNodeRender = {
  id: string
  label: string
  type: MindMapNode['type']
  x: number
  y: number
  width: number
  height: number
}

const getNodeSize = (type: MindMapNode['type']) => {
  if (type === 'root') {
    return { width: 240, height: 84 }
  }

  if (type === 'branch') {
    return { width: 200, height: 74 }
  }

  return { width: 180, height: 68 }
}

const truncateLabel = (label: string, maxLength: number) =>
  label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label

const buildMindMapSvgDataUrl = (snapshot: MindMapSnapshot) => {
  const padding = 80
  const renderedNodes: MindMapNodeRender[] = snapshot.nodes.map((node) => {
    const size = getNodeSize(node.type)
    return {
      id: node.id,
      label: node.data.label,
      type: node.type,
      x: node.position.x,
      y: node.position.y,
      width: size.width,
      height: size.height,
    }
  })

  if (renderedNodes.length === 0) {
    const emptySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" viewBox="0 0 900 560">
      <rect width="900" height="560" fill="#020617" />
      <text x="450" y="280" fill="#94a3b8" text-anchor="middle" font-size="22">暂无可展示的导图节点</text>
    </svg>`
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(emptySvg)}`
  }

  const minX = Math.min(...renderedNodes.map((node) => node.x))
  const minY = Math.min(...renderedNodes.map((node) => node.y))
  const maxX = Math.max(...renderedNodes.map((node) => node.x + node.width))
  const maxY = Math.max(...renderedNodes.map((node) => node.y + node.height))

  const width = Math.max(960, maxX - minX + padding * 2)
  const height = Math.max(620, maxY - minY + padding * 2)
  const offsetX = padding - minX
  const offsetY = padding - minY
  const nodeMap = new Map(renderedNodes.map((node) => [node.id, node]))

  const edgeSvg = snapshot.edges
    .map((edge) => {
      const source = nodeMap.get(edge.source)
      const target = nodeMap.get(edge.target)

      if (!target || !source) {
        return ''
      }

      const sourceX = source.x + source.width + offsetX
      const sourceY = source.y + source.height / 2 + offsetY
      const targetX = target.x + offsetX
      const targetY = target.y + target.height / 2 + offsetY
      const controlDelta = Math.max(44, (targetX - sourceX) / 2)

      return `<path d="M ${sourceX} ${sourceY} C ${sourceX + controlDelta} ${sourceY}, ${targetX - controlDelta} ${targetY}, ${targetX} ${targetY}" stroke="#7dd3fc" stroke-opacity="0.55" stroke-width="2.4" fill="none" />`
    })
    .join('')

  const nodeSvg = renderedNodes
    .map((node) => {
      const x = node.x + offsetX
      const y = node.y + offsetY
      const fill =
        node.type === 'root'
          ? 'rgba(6,182,212,0.28)'
          : node.type === 'branch'
            ? 'rgba(15,23,42,0.92)'
            : 'rgba(15,23,42,0.86)'
      const fontSize = node.type === 'root' ? 21 : node.type === 'branch' ? 18 : 16
      const text = escapeXml(
        truncateLabel(
          node.label.replace(/\s+/g, ' ').trim(),
          node.type === 'root' ? 22 : 26,
        ),
      )

      return `<g>
        <rect x="${x}" y="${y}" width="${node.width}" height="${node.height}" rx="16" ry="16" fill="${fill}" stroke="rgba(226,232,240,0.25)" />
        <text x="${x + node.width / 2}" y="${y + node.height / 2 + 6}" fill="#f8fafc" font-size="${fontSize}" font-family="Microsoft YaHei, PingFang SC, Segoe UI, sans-serif" text-anchor="middle">${text}</text>
      </g>`
    })
    .join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0b1f36" />
        <stop offset="100%" stop-color="#020617" />
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)" />
    ${edgeSvg}
    ${nodeSvg}
  </svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export const openMindMapImageWindow = (snapshot: MindMapSnapshot) => {
  const imageDataUrl = buildMindMapSvgDataUrl(snapshot)
  const body = `
  <main class="container">
    <section class="card">
      <h1>会议思维导图</h1>
      <p class="meta">主题：${escapeHtml(snapshot.topic)} · 生成时间：${escapeHtml(
        formatTimestamp(snapshot.capturedAt),
      )}</p>
      <div class="section">
        <img src="${imageDataUrl}" alt="会议思维导图" />
      </div>
    </section>
  </main>`

  openResultWindow('会议思维导图', body)
}

export const openMeetingSummaryWindow = (summary: MeetingSummary) => {
  const keyPoints = summary.keyPoints
    .map((point) => `<li>${escapeHtml(point)}</li>`)
    .join('')
  const nextSteps = summary.nextSteps
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join('')

  const body = `
  <main class="container">
    <section class="card">
      <h1>总结发言</h1>
      <p class="meta">更新时间：${escapeHtml(formatTimestamp(summary.updatedAt))}</p>
      <div class="section">
        <h2 class="section-title">60秒口播稿</h2>
        <p class="speech">${escapeHtml(summary.speech60s)}</p>
      </div>
      <div class="section">
        <h2 class="section-title">关键要点</h2>
        <ul>${keyPoints}</ul>
      </div>
      <div class="section">
        <h2 class="section-title">下一步行动</h2>
        <ul>${nextSteps}</ul>
      </div>
    </section>
  </main>`

  openResultWindow('总结发言', body)
}

