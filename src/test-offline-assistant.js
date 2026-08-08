// Run: node src/test-offline-assistant.js

import assert from 'node:assert/strict'
import {
  OFFLINE_LITE_MODEL,
  buildOfflineReply,
  createOfflineStreamResult,
  evaluateOfflineExpression,
  isOfflineFallbackError,
} from './offline-assistant.js'

assert.equal(evaluateOfflineExpression('(1250 + 88) * 3'), 4014)
assert.equal(evaluateOfflineExpression('2^3^2'), 512)
assert.throws(() => evaluateOfflineExpression('1 / 0'), /不能除以零/)

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
assert.match(fallback, /自动切换到离线基础模式/)
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

console.log('PASS: Offline Lite runs without an API key or an installed local model')
