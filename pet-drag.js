(function() {
  const api = window.petAPI;
  if (!api) { console.warn('petAPI 不存在'); return; }

  const EDGE = 14;
  let dragState = null;
  let resizeState = null;
  let config = { locked: false };

  api.getConfig().then(c => { config = c || {}; });
  api.onConfigChanged((c) => { config = c || {}; });

  function getEdgeType(x, y) {
    const W = window.innerWidth, H = window.innerHeight;
    const left = x < EDGE, right = x > W - EDGE;
    const top = y < EDGE, bottom = y > H - EDGE;
    if (top && left) return 'nw';
    if (top && right) return 'ne';
    if (bottom && left) return 'sw';
    if (bottom && right) return 'se';
    if (top) return 'n';
    if (bottom) return 's';
    if (left) return 'w';
    if (right) return 'e';
    return null;
  }

  function setCursor(type) {
    if (config.locked) { document.body.style.cursor = 'default'; return; }
    const map = {
      n: 'ns-resize', s: 'ns-resize',
      w: 'ew-resize', e: 'ew-resize',
      nw: 'nwse-resize', se: 'nwse-resize',
      ne: 'nesw-resize', sw: 'nesw-resize'
    };
    document.body.style.cursor = type ? map[type] : 'grab';
  }

  window.addEventListener('mousemove', (e) => {
    if (dragState || resizeState) return;
    const t = getEdgeType(e.clientX, e.clientY);
    setCursor(t);
  }, true);

  window.addEventListener('mousedown', async (e) => {
    if (e.button !== 0) return;
    if (config.locked) return;
    const edge = getEdgeType(e.clientX, e.clientY);
    const b = await api.getBounds();
    if (!b) return;
    if (edge) {
      const psdRatio = await api.getPsdRatio();
      resizeState = {
        dir: edge, mx: e.screenX, my: e.screenY,
        b: { x: b.x, y: b.y, width: b.width, height: b.height },
        psdRatio: psdRatio || (b.width / b.height)
      };
    } else {
      dragState = { mx: e.screenX, my: e.screenY, bx: b.x, by: b.y, fixedW: b.width, fixedH: b.height };
      document.body.style.cursor = 'grabbing';
    }
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);

  window.addEventListener('mousemove', (e) => {
    if (dragState) {
      const dx = e.screenX - dragState.mx;
      const dy = e.screenY - dragState.my;
      api.setBounds({
        x: dragState.bx + dx, y: dragState.by + dy,
        width: dragState.fixedW, height: dragState.fixedH
      });
      e.preventDefault();
      e.stopImmediatePropagation();
    } else if (resizeState) {
      const dx = e.screenX - resizeState.mx;
      const dy = e.screenY - resizeState.my;
      const b = resizeState.b;
      let x = b.x, y = b.y, w = b.width, h = b.height;
      if (resizeState.dir.includes('e')) w = b.width + dx;
      if (resizeState.dir.includes('w')) { w = b.width - dx; x = b.x + dx; }
      if (resizeState.dir.includes('s')) h = b.height + dy;
      if (resizeState.dir.includes('n')) { h = b.height - dy; y = b.y + dy; }
      const ratio = resizeState.psdRatio;
      if (resizeState.dir.includes('e') || resizeState.dir.includes('w')) {
        h = w * ratio;
        if (resizeState.dir.includes('n')) y = b.y + b.height - h;
      } else {
        w = h / ratio;
        if (resizeState.dir.includes('w')) x = b.x + b.width - w;
      }
      w = Math.max(80, Math.round(w));
      h = Math.max(80, Math.round(h));
      api.setBounds({ x: Math.round(x), y: Math.round(y), width: w, height: h });
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('mouseup', () => {
    if (dragState) { dragState = null; document.body.style.cursor = 'grab'; }
    if (resizeState) { resizeState = null; }
  }, true);

  // 滚轮禁用
  window.addEventListener('wheel', (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
  }, { passive: false, capture: true });

  // 右键菜单
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    api.showMenu();
  }, true);

  document.body.style.cursor = 'grab';

  // ============ 鼠标穿透 ============
  let lastIgnore = true;
  let hitTimer = 0;
  function checkHit(clientX, clientY) {
    // 调整气泡位置时，不穿透
    if (window.__petAdjusting) return true;
    const W = window.innerWidth, H = window.innerHeight;
    const mx = W * 0.15, my = H * 0.08;
    return clientX > mx && clientX < W - mx && clientY > my && clientY < H - my;
  }
  window.addEventListener('mousemove', (e) => {
    if (dragState || resizeState) return;
    if (window.__petAdjusting) return;
    const now = Date.now();
    if (now - hitTimer < 60) return;
    hitTimer = now;
    const inPet = checkHit(e.clientX, e.clientY);
    const needIgnore = !inPet;
    if (needIgnore !== lastIgnore) {
      lastIgnore = needIgnore;
      try { api.setIgnoreMouse && api.setIgnoreMouse(needIgnore); } catch (err) {}
    }
  }, true);
  window.addEventListener('mousedown', () => {
    if (lastIgnore) {
      lastIgnore = false;
      try { api.setIgnoreMouse && api.setIgnoreMouse(false); } catch (err) {}
    }
  }, true);
  setTimeout(() => {
    try { api.setIgnoreMouse && api.setIgnoreMouse(true); } catch (e) {}
  }, 300);

  // ============ 自动加载 PSD ============
  let loadedOnce = false;
  async function autoLoadPsd() {
    if (loadedOnce) return;
    try {
      const buf = await api.readPsd();
      if (!buf || buf.length === 0) { console.log('没有 PSD 文件'); return; }
      const arr = new Uint8Array(buf);
      const blob = new Blob([arr], { type: 'application/octet-stream' });
      const file = new File([blob], 'pet.psd', { type: 'application/octet-stream' });
      const input = document.getElementById('fileInput');
      if (!input) { console.warn('找不到 fileInput'); return; }
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      loadedOnce = true;
      console.log('✓ 已自动加载 PSD');
      // 等两帧确保渲染完毕，再显示 body
      requestAnimationFrame(() => requestAnimationFrame(() => {
        document.body.classList.remove('pet-loading');
        console.log('✓ body 已显示');
        // 再等 300ms 通知主进程显示窗口
        setTimeout(() => {
          try { api.notifyReady && api.notifyReady(); } catch (e) {}
        }, 300);
      }));
    } catch (e) {
      console.warn('自动加载失败:', e.message);
    }
  }

  window.addEventListener('load', () => {
    setTimeout(autoLoadPsd, 800);
    setTimeout(autoLoadPsd, 2000);
    setTimeout(autoLoadPsd, 4000);
  });

  api.onPsdReload(() => {
    loadedOnce = false;
    autoLoadPsd();
  });

  // ============ 表情播放 ============
  api.onActionPlay((presetId) => {
    const btn = document.querySelector(`[data-preset="${presetId}"]`);
    if (btn) btn.click();
  });

  
  // 兜底：8 秒后无论如何显示 body
  setTimeout(() => {
    if (document.body.classList.contains('pet-loading')) {
      console.warn('⚠ 8 秒超时，强制显示 body');
      document.body.classList.remove('pet-loading');
      try { api.notifyReady && api.notifyReady(); } catch (e) {}
    }
  }, 8000);
console.log('pet-drag.js 已加载');
})();
