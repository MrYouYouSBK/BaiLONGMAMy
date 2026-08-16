const fs = require('fs')
const path = require('path')

const KEYWORDS_THRESHOLD = 0.35
const KEYWORDS_SCORE = 3.0
const COOLDOWN_MS = 800
let spotter = null
let stream = null
let logFile = null
let lastHitAt = 0
let initialized = false
const parentPort = process.parentPort

function post(message) { try { parentPort?.postMessage(message) } catch {} }
function appendLog(message) {
  try {
    if (!logFile) return
    fs.mkdirSync(path.dirname(logFile), { recursive: true })
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${message}\n`, 'utf8')
  } catch {}
}

function requiredModelPaths(modelDir) {
  return {
    encoder: path.join(modelDir, 'encoder-epoch-13-avg-2-chunk-16-left-64.int8.onnx'),
    decoder: path.join(modelDir, 'decoder-epoch-13-avg-2-chunk-16-left-64.onnx'),
    joiner: path.join(modelDir, 'joiner-epoch-13-avg-2-chunk-16-left-64.int8.onnx'),
    tokens: path.join(modelDir, 'tokens.txt'),
    keywords: path.join(modelDir, 'keywords.txt'),
  }
}

function initialize(message) {
  if (initialized) return
  logFile = message.logFile || null
  try {
    const files = requiredModelPaths(String(message.modelDir || ''))
    for (const [label, filename] of Object.entries(files)) if (!fs.existsSync(filename)) throw new Error(`Missing ${label} model file: ${filename}`)
    const sherpa = require('sherpa-onnx-node')
    spotter = new sherpa.KeywordSpotter({
      featConfig: { sampleRate: 16000, featureDim: 80 },
      modelConfig: {
        transducer: { encoder: files.encoder, decoder: files.decoder, joiner: files.joiner },
        tokens: files.tokens,
        numThreads: Math.max(1, Math.min(4, Number(message.numThreads) || 2)),
        provider: 'cpu',
        debug: 0,
      },
      maxActivePaths: 4,
      numTrailingBlanks: 1,
      keywordsScore: KEYWORDS_SCORE,
      keywordsThreshold: KEYWORDS_THRESHOLD,
      keywordsFile: files.keywords,
    })
    stream = spotter.createStream()
    initialized = true
    appendLog(`ready model=${message.modelDir}`)
    post({ type: 'ready', sampleRate: 16000 })
  } catch (error) {
    spotter = null; stream = null; initialized = false
    const detail = error?.stack || error?.message || String(error)
    appendLog(`init-error ${detail}`)
    post({ type: 'error', error: detail })
  }
}

function consumePcm(rawBuffer) {
  if (!initialized || !spotter || !stream || !rawBuffer) return
  try {
    const samples = rawBuffer instanceof Float32Array ? rawBuffer : new Float32Array(rawBuffer instanceof ArrayBuffer ? rawBuffer : rawBuffer.buffer)
    if (!samples.length) return
    stream.acceptWaveform({ sampleRate: 16000, samples })
    let iterations = 0
    while (spotter.isReady(stream) && iterations < 128) {
      spotter.decode(stream)
      iterations += 1
      const keyword = String(spotter.getResult(stream)?.keyword || '').trim()
      if (!keyword) continue
      const now = Date.now()
      spotter.reset(stream)
      if (now - lastHitAt < COOLDOWN_MS) continue
      lastHitAt = now
      appendLog(`hit keyword=${keyword}`)
      post({ type: 'hit', keyword, at: now })
    }
  } catch (error) {
    const detail = error?.stack || error?.message || String(error)
    appendLog(`decode-error ${detail}`)
    post({ type: 'error', error: detail, recoverable: true })
    try { spotter?.reset(stream) } catch {}
  }
}

parentPort?.on('message', event => {
  const message = event?.data || event
  if (message?.type === 'init') initialize(message)
  else if (message?.type === 'pcm') consumePcm(message.buf)
  else if (message?.type === 'reset') { try { spotter?.reset(stream) } catch {} }
})
process.on('uncaughtException', error => { const detail = error?.stack || error?.message || String(error); appendLog(`uncaught ${detail}`); post({ type: 'error', error: detail }) })
post({ type: 'booted' })
