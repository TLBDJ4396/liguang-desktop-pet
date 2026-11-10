const { execFile } = require('child_process');

// ============ 浏览器进程（先判断浏览器 + AI 关键词） ============
const BROWSER_PROCS = [
  'chrome', 'msedge', 'firefox',
  'sogouexplorer', '360se', '360chrome', '360ChromeX',
  'QQBrowser', 'UCBrowser', 'liebao', 'Maxthon',
  '2345Explorer', 'TheWorld'
];

// ============ AI 关键词 ============
const AI_KEYWORDS = [
  { kw: ['deepseek'],                    scene: 'ai_deepseek'  },
  { kw: ['doubao', '豆包'],              scene: 'ai_doubao'    },
  { kw: ['chatgpt', 'openai'],           scene: 'ai_chatgpt'   },
  { kw: ['claude'],                      scene: 'ai_claude'    },
  { kw: ['kimi'],                        scene: 'ai_kimi'      },
  { kw: ['qwen', '通义'],                scene: 'ai_qwen'      },
  { kw: ['wenxin', '文心', 'ernie'],     scene: 'ai_wenxin'    },
  { kw: ['zhipu', 'chatglm', '智谱'],    scene: 'ai_zhipu'     },
  { kw: ['gemini'],                      scene: 'ai_gemini'    },
  { kw: ['copilot'],                     scene: 'ai_copilot'   },
  { kw: ['yuanbao', '元宝'],             scene: 'ai_yuanbao'   },
  { kw: ['tiangong', '天工'],            scene: 'ai_tiangong'  },
  { kw: ['metaso', '秘塔', 'mita'],      scene: 'ai_mita'      },
  { kw: ['spark', '星火', '讯飞', 'xunfei'], scene: 'ai_xunfei' },
  { kw: ['hailuo', '海螺'],              scene: 'ai_hailuo'    }
];

// ============ 其他应用进程 → 场景 ============
const APP_MAP = [
  { procs: ['code', 'idea64', 'pycharm64', 'webstorm64', 'sublime_text', 'notepad++', 'goland64', 'clion64', 'rider64', 'datagrip64', 'cursor', 'trae'], scene: 'app_code' },
  { procs: ['steam', 'epicgames', 'battle.net', 'uplay', 'origin', 'wegame', 'genshinimpact', 'yuanshen', 'league of legends', 'leagueclient', 'cs2', 'valorant', 'dota2', 'pubg', 'minecraft', 'javaw'], scene: 'app_game' },
  { procs: ['qq', 'wechat', 'discord', 'telegram', 'dingtalk', 'dingtalk', 'TIM', 'wecom', 'feishu', 'lark'], scene: 'app_chat' },
  { procs: ['cloudmusic', 'qqmusic', 'spotify', 'netease', 'aimp', 'foobar2000', 'kugou', 'kuwo'], scene: 'app_music' },
  { procs: ['potplayer', 'mpc-hc', 'vlc', 'bilibili', '哔哩哔哩', 'iqiyi', 'youku', 'tencentvideo'], scene: 'app_video' },
  { procs: ['winword', 'excel', 'powerpnt', 'wps', 'et', 'wpp', 'onenote'], scene: 'app_office' },
  { procs: ['windowsterminal', 'cmd', 'powershell', 'pwsh', 'conemu', 'git-bash', 'mintty', 'alacritty'], scene: 'app_terminal' },
  { procs: ['photoshop', 'illustrator', 'figma', 'sketchup', 'blender', 'cinema', 'afterfx', 'krita', 'procreate', 'sai2', 'clipstudiopaint'], scene: 'app_design' },
  { procs: ['adobepremiere', 'premiere', 'jianyingpro', 'jianying', 'vegas', 'edius', 'davinci', 'resolve'], scene: 'app_videoedit' },
  { procs: ['thunder', 'idman', 'qbittorrent', 'utorrent', 'transmission', 'aria2', 'xunlei', 'motrix'], scene: 'app_download' },
  { procs: ['todesk', 'sunloginclient', 'anydesk', 'teamviewer', 'rustdesk'], scene: 'app_remote' },
  { procs: ['notion', 'obsidian', 'yuque', 'typora', 'wolai', 'logseq', 'joplin', '思源笔记', 'siyuan'], scene: 'app_note' }
];

function matchAi(title) {
  if (!title) return null;
  const t = title.toLowerCase();
  for (const item of AI_KEYWORDS) {
    for (const kw of item.kw) {
      if (t.includes(kw.toLowerCase())) return item.scene;
    }
  }
  if (/chatgpt|\bai\b|智能对话|ai助手|人工智能/i.test(title)) return 'ai_other';
  return null;
}

function matchApp(proc, title) {
  if (!proc) return null;
  // explorer 特判：避免桌面触发
  if (proc.includes('explorer')) {
    if (!title || title === 'Program Manager' || title.includes('桌面')) return null;
    return 'app_explorer';
  }
  for (const item of APP_MAP) {
    for (const p of item.procs) {
      if (proc.includes(p)) return item.scene;
    }
  }
  return null;
}

// ============ PowerShell 脚本 ============
const PS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Win32 {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@
$hwnd = [Win32]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 512
[Win32]::GetWindowText($hwnd, $sb, 512) | Out-Null
$procId = 0
[Win32]::GetWindowThreadProcessId($hwnd, [ref]$procId) | Out-Null
$procName = ""
try { $procName = (Get-Process -Id $procId).ProcessName } catch {}
Write-Output ($procName + "|" + $sb.ToString())
`;

function readActiveWindow() {
  return new Promise((resolve) => {
    execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', PS_SCRIPT],
      { timeout: 3000, windowsHide: true, encoding: 'utf8' },
      (err, stdout) => {
        if (err || !stdout) { resolve(null); return; }
        const line = stdout.trim().split('\n').pop().trim();
        const idx = line.indexOf('|');
        if (idx < 0) { resolve(null); return; }
        resolve({ proc: line.substring(0, idx).toLowerCase(), title: line.substring(idx + 1) });
      });
  });
}

// ============ 状态机 ============
let lastAiScene = null;
let lastAppScene = null;
let aiEnterTime = 0;
let aiLongFired = {};
let aiCooldowns = {};
let lastGlobalTrigger = 0;

const COOLDOWN_AI = 5 * 60 * 1000;
const COOLDOWN_APP = 5 * 60 * 1000;
const COOLDOWN_GLOBAL = 60 * 1000;
const LONG_THRESHOLD = 5 * 60 * 1000;
const SCAN_INTERVAL = 6000;

let getWin = () => null;
function send(channel, payload) {
  const w = getWin();
  if (w && !w.isDestroyed()) w.webContents.send(channel, payload);
}

async function scan() {
  try {
    const info = await readActiveWindow();
    if (!info) return;

    const isBrowser = BROWSER_PROCS.some(p => info.proc.includes(p));
    const aiScene = isBrowser ? matchAi(info.title) : null;
    const appScene = !aiScene ? matchApp(info.proc, info.title) : null;
    const now = Date.now();

    // ============ 浏览器分支 ============
    if (aiScene) {
      // 离开非 AI 应用
      lastAppScene = null;

      if (lastAiScene !== aiScene) {
        if (lastAiScene) send('ai:leave', lastAiScene);
        lastAiScene = aiScene;
        aiEnterTime = now;
        aiLongFired[aiScene] = false;

        if (aiCooldowns[aiScene] && now - aiCooldowns[aiScene] < COOLDOWN_AI) return;
        if (now - lastGlobalTrigger < COOLDOWN_GLOBAL) return;
        aiCooldowns[aiScene] = now;
        lastGlobalTrigger = now;
        console.log('[AI] 进入:', aiScene, '| 进程:', info.proc, '| 标题:', info.title.substring(0, 60));
        send('ai:enter', aiScene);
      } else if (!aiLongFired[aiScene] && now - aiEnterTime > LONG_THRESHOLD) {
        aiLongFired[aiScene] = true;
        console.log('[AI] 停留久了:', aiScene);
        send('ai:long', aiScene);
      }
      return;
    }

    // 离开 AI 页面
    if (lastAiScene) {
      console.log('[AI] 离开:', lastAiScene);
      send('ai:leave', lastAiScene);
      lastAiScene = null;
    }

    // ============ 应用分支 ============
    if (appScene) {
      if (lastAppScene !== appScene) {
        lastAppScene = appScene;
        if (now - lastGlobalTrigger < COOLDOWN_GLOBAL) return;
        if (!aiCooldowns[appScene] || now - aiCooldowns[appScene] > COOLDOWN_APP) {
          aiCooldowns[appScene] = now;
          lastGlobalTrigger = now;
          console.log('[App] 进入:', appScene, '| 进程:', info.proc, '| 标题:', info.title.substring(0, 50));
          send('app:enter', appScene);
        }
      }
    } else {
      lastAppScene = null;
    }
  } catch (e) {}
}

function initScanner(getWinFn) {
  getWin = getWinFn;
  setInterval(scan, SCAN_INTERVAL);
  setTimeout(scan, 3000);
  console.log('[AI/App] 扫描器已启动（PowerShell 模式，每 ' + (SCAN_INTERVAL / 1000) + ' 秒）');
}

module.exports = { initScanner };
