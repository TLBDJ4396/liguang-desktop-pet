(function() {
  const api = window.petAPI;
  if (!api) return;

  let dialogues = {};
  let config = {};

  fetch('dialogues.json')
    .then(r => r.json())
    .then(d => { dialogues = d; console.log('✓ 鼠标感知台词已加载'); })
    .catch(e => console.warn('台词库加载失败:', e.message));

  api.getConfig().then(c => { config = c || {}; }).catch(() => {});
  api.onConfigChanged && api.onConfigChanged(c => { config = c || {}; });

  // ============ 冷却机制（每个场景独立 3 分钟） ============
  const COOLDOWN = 3 * 60 * 1000;
  const lastTrigger = { mouse_idle: 0, mouse_mad: 0, mouse_fast: 0 };

  function showBubble(scene) {
    if (config.talkEnabled === false) return;
    const now = Date.now();
    if (now - (lastTrigger[scene] || 0) < COOLDOWN) return;
    const list = dialogues[scene];
    if (!list || list.length === 0) return;
    lastTrigger[scene] = now;
    const text = list[Math.floor(Math.random() * list.length)];
    console.log('→ 鼠标感知:', scene, '→', text);
    try { api.sendBubble(text); } catch (e) {}
    try { api.recordStat && api.recordStat(scene); } catch (e) {}
  }

  // ============ 状态 ============
  let lastMoveTime = Date.now();
  let idleTriggered = false;
  let clickTimes = [];
  let moveEvents = [];

  // ============ 鼠标移动 ============
  window.addEventListener('mousemove', (e) => {
    const now = Date.now();
    lastMoveTime = now;
    idleTriggered = false;

    moveEvents.push({ t: now, x: e.clientX, y: e.clientY });
    // 只保留最近 2 秒
    while (moveEvents.length && now - moveEvents[0].t > 2000) {
      moveEvents.shift();
    }

    // 至少 5 个点，2 秒内总距离 > 1500px → 快速移动
    if (moveEvents.length >= 5) {
      let dist = 0;
      for (let i = 1; i < moveEvents.length; i++) {
        const dx = moveEvents[i].x - moveEvents[i - 1].x;
        const dy = moveEvents[i].y - moveEvents[i - 1].y;
        dist += Math.sqrt(dx * dx + dy * dy);
      }
      if (dist > 1500) {
        showBubble('mouse_fast');
        moveEvents.length = 0;
      }
    }
  }, { passive: true });

  // ============ 鼠标点击 ============
  window.addEventListener('mousedown', () => {
    const now = Date.now();
    clickTimes.push(now);
    // 只保留最近 60 秒
    while (clickTimes.length && now - clickTimes[0] > 60000) {
      clickTimes.shift();
    }
    // 60 秒内点击 ≥ 20 次 → 疯狂点击
    if (clickTimes.length >= 20) {
      showBubble('mouse_mad');
      clickTimes.length = 0;
    }
  }, { passive: true });

  // ============ 空闲检测（每秒） ============
  setInterval(() => {
    const now = Date.now();
    // 60 秒没动 → 触发一次（动一下才重置）
    if (!idleTriggered && now - lastMoveTime > 60000) {
      idleTriggered = true;
      showBubble('mouse_idle');
    }
  }, 1000);

  console.log('pet-mouse.js 已加载');
})();
