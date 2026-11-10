(function() {
  const api = window.petAPI;
  if (!api) return;

  let dialogues = {};
  let config = {};

  fetch('dialogues.json')
    .then(r => r.json())
    .then(d => {
      dialogues = d;
      const appCount = Object.keys(d).filter(k => k.startsWith('app_')).length;
      console.log('✓ 应用感知台词已加载，共 ' + appCount + ' 个场景');
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
    console.log('→ 应用感知:', scene, '→', text);
    try { api.sendBubble(text); } catch (e) {}
    try { api.recordStat && api.recordStat(scene); } catch (e) {}
  }

  api.onAppEnter && api.onAppEnter((scene) => {
    showBubble(scene);
  });

  // ============ 调试接口 ============
  window.__appTest = {
    trigger: (scene) => showBubble(scene),
    list: () => Object.keys(dialogues).filter(k => k.startsWith('app_')),
    all: () => [
      'app_code', 'app_browser', 'app_game', 'app_chat',
      'app_music', 'app_video', 'app_office', 'app_terminal',
      'app_explorer', 'app_design', 'app_videoedit',
      'app_download', 'app_remote', 'app_note'
    ]
  };

  console.log('pet-app.js 已加载');
  console.log('  测试：__appTest.trigger("app_code")');
  console.log('  列出：__appTest.list()');
})();
