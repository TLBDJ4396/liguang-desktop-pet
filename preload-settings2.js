const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsAPI', {
  // 配置
  getConfig: () => ipcRenderer.invoke('config:get'),
  updateConfig: (patch) => ipcRenderer.send('config:update', patch),
  onConfigChanged: (cb) => ipcRenderer.on('config:changed', (e, c) => cb(c)),

  // 大小
  applySize: (scale) => ipcRenderer.send('settings:apply-size', scale),
  resetSize: () => ipcRenderer.send('settings:reset-size'),

  // 气泡
  adjustBubble: () => ipcRenderer.send('settings:adjust-bubble'),
  setBubbleSize: (size) => ipcRenderer.send('settings:set-bubble-size', size),
  setBubblePos: (pos) => ipcRenderer.send('settings:set-bubble-pos', pos),

  // 素材
  importPsd: () => ipcRenderer.send('settings:import-psd'),
  reloadPsd: () => ipcRenderer.send('settings:reload-psd'),

  // 台词
  getDialogues: () => ipcRenderer.invoke('dialogues:get-all'),
  saveDialogues: (data) => ipcRenderer.send('dialogues:save', data),
  getSceneNames: () => ipcRenderer.invoke('scene-names:get'),
  openDialoguesFile: () => ipcRenderer.send('dialogues:open-file'),
  reloadDialogues: () => ipcRenderer.send('dialogues:reload'),
  exportDialogues: () => ipcRenderer.send('dialogues:export'),
  importDialogues: () => ipcRenderer.send('dialogues:import'),

  // 统计
  getAllStats: () => ipcRenderer.invoke('stats:get-all'),
  clearStats: () => ipcRenderer.send('stats:clear'),
  exportStats: (format) => ipcRenderer.send('stats:export', format),

  // 工具
  openPomodoroSettings: () => ipcRenderer.send('settings:open-pomodoro'),
  openBirthdaySettings: () => ipcRenderer.send('settings:open-birthday'),
  syncHolidays: () => ipcRenderer.send('settings:sync-holidays'),

  // 高级
  openLogFile: () => ipcRenderer.send('settings:open-log'),
  openConfigFolder: () => ipcRenderer.send('settings:open-config-folder'),
  openDevTools: () => ipcRenderer.send('settings:open-devtools'),
  openTestPanel: () => ipcRenderer.send('settings:open-test-panel'),
  resetAll: () => ipcRenderer.send('settings:reset-all'),

  // 关于
  getVersion: () => ipcRenderer.invoke('app:get-version')
});
