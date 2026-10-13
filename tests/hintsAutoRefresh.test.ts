import assert from 'node:assert/strict'
import test from 'node:test'
import {
  HINTS_AUTO_REFRESH_MIN_INTERVAL_MS,
  hintsAutoRefreshDelayMs,
  shouldAutoRefreshHints,
  type HintsAutoRefreshInput,
} from '../shared/ui/store/hintsAutoRefresh'

const base: HintsAutoRefreshInput = {
  enabled: true,
  isStreaming: true,
  isPaused: false,
  isRefreshing: false,
  latestFinalSegmentAt: 10_000,
  hintsBasedOnSegmentAt: null,
  lastRequestedAt: null,
  now: 100_000,
}

test('first hints are requested as soon as a final segment exists', () => {
  assert.equal(shouldAutoRefreshHints(base), true)
  assert.equal(shouldAutoRefreshHints({ ...base, latestFinalSegmentAt: null }), false)
})

test('auto refresh respects the toggle, pause, stop and in-flight requests', () => {
  assert.equal(shouldAutoRefreshHints({ ...base, enabled: false }), false)
  assert.equal(shouldAutoRefreshHints({ ...base, isPaused: true }), false)
  assert.equal(shouldAutoRefreshHints({ ...base, isStreaming: false }), false)
  assert.equal(shouldAutoRefreshHints({ ...base, isRefreshing: true }), false)
})

test('auto refresh waits for new final speech', () => {
  assert.equal(
    shouldAutoRefreshHints({ ...base, hintsBasedOnSegmentAt: 10_000 }),
    false,
  )
  assert.equal(
    shouldAutoRefreshHints({ ...base, hintsBasedOnSegmentAt: 9_000 }),
    true,
  )
})

test('auto refresh is throttled to the minimum interval', () => {
  const lastRequestedAt = base.now - HINTS_AUTO_REFRESH_MIN_INTERVAL_MS + 1
  assert.equal(shouldAutoRefreshHints({ ...base, lastRequestedAt }), false)
  assert.equal(
    shouldAutoRefreshHints({
      ...base,
      lastRequestedAt: base.now - HINTS_AUTO_REFRESH_MIN_INTERVAL_MS,
    }),
    true,
  )
})

test('newer speech waits out the remainder of the interval instead of being dropped', () => {
  const lastRequestedAt = base.now - 5_000
  assert.equal(
    hintsAutoRefreshDelayMs({
      ...base,
      hintsBasedOnSegmentAt: 9_000,
      lastRequestedAt,
    }),
    HINTS_AUTO_REFRESH_MIN_INTERVAL_MS - 5_000,
  )
  assert.equal(
    hintsAutoRefreshDelayMs({ ...base, hintsBasedOnSegmentAt: 10_000, lastRequestedAt }),
    null,
  )
  assert.equal(
    hintsAutoRefreshDelayMs({
      ...base,
      hintsBasedOnSegmentAt: 9_000,
      isRefreshing: true,
    }),
    null,
  )
})
