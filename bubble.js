(function() {
  const container = document.getElementById('bubbles');
  let lastShowTime = 0;

  const GLOBAL_COOLDOWN = 1500;    // 全局冷却 1.5 秒
  const MIN_LIFETIME = 2000;       // 每条最少显示 2 秒
  const BUBBLE_LIFETIME = 5000;    // 每条最多显示 5 秒
  const MAX_BUBBLES = 3;           // 最多同时 3 条

  window.bubbleAPI.onShow((data) => {
    const now = Date.now();

    // 全局冷却
    if (now - lastShowTime < GLOBAL_COOLDOWN) {
      console.log('[气泡] 冷却中，跳过:', data.text);
      return;
    }

    // 满了？检查最老的是否已显示足够久
    if (container.children.length >= MAX_BUBBLES) {
      const oldest = container.children[0];
      const age = now - parseInt(oldest.dataset.createdAt || '0');
      if (age < MIN_LIFETIME) {
        console.log('[气泡] 满了且最老未满 2 秒，丢弃:', data.text);
        return;
      }
      // 删最老的
      oldest.classList.remove('show');
      setTimeout(() => oldest.remove(), 300);
      container.removeChild(oldest);
    }

    lastShowTime = now;
    addBubble(data.text, data.size);
  });

  window.bubbleAPI.onHide(() => {
    while (container.firstChild) {
      const child = container.firstChild;
      child.classList.remove('show');
      setTimeout(() => child.remove(), 300);
      container.removeChild(child);
    }
  });

  function addBubble(text, size) {
    const bubble = document.createElement('div');
    bubble.className = 'pet-bubble';
    bubble.textContent = text || '';
    bubble.style.fontSize = (size || 14) + 'px';
    bubble.dataset.createdAt = Date.now();
    container.appendChild(bubble);

    requestAnimationFrame(() => {
      bubble.classList.add('show');
    });

    // 5 秒后自动消失
    setTimeout(() => {
      if (bubble.parentNode) {
        bubble.classList.remove('show');
        setTimeout(() => bubble.remove(), 300);
      }
    }, BUBBLE_LIFETIME);
  }

  console.log('bubble.js 已加载（多气泡 + 换行 + 防刷）');
})();
