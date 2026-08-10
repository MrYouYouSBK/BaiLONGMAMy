// Run: node src/test-offline-assistant.js

import assert from 'node:assert/strict'
import {
  OFFLINE_LITE_MODEL,
  buildOfflineReply,
  createOfflineStreamResult,
  evaluateOfflineExpression,
  isOfflineFallbackError,
} from './offline-assistant.js'
import { getProviderRuntimePolicy } from './runtime/provider-mode-policy.js'

const offlineRuntime = getProviderRuntimePolicy('offline')
assert.equal(offlineRuntime.runImmediateStartupTick, false, 'Offline Lite skips the no-op immediate startup Tick')
assert.equal(offlineRuntime.runStartupSelfCheck, false, 'Offline Lite skips model-driven startup self-checks')
assert.equal(offlineRuntime.runAwakeningTicks, false, 'Offline Lite skips rapid awakening heartbeats')

const onlineRuntime = getProviderRuntimePolicy('deepseek')
assert.equal(onlineRuntime.runImmediateStartupTick, true, 'model-backed providers retain startup behavior')
assert.equal(onlineRuntime.runStartupSelfCheck, true, 'model-backed providers retain startup self-checks')
assert.equal(onlineRuntime.runAwakeningTicks, true, 'model-backed providers retain awakening heartbeats')

assert.equal(evaluateOfflineExpression('(1250 + 88) * 3'), 4014)
assert.equal(evaluateOfflineExpression('2^3^2'), 512)
assert.throws(() => evaluateOfflineExpression('1 / 0'), /cannot divide by zero/)

const help = buildOfflineReply({ message: '帮助' })
assert.match(help, /不需要 API Key/)
assert.match(help, /基础计算/)

const calculation = buildOfflineReply({ message: '计算 (1250+88)*3' })
assert.match(calculation, /4014/)

const status = buildOfflineReply({ message: '当前是什么模式' })
assert.match(status, new RegExp(OFFLINE_LITE_MODEL))

const fallback = buildOfflineReply({
  message: '你好',
  fallbackError: Object.assign(new Error('insufficient_quota'), { status: 429 }),
})
assert.match(fallback, /切换到 GAI Offline Super/)
assert.equal(isOfflineFallbackError(Object.assign(new Error('payment required'), { status: 402 })), true)
assert.equal(isOfflineFallbackError(new Error('ordinary validation bug')), false)

const streamEvents = []
const streamed = await createOfflineStreamResult({
  message: '现在几点',
  now: new Date('2026-08-09T06:00:00.000Z'),
  onStream: event => streamEvents.push(event),
})
assert.match(streamed.content, /现在是/)
assert.deepEqual(streamEvents.map(event => event.event), ['start', 'chunk', 'end'])

const background = await createOfflineStreamResult({ message: 'TICK', enabled: false })
assert.equal(background.content, '', 'background turns stay silent in Offline Lite')

console.log('PASS: GAI Offline Super runs without an API key or an installed local model')
