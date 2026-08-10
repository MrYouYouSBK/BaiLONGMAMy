import { deleteSecret, getSecret, hasSecret, setSecret } from './capabilities/secret-store.js'

const PROVIDER_REF = 'map-service:active-provider'
const AMAP_KEY_REF = 'map-service:amap:js-key'
const AMAP_SECURITY_REF = 'map-service:amap:security-code'
const GOOGLE_KEY_REF = 'map-service:google:js-key'
const SUPPORTED = new Set(['google', 'osm', 'amap'])

function activeProvider() {
  const value = String(getSecret(PROVIDER_REF) || '').trim().toLowerCase()
  return SUPPORTED.has(value) ? value : 'osm'
}

export function getMapServiceSettings() {
  const provider = activeProvider()
  const amapKeyConfigured = hasSecret(AMAP_KEY_REF)
  const amapSecurityConfigured = hasSecret(AMAP_SECURITY_REF)
  const googleKeyConfigured = hasSecret(GOOGLE_KEY_REF)
  const configured = provider === 'osm'
    || (provider === 'google' && googleKeyConfigured)
    || (provider === 'amap' && amapKeyConfigured && amapSecurityConfigured)
  return {
    provider,
    configured,
    keyConfigured: provider === 'google' ? googleKeyConfigured : amapKeyConfigured,
    securityConfigured: provider === 'amap' ? amapSecurityConfigured : true,
    googleKeyConfigured,
    amapKeyConfigured,
    amapSecurityConfigured,
    providers: [
      { id: 'google', label: 'Google Maps', requiresKey: true },
      { id: 'osm', label: 'OpenStreetMap', requiresKey: false },
      { id: 'amap', label: 'Amap / 高德地图', requiresKey: true },
    ],
  }
}

export function setMapServiceSettings({ provider, jsKey, googleKey, securityCode, clear = false } = {}) {
  const nextProvider = String(provider || activeProvider()).trim().toLowerCase()
  if (!SUPPORTED.has(nextProvider)) throw new Error(`Unsupported map provider: ${nextProvider}`)
  if (clear) {
    if (nextProvider === 'google') deleteSecret(GOOGLE_KEY_REF)
    if (nextProvider === 'amap') {
      deleteSecret(AMAP_KEY_REF)
      deleteSecret(AMAP_SECURITY_REF)
    }
  }
  const key = String(jsKey || '').trim()
  const google = String(googleKey || (nextProvider === 'google' ? key : '')).trim()
  const code = String(securityCode || '').trim()
  if (nextProvider === 'google' && google) setSecret(GOOGLE_KEY_REF, google)
  if (nextProvider === 'amap' && key) setSecret(AMAP_KEY_REF, key)
  if (nextProvider === 'amap' && code) setSecret(AMAP_SECURITY_REF, code)
  setSecret(PROVIDER_REF, nextProvider)
  return getMapServiceSettings()
}

export function getMapRuntimeConfig() {
  const settings = getMapServiceSettings()
  const jsKey = settings.provider === 'google'
    ? getSecret(GOOGLE_KEY_REF)
    : settings.provider === 'amap'
      ? getSecret(AMAP_KEY_REF)
      : ''
  return {
    provider: settings.provider,
    configured: settings.configured,
    jsKey: settings.configured ? jsKey : '',
    servicePath: settings.provider === 'amap' ? '/_AMapService' : '',
  }
}

export function getAmapSecurityCode() {
  return getSecret(AMAP_SECURITY_REF)
}
