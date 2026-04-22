export type MindMapNodeType = 'root' | 'branch' | 'leaf'

export interface MindMapNodeData {
  label: string
}

export interface MindMapNodePosition {
  x: number
  y: number
}

export interface MindMapNode {
  id: string
  type: MindMapNodeType
  position: MindMapNodePosition
  data: MindMapNodeData
}

export interface MindMapEdge {
  id: string
  source: string
  target: string
}

export interface MindMapSnapshot {
  id: string
  topic: string
  nodes: MindMapNode[]
  edges: MindMapEdge[]
  capturedAt: number
}

export interface LegacyMindMapNode {
  id: string
  label: string
  kind: MindMapNodeType
  x: number
  y: number
  parentId?: string | null
}

export interface LegacyMindMapSnapshot {
  id?: string
  topic?: string
  nodes: LegacyMindMapNode[]
  capturedAt?: number
}

