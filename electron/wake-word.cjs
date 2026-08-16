const { utilityProcess } = require('electron')
const path = require('path')

let child = null
let spawned = false
let ready = false
let onHit = null
let onStatus = null
let initOptions = null
let restartTimer = null
let restartAttempt = 0
let config = { enabled: true, trigger: 'phrase', doubleClapEnabled: false }
let noiseFloor = 0.012
let lastTransientAt = 0

function resolveModelDir(codeRoot) {
  const base = codeRoot.endsWith('.asar') ? codeRoot.replace(/\.asar$/, '.asar.unpacked') : codeRoot
  return path.join(base, 'src', 'voice', 'kws-model')
}
function emitStatus(status, detail = '') { try { onStatus?.({ status, detail, enabled: config.enabled, ready }) } catch {} }
function sendInit() {
  if (!child || !initOptions) return
  try { child.postMessage({ type: 'init', modelDir: resolveModelDir(initOptions.codeRoot), logFile: path.join(initOptions.logDir, 'wake-word.log'), numThreads: Math.max(1, Math.min(4, Number(initOptions.numThreads) || 2)) }) }
  catch (error) { emitStatus('error', error?.message || String(error)) }
}
function scheduleRestart() {
  if (!config.enabled || restartTimer || !initOptions) return
  const delay = Math.min(30000, 1000 * (2 ** Math.min(restartAttempt, 5)))
  restartAttempt += 1
  restartTimer = setTimeout(() => { restartTimer = null; spawnChild() }, delay)
  restartTimer.unref?.()
  emitStatus('restarting', `retry in ${delay}ms`)
}
function spawnChild() {
  if (child || !config.enabled || !initOptions) return Boolean(child)
  try {
    child = utilityProcess.fork(path.join(__dirname, 'kws-process.cjs'), [], { stdio: 'inherit', serviceName: 'gai-ai-kws' })
    child.on('message', msg => {
      if (!msg) return
      if (msg.type === 'booted') sendInit()
      else if (msg.type === 'ready') { ready = true; restartAttempt = 0; emitStatus('ready', 'offline keyword model ready') }
      else if (msg.type === 'error') { ready = msg.recoverable === true; emitStatus(msg.recoverable ? 'recovering' : 'error', msg.error); if (!msg.recoverable) { try { child?.kill() } catch {} } }
      else if (msg.type === 'hit' && config.trigger !== 'sound') { try { onHit?.({ trigger: 'phrase', keyword: msg.keyword, at: msg.at || Date.now() }) } catch {} }
    })
    child.on('exit', code => { child = null; spawned = false; ready = false; emitStatus('stopped', `worker exit ${code}`); scheduleRestart() })
    spawned = true
    emitStatus('starting', 'launching offline wake model')
    return true
  } catch (error) { child = null; spawned = false; ready = false; emitStatus('error', error?.message || String(error)); scheduleRestart(); return false }
}
function initWakeWord({ codeRoot, logDir, numThreads, wakeConfig } = {}) {
  initOptions = { codeRoot, logDir, numThreads }
  if (wakeConfig) setConfig(wakeConfig)
  return config.enabled ? spawnChild() : false
}
function detectDoubleClap(samples) {
  if (!samples?.length) return false
  let peak = 0, energy = 0
  for (const sample of samples) { const value = Math.abs(sample); peak = Math.max(peak, value); energy += value * value }
  const rms = Math.sqrt(energy / samples.length)
  const transient = peak >= Math.max(0.32, noiseFloor * 8) && rms >= Math.max(0.035, noiseFloor * 2.6)
  if (!transient) { noiseFloor = Math.max(0.004, Math.min(0.08, noiseFloor * 0.96 + rms * 0.04)); return false }
  const now = Date.now(), delta = now - lastTransientAt
  if (delta >= 220 && delta <= 1100) { lastTransientAt = 0; try { onHit?.({ trigger: 'double-clap', keyword: 'double-clap', at: now }) } catch {}; return true }
  if (delta > 160) lastTransientAt = now
  return false
}
function feedPcm(buffer) {
  if (!config.enabled || !buffer) return
  let ab = null
  if (buffer instanceof ArrayBuffer) ab = buffer
  else if (ArrayBuffer.isView(buffer)) ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  else return
  if (config.doubleClapEnabled) detectDoubleClap(new Float32Array(ab))
  if (!child || !ready) return
  try { child.postMessage({ type: 'pcm', buf: ab }) } catch {}
}
function setConfig(next = {}) {
  const trigger = next.trigger || config.trigger || 'phrase'
  const enabled = Object.prototype.hasOwnProperty.call(next, 'enabled') ? next.enabled !== false : config.enabled
  const doubleClapEnabled = trigger === 'sound' || trigger === 'double-clap'
    || (Object.prototype.hasOwnProperty.call(next, 'doubleClapEnabled') ? next.doubleClapEnabled === true : config.doubleClapEnabled)
  config = { enabled, trigger, doubleClapEnabled }
  if (!config.enabled) stop()
  else if (initOptions && !child) spawnChild()
  return { ...config, ready }
}
function stop() {
  if (restartTimer) { clearTimeout(restartTimer); restartTimer = null }
  ready = false; spawned = false
  if (child) { const target = child; child = null; try { target.kill() } catch {} }
  emitStatus('disabled')
}
function isEnabled() { return config.enabled && spawned }
function getStatus() { return { ...config, spawned, ready } }
function setOnHit(cb) { onHit = cb }
function setOnStatus(cb) { onStatus = cb }
module.exports = { initWakeWord, feedPcm, getStatus, isEnabled, setConfig, setOnHit, setOnStatus, stop }
