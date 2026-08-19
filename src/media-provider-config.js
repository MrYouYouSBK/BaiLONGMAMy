import { getSecret, setSecret } from './capabilities/secret-store.js'

const ACTIVE_REF = 'media-provider:active'
const OPENAI_BASE_REF = 'media-provider:openai:base-url'
const OPENAI_KEY_REF = 'media-provider:openai:api-key'
const OPENAI_MODEL_REF = 'media-provider:openai:model'
const SD_BASE_REF = 'media-provider:stable-diffusion:base-url'
const GEMINI_KEY_REF = 'media-provider:gemini:api-key'
const GEMINI_IMAGE_MODEL_REF = 'media-provider:gemini:image-model'
const VIDEO_PROVIDER_REF = 'media-provider:video:active'
const GEMINI_VIDEO_MODEL_REF = 'media-provider:gemini:video-model'
const SUPPORTED = new Set(['local', 'openai-compatible', 'stable-diffusion', 'gemini'])
const VIDEO_SUPPORTED = new Set(['gemini'])

export function getMediaProviderRuntimeConfig() {
  const rawProvider = String(getSecret(ACTIVE_REF) || 'local').trim().toLowerCase()
  const provider = SUPPORTED.has(rawProvider) ? rawProvider : 'local'
  return {
    provider,
    openaiBaseURL: String(getSecret(OPENAI_BASE_REF) || 'https://api.openai.com/v1').trim().replace(/\/$/, ''),
    openaiApiKey: String(getSecret(OPENAI_KEY_REF) || '').trim(),
    openaiModel: String(getSecret(OPENAI_MODEL_REF) || 'gpt-image-1').trim(),
    stableDiffusionBaseURL: String(getSecret(SD_BASE_REF) || 'http://127.0.0.1:7860').trim().replace(/\/$/, ''),
    geminiApiKey: String(getSecret(GEMINI_KEY_REF) || '').trim(),
    geminiImageModel: String(getSecret(GEMINI_IMAGE_MODEL_REF) || 'gemini-3.1-flash-image').trim(),
    geminiVideoModel: String(getSecret(GEMINI_VIDEO_MODEL_REF) || 'veo-3.1-lite-generate-preview').trim(),
    videoProvider: VIDEO_SUPPORTED.has(String(getSecret(VIDEO_PROVIDER_REF) || 'gemini').trim().toLowerCase())
      ? String(getSecret(VIDEO_PROVIDER_REF) || 'gemini').trim().toLowerCase()
      : 'gemini',
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
    geminiImageModel: config.geminiImageModel,
    geminiVideoModel: config.geminiVideoModel,
    geminiKeyConfigured: !!config.geminiApiKey,
    videoProvider: config.videoProvider,
    providers: [
      { id: 'local', label: 'Local files / camera', configured: true },
      { id: 'stable-diffusion', label: 'Local Stable Diffusion (AUTOMATIC1111)', configured: config.provider === 'stable-diffusion' },
      { id: 'openai-compatible', label: 'OpenAI-compatible image model', configured: !!config.openaiApiKey },
      { id: 'gemini', label: 'Gemini / Nano Banana', configured: !!config.geminiApiKey, mayCharge: true },
    ],
    videoProviders: [
      { id: 'gemini', label: 'Gemini Veo', configured: !!config.geminiApiKey, mayCharge: true },
    ],
  }
}

export function setMediaProviderSettings(updates = {}) {
  const current = getMediaProviderRuntimeConfig()
  const provider = String(updates.provider || current.provider).trim().toLowerCase()
  if (!SUPPORTED.has(provider)) throw new Error(`Unsupported media provider: ${provider}`)
  const nextVideoProvider = String(updates.videoProvider || current.videoProvider).trim().toLowerCase()
  if (nextVideoProvider === 'gemini' && !String(updates.geminiApiKey || current.geminiApiKey).trim()) {
    throw new Error('Gemini Veo requires a Gemini API key')
  }
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
  if (updates.geminiApiKey) setSecret(GEMINI_KEY_REF, String(updates.geminiApiKey).trim())
  if (updates.geminiImageModel) setSecret(GEMINI_IMAGE_MODEL_REF, String(updates.geminiImageModel).trim())
  if (updates.geminiVideoModel) setSecret(GEMINI_VIDEO_MODEL_REF, String(updates.geminiVideoModel).trim())
  if (updates.videoProvider !== undefined) {
    if (!VIDEO_SUPPORTED.has(nextVideoProvider)) throw new Error(`Unsupported video provider: ${nextVideoProvider}`)
    setSecret(VIDEO_PROVIDER_REF, nextVideoProvider)
  }
  if (provider === 'openai-compatible' && !getSecret(OPENAI_KEY_REF)) {
    throw new Error('OpenAI-compatible media requires an API key')
  }
  if (provider === 'gemini' && !getSecret(GEMINI_KEY_REF)) {
    throw new Error('Gemini media requires a Gemini API key')
  }
  setSecret(ACTIVE_REF, provider)
  return getMediaProviderSettings()
}
