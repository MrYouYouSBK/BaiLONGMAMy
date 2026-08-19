import os from 'node:os'
import { execFileSync } from 'node:child_process'

const LOOPBACK_HOST = '127.0.0.1'
const LOCAL_HOSTS = new Set([LOOPBACK_HOST, 'localhost'])

function localURL(port, pathSegments) {
  const url = new URL('http://localhost')
  url.hostname = LOOPBACK_HOST
  url.port = String(port)
  url.pathname = `/${pathSegments.join('/')}`
  return url.toString().replace(/\/$/, '')
}

function localEndpoint({ id, label, port, probePath, priority }) {
  return Object.freeze({
    id,
    label,
    url: localURL(port, probePath),
    baseURL: localURL(port, ['v1']),
    priority,
  })
}

const ENDPOINTS = Object.freeze([
  localEndpoint({ id: 'ollama', label: 'Ollama', port: 11434, probePath: ['api', 'tags'], priority: 20 }),
  localEndpoint({ id: 'lmstudio', label: 'LM Studio', port: 1234, probePath: ['v1', 'models'], priority: 30 }),
  localEndpoint({ id: 'mlx', label: 'MLX / llama.cpp', port: 8080, probePath: ['v1', 'models'], priority: 10 }),
])

function macCpuBrand() {
  if (process.platform !== 'darwin') return ''
  try { return execFileSync('/usr/sbin/sysctl', ['-n', 'machdep.cpu.brand_string'], { encoding: 'utf8', timeout: 1200, windowsHide: true }).trim() }
  catch { return '' }
}

export function getLocalHardwareProfile() {
  const cpus = os.cpus()
  const cpu = macCpuBrand() || cpus[0]?.model?.trim() || 'Unknown CPU'
  const appleChip = cpu.match(/Apple\s+M\d+(?:\s+(?:Pro|Max|Ultra))?/i)?.[0] || null
  const logicalCores = Math.max(1, cpus.length)
  const memoryGB = Math.round(os.totalmem() / (1024 ** 3))
  return {
    platform: process.platform,
    arch: process.arch,
    cpu,
    appleSilicon: process.platform === 'darwin' && process.arch === 'arm64',
    appleChip,
    logicalCores,
    inferenceThreads: Math.max(2, logicalCores - 2),
    memoryGB,
    acceleration: appleChip ? ['Metal', 'MLX', 'Accelerate', 'on-device Speech'] : [],
  }
}

export function recommendMlxModel(memoryGB = 0) {
  const memory = Math.max(0, Number(memoryGB) || 0)
  if (memory >= 32) return 'mlx-community/Qwen3-14B-4bit'
  if (memory >= 16) return 'mlx-community/Qwen3-8B-4bit'
  return 'mlx-community/Llama-3.2-3B-Instruct-4bit'
}

function modelNames(endpoint, data) {
  const raw = endpoint.id === 'ollama' ? data?.models : data?.data
  return (Array.isArray(raw) ? raw : []).map(item => String(item?.name || item?.model || item?.id || '').trim()).filter(Boolean)
}

async function probe(endpoint, fetchImpl) {
  try {
    const target = new URL(endpoint.url)
    if (target.protocol !== 'http:' || !LOCAL_HOSTS.has(target.hostname) || target.username || target.password) {
      throw new Error('Local model discovery only permits credential-free loopback endpoints')
    }
    const response = await fetchImpl(target.toString(), {
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(1600),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return { ...endpoint, available: true, models: modelNames(endpoint, await response.json()) }
  } catch (error) { return { ...endpoint, available: false, models: [], error: error?.message || String(error) } }
}

export async function discoverLocalAI({ fetchImpl = fetch, hardwareProfile = null } = {}) {
  const hardware = hardwareProfile || getLocalHardwareProfile()
  const providers = await Promise.all(ENDPOINTS.map(endpoint => probe(endpoint, fetchImpl)))
  const available = providers.filter(item => item.available)
  const ranked = [...available].sort((left, right) => {
    if (hardware.appleSilicon) return left.priority - right.priority
    if (left.id === 'ollama') return -1
    if (right.id === 'ollama') return 1
    return left.priority - right.priority
  })
  const preferred = ranked.find(item => item.models.length) || ranked[0] || null
  return {
    available: available.length > 0,
    providers,
    recommended: preferred ? { id: preferred.id, label: preferred.label, baseURL: preferred.baseURL, model: preferred.models[0] || '' } : null,
    hardware,
    mlxRecommendation: hardware.appleSilicon ? recommendMlxModel(hardware.memoryGB) : null,
    checkedAt: new Date().toISOString(),
  }
}
