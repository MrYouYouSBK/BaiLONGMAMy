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
} from '../../config.js'
import { EMBEDDING_PROVIDER_PRESETS } from '../../config.js'
import { TTS_PROVIDERS, TTS_VOICES } from '../../voice/tts-providers.js'
import { getAgentName, validateAgentName } from '../agent.js'
import { jsonResponse, readJsonBody } from '../utils.js'
import { setConfig, createReminder, cancelReminder, listPendingReminders } from '../../db.js'
import { getMapServiceSettings, setMapServiceSettings } from '../../map-service.js'
import { getCodexStatus, loginCodex } from '../../codex-connector.js'
import { discoverLocalAI } from '../../local-ai-discovery.js'
import { getManagedMlxStatus, installManagedMlx, startManagedMlx, stopManagedMlx } from '../../local-mlx-manager.js'
import { getMediaProviderRuntimeConfig, getMediaProviderSettings, setMediaProviderSettings } from '../../media-provider-config.js'
import { calculateNextDueAt } from '../../capabilities/tools/reminders.js'

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
      if (!task) throw new Error('Task is required')
      const recurrenceType = String(body.recurrenceType || 'once').trim().toLowerCase()
      if (!['once', 'daily', 'weekly', 'monthly'].includes(recurrenceType)) throw new Error('Repeat must be once, daily, weekly or monthly')
      let recurrenceConfig = null
      let due
      if (recurrenceType === 'once') {
        due = new Date(String(body.dueAt || ''))
        if (Number.isNaN(due.getTime()) || due.getTime() <= Date.now()) throw new Error('Timeline must be a future date and time')
      } else {
        recurrenceConfig = { time: String(body.time || '').trim() }
        if (recurrenceType === 'weekly') recurrenceConfig.weekday = Number(body.weekday)
        if (recurrenceType === 'monthly') recurrenceConfig.day_of_month = Number(body.dayOfMonth)
        due = calculateNextDueAt(recurrenceType, recurrenceConfig, new Date())
      }
      const dueAt = due.toISOString()
      const systemMessage = `GAI AI reminder: ${task}. Complete every safe and authorized step you can automatically. Verify the result before reporting completion, follow up on unfinished dependencies, and ask the user for the next concrete action only when their input or permission is required.`
      const result = createReminder({
        dueAt,
        task,
        systemMessage,
        source: 'gai-control-center',
        recurrenceType: recurrenceType === 'once' ? null : recurrenceType,
        recurrenceConfig,
      })
      jsonResponse(res, 200, { ok: true, id: Number(result.lastInsertRowid), dueAt, task, recurrenceType, recurrenceConfig })
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
    jsonResponse(res, 200, { ok: true, media })
    return true
  }

  if (req.method === 'POST' && url.pathname === '/settings/media-provider') {
    try {
      const body = await readJsonBody(req)
      if (body.provider === 'minimax' && !(globalThis.process?.env?.MINIMAX_API_KEY || getMinimaxKey())) {
        throw new Error('MiniMax media requires a configured API key')
      }
      setMediaProviderSettings(body)
      const runtime = getMediaProviderRuntimeConfig()
      removeProvider('openai-media')
      removeProvider('stable-diffusion')
      removeProvider('gemini-media')
      if (runtime.provider === 'openai-compatible' && runtime.openaiApiKey) {
        replaceProvider(new OpenAICompatibleMediaProvider({ apiKey: runtime.openaiApiKey, baseURL: runtime.openaiBaseURL, model: runtime.openaiModel }))
      }
      if (runtime.provider === 'stable-diffusion') {
        replaceProvider(new StableDiffusionMediaProvider({ baseURL: runtime.stableDiffusionBaseURL }))
      }
      if (runtime.provider === 'gemini' && runtime.geminiApiKey) {
        replaceProvider(new GeminiMediaProvider({ apiKey: runtime.geminiApiKey, model: runtime.geminiImageModel }))
      }
      const preferred = {
        minimax: 'minimax', 'openai-compatible': 'openai-media', 'stable-diffusion': 'stable-diffusion',
        gemini: 'gemini-media',
      }[runtime.provider]
      setPreferredProvider('image', preferred || '')
      const media = getMediaProviderSettings()
      jsonResponse(res, 200, { ok: true, media })
    } catch (err) {
      jsonResponse(res, 400, { ok: false, error: err.message })
    }
    return true
  }

  if (req.method === 'GET' && url.pathname === '/settings/local-ai') {
    jsonResponse(res, 200, { ok: true, localAI: await discoverLocalAI(), mlxRuntime: getManagedMlxStatus() })
    return true
  }

  if (req.method === 'POST' && url.pathname === '/settings/local-ai/mlx/install') {
    try {
      const body = await readJsonBody(req)
      jsonResponse(res, 202, { ok: true, mlxRuntime: installManagedMlx({ model: body.model, startAfterInstall: true }) })
    } catch (err) { jsonResponse(res, 400, { ok: false, error: err.message }) }
    return true
  }

  if (req.method === 'POST' && url.pathname === '/settings/local-ai/mlx/start') {
    try {
      const body = await readJsonBody(req)
      jsonResponse(res, 200, { ok: true, mlxRuntime: await startManagedMlx({ model: body.model, autoStart: true }) })
    } catch (err) { jsonResponse(res, 400, { ok: false, error: err.message }) }
    return true
  }

  if (req.method === 'POST' && url.pathname === '/settings/local-ai/mlx/stop') {
    jsonResponse(res, 200, { ok: true, mlxRuntime: stopManagedMlx({ disableAutoStart: true }) })
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
    const providerSummaries = getProviderSummaries()
    const visibleProviders = process.versions?.electron
      ? Object.fromEntries(Object.entries(providerSummaries).filter(([name]) => ['offline', 'codex', 'openai', 'custom'].includes(name)))
      : providerSummaries
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
      providers: visibleProviders,
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
      if (process.versions?.electron && provider && !['offline', 'codex', 'openai', 'custom'].includes(String(provider).toLowerCase())) {
        throw new Error('The desktop local-first profile only permits Offline Super, local/custom, OpenAI or ChatGPT sign-in')
      }
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
      if (process.versions?.electron) throw new Error('MiniMax is disabled by the desktop local/overseas-only policy')
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
