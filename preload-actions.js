const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('actionsAPI', {
  play: (actionId) => ipcRenderer.send('action:play', actionId)
});
