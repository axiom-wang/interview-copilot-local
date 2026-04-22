import type {
  LegacyMindMapNode,
  LegacyMindMapSnapshot,
  MindMapEdge,
  MindMapNode,
  MindMapNodeType,
  MindMapSnapshot,
} from '../types/mindmap'

const DEFAULT_TOPIC = '讨论导图'

const normalizeNodeType = (value: unknown): MindMapNodeType => {
  if (value === 'root' || value === 'branch' || value === 'leaf') {
    return value
  }

  return 'branch'
}

const toSafeNodeId = (value: unknown, fallbackPrefix: string, index: number) => {
  const raw = typeof value === 'string' ? value.trim() : ''
  return raw || `${fallbackPrefix}-${index + 1}`
}

const toFlowNode = (node: LegacyMindMapNode, index: number): MindMapNode => ({
  id: toSafeNodeId(node.id, 'node', index),
  type: normalizeNodeType(node.kind),
  position: {
    x: Number.isFinite(node.x) ? node.x : 140 + index * 180,
    y: Number.isFinite(node.y) ? node.y : 180 + index * 70,
  },
  data: {
    label: (typeof node.label === 'string' ? node.label.trim() : '') || '未命名节点',
  },
})

const buildRootNode = (topic: string): MindMapNode => ({
  id: 'root-1',
  type: 'root',
  position: { x: 140, y: 220 },
  data: { label: topic || DEFAULT_TOPIC },
})

const dedupeEdges = (edges: MindMapEdge[]) => {
  const seen = new Set<string>()
  const result: MindMapEdge[] = []

  for (const edge of edges) {
    if (!edge.source || !edge.target || edge.source === edge.target) {
      continue
    }

    if (seen.has(edge.id)) {
      continue
    }

    seen.add(edge.id)
    result.push(edge)
  }

  return result
}

const ensureRootNode = (nodes: MindMapNode[], topic: string) => {
  const existingRoot = nodes.find((node) => node.type === 'root')

  if (existingRoot) {
    return existingRoot
  }

  const root = buildRootNode(topic)
  nodes.unshift(root)
  return root
}

const buildFallbackEdges = (nodes: MindMapNode[], rootNode: MindMapNode) =>
  nodes
    .filter((node) => node.id !== rootNode.id)
    .map<MindMapEdge>((node) => ({
      id: `e-${rootNode.id}-${node.id}`,
      source: rootNode.id,
      target: node.id,
    }))

export const legacyMindMapToFlowMap = (
  legacy: LegacyMindMapSnapshot,
): Pick<MindMapSnapshot, 'topic' | 'nodes' | 'edges'> => {
  const topic =
    (typeof legacy.topic === 'string' && legacy.topic.trim()) || DEFAULT_TOPIC
  const rawNodes = Array.isArray(legacy.nodes) ? legacy.nodes : []
  const convertedNodes = rawNodes.map(toFlowNode)
  const nodes = [...convertedNodes]
  const rootNode = ensureRootNode(nodes, topic)
  const nodeIdSet = new Set(nodes.map((node) => node.id))

  const rawToFlowId = new Map<string, string>()
  rawNodes.forEach((rawNode, index) => {
    const rawId = typeof rawNode.id === 'string' ? rawNode.id.trim() : ''
    const flowId = convertedNodes[index]?.id

    if (rawId && flowId) {
      rawToFlowId.set(rawId, flowId)
    }
  })

  const edges: MindMapEdge[] = []

  rawNodes.forEach((rawNode, index) => {
    const targetId = convertedNodes[index]?.id ?? ''
    const rawParentId =
      typeof rawNode.parentId === 'string' ? rawNode.parentId.trim() : ''
    const sourceId = rawToFlowId.get(rawParentId) ?? rawParentId

    if (!targetId || !sourceId || !nodeIdSet.has(sourceId)) {
      return
    }

    edges.push({
      id: `e-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
    })
  })

  const normalizedEdges = dedupeEdges(
    edges.length > 0 ? edges : buildFallbackEdges(nodes, rootNode),
  )

  return {
    topic,
    nodes,
    edges: normalizedEdges,
  }
}

const parseFlowNode = (value: unknown, index: number): MindMapNode | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const node = value as Record<string, unknown>
  const position = node.position as Record<string, unknown> | undefined
  const data = node.data as Record<string, unknown> | undefined
  const x = typeof position?.x === 'number' ? position.x : Number.NaN
  const y = typeof position?.y === 'number' ? position.y : Number.NaN

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null
  }

  const label =
    (typeof data?.label === 'string' ? data.label.trim() : '') || '未命名节点'

  return {
    id: toSafeNodeId(node.id, 'node', index),
    type: normalizeNodeType(node.type),
    position: { x, y },
    data: { label },
  }
}

const parseFlowEdge = (
  value: unknown,
  index: number,
  nodeIds: Set<string>,
): MindMapEdge | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const edge = value as Record<string, unknown>
  const source = typeof edge.source === 'string' ? edge.source.trim() : ''
  const target = typeof edge.target === 'string' ? edge.target.trim() : ''

  if (!source || !target || source === target) {
    return null
  }

  if (!nodeIds.has(source) || !nodeIds.has(target)) {
    return null
  }

  const id =
    (typeof edge.id === 'string' && edge.id.trim()) || `e-${source}-${target}-${index + 1}`

  return { id, source, target }
}

export const normalizeMindMapSnapshot = (
  value: unknown,
  capturedAt: number,
): MindMapSnapshot => {
  if (!value || typeof value !== 'object') {
    const root = buildRootNode(DEFAULT_TOPIC)
    return {
      id: `mindmap-${capturedAt}`,
      topic: DEFAULT_TOPIC,
      nodes: [root],
      edges: [],
      capturedAt,
    }
  }

  const payload = value as Record<string, unknown>
  const rawNodes = Array.isArray(payload.nodes) ? payload.nodes : []
  const topic =
    (typeof payload.topic === 'string' && payload.topic.trim()) || DEFAULT_TOPIC

  const looksLikeFlowNodes = rawNodes.some(
    (node) =>
      !!node &&
      typeof node === 'object' &&
      'position' in (node as Record<string, unknown>) &&
      'data' in (node as Record<string, unknown>),
  )

  if (!looksLikeFlowNodes) {
    const converted = legacyMindMapToFlowMap({
      topic,
      nodes: rawNodes as LegacyMindMapNode[],
    })

    return {
      id:
        (typeof payload.id === 'string' && payload.id.trim()) ||
        `mindmap-${capturedAt}`,
      topic: converted.topic,
      nodes: converted.nodes,
      edges: converted.edges,
      capturedAt,
    }
  }

  const nodes = rawNodes
    .map((node, index) => parseFlowNode(node, index))
    .filter((node): node is MindMapNode => node !== null)

  const rootNode = ensureRootNode(nodes, topic)
  const nodeIds = new Set(nodes.map((node) => node.id))
  const rawEdges = Array.isArray(payload.edges) ? payload.edges : []
  const parsedEdges = rawEdges
    .map((edge, index) => parseFlowEdge(edge, index, nodeIds))
    .filter((edge): edge is MindMapEdge => edge !== null)

  return {
    id:
      (typeof payload.id === 'string' && payload.id.trim()) ||
      `mindmap-${capturedAt}`,
    topic,
    nodes,
    edges: dedupeEdges(
      parsedEdges.length > 0 ? parsedEdges : buildFallbackEdges(nodes, rootNode),
    ),
    capturedAt,
  }
}

