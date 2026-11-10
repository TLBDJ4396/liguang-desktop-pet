(function() {
  const api = window.petAPI;
  if (!api) return;

  let dialogues = {};
  let config = { talkEnabled: true, bubbleSize: 14 };
  let lastShown = {};

  // ============ 状态机 ============
  let idleState = 'awake';   // awake | yawning | sleeping
  let lastInteractTime = Date.now();
  let stateEnterTime = Date.now();
  let lastTimeSlot = null;

  // 调试用（改成小值可以快速测试）
  const YAWn_THRESHOLD_MS = 5 * 60 * 1000;   // 5 分钟空闲 → 打哈欠
  const YAWN_DURATION_MS = 8000;              // 打哈欠持续 8 秒 → 睡觉

  fetch('dialogues.json')
    .then(r => r.json())
    .then(d => { dialogues = d; console.log('✓ 台词库已加载'); })
    .catch(e => console.warn('台词库加载失败:', e.message));

  function applyConfig(c) {
    if (!c) return;
    config = { ...config, ...c };
  }
  api.getConfig().then(applyConfig).catch(() => {});
  api.onConfigChanged(applyConfig);

  function showBubble(scene) {
    if (config.talkEnabled === false) return;
    const list = dialogues[scene];
    if (!list || list.length === 0) return;
    const now = Date.now();
    if (lastShown[scene] && now - lastShown[scene] < 1500) return;
    lastShown[scene] = now;
    const text = list[Math.floor(Math.random() * list.length)];
    try { api.sendBubble(text); } catch (e) {}
    try { api.recordStat && api.recordStat(scene); } catch (e) {}
  }

  function playMotion(name) {
    try {
      if (window.__petMotion && window.__petMotion.play) {
        window.__petMotion.play(name);
      }
    } catch (e) {}
  }

  function setEyes(value) {
    try {
      if (window.__petMotion && window.__petMotion.setEyes) {
        window.__petMotion.setEyes(value);
      }
    } catch (e) {}
  }

  // ============ 状态切换 ============
  function enterYawning() {
    if (idleState !== 'awake') return;
    idleState = 'yawning';
    stateEnterTime = Date.now();
    console.log('→ 打哈欠');
    showBubble('yawn');
    playMotion('yawn');
  }

  function enterSleeping() {
    idleState = 'sleeping';
    stateEnterTime = Date.now();
    console.log('→ 睡觉');
    showBubble('sleep');
    setEyes(0);
  }

  function wakeUp() {
    if (idleState === 'awake') return;
    const wasSleeping = (idleState === 'sleeping');
    idleState = 'awake';
    stateEnterTime = Date.now();
    lastInteractTime = Date.now();
    console.log('→ 醒来');
    if (wasSleeping) {
      // 从睡觉醒来，播动画
      playMotion('wake');
      setTimeout(() => showBubble('wake'), 400);
    } else {
      // 从打哈欠醒来，直接睁眼
      setEyes(1);
    }
  }

  // ============ 空闲检测（每秒） ============
  setInterval(() => {
    if (config.talkEnabled === false) return;
    const idle = Date.now() - lastInteractTime;

    if (idleState === 'awake') {
      if (idle > YAWn_THRESHOLD_MS) enterYawning();
    } else if (idleState === 'yawning') {
      if (Date.now() - stateEnterTime > YAWN_DURATION_MS) enterSleeping();
    }
  }, 1000);

  // ============ 时间感知 ============
  function getTimeSlot() {
    const h = new Date().getHours();
    if (h >= 5 && h < 10) return 'morning';
    if (h >= 11 && h < 14) return 'noon';
    if (h >= 22 || h < 5) return 'night';
    return null;
  }

  setInterval(() => {
    if (config.talkEnabled === false) return;
    if (idleState !== 'awake') return;
    const slot = getTimeSlot();
    if (slot && slot !== lastTimeSlot) {
      lastTimeSlot = slot;
      console.log('→ 时段:', slot);
      showBubble(slot);
    }
  }, 30 * 1000);

  // ============ 交互 ============
  function isOnCharacter(x, y) {
    const W = window.innerWidth, H = window.innerHeight;
    const mx = W * 0.15, my = H * 0.08;
    return x > mx && x < W - mx && y > my && y < H - my;
  }

  let mouseDownAt = 0, mouseDownX = 0, mouseDownY = 0;
  let dragging = false;
  let clickedLastTime = 0;

  ['mousemove', 'mousedown', 'keydown', 'click'].forEach(ev => {
    window.addEventListener(ev, () => {
      lastInteractTime = Date.now();
      if (idleState !== 'awake') wakeUp();
    });
  });

  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (!isOnCharacter(e.clientX, e.clientY)) return;
    mouseDownAt = Date.now();
    mouseDownX = e.clientX;
    mouseDownY = e.clientY;
    dragging = false;
  }, true);

  window.addEventListener('mousemove', (e) => {
    if (mouseDownAt === 0) return;
    const dx = e.clientX - mouseDownX;
    const dy = e.clientY - mouseDownY;
    if (!dragging && Math.abs(dx) + Math.abs(dy) > 8) {
      dragging = true;
      showBubble('drag');
    }
  }, true);

  window.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;
    if (mouseDownAt === 0) return;
    const wasDragging = dragging;
    mouseDownAt = 0;
    dragging = false;
    if (wasDragging) { setTimeout(() => showBubble('drop'), 100); return; }
    if (idleState !== 'awake') return;
    const now = Date.now();
    if (now - clickedLastTime < 280) {
      clickedLastTime = 0;
      showBubble('dblclick');
    } else {
      clickedLastTime = now;
      const stamp = now;
      setTimeout(() => {
        if (clickedLastTime === stamp) {
          showBubble('click');
          clickedLastTime = 0;
        }
      }, 280);
    }
  }, true);

  document.addEventListener('mouseenter', () => {
    setTimeout(() => {
      if (idleState !== 'awake') return;
      if (Math.random() < 0.5) showBubble('enter');
    }, 400);
  });
  document.addEventListener('mouseleave', () => {
    if (idleState !== 'awake') return;
    if (Math.random() < 0.5) showBubble('leave');
  });

  // ============ 启动问候 ============
  window.addEventListener('load', () => {
    setTimeout(() => {
      const slot = getTimeSlot();
      if (slot) {
        lastTimeSlot = slot;
        showBubble(slot);
      }
      setTimeout(() => showBubble('boot'), 3500);
    }, 2500);
  });

  // ============ 气泡大小 / 位置微调（保留） ============
  api.onBubbleCustomSize && api.onBubbleCustomSize(() => {
    const cur = config.bubbleSize || 14;
    const input = prompt('输入气泡文字大小（8 ~ 60）:', cur);
    if (input === null) return;
    const size = parseInt(input);
    if (isNaN(size) || size < 8 || size > 60) { alert('请输入 8 到 60'); return; }
    config.bubbleSize = size;
    api.updateConfig({ bubbleSize: size });
  });

  api.onBubbleAdjust && api.onBubbleAdjust(() => {
    startAdjustMode();
  });

  function startAdjustMode() {
    const cur = config.bubbleOffset || { x: 0, y: -80 };
    let offset = { ...cur };
    let adjusting = true;

    api.sendBubble('方向键微调 · Shift 大步 · Enter 保存 · Esc 取消');

    const onKey = (e) => {
      if (!adjusting) return;
      const step = e.shiftKey ? 20 : 2;
      let handled = true;
      switch (e.key) {
        case 'ArrowLeft':  offset.x -= step; break;
        case 'ArrowRight': offset.x += step; break;
        case 'ArrowUp':    offset.y -= step; break;
        case 'ArrowDown':  offset.y += step; break;
        case 'Enter':      saveAndExit(); return;
        case 'Escape':     cancelAndExit(); return;
        default:           handled = false;
      }
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
        api.updateConfig({ bubbleOffset: { x: offset.x, y: offset.y } });
      }
    };

    window.addEventListener('keydown', onKey, true);

    function cleanup() {
      window.removeEventListener('keydown', onKey, true);
      adjusting = false;
      try { api.endBubbleAdjust && api.endBubbleAdjust(); } catch (e) {}
    }
    function saveAndExit() {
      api.updateConfig({ bubbleOffset: { x: offset.x, y: offset.y } });
      cleanup();
      console.log('✓ 气泡偏移已保存:', offset);
    }
    function cancelAndExit() { cleanup(); }

    setTimeout(() => { if (adjusting) saveAndExit(); }, 12000);
  }

  // 暴露给测试面板
  window.__petState = {
    get: () => idleState,
    forceYawn: () => enterYawning(),
    forceSleep: () => enterSleeping(),
    forceWake: () => wakeUp()
  };

  console.log('pet-bubble.js 已加载（含自动状态机）');
})();
