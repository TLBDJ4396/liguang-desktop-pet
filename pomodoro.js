const fs = require('fs');
const path = require('path');

let config = { workMin: 25, breakMin: 5 };
let state = 'idle';   // idle | working | paused | breaking
let remainingSec = 0;
let totalSec = 0;
let timer = null;
let getWin = () => null;
let configPath = '';

function send(channel, payload) {
  const w = getWin();
  if (w && !w.isDestroyed()) w.webContents.send(channel, payload);
}

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (cfg.pomodoro) {
        config = { ...config, ...cfg.pomodoro };
      }
    }
  } catch (e) {}
}

function saveConfig() {
  try {
    let cfg = {};
    if (fs.existsSync(configPath)) {
      cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    cfg.pomodoro = config;
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
  } catch (e) {}
}

function tick() {
  if (state === 'paused' || state === 'idle') return;
  remainingSec--;

  // 通知前端更新显示（可选）
  send('pomodoro:tick', { state, remaining: remainingSec, total: totalSec });

  if (remainingSec <= 0) {
    if (state === 'working') {
      // 工作结束 → 休息
      send('pomodoro:work_end');
      startBreak();
    } else if (state === 'breaking') {
      // 休息结束 → 继续工作
      send('pomodoro:break_end');
      startWork();
    }
  }
}

function startWork() {
  state = 'working';
  totalSec = config.workMin * 60;
  remainingSec = totalSec;
  console.log('[Pomodoro] 开始工作', config.workMin, '分钟');
}

function startBreak() {
  state = 'breaking';
  totalSec = config.breakMin * 60;
  remainingSec = totalSec;
  console.log('[Pomodoro] 开始休息', config.breakMin, '分钟');
}

function start() {
  if (state === 'working' || state === 'breaking') return false;
  if (!timer) {
    timer = setInterval(tick, 1000);
  }
  startWork();
  send('pomodoro:start');
  return true;
}

function pause() {
  if (state !== 'working' && state !== 'breaking') return false;
  state = 'paused';
  console.log('[Pomodoro] 已暂停');
  send('pomodoro:state', { state, remaining: remainingSec, total: totalSec });
  return true;
}

function resume() {
  if (state !== 'paused') return false;
  // 恢复时判断之前是工作还是休息：用 totalSec 判断
  const isWorkPhase = totalSec === config.workMin * 60;
  state = isWorkPhase ? 'working' : 'breaking';
  console.log('[Pomodoro] 已继续');
  send('pomodoro:state', { state, remaining: remainingSec, total: totalSec });
  return true;
}

function stop() {
  state = 'idle';
  remainingSec = 0;
  totalSec = 0;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  console.log('[Pomodoro] 已停止');
  send('pomodoro:stop');
  return true;
}

function setConfig(workMin, breakMin) {
  config.workMin = Math.max(1, Math.min(120, workMin));
  config.breakMin = Math.max(1, Math.min(60, breakMin));
  saveConfig();
  console.log('[Pomodoro] 已更新配置', config);
  return true;
}

function getState() {
  return { state, remaining: remainingSec, total: totalSec, config };
}

function initPomodoro(getWinFn, cfgPath) {
  getWin = getWinFn;
  configPath = cfgPath;
  loadConfig();
  console.log('[Pomodoro] 番茄钟已初始化 (' + config.workMin + '/' + config.breakMin + ')');
}

module.exports = { initPomodoro, start, pause, resume, stop, setConfig, getState };
