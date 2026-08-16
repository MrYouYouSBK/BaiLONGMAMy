const { contextBridge, ipcRenderer, webFrame } = require('electron')

const listen = (channel, handler) => {
  if (typeof handler !== 'function') return () => {}
  const listener = (_event, payload) => handler(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const desktopApi = {
  platform: process.platform,
  isElectron: true,
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  getDeviceStatus: () => ipcRenderer.invoke('devices:get-status'),
  requestMediaAccess: kind => ipcRenderer.invoke('devices:request-access', kind),
  checkForUpdates: () => ipcRenderer.invoke('updater:check-for-updates'),
  startDownload: () => ipcRenderer.invoke('updater:start-download'),
  quitAndInstall: () => ipcRenderer.invoke('updater:quit-and-install'),
  getLatestSystemScreenshot: options => ipcRenderer.invoke('system-screenshot:get-latest', options || {}),
  getStartupProgress: () => ipcRenderer.invoke('startup:get-progress'),
  onStartupProgress: handler => listen('startup:progress', handler),
  getZoomFactor: () => webFrame.getZoomFactor(),
  setZoomFactor: factor => webFrame.setZoomFactor(factor),
  onUpdaterStatus: handler => listen('updater:status', handler),
  preferences: {
    get: () => ipcRenderer.invoke('desktop-preferences:get'),
    set: updates => ipcRenderer.invoke('desktop-preferences:set', updates || {}),
  },
  openExternal: url => ipcRenderer.invoke('desktop:open-external', url),
  screen: {
    getStatus: () => ipcRenderer.invoke('screen-sharing:get-status'),
    setEnabled: enabled => ipcRenderer.invoke('screen-sharing:set-enabled', enabled),
    capture: () => ipcRenderer.invoke('screen-sharing:capture'),
  },
  wake: {
    onHit: handler => listen('wake:hit', handler),
    onStatus: handler => listen('wake:status', handler),
    getConfig: () => ipcRenderer.invoke('wake:get-config'),
    setConfig: updates => ipcRenderer.invoke('wake:set-config', updates || {}),
    setConversationActive: active => ipcRenderer.invoke('wake:set-conversation-active', active),
    orbEnter: () => ipcRenderer.send('wake:orb-enter'),
    orbFrame: payload => ipcRenderer.send('wake:orb-frame', payload),
    orbText: payload => ipcRenderer.send('wake:orb-text', payload),
    orbExit: () => ipcRenderer.send('wake:orb-exit'),
  },
}

contextBridge.exposeInMainWorld('gai', desktopApi)
// Upgrade compatibility for v3.1 renderer modules and persisted integrations.
contextBridge.exposeInMainWorld('bailongma', desktopApi)
