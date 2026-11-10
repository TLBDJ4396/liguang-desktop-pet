const fs = require('fs');
const path = require('path');

let statsPath = '';
let stats = {};

function load() {
  try {
    if (fs.existsSync(statsPath)) {
      stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    }
  } catch (e) { stats = {}; }
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2)); } catch (e) {}
  }, 1000);
}

function record(scene) {
  if (!scene) return;
  if (!stats[scene]) stats[scene] = { count: 0, last: '' };
  stats[scene].count++;
  stats[scene].last = new Date().toLocaleString('zh-CN');
  save();
}

function getAll() {
  return stats;
}

function clear() {
  stats = {};
  save();
}

function initStatsManager(cfgPath) {
  statsPath = path.join(cfgPath, 'stats.json');
  load();
  console.log('[Stats] 统计已加载，共 ' + Object.keys(stats).length + ' 个场景有记录');
}

module.exports = { initStatsManager, record, getAll, clear };
