(function() {
  const api = window.petAPI;
  if (!api) return;

  let dialogues = {};
  let config = {};

  fetch('dialogues.json')
    .then(r => r.json())
    .then(d => {
      dialogues = d;
      const hCount = Object.keys(d).filter(k => k.startsWith('holiday_')).length;
      console.log('✓ 节日台词已加载，共 ' + hCount + ' 个场景');
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
    console.log('→ 节日:', scene, '→', text);
    try { api.sendBubble(text); } catch (e) {}
    try { api.recordStat && api.recordStat(scene); } catch (e) {}
  }

  api.onHolidayTrigger && api.onHolidayTrigger((scene) => {
    showBubble(scene);
  });

  // ============ 自定义输入弹窗（替换 prompt） ============
  function showInputDialog(defaultValue) {
    return new Promise((resolve) => {
      // 遮罩
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.6);
        z-index: 100000; display: flex; align-items: center; justify-content: center;
        font-family: "Microsoft YaHei", sans-serif;
      `;

      // 弹窗
      const dialog = document.createElement('div');
      dialog.style.cssText = `
        background: #1e1e1e; color: #d4d4d4;
        border: 1px solid #444; border-radius: 10px;
        padding: 20px; width: 380px; box-shadow: 0 10px 40px rgba(0,0,0,0.6);
      `;
      dialog.innerHTML = `
        <div style="font-size:15px;font-weight:600;margin-bottom:14px;">设置生日</div>
        <div style="font-size:12px;color:#888;line-height:1.6;margin-bottom:10px;">
          格式：类型 月 日<br>
          公历：solar 8 15<br>
          农历：lunar 8 15<br>
          留空 → 清除生日设置
        </div>
        <input id="pet-bd-input" type="text" value="${defaultValue || ''}"
          placeholder="solar 8 15"
          style="width:100%;padding:10px;background:#2a2a2a;color:#d4d4d4;
          border:1px solid #444;border-radius:6px;font-size:14px;outline:none;box-sizing:border-box;" />
        <div style="display:flex;gap:8px;margin-top:16px;">
          <button id="pet-bd-cancel" style="flex:1;padding:10px;background:#3a3d41;
            color:#d4d4d4;border:1px solid #4a4d51;border-radius:6px;cursor:pointer;font-size:13px;">取消</button>
          <button id="pet-bd-ok" style="flex:1;padding:10px;background:#0e639c;
            color:#fff;border:1px solid #1177bb;border-radius:6px;cursor:pointer;font-size:13px;">确定</button>
        </div>
      `;

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      const input = document.getElementById('pet-bd-input');
      input.focus();
      input.select();

      function close() { document.body.removeChild(overlay); }

      document.getElementById('pet-bd-ok').addEventListener('click', () => {
        const val = input.value;
        close();
        resolve(val);
      });
      document.getElementById('pet-bd-cancel').addEventListener('click', () => {
        close();
        resolve(null);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { const v = input.value; close(); resolve(v); }
        if (e.key === 'Escape') { close(); resolve(null); }
      });
    });
  }

  // ============ 设置生日 ============
  api.onBirthdayEdit && api.onBirthdayEdit(async () => {
    const cur = await api.getConfig();
    const curBd = cur.birthday || {};
    const curStr = curBd.type ? `${curBd.type} ${curBd.month} ${curBd.day}` : '';

    const input = await showInputDialog(curStr);
    if (input === null) return;

    // 清空
    if (!input.trim()) {
      api.updateConfig({ birthday: null });
      alert('✓ 已清除生日设置');
      return;
    }

    const parts = input.trim().split(/\s+/);
    if (parts.length !== 3) {
      alert('❌ 格式不对\n应该像：solar 8 15 或 lunar 8 15');
      return;
    }

    const [type, monthStr, dayStr] = parts;
    if (type !== 'solar' && type !== 'lunar') {
      alert('❌ 类型必须是 solar（公历）或 lunar（农历）');
      return;
    }

    const month = parseInt(monthStr);
    const day = parseInt(dayStr);
    if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
      alert('❌ 月份或日期不对');
      return;
    }

    api.updateConfig({ birthday: { type, month, day } });
    alert(`✓ 生日已设置\n类型：${type === 'solar' ? '公历' : '农历'}\n日期：${month}月${day}日`);
  });

  // ============ 联网更新节日（占位） ============
  api.onHolidaySync && api.onHolidaySync(() => {
    alert('联网更新功能暂未接入\n\n目前使用本地农历库（1900~2100 年）\n所有常见节日都已支持');
  });

  // ============ 调试 ============
  window.__holidayTest = {
    trigger: (scene) => showBubble(scene),
    today: async () => {
      const info = await api.getTodayInfo();
      console.log('=== 璃光认为今天是 ===');
      console.log('📅 公历：', info.solar);
      console.log('🌙 农历：', info.lunar);
      console.log('🎉 今日节日：', info.matches.length ? info.matches.join(', ') : '（无）');
      console.log('🎂 你的生日：', info.birthday);
      console.table(info);
      return info;
    },
    list: () => Object.keys(dialogues).filter(k => k.startsWith('holiday_')),
    setBirthday: async (type, month, day) => {
      api.updateConfig({ birthday: { type, month, day } });
      console.log('✓ 已设置:', type, month, day);
    },
    clearBirthday: () => {
      api.updateConfig({ birthday: null });
      console.log('✓ 已清除');
    }
  };

  console.log('pet-holiday.js 已加载（自定义弹窗版）');
})();
