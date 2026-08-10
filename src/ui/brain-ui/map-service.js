const scriptPromises = new Map()
const providerPromises = new Map()

export class MapServiceError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'MapServiceError'
    this.code = code
  }
}

function loadStyle(id, href) {
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}

function loadScript(id, src, ready) {
  if (ready()) return Promise.resolve()
  if (scriptPromises.has(id)) return scriptPromises.get(id)
  const promise = new Promise((resolve, reject) => {
    const existing = document.getElementById(id)
    if (existing) {
      existing.addEventListener('load', resolve, { once: true })
      existing.addEventListener('error', () => reject(new MapServiceError('loader_failed', `${id} failed to load`)), { once: true })
      return
    }
    const script = document.createElement('script')
    script.id = id
    script.src = src
    script.async = true
    script.onload = resolve
    script.onerror = () => reject(new MapServiceError('loader_failed', `${id} failed to load`))
    document.head.appendChild(script)
  })
  scriptPromises.set(id, promise)
  return promise
}

async function fetchRuntimeConfig(apiRoot) {
  const response = await fetch(`${apiRoot}/map-service/config`, { signal: AbortSignal.timeout(8000) })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.ok) throw new MapServiceError('config_failed', data.error || 'Map configuration could not be read')
  if (!data.map?.configured) throw new MapServiceError('not_configured', 'Configure a map provider in Settings → GAI Control Center')
  return data.map
}

function point(value) {
  return { lng: Number(value?.[0]), lat: Number(value?.[1]) }
}

function plainText(html) {
  const box = document.createElement('div')
  box.innerHTML = String(html || '')
  return box.textContent?.trim() || ''
}

function createGoogleCompat(google) {
  const gm = google.maps
  class GMap {
    constructor(container, options = {}) {
      this._map = new gm.Map(container, {
        center: point(options.center || [0, 0]),
        zoom: Number(options.zoom || 5),
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [{ elementType: 'geometry', stylers: [{ color: '#08131d' }] }, { elementType: 'labels.text.fill', stylers: [{ color: '#9fb7c6' }] }],
      })
    }
    add(items) { for (const item of Array.isArray(items) ? items : [items]) item?.setMap?.(this) }
    remove(items) { for (const item of Array.isArray(items) ? items : [items]) item?.setMap?.(null) }
    addControl() {}
    setFitView(items, _immediately, _padding, maxZoom = 8) {
      const bounds = new gm.LatLngBounds()
      for (const item of Array.isArray(items) ? items : [items]) for (const p of item?._points || []) bounds.extend(point(p))
      if (!bounds.isEmpty()) {
        this._map.fitBounds(bounds)
        gm.event.addListenerOnce(this._map, 'idle', () => { if (this._map.getZoom() > maxZoom) this._map.setZoom(maxZoom) })
      }
    }
  }
  class BaseOverlay {
    on(name, handler) { this._overlay?.addListener?.(name, handler); return this }
    setMap(map) { this._overlay?.setMap?.(map?._map || null) }
    setOptions(options = {}) { this._overlay?.setOptions?.(options) }
  }
  class Polyline extends BaseOverlay {
    constructor(options = {}) {
      super(); this._points = options.path || []
      this._overlay = new gm.Polyline({ path: this._points.map(point), strokeColor: options.strokeColor, strokeOpacity: options.strokeOpacity, strokeWeight: options.strokeWeight, geodesic: true })
    }
  }
  class Polygon extends BaseOverlay {
    constructor(options = {}) {
      super(); this._points = options.path || []
      this._overlay = new gm.Polygon({ paths: this._points.map(point), strokeColor: options.strokeColor, strokeOpacity: options.strokeOpacity, strokeWeight: options.strokeWeight, fillColor: options.fillColor, fillOpacity: options.fillOpacity, geodesic: true })
    }
  }
  class CircleMarker extends BaseOverlay {
    constructor(options = {}) {
      super(); this._points = [options.center]
      this._overlay = new gm.Marker({ position: point(options.center), icon: { path: gm.SymbolPath.CIRCLE, scale: options.radius || 4, strokeColor: options.strokeColor, strokeOpacity: options.strokeOpacity ?? 1, strokeWeight: options.strokeWeight || 1, fillColor: options.fillColor, fillOpacity: options.fillOpacity ?? 1 } })
    }
    setOptions(options = {}) {
      const icon = this._overlay.getIcon() || {}
      this._overlay.setIcon({ ...icon, fillOpacity: options.fillOpacity ?? icon.fillOpacity, strokeOpacity: options.strokeOpacity ?? icon.strokeOpacity })
    }
  }
  class Marker extends BaseOverlay {
    constructor(options = {}) {
      super(); this._points = [options.position]
      const label = plainText(options.content)
      this._overlay = new gm.Marker({ position: point(options.position), title: label, label: label ? { text: label.slice(0, 42), color: '#eefcff', fontSize: '11px' } : undefined })
    }
  }
  class InfoWindow {
    constructor(options = {}) { this._window = new gm.InfoWindow({ content: options.content || '' }) }
    setContent(value) { this._window.setContent(value) }
    open(map, position) { this._window.setPosition(point(position)); this._window.open({ map: map?._map }) }
    close() { this._window.close() }
  }
  return { __provider: 'google', Map: GMap, Polyline, Polygon, CircleMarker, Marker, InfoWindow, Pixel: class Pixel { constructor(x, y) { this.x = x; this.y = y } }, Scale: class {}, ToolBar: class {}, DistrictLayer: {} }
}

function createLeafletCompat(L) {
  class LMap {
    constructor(container, options = {}) {
      this._map = L.map(container, { zoomControl: true }).setView([Number(options.center?.[1] || 0), Number(options.center?.[0] || 0)], Number(options.zoom || 5))
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(this._map)
    }
    add(items) { for (const item of Array.isArray(items) ? items : [items]) item?.setMap?.(this) }
    remove(items) { for (const item of Array.isArray(items) ? items : [items]) item?.setMap?.(null) }
    addControl() {}
    setFitView(items, _immediately, padding = [40, 40, 40, 40], maxZoom = 8) {
      const pts = (Array.isArray(items) ? items : [items]).flatMap(item => item?._points || []).map(p => [p[1], p[0]])
      if (pts.length) this._map.fitBounds(pts, { padding: [Math.max(...padding), Math.max(...padding)], maxZoom })
    }
  }
  class BaseOverlay {
    on(name, handler) { this._overlay?.on?.(name, handler); return this }
    setMap(map) { if (map?._map) this._overlay.addTo(map._map); else this._overlay.remove?.() }
    setOptions(options = {}) { this._overlay?.setStyle?.(options) }
  }
  const latlngs = values => (values || []).map(p => [p[1], p[0]])
  class Polyline extends BaseOverlay { constructor(o = {}) { super(); this._points = o.path || []; this._overlay = L.polyline(latlngs(this._points), { color: o.strokeColor, opacity: o.strokeOpacity, weight: o.strokeWeight, dashArray: o.strokeStyle === 'dashed' ? '8 7' : undefined }) } }
  class Polygon extends BaseOverlay { constructor(o = {}) { super(); this._points = o.path || []; this._overlay = L.polygon(latlngs(this._points), { color: o.strokeColor, opacity: o.strokeOpacity, weight: o.strokeWeight, fillColor: o.fillColor, fillOpacity: o.fillOpacity }) } }
  class CircleMarker extends BaseOverlay { constructor(o = {}) { super(); this._points = [o.center]; this._overlay = L.circleMarker([o.center?.[1], o.center?.[0]], { radius: o.radius, color: o.strokeColor, opacity: o.strokeOpacity, weight: o.strokeWeight, fillColor: o.fillColor, fillOpacity: o.fillOpacity }) } }
  class Marker extends BaseOverlay { constructor(o = {}) { super(); this._points = [o.position]; const html = String(o.content || ''); this._overlay = html ? L.marker([o.position?.[1], o.position?.[0]], { icon: L.divIcon({ className: 'gai-map-label', html }) }) : L.marker([o.position?.[1], o.position?.[0]]) } }
  class InfoWindow { constructor(o = {}) { this._popup = L.popup({ closeButton: true }).setContent(o.content || '') } setContent(v) { this._popup.setContent(v) } open(map, p) { this._popup.setLatLng([p?.[1], p?.[0]]).openOn(map._map) } close() { this._popup.remove?.() } }
  return { __provider: 'osm', Map: LMap, Polyline, Polygon, CircleMarker, Marker, InfoWindow, Pixel: class Pixel {}, Scale: class {}, ToolBar: class {}, DistrictLayer: {} }
}

async function loadProvider(apiRoot) {
  const config = await fetchRuntimeConfig(apiRoot)
  if (providerPromises.has(config.provider)) return providerPromises.get(config.provider)
  const promise = (async () => {
    if (config.provider === 'google') {
      await loadScript('gai-google-maps', `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.jsKey)}&v=weekly`, () => !!window.google?.maps)
      return { AMap: createGoogleCompat(window.google), config }
    }
    if (config.provider === 'osm') {
      loadStyle('gai-leaflet-css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css')
      await loadScript('gai-leaflet-js', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', () => !!window.L)
      return { AMap: createLeafletCompat(window.L), config }
    }
    window._AMapSecurityConfig = { serviceHost: `${apiRoot}${config.servicePath || '/_AMapService'}` }
    await loadScript('gai-amap-loader', 'https://webapi.amap.com/loader.js', () => !!window.AMapLoader)
    if (!window.AMapLoader?.load) throw new MapServiceError('loader_invalid', 'Amap loader is unavailable')
    const AMap = await window.AMapLoader.load({ key: config.jsKey, version: '2.0', plugins: ['AMap.Scale', 'AMap.ToolBar', 'AMap.DistrictLayer'] })
    AMap.__provider = 'amap'
    return { AMap, config }
  })().catch(error => { providerPromises.delete(config.provider); throw error })
  providerPromises.set(config.provider, promise)
  return promise
}

function addCityBoundaryLayer(AMap, map) {
  if (AMap.__provider !== 'amap' || !AMap.DistrictLayer?.Country) return null
  const layer = new AMap.DistrictLayer.Country({ zIndex: 8, zooms: [3, 12], SOC: 'CHN', depth: 2 })
  layer.setStyles({ 'nation-stroke': '#4cc9f0', 'coastline-stroke': '#4cc9f0', 'province-stroke': 'rgba(96, 204, 240, 0.72)', 'city-stroke': 'rgba(122, 190, 218, 0.38)', fill: 'rgba(8, 38, 58, 0.12)' })
  map.add(layer)
  return layer
}

export async function createMap(container, { apiRoot = location.origin, center = [121, 25], zoom = 5, cityBoundaries = true, controls = true } = {}) {
  if (!container) throw new MapServiceError('container_missing', 'Map container is missing')
  const { AMap, config } = await loadProvider(apiRoot)
  const map = new AMap.Map(container, { center, zoom, zooms: [3, 18], viewMode: '2D', mapStyle: 'amap://styles/darkblue', showLabel: true, showIndoorMap: false, resizeEnable: true })
  const boundaryLayer = cityBoundaries ? addCityBoundaryLayer(AMap, map) : null
  if (controls && AMap.__provider === 'amap') {
    map.addControl(new AMap.Scale({ position: 'LB' }))
    map.addControl(new AMap.ToolBar({ position: 'RT', liteStyle: true }))
  }
  return { AMap, map, boundaryLayer, config }
}

const GCJ_A = 6378245.0
const GCJ_EE = 0.00669342162296594323
function outsideChina(lon, lat) { return lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271 }
function transformLatitude(x, y) { let value = -100 + 2*x + 3*y + .2*y*y + .1*x*y + .2*Math.sqrt(Math.abs(x)); value += (20*Math.sin(6*x*Math.PI)+20*Math.sin(2*x*Math.PI))*2/3; value += (20*Math.sin(y*Math.PI)+40*Math.sin(y/3*Math.PI))*2/3; value += (160*Math.sin(y/12*Math.PI)+320*Math.sin(y*Math.PI/30))*2/3; return value }
function transformLongitude(x, y) { let value = 300 + x + 2*y + .1*x*x + .1*x*y + .1*Math.sqrt(Math.abs(x)); value += (20*Math.sin(6*x*Math.PI)+20*Math.sin(2*x*Math.PI))*2/3; value += (20*Math.sin(x*Math.PI)+40*Math.sin(x/3*Math.PI))*2/3; value += (150*Math.sin(x/12*Math.PI)+300*Math.sin(x/30*Math.PI))*2/3; return value }
export function wgs84ToGcj02(coordinate) { const lon=Number(coordinate?.[0]),lat=Number(coordinate?.[1]); if(!Number.isFinite(lon)||!Number.isFinite(lat))return null;if(outsideChina(lon,lat))return[lon,lat];let dLat=transformLatitude(lon-105,lat-35),dLon=transformLongitude(lon-105,lat-35);const radLat=lat/180*Math.PI;let magic=Math.sin(radLat);magic=1-GCJ_EE*magic*magic;const sqrtMagic=Math.sqrt(magic);dLat=dLat*180/((GCJ_A*(1-GCJ_EE))/(magic*sqrtMagic)*Math.PI);dLon=dLon*180/(GCJ_A/sqrtMagic*Math.cos(radLat)*Math.PI);return[lon+dLon,lat+dLat] }
export async function convertFromGps(AMap, coordinates = []) { return coordinates.map(value => AMap?.__provider === 'amap' ? wgs84ToGcj02(value) : [Number(value?.[0]), Number(value?.[1])]).filter(value => value && value.every(Number.isFinite)) }
