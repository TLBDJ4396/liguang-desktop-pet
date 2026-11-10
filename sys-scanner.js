const si = require('systeminformation');
const os = require('os');
const dns = require('dns');
const { screen } = require('electron');

// ============ 阈值配置 ============
const THRESHOLDS = {
  cpuHigh: 80,          // %
  memHigh: 85,          // %
  gpuHigh: 80,          // %
  batteryLow: 20,       // %
  uptimeLong: 12 * 60 * 60,  // 秒（12 小时）
  diskFull: 5,          // 剩余 %
  bootFresh: 5 * 60     // 秒（5 分钟）
};

const COOLDOWN = 10 * 60 * 1000;  // 同类 10 分钟
const SCAN_INTERVAL = 5 * 1000;  // 每 30 秒

let getWin = () => null;
let lastTrigger = {};
let bootChecked = false;        // 只在启动时检测一次"刚开机"
let lastBatteryState = null;    // 记录充电状态变化
let lastNetState = null;        // 记录网络状态变化

function send(channel, payload) {
  const w = getWin();
  if (w && !w.isDestroyed()) w.webContents.send(channel, payload);
}

function tryTrigger(scene, sceneName) {
  const now = Date.now();
  if (lastTrigger[scene] && now - lastTrigger[scene] < COOLDOWN) return false;
  lastTrigger[scene] = now;
  console.log('[Sys]', sceneName || scene);
  send('sys:trigger', scene);
  return true;
}

// CPU/内存/GPU 高：50% 分流到 sys_helpless
function triggerResource(scene) {
  if (Math.random() < 0.5) {
    tryTrigger(scene);
  } else {
    tryTrigger('sys_helpless', scene + ' → sys_helpless');
  }
}

// ============ 各项检测 ============
async function checkCpu() {
  try {
    const load = await si.currentLoad();
    const usage = load.currentLoad || 0;
    if (usage > THRESHOLDS.cpuHigh) {
      triggerResource('sys_resource_high');
    }
  } catch (e) {}
}

async function checkMem() {
  try {
    const mem = await si.mem();
    const usage = (mem.active / mem.total) * 100;
    if (usage > THRESHOLDS.memHigh) {
      triggerResource('sys_resource_high');
    }
  } catch (e) {}
}

async function checkGpu() {
  try {
    const gpu = await si.graphics();
    for (const c of (gpu.controllers || [])) {
      if (c.utilizationGpu && c.utilizationGpu > THRESHOLDS.gpuHigh) {
        triggerResource('sys_gpu_high');
        return;
      }
    }
  } catch (e) {}
}

async function checkBattery() {
  try {
    const bat = await si.battery();
    if (!bat.hasBattery) return;

    // 从"没插电"变成"插电" → 充电提示
    const currentCharging = bat.isCharging || bat.acConnected;
    if (lastBatteryState !== null && !lastBatteryState && currentCharging) {
      tryTrigger('sys_charging', '充电中');
    }
    lastBatteryState = currentCharging;

    // 电量低
    if (!currentCharging && bat.percent < THRESHOLDS.batteryLow) {
      // 50/50 分流到 sys_helpless
      if (Math.random() < 0.5) {
        tryTrigger('sys_battery_low');
      } else {
        tryTrigger('sys_helpless', 'sys_battery_low → sys_helpless');
      }
    }
  } catch (e) {}
}

async function checkNetwork() {
  return new Promise((resolve) => {
    dns.lookup('www.baidu.com', (err) => {
      const online = !err;
      if (lastNetState !== null && lastNetState && !online) {
        tryTrigger('sys_net_down', '网络断');
      }
      lastNetState = online;
      resolve();
    });
  });
}

async function checkUptime() {
  try {
    const uptime = os.uptime();
    if (uptime > THRESHOLDS.uptimeLong) {
      tryTrigger('sys_uptime_long');
    }
  } catch (e) {}
}

async function checkDisk() {
  try {
    const fsSize = await si.fsSize();
    for (const disk of fsSize) {
      const used = disk.use || 0;  // 使用百分比
      const freePercent = 100 - used;
      if (freePercent < THRESHOLDS.diskFull && disk.size > 10 * 1024 * 1024 * 1024) {
        tryTrigger('sys_disk_full');
        return;
      }
    }
  } catch (e) {}
}

function checkMultiMonitor() {
  try {
    const displays = screen.getAllDisplays();
    if (displays.length >= 2) {
      tryTrigger('sys_multi_monitor');
    }
  } catch (e) {}
}

function checkBoot() {
  if (bootChecked) return;
  bootChecked = true;
  try {
    const uptime = os.uptime();
    if (uptime < THRESHOLDS.bootFresh) {
      setTimeout(() => tryTrigger('sys_boot', '刚开机'), 5000);
    }
  } catch (e) {}
}

// ============ 主循环 ============
async function scan() {
  await checkCpu();
  await checkMem();
  await checkGpu();
  await checkBattery();
  await checkNetwork();
  await checkUptime();
  await checkDisk();
  checkMultiMonitor();
}

function initSysScanner(getWinFn) {
  getWin = getWinFn;
  checkBoot();
  setTimeout(scan, 8000);
  setInterval(scan, SCAN_INTERVAL);
  console.log('[Sys] 系统状态扫描器已启动（每 ' + (SCAN_INTERVAL / 1000) + ' 秒）');
}

module.exports = { initSysScanner };
