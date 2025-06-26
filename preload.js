const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // IPC methods
  send: (channel, data) => {
    // whitelist channels
    let validChannels = ['video:convert']
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  },
  receive: (channel, func) => {
    let validChannels = ['video:done', 'video:progress', 'video:error']
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender` 
      ipcRenderer.on(channel, (event, ...args) => func(...args))
    }
  },
  
  // Dialog methods
  showOpenDialog: (options) => {
    return ipcRenderer.invoke('dialog:openFile', options)
  },
  
  showSaveDialog: (options) => {
    return ipcRenderer.invoke('dialog:saveFile', options)
  },
  
  // Get default paths from main process
  getDefaultPath: (type) => {
    return ipcRenderer.invoke('get-default-path', type)
  }
}) 