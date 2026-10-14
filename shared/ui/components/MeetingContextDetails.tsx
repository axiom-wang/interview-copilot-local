import { useState } from 'react'
import { resolveScenarioAssistance } from '../../meeting/scenarios/assistance'
import type { MeetingScenarioId } from '../../meeting/scenarios'
import type { ConsensusAnalysis } from '../../meeting/types/analysis'
import type { MeetingMemory, MemoryEventStatus } from '../../meeting/types/meetingMemory'
import type { TranscriptSegment } from '../../meeting/types/transcript'
import type { SpeakerProfile } from '../../meeting/types/speaker'

const statusLabels: Record<MemoryEventStatus, string> = {
  discussed: '讨论', proposed: '提议', confirmed: '确认', disputed: '异议',
  resolved: '解决', rejected: '否决', superseded: '撤销 / 替代',
}
const intentLabels = { contribute: '补充观点', clarify: '想问一句', challenge: '有一点异议', listen: '继续倾听' }
const time = (timestamp: number) => new Date(timestamp).toLocaleTimeString('zh-CN', { hour12: false })

export function MeetingContextDetails({ analysis, memory, scenarioId, segments = [], speakerProfiles = {} }: {
  analysis: ConsensusAnalysis
  memory?: MeetingMemory
  scenarioId?: MeetingScenarioId
  segments?: TranscriptSegment[]
  speakerProfiles?: Record<string, SpeakerProfile>
}) {
  const [showHistory, setShowHistory] = useState(false)
  const byId = new Map(segments.map((s) => [s.id, s]))
  const evidence = (ids: string[]) => ids.flatMap((id) => {
    const segment = byId.get(id)
    if (!segment) return []
    const speaker = speakerProfiles[segment.speaker]?.displayName ?? segment.speaker
    return [<blockquote className="theme-body mt-2 text-sm leading-6" key={id}>
      <span className="theme-muted block text-xs">{speaker} · {time(segment.timestamp)}</span>
      {segment.text}
    </blockquote>]
  })
  const chunks = memory?.chunks ?? []

  return <>
    {analysis.contextCoverage ? <p className="theme-body text-xs leading-5">
      已参考全程 {analysis.contextCoverage.segmentCount} 条转写 · 截至 {time(analysis.contextCoverage.throughTimestamp)}
      {chunks.length ? ' · 较早内容已整理为可追溯记忆' : ' · 使用完整原话'}
    </p> : null}
    {analysis.participantView ? <div>
      <h3 className="theme-title text-sm font-semibold">AI 的参会观点</h3>
      <p className="theme-body mt-2 text-sm leading-6">{analysis.participantView.understanding}</p>
      <p className="theme-title mt-3 text-xs font-semibold">{intentLabels[analysis.participantView.intent]}</p>
      {analysis.participantView.contribution ? <p className="theme-title mt-1 text-sm leading-7">{analysis.participantView.contribution}</p> : null}
      <p className="theme-body mt-1 text-xs leading-5">{analysis.participantView.reason}</p>
      <p className="theme-muted mt-1 text-xs">AI 观点，尚未作为会议发言或团队决定</p>
      {analysis.participantView.evidenceIds.some((id) => byId.has(id)) ? <details className="mt-2">
        <summary className="theme-body cursor-pointer text-xs">查看观点依据</summary>
        {evidence(analysis.participantView.evidenceIds)}
      </details> : null}
    </div> : null}
    {analysis.scenarioFocus?.length ? <div>
      <h3 className="theme-title text-sm font-semibold">{resolveScenarioAssistance(scenarioId).title}</h3>
      <ul className="mt-2 space-y-3">
        {analysis.scenarioFocus.map((item, index) => <li key={`${item.label}-${index}`}>
          <p className="theme-title text-xs font-semibold">{item.label}</p>
          <p className="theme-body mt-1 text-sm leading-6">{item.detail}</p>
          {item.evidenceIds.some((id) => byId.has(id)) ? <details className="mt-1">
            <summary className="theme-body cursor-pointer text-xs">查看依据</summary>
            {evidence(item.evidenceIds)}
          </details> : <p className="theme-muted mt-1 text-xs">建议或待确认，暂无直接原话依据</p>}
        </li>)}
      </ul>
    </div> : null}
    {chunks.length ? <details onToggle={(event) => setShowHistory(event.currentTarget.open)}>
      <summary className="theme-body cursor-pointer text-sm">查看会议记忆与变更记录</summary>
      {showHistory ? <div className="mt-3 space-y-4">
        <p className="theme-body text-xs leading-5">以下记录各时点的讨论状态。后续可能已修改决定，当前结论请结合上方分析。</p>
        {chunks.map((chunk) => <div key={chunk.sourceDigest}>
          <p className="theme-muted text-xs">{time(chunk.startedAt)} – {time(chunk.endedAt)}</p>
          <ul className="mt-2 space-y-3">{chunk.events.map((event, index) =>
            <li key={index}>
              <p className="theme-title text-sm font-medium">{event.topic} · {statusLabels[event.status]}</p>
              <p className="theme-body mt-1 text-sm leading-6">{event.detail}</p>
              <details className="mt-1">
                <summary className="theme-body cursor-pointer text-xs">查看原话</summary>
                {evidence(event.evidenceIds)}
              </details>
            </li>)}</ul>
        </div>)}
      </div> : null}
    </details> : null}
  </>
}
