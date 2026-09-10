import { resolveScenarioProfile } from '../scenarios'
import type { SessionRecord } from '../types/session'

const sanitizeFileName = (value: string) =>
  value.replace(/[<>:"/\\|?*]+/g, '-').replace(/\s+/g, '-').slice(0, 80)

const triggerDownload = (
  content: string,
  fileName: string,
  mimeType: string,
) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

const formatDateTime = (timestamp: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp)

const getSpeakerDisplayName = (session: SessionRecord, speakerId: string) => {
  const profile = session.speakerProfiles[speakerId]

  if (!profile) {
    return speakerId
  }

  if (profile.isMe) {
    return profile.displayName ? `我 · ${profile.displayName}` : '我'
  }

  return profile.displayName ?? speakerId
}

export const exportSessionAsJson = (session: SessionRecord) => {
  triggerDownload(
    JSON.stringify(session, null, 2),
    `${sanitizeFileName(session.title)}.json`,
    'application/json;charset=utf-8',
  )
}

export const exportSessionAsMarkdown = (session: SessionRecord) => {
  const transcriptSection = session.transcriptSegments
    .map(
      (segment) =>
        `- ${formatDateTime(segment.timestamp)} | ${getSpeakerDisplayName(session, segment.speaker)} | ${segment.isFinal ? '已定稿' : '识别中'} | ${segment.text}`,
    )
    .join('\n')

  const pinnedSection =
    session.pinnedSegments.length > 0
      ? session.pinnedSegments
          .map(
            (item) =>
              `- ${formatDateTime(item.pinnedAt)} | ${item.note} | segmentId=${item.segmentId}`,
          )
          .join('\n')
      : '- 暂无'

  const profile = resolveScenarioProfile(session.scenarioId)
  const summarySection = session.meetingSummary
    ? `### ${formatDateTime(session.meetingSummary.updatedAt)}

- ${profile.spokenSummaryLabel}：${session.meetingSummary.speech60s}
- 关键要点：${session.meetingSummary.keyPoints.join('；') || '暂无'}
- 下一步动作：${session.meetingSummary.nextSteps.join('；') || '暂无'}`
    : '暂无'

  const minutes = session.meetingMinutes
  const minutesSection = minutes
    ? `### ${minutes.title || '会议纪要'}

- 概览：${minutes.overview || '暂无'}
- 已定决策：${minutes.decisions.join('；') || '暂无'}
- 待定问题：${minutes.openQuestions.join('；') || '暂无'}
- 行动项：${
        minutes.actionItems.length > 0
          ? minutes.actionItems
              .map((item) => `${item.owner || '待定'}｜${item.task}${item.due ? `｜${item.due}` : ''}`)
              .join('；')
          : '暂无'
      }
${
  minutes.topics.length > 0
    ? minutes.topics
        .map(
          (topic) =>
            `- ${topic.topic}：${topic.points.join('；') || '暂无'}${
              topic.conclusion ? `（结论：${topic.conclusion}）` : ''
            }`,
        )
        .join('\n')
    : '- 议题：暂无'
}`
    : '暂无'

  const snapshotSection =
    session.analysisSnapshots.length > 0
      ? session.analysisSnapshots
          .map((snapshot) => {
            const nextAction =
              snapshot.phaseAnalysis.nextAction ||
              snapshot.phaseAnalysis.nextBestAction ||
              '继续推进当前讨论主线'
            const whyNow = snapshot.speakingHints.whyNow || '未提供'
            const mindMapTopic = snapshot.mindMapSnapshot?.topic ?? '未生成'

            return `### ${formatDateTime(snapshot.timestamp)}

- 阶段：${profile.phaseLabels[snapshot.phaseAnalysis.phase] ?? snapshot.phaseAnalysis.phase}
- 下一动作：${nextAction}
- 共识：${snapshot.consensusAnalysis.consensus.join('；') || '暂无'}
- 分歧：${snapshot.consensusAnalysis.tensions.join('；') || '暂无'}
- 缺口：${snapshot.consensusAnalysis.missing.join('；') || '暂无'}
- 动作类型：${snapshot.speakingHints.functionType}
- Why Now：${whyNow}
- 15 秒建议：${snapshot.speakingHints.hint15s}
- 30 秒建议：${snapshot.speakingHints.hint30s}
- 60 秒建议：${snapshot.speakingHints.hint60s}
- 导图主题：${mindMapTopic}`
          })
          .join('\n\n')
      : '暂无'

  const markdown = `# ${session.title}

## 基本信息

- 开始时间：${formatDateTime(session.startedAt)}
- 结束时间：${formatDateTime(session.endedAt)}
- 会议场景：${profile.label}
- 转写片段数：${session.transcriptSegments.length}
- 分析快照数：${session.analysisSnapshots.length}
- 标记片段数：${session.pinnedSegments.length}

## 标记片段

${pinnedSection}

## 总结发言

${summarySection}

## 会议纪要

${minutesSection}

## 时间线快照

${snapshotSection}

## 完整转写

${transcriptSection}
`

  triggerDownload(
    markdown,
    `${sanitizeFileName(session.title)}.md`,
    'text/markdown;charset=utf-8',
  )
}
