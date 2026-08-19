import assert from 'node:assert/strict'
import { discoverLocalAI, recommendMlxModel } from './local-ai-discovery.js'

function localURL(port, pathSegments) {
  const url = new URL('http://localhost')
  url.hostname = '127.0.0.1'
  url.port = String(port)
  url.pathname = `/${pathSegments.join('/')}`
  return url.toString()
}

const responses = new Map([
  [localURL(11434, ['api', 'tags']), { models: [{ name: 'qwen3:8b' }] }],
  [localURL(8080, ['v1', 'models']), { data: [{ id: 'mlx-community/Qwen3-8B' }] }],
])
const fetchImpl = async url => ({
  ok: responses.has(url),
  status: responses.has(url) ? 200 : 503,
  json: async () => responses.get(url) || {},
})

const localAI = await discoverLocalAI({
  fetchImpl,
  hardwareProfile: {
    platform: 'darwin', arch: 'arm64', cpu: 'Apple M5 Max', appleSilicon: true,
    appleChip: 'Apple M5 Max', logicalCores: 16, inferenceThreads: 14, memoryGB: 64,
    acceleration: ['Metal', 'MLX', 'Accelerate', 'on-device Speech'],
  },
})

assert.equal(localAI.available, true)
assert.equal(localAI.hardware.appleChip, 'Apple M5 Max')
assert.equal(localAI.hardware.inferenceThreads, 14)
assert.equal(localAI.recommended.id, 'mlx')
assert.equal(localAI.recommended.model, 'mlx-community/Qwen3-8B')
assert.equal(localAI.mlxRecommendation, 'mlx-community/Qwen3-14B-4bit')
assert.equal(recommendMlxModel(8), 'mlx-community/Llama-3.2-3B-Instruct-4bit')
assert.equal(recommendMlxModel(16), 'mlx-community/Qwen3-8B-4bit')
assert.equal(recommendMlxModel(32), 'mlx-community/Qwen3-14B-4bit')
assert.deepEqual(localAI.providers.find(item => item.id === 'lmstudio').models, [])

console.log('GAI AI local-model discovery checks passed')
