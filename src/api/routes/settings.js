import { emitEvent, setStickyEvent } from '../../events.js'
import { pushMessage } from '../../inbound-message.js'
import { restartConnector } from '../../social/index.js'
import { removeProvider, replaceProvider, setPreferredProvider } from '../../providers/registry.js'
import { MinimaxProvider } from '../../providers/minimax.js'
import { GeminiMediaProvider, OpenAICompatibleMediaProvider, StableDiffusionMediaProvider } from '../../providers/openai-media.js'
import {
  config,
  getActivationStatus,
  getEmbeddingConfig,
  getMinimaxKey,
  getNetworkConfig,
  getProviderSummaries,
  getSecurity,
  getSocialConfig,
  getTTSConfig,
  getVoiceConfig,
  getWebSearchConfig,
  saveLLMSettings,
  setEmbeddingConfig,
  setMinimaxKey,
  setNetworkConfig,
  setSecurity,
  setSocialConfig,
  setTemperature,
  setThinking,
  setTTSConfig,
  setVoiceConfig,
  setWebSearchConfig,
  switchModel,
  getSeedanceConfig,
  setSeedanceConfig,
} from '../../config.js'
import { EMBEDDING_PROVIDER_PRESETS } from '../../config.js'
import { TTS_PROVIDERS, TTS_VOICES } from '../../voice/tts-providers.js'
import { getAgentName, validateAgentName } from '../agent.js'
import { jsonResponse, readJsonBody } from '../utils.js'
import { setConfig, createReminder, cancelReminder, listPendingReminders } from '../../db.js'
import { getMapServiceSettings, setMapServiceSettings } from '../../map-service.js'
import { getCodexStatus, loginCodex } from '../../codex-connector.js'
import { discoverLocalAI } from '../../local-ai-discovery.js'
import { getMediaProviderRuntimeConfig, getMediaProviderSettings, setMediaProviderSettings } from '../../media-provider-config.js'

function checkLocalOrToken(req, res, url, requireLocalOrToken) {
  if (typeof requireLocalOrToken === 'function') return requireLocalOrToken(req, res, url)
  jsonResponse(res, 403, { ok: false, error: 'forbidden' })
  return false
}

export async function handleSettingsRoutes(req, res, url, { requireLocalOrToken, hasAllowedAccess } = {}) {
  if (req.method === 'GET' && url.pathname === '/settings/reminders') {
    jsonResponse(res, 200, { ok: true, reminders: listPendingReminders(100) })
    return true
  }

  if (req.method === 'POST' && url.pathname === '/settings/reminders') {
    try {
      const body = await readJsonBody(req)
      const task = String(body.task || '').trim()
      const due = new Date(String(body.dueAt || ''))
      if (!task) throw new Error('Task is required')
      if (Number.isNaN(due.getTime()) || due.getTime() <= Date.now()) throw new Error('Timeline must be a future date and time')
      const dueAt = due.toISOString()
      const systemMessage = `GAI AI reminder: ${task}. Complete every safe and authorized step you can automatically. Verify the result before reporting completion, follow up on unfinished dependencies, and ask the user for the next concrete action only when their input or permission is required.`
      const result = createReminder({ dueAt, task, systemMessage, source: 'gai-control-center' })
      jsonResponse(res, 200, { ok: true, id: Number(result.lastInsertRowid), dueAt, task })
    } catch (err) {
      jsonResponse(res, 400, { ok: false, error: err.message })
    }
    return true
  }

  if (req.method === 'POST' && url.pathname === '/settings/reminders/cancel') {
    try {
      const body = await readJsonBody(req)
      const id = Number(body.id)
      if (!Number.isInteger(id) || id <= 0) throw new Error('A valid reminder id is required')
      const result = cancelReminder(id)
      if (!result.changes) throw new Error(`Pending reminder #${id} was not found`)
      jsonResponse(res, 200, { ok: true, id })
    } catch (err) {
      jsonResponse(res, 400, { ok: false, error: err.message })
    }
    return true
  }

  if (req.method === 'GET' && url.pathname === '/settings/media-provider') {
    const media = getMediaProviderSettings()
    const minimaxConfigured = !!(globalThis.process?.env?.MINIMAX_API_KEY || getMinimaxKey())
    media.providers = media.providers.map(provider => provider.id === 'minimax' ? { ...provider, configured: minimaxConfigured } : provider)
    const seedance = getSeedanceConfig()
    media.seedance = {
      configured: seedance.configured,
      model: seedance.model,
      baseURL: seedance.baseURL,
    }
    media.videoProviders = media.videoProviders.map(provider => provider.id === 'seedance'
      ? { ...provider, configured: seedance.configured }
      : provider)
    jsonResponse(res, 200, { ok: true, media })
    return true
  }

  if (req.method === 'POST' && url.pathname === '/settings/media-provider') {
    try {
      const body = await readJsonBody(req)
      if (body.provider === 'minimax' && !(globalThis.process?.env?.MINIMAX_API_KEY || getMinimaxKey())) {
        throw new Error('MiniMax media requires a configured API key')
      }
      if (body.seedanceApiKey || body.seedanceModel || body.seedanceBaseURL) {
        setSeedanceConfig({ apiKey: body.seedanceApiKey, model: body.seedanceModel, baseURL: body.seedanceBaseURL })
      }
      setMediaProviderSettings(body)
      const runtime = getMediaProviderRuntimeConfig()
      removeProvider('openai-media')
      removeProvider('stable-diffusion')
      removeProvider('gemini-media')
      removeProvider('doubao-media')
      if (runtime.provider === 'openai-compatible' && runtime.openaiApiKey) {
        replaceProvider(new OpenAICompatibleMediaProvider({ apiKey: runtime.openaiApiKey, baseURL: runtime.openaiBaseURL, model: runtime.openaiModel }))
      }
      if (runtime.provider === 'stable-diffusion') {
        replaceProvider(new StableDiffusionMediaProvider({ baseURL: runtime.stableDiffusionBaseURL }))
      }
      if (runtime.provider === 'gemini' && runtime.geminiApiKey) {
        replaceProvider(new GeminiMediaProvider({ apiKey: runtime.geminiApiKey, model: runtime.geminiImageModel }))
      }
      if (runtime.provider === 'doubao' && runtime.doubaoApiKey && runtime.doubaoImageModel) {
        replaceProvider(new OpenAICompatibleMediaProvider({
          name: 'doubao-media', apiKey: runtime.doubaoApiKey,
          baseURL: runtime.doubaoBaseURL, model: runtime.doubaoImageModel,
        }))
      }
      const preferred = {
        minimax: 'minimax', 'openai-compatible': 'openai-media', 'stable-diffusion': 'stable-diffusion',
        gemini: 'gemini-media', doubao: 'doubao-media',
      }[runtime.provider]
      setPreferredProvider('image', preferred || '')
      const media = getMediaProviderSettings()
      const seedance = getSeedanceConfig()
      media.seedance = { configured: seedance.configured, model: seedance.model, baseURL: seedance.baseURL }
      media.videoProviders = media.videoProviders.map(item => item.id === 'seedance' ? { ...item, configured: seedance.configured } : item)
      jsonResponse(res, 200, { ok: true, media })
    } catch (err) {
      jsonResponse(res, 400, { ok: false, error: err.message })
    }
    return true
  }

  if (req.method === 'GET' && url.pathname === '/settings/local-ai') {
    jsonResponse(res, 200, { ok: true, localAI: await discoverLocalAI() })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/settings/codex') {
    jsonResponse(res, 200, { ok: true, codex: await getCodexStatus() })
    return true
  }

  if (req.method === 'POST' && url.pathname === '/settings/codex/login') {
    const codex = await loginCodex()
    jsonResponse(res, codex.ok ? 200 : 400, { ok: codex.ok, codex })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/settings') {
    const status = getActivationStatus()
    const minimaxKey = getMinimaxKey()
    jsonResponse(res, 200, {
      agent_name: getAgentName(),
      llm: {
        activated: status.activated,
        provider: status.provider,
        model: status.model,
        baseURL: status.baseURL,
        models: status.models,
        temperature: config.temperature,
        thinking: config.thinking === true,
        apiKey: config.apiKey || '',
      },
      providers: getProviderSummaries(),
      minimax: {
        configured: !!(globalThis.process?.env?.MINIMAX_API_KEY || minimaxKey),
      },
      network: getNetworkConfig(),
    })
    return true
  }

  if (req.method === 'POST' && url.pathname === '/settings/agent-name') {
    try {
      const { agentName, agent_name } = await readJsonBody(req)
      const trimmedName = validateAgentName(agentName ?? agent_name)
      if (trimmedName) setConfig('agent_name', trimmedName)
      const name = getAgentName()
      setStickyEvent('agent_name_updated', { name })
      emitEvent('agent_name_updated', { name })
      jsonResponse(res, 200, { ok: true, agent_name: name })
    } catch (err) {
      jsonResponse(res, 400, { ok: false, error: err.message })
    }
    return true
  }

  if (req.method === 'POST' && url.pathname === '/settings/model') {
    try {
      const { provider, apiKey, model, baseURL } = await readJsonBody(req)
      const result = provider || apiKey || baseURL
        ? await saveLLMSettings({ provider, apiKey, model, baseURL })
        : switchModel(model)
      emitEvent('model_switched', result)
      jsonResponse(res, 200, { ok: true, ...result })
    } catch (err) {
      jsonResponse(res, 400, { ok: false, error: err.message })
    }
    return true
  }

  if (req.method === 'POST' && url.pathname === '/settings/temperature') {
    try {
      const { temperature } = await readJsonBody(req)
      const result = setTemperature(temperature)
      jsonResponse(res, 200, { ok: true, ...result })
    } catch (err) {
      jsonResponse(res, 400, { ok: false, error: err.message })
    }
    return true
  }

  if (req.method === 'POST' && url.pathname === '/settings/thinking') {
    try {
      const { thinking } = await readJsonBody(req)
      const result = setThinking(thinking)
      jsonResponse(res, 200, { ok: true, ...result })
    } catch (err) {
      jsonResponse(res, 400, { ok: false, error: err.message })
    }
    return true
  }

  if (req.method === 'GET' && url.pathname === '/settings/security') {
    if (!hasAllowedAccess?.(req, url)) {
      jsonResponse(res, 403, { ok: false, error: 'forbidden' })
      return true
    }
    jsonResponse(res, 200, { ok: true, security: getSecurity(), network: getNetworkConfig() })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/settings/map') {
    jsonResponse(res, 200, { ok: true, map: getMapServiceSettings() })
    return true
  }

  if (req.method === 'POST' && url.pathname === '/settings/map') {
    try {
      const body = await readJsonBody(req)
      const map = setMapServiceSettings(body)
      jsonResponse(res, 200, { ok: true, map })
    } catch (err) {
      jsonResponse(res, 400, { ok: false, error: err.message })
    }
    return true
  }

  if (req.method === 'POST' && url.pathname === '/settings/security') {
    if (!checkLocalOrToken(req, res, url, requireLocalOrToken)) return true
    try {
      const updates = await readJsonBody(req)
      const result = setSecurity(updates)
      const network = Object.prototype.hasOwnProperty.call(updates, 'allowLanAccess')
        ? setNetworkConfig({ allowLanAccess: !!updates.allowLanAccess })
        : getNetworkConfig()
      jsonResponse(res, 200, { ok: true, security: result, network })
    } catch (err) {
      jsonResponse(res, 400, { ok: false, error: err.message })
    }
    return true
  }

  if (req.method === 'GET' && url.pathname === '/settings/social') {
    jsonResponse(res, 200, { ok: true, social: getSocialConfig() })
    return true
  }

  if (req.method === 'POST' && url.pathname === '/settings/social') {
    try {
      const updates = await readJsonBody(req)
      const feishuTouched = ('FEISHU_APP_ID' in updates) || ('FEISHU_APP_SECRET' in updates)
      const feishuChanged = feishuTouched && (
        (updates.FEISHU_APP_ID || '') !== (process.env.FEISHU_APP_ID || '') ||
        (updates.FEISHU_APP_SECRET || '') !== (process.env.FEISHU_APP_SECRET || '')
      )
      setSocialConfig(updates)
      const PLATFORM_KEYS = {
        discord: ['DISCORD_BOT_TOKEN'],
      }
      for (const [platform, keys] of Object.entries(PLATFORM_KEYS)) {
        if (keys.some(k => updates[k])) {
          restartConnector(platform, { pushMessage, emitEvent }).catch(err =>
            console.warn(`[social] restart ${platform} failed:`, err.message)
          )
        }
      }
      if (feishuChanged && process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET) {
        restartConnector('feishu', { pushMessage, emitEvent }).catch(err =>
          console.warn('[social] restart feishu failed:', err.message)
        )
      }
      if (updates._clawbot_connect) {
        restartConnector('wechat-clawbot', { pushMessage, emitEvent }).catch(err =>
          console.warn('[social] restart wechat-clawbot failed:', err.message)
        )
      }
      if (updates._feishu_disconnect) {
        restartConnector('feishu', { pushMessage, emitEvent }).catch(err =>
          console.warn('[social] restart feishu failed:', err.message)
        )
      }
      jsonResponse(res, 200, { ok: true, social: getSocialConfig() })
    } catch (err) {
      jsonResponse(res, 400, { ok: false, error: err.message })
    }
    return true
  }

  if (req.method === 'POST' && url.pathname === '/settings/minimax') {
    try {
      const { apiKey } = await readJsonBody(req)
      const trimmed = String(apiKey || '').trim()
      if (!trimmed) throw new Error('API key cannot be empty')
      setMinimaxKey(trimmed)
      replaceProvider(new MinimaxProvider({ apiKey: trimmed }))
      jsonResponse(res, 200, { ok: true, configured: true })
    } catch (err) {
      jsonResponse(res, 400, { ok: false, error: err.message })
    }
    return true
  }

  if (req.method === 'GET' && url.pathname === '/settings/voice') {
    jsonResponse(res, 200, { ok: true, voice: getVoiceConfig() })
    return true
  }

  if (req.method === 'POST' && url.pathname === '/settings/voice') {
    try {
      const body = await readJsonBody(req)
      setVoiceConfig(body)
      jsonResponse(res, 200, { ok: true, voice: getVoiceConfig() })
    } catch (err) {
      jsonResponse(res, 400, { ok: false, error: err.message })
    }
    return true
  }

  if (req.method === 'GET' && url.pathname === '/settings/tts') {
    jsonResponse(res, 200, { ok: true, tts: getTTSConfig(), providers: TTS_PROVIDERS, voices: TTS_VOICES })
    return true
  }

  if (req.method === 'POST' && url.pathname === '/settings/tts') {
    try {
      const body = await readJsonBody(req)
      setTTSConfig(body)
      jsonResponse(res, 200, { ok: true, tts: getTTSConfig() })
    } catch (err) {
      jsonResponse(res, 400, { ok: false, error: err.message })
    }
    return true
  }

  if (req.method === 'GET' && url.pathname === '/settings/web-search') {
    jsonResponse(res, 200, { ok: true, webSearch: getWebSearchConfig() })
    return true
  }

  if (req.method === 'POST' && url.pathname === '/settings/web-search') {
    try {
      const body = await readJsonBody(req)
      setWebSearchConfig(body)
      jsonResponse(res, 200, { ok: true, webSearch: getWebSearchConfig() })
    } catch (err) {
      jsonResponse(res, 400, { ok: false, error: err.message })
    }
    return true
  }

  if (req.method === 'GET' && url.pathname === '/settings/embedding') {
    jsonResponse(res, 200, {
      ok: true,
      embedding: getEmbeddingConfig(),
      presets: EMBEDDING_PROVIDER_PRESETS,
    })
    return true
  }

  if (req.method === 'POST' && url.pathname === '/settings/embedding') {
    try {
      const body = await readJsonBody(req)
      setEmbeddingConfig(body)
      try {
        const { clearEmbeddingCache } = await import('../../embedding.js')
        clearEmbeddingCache()
      } catch {}
      try {
        const { getEmbeddingCredentials } = await import('../../config.js')
        const cred = getEmbeddingCredentials()
        if (cred?.provider === 'local' && cred.model) {
          const { warmupLocalEmbedding } = await import('../../embedding-local.js')
          warmupLocalEmbedding(cred.model).catch(() => {})
        }
      } catch {}
      jsonResponse(res, 200, { ok: true, embedding: getEmbeddingConfig() })
    } catch (err) {
      jsonResponse(res, 400, { ok: false, error: err.message })
    }
    return true
  }

  return false
}
