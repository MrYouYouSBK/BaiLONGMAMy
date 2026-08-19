import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { paths } from './paths.js'
import { getLocalHardwareProfile, recommendMlxModel } from './local-ai-discovery.js'
import { saveLLMSettings } from './config.js'

const HOST = '127.0.0.1'
const PORT = 8080
const BASE_URL = `http://${HOST}:${PORT}/v1`
const runtimeRoot = path.join(paths.dataDir, 'mlx-runtime')
const venvRoot = path.join(runtimeRoot, 'venv')
const settingsFile = path.join(runtimeRoot, 'settings.json')
const venvPython = path.join(venvRoot, 'bin', 'python3')
const venvServer = path.join(venvRoot, 'bin', 'mlx_lm.server')
const uvRoot = path.join(runtimeRoot, 'bootstrap')
const uvBinary = path.join(uvRoot, 'uv')
const UV_VERSION = '0.12.5'
const UV_ARCHIVE_URL = `https://releases.astral.sh/github/uv/releases/download/${UV_VERSION}/uv-aarch64-apple-darwin.tar.gz`
const UV_ARCHIVE_SHA256 = '5bb0e5fe008a773c3dbcb97ff79cd89e1241464fe9d2f986d52ad8f1b037bd62'
const MAX_BOOTSTRAP_BYTES = 64 * 1024 * 1024

let serverProcess = null
let installPromise = null
let probeTimer = null
let runtimeState = 'stopped'
let lastError = ''
let lastLog = ''
let activationPromise = null

function terminateManagedChildOnExit() {
  clearProbeTimer()
  const child = serverProcess
  serverProcess = null
  if (!child || child.killed) return
  try { child.kill('SIGTERM') } catch {}
}

process.once('exit', terminateManagedChildOnExit)
process.once('SIGINT', () => {
  terminateManagedChildOnExit()
  process.exit(130)
})
process.once('SIGTERM', () => {
  terminateManagedChildOnExit()
  process.exit(143)
})

function supportedHardware() {
  return process.platform === 'darwin' && process.arch === 'arm64'
}

function readSettings() {
  try {
    const value = JSON.parse(fs.readFileSync(settingsFile, 'utf8'))
    return value && typeof value === 'object' ? value : {}
  } catch { return {} }
}

function writeSettings(updates = {}) {
  const next = { ...readSettings(), ...updates }
  fs.mkdirSync(runtimeRoot, { recursive: true })
  const temporary = `${settingsFile}.tmp-${process.pid}`
  fs.writeFileSync(temporary, JSON.stringify(next, null, 2), 'utf8')
  fs.renameSync(temporary, settingsFile)
  return next
}

function safeModelId(value, fallback) {
  const model = String(value || fallback || '').trim()
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(model)) throw new Error('MLX model must be a valid Hugging Face repository id')
  return model
}

function appendLog(chunk) {
  const text = String(chunk || '').trim()
  if (!text) return
  lastLog = `${lastLog}\n${text}`.trim().slice(-4000)
}

function commandWorks(command, args = ['--version']) {
  try {
    const result = spawnSync(command, args, { encoding: 'utf8', timeout: 5000, windowsHide: true })
    return result.status === 0
  } catch { return false }
}

function findFile(root, filename, depth = 0) {
  if (depth > 4) return null
  let entries = []
  try { entries = fs.readdirSync(root, { withFileTypes: true }) } catch { return null }
  const direct = entries.find(entry => entry.isFile() && entry.name === filename)
  if (direct) return path.join(root, direct.name)
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const found = findFile(path.join(root, entry.name), filename, depth + 1)
    if (found) return found
  }
  return null
}

async function installVerifiedUv() {
  if (commandWorks(uvBinary)) return uvBinary
  runtimeState = 'installing'
  appendLog(`Downloading verified uv ${UV_VERSION} bootstrap from Astral (Apple Silicon).`)
  const response = await fetch(UV_ARCHIVE_URL, {
    redirect: 'follow',
    signal: AbortSignal.timeout(120_000),
    headers: { 'User-Agent': 'GAI-AI-MLX-Bootstrap/3.3' },
  })
  if (!response.ok) throw new Error(`Could not download the MLX bootstrap (HTTP ${response.status})`)
  const finalURL = new URL(response.url)
  if (finalURL.protocol !== 'https:' || !(finalURL.hostname === 'releases.astral.sh' || finalURL.hostname === 'github.com' || finalURL.hostname.endsWith('.githubusercontent.com'))) {
    throw new Error(`MLX bootstrap redirected to an untrusted host: ${finalURL.hostname}`)
  }
  const declaredBytes = Number(response.headers.get('content-length') || 0)
  if (declaredBytes > MAX_BOOTSTRAP_BYTES) throw new Error('MLX bootstrap download exceeded the safe size limit')
  const archive = Buffer.from(await response.arrayBuffer())
  if (archive.length === 0 || archive.length > MAX_BOOTSTRAP_BYTES) throw new Error('MLX bootstrap download has an invalid size')
  const actualHash = crypto.createHash('sha256').update(archive).digest('hex')
  if (actualHash !== UV_ARCHIVE_SHA256) throw new Error(`MLX bootstrap SHA-256 verification failed (received ${actualHash})`)

  fs.mkdirSync(runtimeRoot, { recursive: true })
  const archivePath = path.join(runtimeRoot, `uv-${process.pid}.tar.gz`)
  const extractRoot = path.join(runtimeRoot, `uv-extract-${process.pid}`)
  try {
    fs.writeFileSync(archivePath, archive, { mode: 0o600 })
    fs.rmSync(extractRoot, { recursive: true, force: true })
    fs.mkdirSync(extractRoot, { recursive: true })
    await runChild('/usr/bin/tar', ['-xzf', archivePath, '-C', extractRoot], 'installing')
    const extractedUv = findFile(extractRoot, 'uv')
    if (!extractedUv) throw new Error('Verified MLX bootstrap archive did not contain uv')
    fs.mkdirSync(uvRoot, { recursive: true })
    fs.copyFileSync(extractedUv, uvBinary)
    fs.chmodSync(uvBinary, 0o700)
    if (!commandWorks(uvBinary)) throw new Error('Verified MLX bootstrap could not run on this Mac')
    appendLog(`Verified uv ${UV_VERSION} bootstrap installed.`)
    return uvBinary
  } finally {
    try { fs.unlinkSync(archivePath) } catch {}
    fs.rmSync(extractRoot, { recursive: true, force: true })
  }
}

function mlxInstalled() {
  return fs.existsSync(venvPython) && commandWorks(venvPython, ['-c', 'import mlx, mlx_lm'])
}

function mlxEnvironment() {
  return {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    HF_HUB_DISABLE_TELEMETRY: '1',
    DO_NOT_TRACK: '1',
    HF_HOME: path.join(runtimeRoot, 'models'),
    UV_CACHE_DIR: path.join(runtimeRoot, 'cache'),
    UV_PYTHON_INSTALL_DIR: path.join(runtimeRoot, 'python'),
    UV_MANAGED_PYTHON: '1',
  }
}

function runChild(command, args, stateLabel) {
  return new Promise((resolve, reject) => {
    runtimeState = stateLabel
    lastError = ''
    const child = spawn(command, args, {
      cwd: runtimeRoot,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: mlxEnvironment(),
    })
    child.stdout.on('data', appendLog)
    child.stderr.on('data', appendLog)
    child.once('error', reject)
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${path.basename(command)} exited with code ${code}: ${lastLog.slice(-1200)}`)))
  })
}

async function probeServer() {
  try {
    const response = await fetch(`${BASE_URL}/models`, { redirect: 'error', signal: AbortSignal.timeout(1800) })
    if (!response.ok) return null
    const data = await response.json()
    const models = (Array.isArray(data?.data) ? data.data : []).map(item => String(item?.id || '').trim()).filter(Boolean)
    return { available: true, models }
  } catch { return null }
}

function activateLocalModel(model) {
  if (activationPromise) return activationPromise
  activationPromise = saveLLMSettings({ provider: 'custom', apiKey: 'none', model, baseURL: BASE_URL })
    .then(() => appendLog(`GAI AI reasoning is now using local MLX model ${model}.`))
    .catch(error => {
      lastError = `MLX is running, but automatic model activation failed: ${error?.message || error}`
      appendLog(lastError)
    })
    .finally(() => { activationPromise = null })
  return activationPromise
}

function clearProbeTimer() {
  if (probeTimer) clearInterval(probeTimer)
  probeTimer = null
}

function startReadinessProbe() {
  clearProbeTimer()
  const check = async () => {
    if (!serverProcess) return clearProbeTimer()
    const available = await probeServer()
    if (available) {
      runtimeState = 'running'
      lastError = ''
      clearProbeTimer()
      const model = available.models[0] || readSettings().model
      if (model) activateLocalModel(model)
    }
  }
  check()
  probeTimer = setInterval(check, 2000)
  probeTimer.unref?.()
}

export function getManagedMlxStatus() {
  const hardware = getLocalHardwareProfile()
  const settings = readSettings()
  const recommendedModel = recommendMlxModel(hardware.memoryGB)
  return {
    supported: supportedHardware(),
    installed: mlxInstalled(),
    managed: Boolean(serverProcess),
    state: runtimeState,
    pid: serverProcess?.pid || null,
    model: settings.model || recommendedModel,
    recommendedModel,
    autoStart: settings.autoStart === true,
    baseURL: BASE_URL,
    hardware,
    lastError,
    lastLog,
  }
}

export function installManagedMlx({ model, startAfterInstall = true } = {}) {
  if (!supportedHardware()) throw new Error('Managed MLX requires an Apple Silicon Mac')
  const hardware = getLocalHardwareProfile()
  const selectedModel = safeModelId(model, recommendMlxModel(hardware.memoryGB))
  writeSettings({ model: selectedModel, autoStart: startAfterInstall === true })
  if (installPromise) return getManagedMlxStatus()

  installPromise = (async () => {
    try {
      fs.mkdirSync(runtimeRoot, { recursive: true })
      const uv = await installVerifiedUv()
      if (!fs.existsSync(venvPython)) {
        await runChild(uv, ['venv', '--python', '3.12', venvRoot], 'installing')
      }
      await runChild(uv, ['pip', 'install', '--python', venvPython, '--upgrade', 'mlx-lm'], 'installing')
      runtimeState = 'installed'
      if (startAfterInstall) await startManagedMlx({ model: selectedModel, autoStart: true })
    } catch (error) {
      runtimeState = 'error'
      lastError = error?.message || String(error)
      appendLog(lastError)
    } finally { installPromise = null }
  })()
  return getManagedMlxStatus()
}

export async function startManagedMlx({ model, autoStart = true } = {}) {
  if (!supportedHardware()) throw new Error('Managed MLX requires an Apple Silicon Mac')
  const hardware = getLocalHardwareProfile()
  const selectedModel = safeModelId(model, readSettings().model || recommendMlxModel(hardware.memoryGB))
  if (!mlxInstalled()) throw new Error('MLX runtime is not installed yet')

  const existing = await probeServer()
  if (existing) {
    runtimeState = serverProcess ? 'running' : 'external-running'
    const activeModel = existing.models[0] || selectedModel
    writeSettings({ model: activeModel, autoStart: autoStart === true })
    activateLocalModel(activeModel)
    return getManagedMlxStatus()
  }
  if (serverProcess) return getManagedMlxStatus()

  fs.mkdirSync(runtimeRoot, { recursive: true })
  writeSettings({ model: selectedModel, autoStart: autoStart === true })
  runtimeState = 'starting'
  lastError = ''
  lastLog = `Loading ${selectedModel} with MLX Metal acceleration. The first start downloads the model into the local cache.`
  const command = fs.existsSync(venvServer) ? venvServer : venvPython
  const args = fs.existsSync(venvServer)
    ? ['--model', selectedModel, '--host', HOST, '--port', String(PORT)]
    : ['-m', 'mlx_lm.server', '--model', selectedModel, '--host', HOST, '--port', String(PORT)]
  serverProcess = spawn(command, args, {
    cwd: runtimeRoot,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: mlxEnvironment(),
  })
  serverProcess.stdout.on('data', appendLog)
  serverProcess.stderr.on('data', appendLog)
  serverProcess.once('error', error => {
    lastError = error?.message || String(error)
    runtimeState = 'error'
  })
  serverProcess.once('exit', code => {
    serverProcess = null
    clearProbeTimer()
    if (runtimeState !== 'stopping') {
      runtimeState = code === 0 ? 'stopped' : 'error'
      if (code !== 0 && !lastError) lastError = `MLX server exited with code ${code}`
    } else runtimeState = 'stopped'
  })
  startReadinessProbe()
  return getManagedMlxStatus()
}

export function stopManagedMlx({ disableAutoStart = true } = {}) {
  if (disableAutoStart) writeSettings({ autoStart: false })
  clearProbeTimer()
  if (serverProcess) {
    runtimeState = 'stopping'
    const child = serverProcess
    try { child.kill('SIGTERM') } catch {}
    const timer = setTimeout(() => { if (serverProcess === child) try { child.kill('SIGKILL') } catch {} }, 5000)
    timer.unref?.()
  } else runtimeState = 'stopped'
  return getManagedMlxStatus()
}

export async function autoStartManagedMlx() {
  const settings = readSettings()
  if (!supportedHardware() || settings.autoStart !== true || !mlxInstalled()) return getManagedMlxStatus()
  try { return await startManagedMlx({ model: settings.model, autoStart: true }) }
  catch (error) {
    runtimeState = 'error'
    lastError = error?.message || String(error)
    return getManagedMlxStatus()
  }
}
