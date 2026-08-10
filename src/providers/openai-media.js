import { BaseProvider } from './base.js'

export class OpenAICompatibleMediaProvider extends BaseProvider {
  constructor({ apiKey, baseURL, model = 'gpt-image-1' }) {
    super({ name: 'openai-media', apiKey, baseURL: String(baseURL || 'https://api.openai.com/v1').replace(/\/$/, '') })
    this.model = model
  }

  canDo(capability) { return capability === 'image' }
  getQuotaStatus() { return { image: { provider: this.name } } }

  async call(capability, { prompt, aspect_ratio = '1:1', n = 1 }) {
    if (capability !== 'image') throw new Error(`OpenAI media does not support ${capability}`)
    const size = { '1:1': '1024x1024', '16:9': '1536x1024', '4:3': '1536x1024', '3:4': '1024x1536', '9:16': '1024x1536' }[aspect_ratio] || '1024x1024'
    const response = await fetch(`${this.baseURL}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, prompt, n, size }),
      signal: AbortSignal.timeout(120_000),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(`OpenAI-compatible image request failed: ${data?.error?.message || `HTTP ${response.status}`}`)
    const urls = (data?.data || []).map(item => item?.url || (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : '')).filter(Boolean)
    if (!urls.length) throw new Error('OpenAI-compatible image endpoint returned no images')
    return { urls }
  }
}

export class StableDiffusionMediaProvider extends BaseProvider {
  constructor({ baseURL }) {
    super({ name: 'stable-diffusion', apiKey: '', baseURL: String(baseURL || 'http://127.0.0.1:7860').replace(/\/$/, '') })
  }

  canDo(capability) { return capability === 'image' }
  getQuotaStatus() { return { image: { provider: this.name, local: true } } }

  async call(capability, { prompt, aspect_ratio = '1:1', n = 1 }) {
    if (capability !== 'image') throw new Error(`Stable Diffusion does not support ${capability}`)
    const [width, height] = ({ '1:1': [1024, 1024], '16:9': [1024, 576], '4:3': [1024, 768], '3:4': [768, 1024], '9:16': [576, 1024] }[aspect_ratio] || [1024, 1024])
    const response = await fetch(`${this.baseURL}/sdapi/v1/txt2img`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, width, height, batch_size: n }), signal: AbortSignal.timeout(180_000),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(`Stable Diffusion request failed: ${data?.detail || `HTTP ${response.status}`}`)
    const urls = (data?.images || []).map(image => `data:image/png;base64,${image}`)
    if (!urls.length) throw new Error('Stable Diffusion returned no images')
    return { urls }
  }
}
