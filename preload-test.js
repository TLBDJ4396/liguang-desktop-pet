const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('testAPI', {
  showBubble: (text) => ipcRenderer.send('test:showBubble', text),
  playAction: (presetId) => ipcRenderer.send('test:playAction', presetId)
});
