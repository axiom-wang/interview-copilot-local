import type { SessionRecord } from '../../meeting/types/session'

export const formatSessionDuration = (session: SessionRecord) => {
  const minutes = Math.round((session.endedAt - session.startedAt) / 60_000)
  return minutes < 1 ? '不足 1 分钟' : `${minutes} 分钟`
}
