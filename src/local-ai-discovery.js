const ENDPOINTS = [
  { id: 'ollama', label: 'Ollama', url: 'http://127.0.0.1:11434/api/tags', baseURL: 'http://127.0.0.1:11434/v1' },
  { id: 'lmstudio', label: 'LM Studio', url: 'http://127.0.0.1:1234/v1/models', baseURL: 'http://127.0.0.1:1234/v1' },
]

async function probe(endpoint) {
  try {
    const response = await fetch(endpoint.url, { signal: AbortSignal.timeout(1600) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    const raw = endpoint.id === 'ollama' ? data?.models : data?.data
    const models = (Array.isArray(raw) ? raw : [])
      .map(item => String(item?.name || item?.model || item?.id || '').trim())
      .filter(Boolean)
    return { ...endpoint, available: true, models }
  } catch (error) {
    return { ...endpoint, available: false, models: [], error: error?.message || String(error) }
  }
}

export async function discoverLocalAI() {
  const providers = await Promise.all(ENDPOINTS.map(probe))
  return {
    available: providers.some(item => item.available),
    providers,
    checkedAt: new Date().toISOString(),
  }
}
