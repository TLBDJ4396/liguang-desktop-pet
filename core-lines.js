const fs = require('fs');
const path = require('path');

const STATE_FILE = 'core-lines-state.json';
const TRIGGER_HOUR = 7;

let statePath = '';
let state = { lastFired: '' };
let timer = null;
let getWin = () => null;

function send(channel, payload) {
  const w = getWin();
  if (w && !w.isDestroyed()) w.webContents.send(channel, payload);
}

function load() {
  try {
    if (fs.existsSync(statePath)) {
      state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    }
  } catch (e) { state = { lastFired: '' }; }
}

function save() {
  try { fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); } catch (e) {}
}

function check() {
  const now = new Date();
  const today = now.toDateString();
  const hour = now.getHours();

  if (state.lastFired === today) return;   // 今天已触发
  if (hour < TRIGGER_HOUR) return;          // 还没到 7 点

  state.lastFired = today;
  save();
  console.log('[Core] 触发早茶 ·', today, '（' + hour + '点）');
  send('core:morning_tea');
}

function initCoreLines(getWinFn, userDataPath) {
  getWin = getWinFn;
  statePath = path.join(userDataPath, STATE_FILE);
  load();
  console.log('[Core] 早茶模块已启动（每天 7:00 触发，今日状态: ' + (state.lastFired || '未触发') + '）');
  // 启动时延迟 8 秒检查一次（等宠物显示完）
  setTimeout(check, 8000);
  // 每分钟检查
  timer = setInterval(check, 60 * 1000);
}

function forceCheck() { check(); }

module.exports = { initCoreLines, forceCheck };
