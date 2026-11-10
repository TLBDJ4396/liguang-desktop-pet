const { app, BrowserWindow, screen, ipcMain, Menu, dialog, shell, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { initScanner } = require('./ai-jealousy-scanner');
const { initSysScanner } = require('./sys-scanner');
const { initHolidayScanner, getTodayInfo } = require('./holiday-scanner');
const Pomodoro = require('./pomodoro');
const Stats = require('./stats-manager');
const CoreLines = require('./core-lines');

const CONFIG_PATH = path.join(app.getPath('userData'), 'pet-config.json');
const BASE_WIDTH = 400;

const DEFAULT_CONFIG = {
  x: null, y: null, width: BASE_WIDTH, height: null,
  locked: false, alwaysOnTop: true, autoStart: false,
  talkEnabled: true, psdPath: null,
  bubbleSize: 14, bubblePos: 'top', bubbleOffset: null
};
let config = { ...DEFAULT_CONFIG };
let win = null, actionWin = null, bubbleWin = null;
let pageReady = false;
let readyTimeout = null;

// ============ 配置 ============
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      Object.assign(config, JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')));
    }
  } catch (e) {}
}
let saveTimer = null;
function saveConfig() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2)); } catch (e) {}
  }, 250);
}

// ============ PSD 工具 ============
function readPsdSize(psdPath) {
  try {
    const buf = fs.readFileSync(psdPath);
    if (buf.length < 26) return null;
    if (buf.toString('ascii', 0, 4) !== '8BPS') return null;
    const height = buf.readUInt32BE(14);
    const width = buf.readUInt32BE(18);
    if (width <= 0 || height <= 0) return null;
    return { width, height };
  } catch (e) { return null; }
}

function getCurrentPsdPath() {
  if (config.psdPath && fs.existsSync(config.psdPath)) return config.psdPath;
  const dir = path.join(__dirname, 'assets');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.psd'));
  return files.length ? path.join(dir, files[0]) : null;
}

function getPsdRatio() {
  const p = getCurrentPsdPath();
  if (!p) return null;
  const s = readPsdSize(p);
  return s ? s.height / s.width : null;
}

// ============ 主窗口 ============
function createWindow() {
  const wa = screen.getPrimaryDisplay().workArea;
  const ratio = getPsdRatio() || 1.75;
  let w = config.width || BASE_WIDTH;
  let h = config.height || Math.round(w * ratio);
  let x = config.x, y = config.y;

  if (x == null || y == null) {
    x = wa.x + wa.width - w - 30;
    y = wa.y + wa.height - h - 30;
  }

  win = new BrowserWindow({
    x: Math.round(x), y: Math.round(y),
    width: Math.round(w), height: Math.round(h),
    minWidth: 80, minHeight: 80,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: true,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: config.alwaysOnTop,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });
  win.setAlwaysOnTop(config.alwaysOnTop, 'screen-saver');
  win.loadFile(path.join(__dirname, 'index.html'));

  // 8 秒兜底：如果 page:ready 没到达，强制显示
  readyTimeout = setTimeout(() => {
    if (!pageReady && win && !win.isDestroyed()) {
      console.log('[主进程] 超时 8 秒，强制显示');
      win.show();
      win.setIgnoreMouseEvents(true, { forward: true });
      win.webContents.openDevTools({ mode: 'detach' });
      pageReady = true;
    }
  }, 8000);

  win.on('move', persistBounds);
  win.on('resize', persistBounds);
  win.on('close', (e) => {
    if (!app.isQuitting) { e.preventDefault(); win.hide(); }
  });

  // 主窗口创建后，创建气泡窗口
  createBubbleWindow();
}

function persistBounds() {
  if (!win || win.isDestroyed()) return;
  const [x, y] = win.getPosition();
  const [width, height] = win.getSize();
  Object.assign(config, { x, y, width, height });
  saveConfig();
  syncBubblePosition();
}

// ============ 气泡窗口 ============
function createBubbleWindow() {
  const wa = screen.getPrimaryDisplay().workArea;
  bubbleWin = new BrowserWindow({
    x: wa.x + wa.width - 400,
    y: wa.y + wa.height - 700,
    width: 320, height: 300,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    show: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-bubble.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  bubbleWin.setAlwaysOnTop(true, 'screen-saver');
  bubbleWin.setIgnoreMouseEvents(true, { forward: true });
  bubbleWin.loadFile(path.join(__dirname, 'bubble.html'));

  if (win) {
    win.on('move', syncBubblePosition);
    win.on('resize', syncBubblePosition);
  }
}

function syncBubblePosition() {
  if (!win || !bubbleWin || win.isDestroyed() || bubbleWin.isDestroyed()) return;
  const [wx, wy] = win.getPosition();
  const [ww, wh] = win.getSize();
  const [bw, bh] = bubbleWin.getSize();
  const pos = config.bubblePos || 'top';
  let bx, by;
  switch (pos) {
    case 'top':       bx = wx + (ww - bw) / 2; by = wy - bh + 20; break;
    case 'top-right': bx = wx + ww - bw - 20;  by = wy - bh + 30; break;
    case 'top-left':  bx = wx + 20;            by = wy - bh + 30; break;
    case 'right':     bx = wx + ww - 20;       by = wy + wh / 3;  break;
    case 'left':      bx = wx - bw + 20;       by = wy + wh / 3;  break;
    default:          bx = wx + (ww - bw) / 2; by = wy - bh + 20;
  }
  if (config.bubbleOffset) {
    bx = wx + config.bubbleOffset.x;
    by = wy + config.bubbleOffset.y;
  }
  bubbleWin.setBounds({
    x: Math.round(bx), y: Math.round(by),
    width: bw, height: bh
  });
}

function showBubbleText(text) {
  if (!bubbleWin || bubbleWin.isDestroyed()) return;
  if (config.talkEnabled === false) return;
  syncBubblePosition();
  bubbleWin.showInactive();
  bubbleWin.webContents.send('bubble:show', {
    text,
    size: config.bubbleSize || 14
  });
}

function hideBubbleText() {
  if (!bubbleWin || bubbleWin.isDestroyed()) return;
  bubbleWin.webContents.send('bubble:hide');
  setTimeout(() => {
    if (bubbleWin && !bubbleWin.isDestroyed()) bubbleWin.hide();
  }, 400);
}

// ============ 大小 ============
function applySize(scale) {
  if (!win) return;
  const ratio = getPsdRatio() || 1.75;
  const w = Math.round(BASE_WIDTH * scale);
  const h = Math.round(w * ratio);
  const [x, y] = win.getPosition();
  const [cw, ch] = win.getSize();
  const cx = x + cw / 2, cy = y + ch / 2;
  win.setBounds({
    x: Math.round(cx - w / 2),
    y: Math.round(cy - h / 2),
    width: w, height: h
  });
}

function toggleVisible() {
  if (!win) return;
  if (win.isVisible()) win.hide();
  else win.show();
}

function setAutoStart(enabled) {
  config.autoStart = enabled;
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: app.isPackaged ? [] : [path.resolve(__dirname)]
  });
  saveConfig();
}

// ============ 导入 PSD ============
async function importPsd() {
  const result = await dialog.showOpenDialog(win, {
    title: '选择 PSD 文件',
    filters: [{ name: 'PSD', extensions: ['psd'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) return;
  const src = result.filePaths[0];
  const assetsDir = path.join(__dirname, 'assets');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
  const dst = path.join(assetsDir, 'pet.psd');
  try { fs.copyFileSync(src, dst); } catch (e) { return; }
  config.psdPath = dst;
  saveConfig();
  if (win && !win.isDestroyed()) win.webContents.send('psd:reload');
}

// ============ 动作调试窗口 ============
function openTestWindow() {
  if (actionWin && !actionWin.isDestroyed()) { actionWin.focus(); return; }
  actionWin = new BrowserWindow({
    width: 360, height: 260,
    title: '测试面板',
    parent: win || undefined,
    resizable: false,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload-test.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  actionWin.setMenuBarVisibility(false);
  actionWin.loadFile(path.join(__dirname, 'test.html'));
  actionWin.on('closed', () => { actionWin = null; });
}

// ============ 右键菜单 ============

// ============ 设置窗口 ============
let settingsWin = null;

function openSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 900, height: 640,
    title: '璃光设置',
    parent: win || undefined,
    backgroundColor: '#1a1a1c',
    webPreferences: {
      preload: path.join(__dirname, 'preload-settings2.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  settingsWin.setMenuBarVisibility(false);
  settingsWin.loadFile(path.join(__dirname, 'settings.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
}

function showMenu() {
  if (!win) return;
  const sizes = [0.6, 0.8, 1.0, 1.25, 1.5, 2.0];
  const bubbleSizes = [
    { label: '小 (12px)', value: 12 },
    { label: '中 (14px)', value: 14 },
    { label: '大 (16px)', value: 16 },
    { label: '超大 (20px)', value: 20 }
  ];
  const bubblePositions = [
    { label: '头顶', value: 'top' },
    { label: '右上', value: 'top-right' },
    { label: '左上', value: 'top-left' },
    { label: '右侧', value: 'right' },
    { label: '左侧', value: 'left' }
  ];

  const menu = Menu.buildFromTemplate([
    { label: '显示 / 隐藏', click: toggleVisible },
    { type: 'separator' },
    {
      label: '大小',
      submenu: sizes.map(s => ({
        label: `${Math.round(s * 100)}%`,
        type: 'radio',
        checked: Math.abs(config.width - BASE_WIDTH * s) < 10,
        click: () => applySize(s)
      }))
    },
    { label: '重置大小', click: () => applySize(1.0) },
    { type: 'separator' },
    {
      label: '气泡文字大小',
      submenu: bubbleSizes.map(b => ({
        label: b.label,
        type: 'radio',
        checked: config.bubbleSize === b.value,
        click: () => {
          config.bubbleSize = b.value;
          saveConfig();
          if (win && !win.isDestroyed()) win.webContents.send('config:changed', config);
        }
      }))
    },
    {
      label: '气泡位置',
      submenu: bubblePositions.map(p => ({
        label: p.label,
        type: 'radio',
        checked: config.bubblePos === p.value,
        click: () => {
          config.bubblePos = p.value;
          config.bubbleOffset = null;
          saveConfig();
          syncBubblePosition();
          if (win && !win.isDestroyed()) win.webContents.send('config:changed', config);
        }
      }))
    },
    { label: '调整气泡位置...', click: () => {
      if (win && !win.isDestroyed()) {
        win.setIgnoreMouseEvents(false);
        win.focus();
        win.webContents.send('bubble:adjust');
      }
    }},
    { type: 'separator' },
    {
      label: '台词气泡', type: 'checkbox', checked: config.talkEnabled,
      click: (mi) => {
        config.talkEnabled = mi.checked;
        saveConfig();
        if (win && !win.isDestroyed()) win.webContents.send('config:changed', config);
        if (!config.talkEnabled) hideBubbleText();
      }
    },
    {
      label: '锁定位置', type: 'checkbox', checked: config.locked,
      click: (mi) => {
        config.locked = mi.checked;
        saveConfig();
        if (win && !win.isDestroyed()) win.webContents.send('config:changed', config);
      }
    },
    {
      label: '开机自启', type: 'checkbox', checked: config.autoStart,
      click: (mi) => setAutoStart(mi.checked)
    },
    { type: 'separator' },
    { label: '⚙️ 设置...', click: openSettingsWindow },
    { type: 'separator' },
    { label: '退出', click: () => {
      app.isQuitting = true;
      try { globalShortcut.unregisterAll(); } catch (e) {}
      if (readyTimeout) clearTimeout(readyTimeout);
      BrowserWindow.getAllWindows().forEach(w => {
        if (!w.isDestroyed()) w.destroy();
      });
      app.quit();
      setTimeout(() => process.exit(0), 500);
    }}
  ]);
  menu.popup({ window: win });
}

// ============ IPC ============
ipcMain.handle('win:get-bounds', () => win && !win.isDestroyed() ? win.getBounds() : null);
ipcMain.handle('win:get-psd-ratio', () => getPsdRatio());
ipcMain.handle('config:get', () => config);
ipcMain.handle('psd:read', () => {
  const p = getCurrentPsdPath();
  if (!p) return null;
  return fs.readFileSync(p);
});

ipcMain.on('win:set-bounds', (e, b) => {
  if (!win || win.isDestroyed()) return;
  const cur = win.getBounds();
  win.setBounds({
    x: Math.round(b.x ?? cur.x),
    y: Math.round(b.y ?? cur.y),
    width: Math.max(80, Math.round(b.width ?? cur.width)),
    height: Math.max(80, Math.round(b.height ?? cur.height))
  });
});

ipcMain.on('win:set-ignore-mouse', (e, ignore) => {
  if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(!!ignore, { forward: true });
});


// ============ 日志系统 ============
const triggerLogs = [];  // 最多 200 条

ipcMain.on('log:report', (e, entry) => {
  const item = {
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    scene: entry.scene || '',
    text: entry.text || '',
    source: entry.source || ''
  };
  triggerLogs.push(item);
  if (triggerLogs.length > 200) triggerLogs.shift();
});

ipcMain.handle('log:get-all', () => triggerLogs);
ipcMain.on('log:clear', () => { triggerLogs.length = 0; });


// 节日触发 → 转发给渲染进程
// (holiday-scanner 已经用 send('holiday:trigger', scene) 发送)

// 生日设置保存
ipcMain.on('birthday:save', (e, birthday) => {
  config.birthday = birthday;
  saveConfig();
  console.log('[Birthday] 已保存:', JSON.stringify(birthday));
});

ipcMain.handle('birthday:get', () => config.birthday || null);


// ============ 查看日志 ============
const LOG_PATH = require('path').join(app.getPath('userData'), 'pet.log');

ipcMain.on('log:append', (e, entry) => {
  try {
    const line = `[${new Date().toLocaleString('zh-CN')}] ${entry}\n`;
    require('fs').appendFileSync(LOG_PATH, line);
  } catch (err) {}
});

ipcMain.on('log:open', () => {
  if (require('fs').existsSync(LOG_PATH)) {
    require('electron').shell.openPath(LOG_PATH);
  } else {
    dialog.showMessageBox({ message: '暂无日志文件', type: 'info' });
  }
});

ipcMain.on('log:clear', () => {
  try {
    if (require('fs').existsSync(LOG_PATH)) require('fs').unlinkSync(LOG_PATH);
    if (win && !win.isDestroyed()) win.webContents.send('log:cleared');
  } catch (err) {}
});

ipcMain.handle('log:read', () => {
  try {
    if (require('fs').existsSync(LOG_PATH)) {
      return require('fs').readFileSync(LOG_PATH, 'utf8');
    }
  } catch (err) {}
  return '';
});


ipcMain.handle('holiday:today', () => {
  try { return getTodayInfo(); } catch (e) { return { error: e.message }; }
});


// ============ 番茄钟 IPC ============
ipcMain.on('pomodoro:start-ipc', () => Pomodoro.start());
ipcMain.on('pomodoro:pause-ipc', () => Pomodoro.pause());
ipcMain.on('pomodoro:resume-ipc', () => Pomodoro.resume());
ipcMain.on('pomodoro:stop-ipc', () => Pomodoro.stop());
ipcMain.on('pomodoro:set-config-ipc', (e, workMin, breakMin) => Pomodoro.setConfig(workMin, breakMin));
ipcMain.handle('pomodoro:get-state-ipc', () => Pomodoro.getState());
ipcMain.on('pomodoro:open-settings', () => {
  if (win && !win.isDestroyed()) win.webContents.send('pomodoro:open-settings');
});


// ============ 统计 IPC ============
ipcMain.on('stats:record', (e, scene) => Stats.record(scene));
ipcMain.handle('stats:get-all', () => Stats.getAll());
ipcMain.on('stats:clear', () => Stats.clear());


// ============ 设置窗口 IPC ============
ipcMain.on('settings:apply-size', (e, scale) => applySize(scale));
ipcMain.on('settings:reset-size', () => applySize(1.0));
ipcMain.on('settings:adjust-bubble', () => {
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(false);
    win.focus();
    win.webContents.send('bubble:adjust');
  }
});
ipcMain.on('settings:set-bubble-size', (e, size) => {
  config.bubbleSize = size;
  saveConfig();
  if (win && !win.isDestroyed()) win.webContents.send('config:changed', config);
});
ipcMain.on('settings:set-bubble-pos', (e, pos) => {
  config.bubblePos = pos;
  config.bubbleOffset = null;
  saveConfig();
  syncBubblePosition();
  if (win && !win.isDestroyed()) win.webContents.send('config:changed', config);
});

ipcMain.on('settings:import-psd', () => importPsd());
ipcMain.on('settings:reload-psd', () => {
  if (win && !win.isDestroyed()) win.webContents.send('psd:reload');
});

// 台词读写
ipcMain.handle('dialogues:get-all', () => {
  try {
    const p = path.join(__dirname, 'dialogues.json');
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) { return {}; }
});
ipcMain.on('dialogues:save', (e, data) => {
  try {
    const p = path.join(__dirname, 'dialogues.json');
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
    if (win && !win.isDestroyed()) win.webContents.send('dialogues:reload');
    if (settingsWin && !settingsWin.isDestroyed()) {
      settingsWin.webContents.send('dialogues:saved');
    }
  } catch (err) {}
});
ipcMain.handle('scene-names:get', () => {
  try {
    const p = path.join(__dirname, 'scene-names.json');
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) { return {}; }
});
ipcMain.on('dialogues:open-file', () => {
  require('electron').shell.openPath(path.join(__dirname, 'dialogues.json'));
});
ipcMain.on('dialogues:reload', () => {
  if (win && !win.isDestroyed()) win.webContents.send('dialogues:reload');
});

// 统计导出
ipcMain.on('stats:export', (e, format) => {
  const Stats = require('./stats-manager');
const CoreLines = require('./core-lines');
  const data = Stats.getAll();
  let content, ext;
  if (format === 'csv') {
    content = '场景,触发次数,最后触发\n';
    for (const [k, v] of Object.entries(data)) {
      content += `${k},${v.count},${v.last}\n`;
    }
    ext = 'csv';
  } else {
    content = JSON.stringify(data, null, 2);
    ext = 'json';
  }
  const filePath = path.join(require('electron').app.getPath('desktop'), `liguang-stats.${ext}`);
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    require('electron').shell.openPath(filePath);
  } catch (err) {}
});

// 工具
ipcMain.on('settings:open-pomodoro', () => {
  if (win && !win.isDestroyed()) win.webContents.send('pomodoro:open-settings');
});
ipcMain.on('settings:open-birthday', () => {
  if (win && !win.isDestroyed()) win.webContents.send('birthday:edit');
});
ipcMain.on('settings:sync-holidays', () => {
  if (win && !win.isDestroyed()) win.webContents.send('holiday:sync');
});

// 高级
ipcMain.on('settings:open-log', () => {
  const lp = path.join(require('electron').app.getPath('userData'), 'pet.log');
  if (fs.existsSync(lp)) require('electron').shell.openPath(lp);
});
ipcMain.on('settings:open-config-folder', () => {
  require('electron').shell.openPath(require('electron').app.getPath('userData'));
});
ipcMain.on('settings:open-devtools', () => {
  if (win && !win.isDestroyed()) win.webContents.openDevTools({ mode: 'detach' });
});
ipcMain.on('settings:open-test-panel', () => openTestWindow());
ipcMain.on('settings:reset-all', () => {
  const r = require('electron').dialog.showMessageBoxSync(settingsWin, {
    type: 'question',
    buttons: ['取消', '确定重置'],
    defaultId: 0,
    message: '确定要重置所有设置吗？',
    detail: '位置、大小、气泡等会恢复默认。台词和素材不动。'
  });
  if (r === 1) {
    try { fs.unlinkSync(CONFIG_PATH); } catch (err) {}
    require('electron').app.relaunch();
    require('electron').app.exit(0);
  }
});

ipcMain.handle('app:get-version', () => app.getVersion());

ipcMain.on('page:ready', () => {
  if (pageReady) return;
  pageReady = true;
  if (readyTimeout) clearTimeout(readyTimeout);
  if (win && !win.isDestroyed()) {
    console.log('[主进程] 收到 page:ready，显示窗口');
    win.show();
    win.setIgnoreMouseEvents(true, { forward: true });
  }
});

ipcMain.on('pet:menu', () => showMenu());
ipcMain.on('pet:open-actions', () => openTestWindow());

ipcMain.on('action:play', (e, presetId) => {
  if (win && !win.isDestroyed()) win.webContents.send('action:play', presetId);
});

ipcMain.on('config:update', (e, patch) => {
  Object.assign(config, patch);
  saveConfig();
  if (win && !win.isDestroyed()) win.webContents.send('config:changed', config);
  syncBubblePosition();
});

ipcMain.on('bubble:show', (e, text) => {
  showBubbleText(text);
  // 直接写日志文件
  try {
    const fs = require('fs');
    const path = require('path');
    const LOG_PATH = path.join(app.getPath('userData'), 'pet.log');
    const line = `[${new Date().toLocaleString('zh-CN')}] ${text}\n`;
    fs.appendFileSync(LOG_PATH, line);
  } catch (err) {}
});

ipcMain.on('bubble:hide', () => hideBubbleText());

ipcMain.on('bubble:adjust-end', () => {
  if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(true, { forward: true });
});

// ============ 启动 ============

// ============ 测试面板 IPC ============

ipcMain.on('test:playAction', (e, presetId) => {
  if (win && !win.isDestroyed()) win.webContents.send('action:play', presetId);
});
ipcMain.on('test:showBubble', (e, text) => {
  showBubbleText(text);
});

app.whenReady().then(() => {
  loadConfig();
  initScanner(() => win);
  initSysScanner(() => win);
  initHolidayScanner(() => win);
  Pomodoro.initPomodoro(() => win, CONFIG_PATH);
  Stats.initStatsManager(app.getPath('userData'));
  CoreLines.initCoreLines(() => win, app.getPath('userData'));
  createWindow();
  globalShortcut.register('CommandOrControl+Shift+P', toggleVisible);
});

app.on('window-all-closed', () => {});
app.on('before-quit', () => {
  app.isQuitting = true;
  BrowserWindow.getAllWindows().forEach(w => {
    if (!w.isDestroyed()) w.destroy();
  });
});