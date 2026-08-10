import { getTTSCredentials } from '../../config.js'
import { updateLastJarvisConversationContent } from '../../db.js'
import { emitEvent } from '../../events.js'
import { stripMarkdownForSpeech } from '../../capabilities/tools/media.js'
import { streamTTS, validateTTSConfig } from '../../voice/tts-providers.js'
import { getVoiceProfile, readVoiceProfileSample, saveVoiceProfileDataUrl } from '../../voice/voice-profile.js'
import { jsonResponse, readJsonBody } from '../utils.js'

export async function handleTTSRoutes(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/tts/voice-profile') {
    jsonResponse(res, 200, getVoiceProfile())
    return true
  }

  if (req.method === 'POST' && url.pathname === '/tts/voice-profile') {
    try {
      const body = await readJsonBody(req, { maxBytes: 14 * 1024 * 1024 })
      jsonResponse(res, 200, { ok: true, profile: saveVoiceProfileDataUrl(body.sample) })
    } catch (error) {
      jsonResponse(res, error.statusCode || 400, { ok: false, error: error.message })
    }
    return true
  }

  if (req.method === 'GET' && url.pathname === '/tts/voice-profile/sample') {
    const sample = readVoiceProfileSample()
    if (!sample) jsonResponse(res, 404, { ok: false, error: 'No voice sample' })
    else {
      res.writeHead(200, { 'Content-Type': sample.mimeType, 'Cache-Control': 'private, max-age=60' })
      res.end(sample.bytes)
    }
    return true
  }

  if (req.method === 'POST' && url.pathname === '/tts/stream') {
    try {
      const body = await readJsonBody(req)
      // Strip markdown at the synthesis boundary so TTS does not speak markup symbols.
      const text = stripMarkdownForSpeech(body.text)
      if (!text) {
        jsonResponse(res, 400, { ok: false, error: 'Missing text parameter' })
        return true
      }
      const creds = getTTSCredentials()
      // Preflight config so missing provider credentials produce an actionable response.
      const check = validateTTSConfig(creds)
      // A cloud option never gets to turn speech into silence: missing credentials
      // transparently fall back to the free OS voice.
      let selectedProvider = check.ok ? creds.provider : 'system'
      let selectedVoice = selectedProvider === 'system' ? 'system-auto' : (body.voiceId || creds.voiceId || undefined)
      const keys = {
          doubaoKey: creds.doubaoKey,
          doubaoAppId: creds.doubaoAppId,
          doubaoAccessKey: creds.doubaoAccessKey,
          doubaoResourceId: creds.doubaoResourceId,
          doubaoStyle: creds.doubaoStyle,
          doubaoSpeechRate: creds.doubaoSpeechRate,
          minimaxKey: creds.minimaxKey,
          openaiKey: creds.openaiKey,
          openaiBaseURL: creds.openaiBaseURL,
          elevenLabsKey: creds.elevenLabsKey,
          volcanoAppId: creds.volcanoAppId,
          volcanoToken: creds.volcanoToken,
      }
      let audioStream
      try {
        audioStream = await streamTTS({ text: text.slice(0, 800), provider: selectedProvider, voiceId: selectedVoice, keys })
      } catch (cloudError) {
        if (selectedProvider === 'system') throw cloudError
        console.warn(`[TTS] ${selectedProvider} unavailable; falling back to system voice:`, cloudError.message)
        selectedProvider = 'system'
        selectedVoice = 'system-auto'
        audioStream = await streamTTS({ text: text.slice(0, 800), provider: 'system', voiceId: selectedVoice, keys: {} })
      }
      let headersWritten = false
      let responseDone = false
      const finishRes = () => { if (!responseDone) { responseDone = true; res.end() } }
      const errorRes = (msg) => { if (!responseDone) { responseDone = true; jsonResponse(res, 500, { ok: false, error: msg }) } }
      let activeStreamId = 0
      const pipeStream = (stream, provider) => {
        const streamId = ++activeStreamId
        let sawData = false
        let settled = false
        const recoverOrFail = async (error) => {
          if (settled || streamId !== activeStreamId) return
          settled = true
          if (!headersWritten && provider !== 'system') {
            try {
              console.warn(`[TTS] ${provider} stream failed; falling back to system voice:`, error.message)
              selectedProvider = 'system'
              const fallback = await streamTTS({ text: text.slice(0, 800), provider: 'system', voiceId: 'system-auto', keys: {} })
              pipeStream(fallback, 'system')
              return
            } catch (fallbackError) { error = fallbackError }
          }
          if (!headersWritten) errorRes(error.message)
          else finishRes()
        }
        stream.on('data', chunk => {
          if (streamId !== activeStreamId || responseDone) return
          sawData = true
          if (!headersWritten) {
            headersWritten = true
            res.writeHead(200, {
              'Content-Type': stream.contentType || 'audio/mpeg',
              'Transfer-Encoding': 'chunked',
              'Cache-Control': 'no-cache',
              'Access-Control-Allow-Origin': '*',
              ...(provider !== creds.provider ? { 'X-GAI-TTS-Fallback': 'system' } : {}),
            })
          }
          res.write(chunk)
        })
        stream.on('end', () => {
          if (settled || streamId !== activeStreamId) return
          settled = true
          if (!sawData) {
            settled = false
            recoverOrFail(new Error('TTS synthesis returned no audio'))
          } else finishRes()
        })
        stream.on('error', error => recoverOrFail(error))
      }
      pipeStream(audioStream, selectedProvider)
    } catch (err) {
      console.warn('[TTS] Streaming synthesis failed:', err.message)
      if (!res.headersSent) jsonResponse(res, 500, { ok: false, error: err.message })
      else try { res.end() } catch {}
    }
    return true
  }

  if (req.method === 'POST' && url.pathname === '/tts/interrupted') {
    try {
      const body = await readJsonBody(req)
      const { spokenContent } = body
      if (typeof spokenContent !== 'string') {
        jsonResponse(res, 400, { error: 'spokenContent required' })
        return true
      }
      const updated = updateLastJarvisConversationContent(spokenContent)
      emitEvent('tts_interrupted', { spokenContent })
      jsonResponse(res, 200, { ok: true, updated })
    } catch (e) {
      jsonResponse(res, 500, { error: e.message })
    }
    return true
  }

  return false
}
