(function() {
  const api = window.petAPI;
  if (!api) return;

  let dialogues = {};
  let config = {};

  fetch('dialogues.json')
    .then(r => r.json())
    .then(d => {
      dialogues = d;
      const sysCount = Object.keys(d).filter(k => k.startsWith('sys_')).length;
      console.log('✓ 系统状态台词已加载，共 ' + sysCount + ' 个场景');
    })
    .catch(e => console.warn('台词库加载失败:', e.message));

  api.getConfig().then(c => { config = c || {}; }).catch(() => {});
  api.onConfigChanged && api.onConfigChanged(c => { config = c || {}; });

  function showBubble(scene) {
    if (config.talkEnabled === false) return;
    const list = dialogues[scene];
    if (!list || list.length === 0) {
      console.warn('场景 "' + scene + '" 无台词（去角色卡生成后贴回来）');
      return;
    }
    const text = list[Math.floor(Math.random() * list.length)];
    console.log('→ 系统状态:', scene, '→', text);
    try { api.sendBubble(text); } catch (e) {}
    try { api.recordStat && api.recordStat(scene); } catch (e) {}
  }

  api.onSysTrigger && api.onSysTrigger((scene) => {
    showBubble(scene);
  });

  // ============ 调试接口 ============
  window.__sysTest = {
    trigger: (scene) => showBubble(scene),
    list: () => Object.keys(dialogues).filter(k => k.startsWith('sys_')),
    all: () => [
      'sys_resource_high',
      'sys_battery_low',
      'sys_net_down',
      'sys_uptime_long',
      'sys_gpu_high',
      'sys_disk_full',
      'sys_multi_monitor',
      'sys_boot',
      'sys_helpless',
      'sys_charging'
    ]
  };

  console.log('pet-sys.js 已加载');
  console.log('  测试：__sysTest.trigger("sys_helpless")');
  console.log('  列出已有台词：__sysTest.list()');
})();
