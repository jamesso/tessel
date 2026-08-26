const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('tesselAbout', {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
})
