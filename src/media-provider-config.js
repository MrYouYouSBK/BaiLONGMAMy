import { getSecret, setSecret } from './capabilities/secret-store.js'

const ACTIVE_REF = 'media-provider:active'
const OPENAI_BASE_REF = 'media-provider:openai:base-url'
const OPENAI_KEY_REF = 'media-provider:openai:api-key'
const OPENAI_MODEL_REF = 'media-provider:openai:model'
const SD_BASE_REF = 'media-provider:stable-diffusion:base-url'
const SUPPORTED = new Set(['auto', 'local', 'minimax', 'openai-compatible', 'stable-diffusion'])

export function getMediaProviderRuntimeConfig() {
  const rawProvider = String(getSecret(ACTIVE_REF) || 'auto').trim().toLowerCase()
  const provider = SUPPORTED.has(rawProvider) ? rawProvider : 'auto'
  return {
    provider,
    openaiBaseURL: String(getSecret(OPENAI_BASE_REF) || 'https://api.openai.com/v1').trim().replace(/\/$/, ''),
    openaiApiKey: String(getSecret(OPENAI_KEY_REF) || '').trim(),
    openaiModel: String(getSecret(OPENAI_MODEL_REF) || 'gpt-image-1').trim(),
    stableDiffusionBaseURL: String(getSecret(SD_BASE_REF) || 'http://127.0.0.1:7860').trim().replace(/\/$/, ''),
  }
}

export function getMediaProviderSettings() {
  const config = getMediaProviderRuntimeConfig()
  return {
    provider: config.provider,
    openaiBaseURL: config.openaiBaseURL,
    openaiModel: config.openaiModel,
    openaiKeyConfigured: !!config.openaiApiKey,
    stableDiffusionBaseURL: config.stableDiffusionBaseURL,
    providers: [
      { id: 'local', label: 'Local files / camera', configured: true },
      { id: 'stable-diffusion', label: 'Local Stable Diffusion (AUTOMATIC1111)', configured: config.provider === 'stable-diffusion' },
      { id: 'openai-compatible', label: 'OpenAI-compatible image model', configured: !!config.openaiApiKey },
      { id: 'minimax', label: 'MiniMax', configured: false },
    ],
  }
}

export function setMediaProviderSettings(updates = {}) {
  const provider = String(updates.provider || getMediaProviderRuntimeConfig().provider).trim().toLowerCase()
  if (!SUPPORTED.has(provider)) throw new Error(`Unsupported media provider: ${provider}`)
  if (updates.openaiBaseURL !== undefined) {
    const value = String(updates.openaiBaseURL || '').trim().replace(/\/$/, '')
    if (value && !/^https?:\/\//i.test(value)) throw new Error('Media Base URL must start with http:// or https://')
    if (value) setSecret(OPENAI_BASE_REF, value)
  }
  if (updates.openaiApiKey) setSecret(OPENAI_KEY_REF, String(updates.openaiApiKey).trim())
  if (updates.openaiModel) setSecret(OPENAI_MODEL_REF, String(updates.openaiModel).trim())
  if (updates.stableDiffusionBaseURL !== undefined) {
    const value = String(updates.stableDiffusionBaseURL || '').trim().replace(/\/$/, '')
    if (value && !/^https?:\/\//i.test(value)) throw new Error('Stable Diffusion URL must start with http:// or https://')
    if (value) setSecret(SD_BASE_REF, value)
  }
  if (provider === 'openai-compatible' && !getSecret(OPENAI_KEY_REF)) {
    throw new Error('OpenAI-compatible media requires an API key')
  }
  setSecret(ACTIVE_REF, provider)
  return getMediaProviderSettings()
}
