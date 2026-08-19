import { getMapRuntimeConfig } from '../../map-service.js'
import { jsonResponse } from '../utils.js'

const AMAP_REST_BASE = 'https://restapi.amap.com/'
const AMAP_WEB_BASE = 'https://webapi.amap.com/'

export function buildAmapProxyTarget(url, securityCode) {
  const suffix = url.pathname.slice('/_AMapService/'.length)
  if (!/^(?:v3|v4)\/[A-Za-z0-9._~!$&'()*+,;=@%/-]+$/.test(suffix) || suffix.includes('..')) {
    throw new Error('invalid_amap_proxy_path')
  }
  const base = suffix.startsWith('v4/map/styles') ? AMAP_WEB_BASE : AMAP_REST_BASE
  const target = new URL(suffix, base)
  for (const [key, value] of url.searchParams) target.searchParams.append(key, value)
  target.searchParams.set('jscode', securityCode)
  return target
}

function copyProxyHeaders(upstream, res) {
  const contentType = upstream.headers.get('content-type')
  const cacheControl = upstream.headers.get('cache-control')
  if (contentType) res.setHeader('Content-Type', contentType)
  if (cacheControl) res.setHeader('Cache-Control', cacheControl)
}

export async function handleMapRoutes(req, res, url, { requireLocalOrToken } = {}) {
  if (req.method === 'GET' && url.pathname === '/map-service/config') {
    if (!requireLocalOrToken?.(req, res, url)) return true
    jsonResponse(res, 200, { ok: true, map: getMapRuntimeConfig() })
    return true
  }

  if (req.method === 'GET' && url.pathname.startsWith('/_AMapService/')) {
    if (!requireLocalOrToken?.(req, res, url)) return true
    // Legacy endpoint intentionally cannot make an upstream request in the
    // local/overseas-only desktop profile.
    jsonResponse(res, 410, { ok: false, error: 'map_provider_disabled' })
    return true
  }

  return false
}
