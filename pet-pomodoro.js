(function() {
  const api = window.petAPI;
  if (!api) return;

  let dialogues = {};
  let config = {};

  fetch('dialogues.json')
    .then(r => r.json())
    .then(d => {
      dialogues = d;
      console.log('✓ 番茄钟台词已加载');
    })
    .catch(e => console.warn('台词库加载失败:', e.message));

  api.getConfig().then(c => { config = c || {}; }).catch(() => {});
  api.onConfigChanged && api.onConfigChanged(c => { config = c || {}; });

  function showBubble(scene) {
    if (config.talkEnabled === false) return;
    const list = dialogues[scene];
    if (!list || list.length === 0) {
      console.warn('场景 "' + scene + '" 无台词');
      return;
    }
    const text = list[Math.floor(Math.random() * list.length)];
    console.log('→ 番茄钟:', scene, '→', text);
    try { api.sendBubble(text); } catch (e) {}
    try { api.recordStat && api.recordStat(scene); } catch (e) {}
  }

  // ============ 事件监听 ============
  api.onPomodoroStart && api.onPomodoroStart(() => {
    showBubble('pomodoro_start');
  });

  api.onPomodoroWorkEnd && api.onPomodoroWorkEnd(() => {
    showBubble('pomodoro_work_end');
  });

  api.onPomodoroBreakEnd && api.onPomodoroBreakEnd(() => {
    showBubble('pomodoro_break_end');
  });

  api.onPomodoroStop && api.onPomodoroStop(() => {
    showBubble('pomodoro_stop');
  });

  // ============ 自定义输入弹窗（设置时间） ============
  function showSettingsDialog(curWork, curBreak) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.6);
        z-index: 100000; display: flex; align-items: center; justify-content: center;
        font-family: "Microsoft YaHei", sans-serif;
      `;

      const dialog = document.createElement('div');
      dialog.style.cssText = `
        background: #1e1e1e; color: #d4d4d4;
        border: 1px solid #444; border-radius: 10px;
        padding: 20px; width: 340px; box-shadow: 0 10px 40px rgba(0,0,0,0.6);
      `;
      dialog.innerHTML = `
        <div style="font-size:15px;font-weight:600;margin-bottom:14px;">🍅 番茄钟设置</div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <label style="width:90px;font-size:13px;color:#aaa;">工作时长</label>
          <input id="pet-pomo-work" type="number" min="1" max="120" value="${curWork}"
            style="flex:1;padding:8px 10px;background:#2a2a2a;color:#d4d4d4;
            border:1px solid #444;border-radius:6px;font-size:14px;outline:none;box-sizing:border-box;" />
          <span style="font-size:12px;color:#888;">分钟</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <label style="width:90px;font-size:13px;color:#aaa;">休息时长</label>
          <input id="pet-pomo-break" type="number" min="1" max="60" value="${curBreak}"
            style="flex:1;padding:8px 10px;background:#2a2a2a;color:#d4d4d4;
            border:1px solid #444;border-radius:6px;font-size:14px;outline:none;box-sizing:border-box;" />
          <span style="font-size:12px;color:#888;">分钟</span>
        </div>
        <div style="display:flex;gap:8px;">
          <button id="pet-pomo-cancel" style="flex:1;padding:10px;background:#3a3d41;
            color:#d4d4d4;border:1px solid #4a4d51;border-radius:6px;cursor:pointer;font-size:13px;">取消</button>
          <button id="pet-pomo-ok" style="flex:1;padding:10px;background:#0e639c;
            color:#fff;border:1px solid #1177bb;border-radius:6px;cursor:pointer;font-size:13px;">确定</button>
        </div>
      `;

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      const workInput = document.getElementById('pet-pomo-work');
      const breakInput = document.getElementById('pet-pomo-break');
      workInput.focus();
      workInput.select();

      function close() { document.body.removeChild(overlay); }

      document.getElementById('pet-pomo-ok').addEventListener('click', () => {
        const work = parseInt(workInput.value);
        const brk = parseInt(breakInput.value);
        close();
        resolve({ work, break: brk });
      });

      document.getElementById('pet-pomo-cancel').addEventListener('click', () => {
        close();
        resolve(null);
      });

      const onKey = (e) => {
        if (e.key === 'Enter') {
          const work = parseInt(workInput.value);
          const brk = parseInt(breakInput.value);
          close();
          resolve({ work, break: brk });
        }
        if (e.key === 'Escape') { close(); resolve(null); }
      };
      workInput.addEventListener('keydown', onKey);
      breakInput.addEventListener('keydown', onKey);
    });
  }

  // ============ 打开设置弹窗 ============
  api.onPomodoroOpenSettings && api.onPomodoroOpenSettings(async () => {
    const st = await api.pomodoroGetState();
    const cfg = st.config || { workMin: 25, breakMin: 5 };
    const result = await showSettingsDialog(cfg.workMin, cfg.breakMin);
    if (!result) return;
    if (!result.work || !result.break) {
      alert('❌ 请输入有效数字');
      return;
    }
    if (result.work < 1 || result.work > 120) {
      alert('❌ 工作时长 1~120 分钟');
      return;
    }
    if (result.break < 1 || result.break > 60) {
      alert('❌ 休息时长 1~60 分钟');
      return;
    }
    api.pomodoroSetConfig(result.work, result.break);
    alert(`✓ 已设置\n工作 ${result.work} 分钟 / 休息 ${result.break} 分钟`);
  });

  // ============ 调试接口 ============
  window.__pomodoroTest = {
    start: () => api.pomodoroStart(),
    pause: () => api.pomodoroPause(),
    resume: () => api.pomodoroResume(),
    stop: () => api.pomodoroStop(),
    state: async () => {
      const s = await api.pomodoroGetState();
      console.log('状态:', s);
      return s;
    },
    setConfig: (w, b) => api.pomodoroSetConfig(w, b),
    testBubble: (scene) => showBubble(scene)
  };

  console.log('pet-pomodoro.js 已加载');
  console.log('  调试：__pomodoroTest.start() / .state()');
})();
