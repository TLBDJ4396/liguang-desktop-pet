const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bubbleAPI', {
  onShow: (cb) => ipcRenderer.on('bubble:show', (e, data) => cb(data)),
  onHide: (cb) => ipcRenderer.on('bubble:hide', () => cb())
});
