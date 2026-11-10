(function() {
  const api = window.petAPI;
  if (!api) return;

  let dialogues = {};
  let config = {};

  fetch('dialogues.json')
    .then(r => r.json())
    .then(d => {
      dialogues = d;
      console.log('✓ 核心台词已加载');
    })
    .catch(e => console.warn('台词库加载失败:', e.message));

  api.getConfig().then(c => { config = c || {}; }).catch(() => {});
  api.onConfigChanged && api.onConfigChanged(c => { config = c || {}; });

  // 监听早茶触发
  api.onCoreMorningTea && api.onCoreMorningTea(() => {
    if (config.talkEnabled === false) return;
    playMorningTea();
  });

  async function playMorningTea() {
    const lines = dialogues.core_morning_tea || [
      "主人，您的茶。",
      "温度已调节至您最喜欢的52摄氏度。"
    ];

    // 第一条
    try { api.sendBubble(lines[0]); } catch (e) {}
    try { api.recordStat && api.recordStat('core_morning_tea'); } catch (e) {}
    console.log('→ 早茶:', lines[0]);

    // 第二条（延迟 1.8 秒）
    await new Promise(r => setTimeout(r, 1800));

    try { api.sendBubble(lines[1]); } catch (e) {}
    console.log('→ 早茶:', lines[1]);
  }

  // 调试接口
  window.__coreTest = {
    fire: () => playMorningTea(),
    status: () => console.log('早茶测试')
  };

  console.log('pet-core.js 已加载（右键 DevTools 输入 __coreTest.fire() 测试）');
})();
