import type { SpeakerProfile } from '../types/speaker'
import type { TranscriptSegment } from '../types/transcript'

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

const getSpeakerDisplayName = (
  speakerId: string,
  speakerProfiles: Record<string, SpeakerProfile>,
) => {
  const profile = speakerProfiles[speakerId]

  if (!profile) {
    return speakerId
  }

  if (profile.isMe) {
    return profile.displayName ? `我 · ${profile.displayName}` : '我'
  }

  return profile.displayName ?? speakerId
}

export const exportLiveTranscriptAsTxt = (
  segments: TranscriptSegment[],
  speakerProfiles: Record<string, SpeakerProfile>,
) => {
  const exportedAt = Date.now()
  const lines = segments
    .filter((segment) => segment.text.trim().length > 0)
    .map((segment) => {
      const status = segment.isFinal ? '最终' : '中间'
      const speaker = getSpeakerDisplayName(segment.speaker, speakerProfiles)
      return `${formatDateTime(segment.timestamp)} | ${speaker} | ${status} | ${segment.text}`
    })

  const content = [
    `实时讨论转写导出`,
    `导出时间：${formatDateTime(exportedAt)}`,
    `片段数：${lines.length}`,
    '',
    ...lines,
    '',
  ].join('\n')

  triggerDownload(
    content,
    `${sanitizeFileName(`live-transcript-${formatDateTime(exportedAt)}`)}.txt`,
    'text/plain;charset=utf-8',
  )
}
