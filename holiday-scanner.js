const { Lunar, Solar } = require('lunar-javascript');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(require('electron').app.getPath('userData'), 'pet-config.json');

// ============ 公历固定节日 ============
const SOLAR_HOLIDAYS = [
  { month: 1,  day: 1,  scene: 'holiday_newyear' },
  { month: 2,  day: 14, scene: 'holiday_valentine' },
  { month: 3,  day: 8,  scene: 'holiday_women' },
  { month: 5,  day: 1,  scene: 'holiday_labor' },
  { month: 6,  day: 1,  scene: 'holiday_children' },
  { month: 10, day: 1,  scene: 'holiday_national' },
  { month: 10, day: 31, scene: 'holiday_halloween' },
  { month: 11, day: 11, scene: 'holiday_double11' },
  { month: 12, day: 24, scene: 'holiday_christmas_eve' },
  { month: 12, day: 25, scene: 'holiday_christmas' }
];

// ============ 农历固定节日 ============
const LUNAR_HOLIDAYS = [
  { month: 1,  day: 1,  scene: 'holiday_spring_festival' },
  { month: 1,  day: 15, scene: 'holiday_lantern' },
  { month: 5,  day: 5,  scene: 'holiday_dragon_boat' },
  { month: 7,  day: 7,  scene: 'holiday_qixi' },
  { month: 8,  day: 15, scene: 'holiday_mid_autumn' },
  { month: 9,  day: 9,  scene: 'holiday_double_ninth' },
  { month: 12, day: 8,  scene: 'holiday_laba' }
  // 除夕单独处理（腊月最后一天）
];

// ============ 节日检测 ============
function detectHolidays() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  const matches = [];

  // 公历
  for (const h of SOLAR_HOLIDAYS) {
    if (h.month === month && h.day === day) {
      matches.push(h.scene);
    }
  }

  // 农历
  try {
    const solar = Solar.fromDate(today);
    const lunar = solar.getLunar();
    const lMonth = Math.abs(lunar.getMonth());  // 可能负数（闰月）
    const lDay = lunar.getDay();

    for (const h of LUNAR_HOLIDAYS) {
      if (h.month === lMonth && h.day === lDay) {
        matches.push(h.scene);
      }
    }

    // 除夕：农历腊月最后一天（下一天是正月初一）
    const tomorrow = new Date(today.getTime() + 86400000);
    const tmrLunar = Solar.fromDate(tomorrow).getLunar();
    if (tmrLunar.getMonth() === 1 && tmrLunar.getDay() === 1) {
      matches.push('holiday_new_year_eve');
    }
  } catch (e) {
    console.warn('[Holiday] 农历计算失败:', e.message);
  }

  // 用户生日
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      const bd = cfg.birthday;
      if (bd && bd.type) {
        if (bd.type === 'solar') {
          if (bd.month === month && bd.day === day) {
            matches.push('holiday_birthday');
          }
        } else if (bd.type === 'lunar') {
          const solar = Solar.fromDate(today);
          const lunar = solar.getLunar();
          const lMonth = Math.abs(lunar.getMonth());
          const lDay = lunar.getDay();
          if (bd.month === lMonth && bd.day === lDay) {
            matches.push('holiday_birthday');
          }
        }
      }
    }
  } catch (e) {}

  return matches;
}

// ============ 联网补正（可选）============
async function syncHolidaysFromApi() {
  // 占位：以后接 API
  console.log('[Holiday] 联网补正功能未接入，暂时只靠本地库');
  return false;
}

// ============ 状态 ============
let getWin = () => null;
let lastCheckDate = '';
let firedToday = {};

function send(channel, payload) {
  const w = getWin();
  if (w && !w.isDestroyed()) w.webContents.send(channel, payload);
}

function checkHolidays() {
  const today = new Date();
  const dateKey = today.toDateString();

  // 每天只检查一次
  if (lastCheckDate === dateKey) return;
  lastCheckDate = dateKey;
  firedToday = {};

  const matches = detectHolidays();

  if (matches.length === 0) return;

  console.log('[Holiday] 今天是:', matches.join(', '));

  // 只触发第一个（避免一次弹多个）
  const scene = matches[0];
  if (firedToday[scene]) return;
  firedToday[scene] = true;

  // 启动 10 秒后弹（等宠物显示出来）
  setTimeout(() => {
    console.log('[Holiday] 触发:', scene);
    send('holiday:trigger', scene);
  }, 10000);
}

function initHolidayScanner(getWinFn) {
  getWin = getWinFn;
  checkHolidays();
  // 每小时检查一次（跨天会触发）
  setInterval(checkHolidays, 60 * 60 * 1000);
  console.log('[Holiday] 节日扫描器已启动（本地库 + 用户生日）');

  // 打印一下今天是什么节日（方便调试）
  const matches = detectHolidays();
  if (matches.length) {
    console.log('[Holiday] 今天命中: ' + matches.join(', '));
  }
}


// ============ 获取今天信息（调试用） ============
function getTodayInfo() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekday = '星期' + weekdays[today.getDay()];

  let lunarStr = '（计算失败）';
  let lunarFestival = '';
  try {
    const solar = Solar.fromDate(today);
    const lunar = solar.getLunar();
    const lYear = lunar.getYearInGanZhi();
    const lMonth = lunar.getMonthInChinese();
    const lDay = lunar.getDayInChinese();
    lunarStr = `${lYear}年 ${lMonth}月${lDay}`;
    lunarFestival = lunar.getFestivals().join('、') || '';
  } catch (e) {}

  const matches = detectHolidays();

  return {
    solar: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${weekday}`,
    lunar: lunarStr,
    lunarFestival: lunarFestival,
    matches: matches,
    birthday: (() => {
      try {
        const cfg = JSON.parse(require('fs').readFileSync(CONFIG_PATH, 'utf8'));
        if (cfg.birthday) {
          const t = cfg.birthday.type === 'solar' ? '公历' : '农历';
          return `${t} ${cfg.birthday.month}月${cfg.birthday.day}日`;
        }
      } catch (e) {}
      return '（未设置）';
    })()
  };
}
module.exports = { initHolidayScanner, syncHolidaysFromApi, detectHolidays, getTodayInfo };
