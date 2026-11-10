(function() {
  const api = window.petAPI;
  if (!api) return;

  let dialogues = {};
  let config = {};

  fetch('dialogues.json')
    .then(r => r.json())
    .then(d => {
      dialogues = d;
      const aiCount = Object.keys(d).filter(k => k.startsWith('ai_')).length;
      console.log('✓ AI 嫉妒台词已加载，共 ' + aiCount + ' 个场景');
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
    console.log('→ AI嫉妒:', scene, '→', text);
    try { api.sendBubble(text); } catch (e) {}
    try { api.recordStat && api.recordStat(scene); } catch (e) {}
  }

  // ============ 进入 ============
  api.onAiEnter && api.onAiEnter((scene) => {
    showBubble(scene);
  });

  // ============ 停留久了 ============
  api.onAiLong && api.onAiLong((scene) => {
    // 如果专属场景有 _long 后缀的，优先用；否则用通用的 ai_long
    const specific = scene + '_long';
    if (dialogues[specific] && dialogues[specific].length) {
      showBubble(specific);
    } else {
      showBubble('ai_long');
    }
  });

  // ============ 离开 ============
  api.onAiLeave && api.onAiLeave((scene) => {
    const specific = scene + '_leave';
    if (dialogues[specific] && dialogues[specific].length) {
      showBubble(specific);
    } else {
      showBubble('ai_leave');
    }
  });

  // ============ 调试接口 ============
  window.__aiJealousyTest = {
    enter: (scene) => showBubble(scene || 'ai_deepseek'),
    long:  (scene) => showBubble((scene || 'ai_deepseek') + '_long'),
    leave: (scene) => showBubble((scene || 'ai_deepseek') + '_leave'),
    list:  () => Object.keys(dialogues).filter(k => k.startsWith('ai_'))
  };

  console.log('pet-ai-jealousy.js 已加载');
  console.log('  测试：__aiJealousyTest.enter() / .long() / .leave()');
  console.log('  列出：__aiJealousyTest.list()');
})();
