export const HINTS_AUTO_REFRESH_MIN_INTERVAL_MS = 20_000
export const HINTS_AUTO_REFRESH_STORAGE_KEY = 'interview-copilot-local/hints-auto-refresh'

export interface HintsAutoRefreshInput {
  enabled: boolean
  isStreaming: boolean
  isPaused: boolean
  isRefreshing: boolean
  /** Timestamp of the newest final transcript segment, if any. */
  latestFinalSegmentAt: number | null
  /** Timestamp of the newest final segment included in the current hints. */
  hintsBasedOnSegmentAt: number | null
  /** Wall-clock time of the last hints request. */
  lastRequestedAt: number | null
  now: number
}

/**
 * How long to wait before refreshing hints.
 * `0` means refresh now, `null` means there is nothing to follow up.
 */
export const hintsAutoRefreshDelayMs = ({
  enabled,
  isStreaming,
  isPaused,
  isRefreshing,
  latestFinalSegmentAt,
  hintsBasedOnSegmentAt,
  lastRequestedAt,
  now,
}: HintsAutoRefreshInput) => {
  if (!enabled || !isStreaming || isPaused || isRefreshing) {
    return null
  }

  if (latestFinalSegmentAt === null) {
    return null
  }

  if (hintsBasedOnSegmentAt !== null && latestFinalSegmentAt <= hintsBasedOnSegmentAt) {
    return null
  }

  if (lastRequestedAt === null) {
    return 0
  }

  const elapsed = now - lastRequestedAt
  if (elapsed >= HINTS_AUTO_REFRESH_MIN_INTERVAL_MS) {
    return 0
  }

  return HINTS_AUTO_REFRESH_MIN_INTERVAL_MS - elapsed
}

export const shouldAutoRefreshHints = (input: HintsAutoRefreshInput) =>
  hintsAutoRefreshDelayMs(input) === 0

export const readHintsAutoRefresh = () => {
  try {
    return window.localStorage.getItem(HINTS_AUTO_REFRESH_STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

export const persistHintsAutoRefresh = (enabled: boolean) => {
  try {
    window.localStorage.setItem(HINTS_AUTO_REFRESH_STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    // The toggle still applies for this session when storage is unavailable.
  }
}
