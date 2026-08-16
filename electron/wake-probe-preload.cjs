const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('wakeProbe', {
  sendPcm: buffer => ipcRenderer.send('wake:pcm', buffer),
  reportStatus: (status, detail) => ipcRenderer.send('wake:status', { status, detail }),
  getConfig: () => ipcRenderer.invoke('wake:get-config'),
  onConfig: handler => {
    if (typeof handler !== 'function') return () => {}
    const listener = (_event, config) => handler(config)
    ipcRenderer.on('wake:config', listener)
    return () => ipcRenderer.removeListener('wake:config', listener)
  },
})
