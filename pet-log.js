(function() {
  const api = window.petAPI;
  if (!api) return;

  let panel = null;
  let body = null;

  function ensurePanel() {
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'pet-log-panel';
    panel.style.cssText = `
      position: fixed; right: 10px; bottom: 10px;
      width: 360px; max-height: 420px;
      background: rgba(30,30,30,0.97); color: #d4d4d4;
      border: 1px solid #444; border-radius: 8px;
      font-family: "Microsoft YaHei", sans-serif; font-size: 12px;
      z-index: 99999; display: flex; flex-direction: column;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5); pointer-events: auto;
    `;
    panel.innerHTML = `
      <div style="padding:8px 12px;background:#252526;border-bottom:1px solid #444;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center;font-weight:600;">
        <span>📋 触发记录</span>
        <span>
          <button id="pet-log-refresh" style="background:#3a3d41;color:#d4d4d4;border:1px solid #4a4d51;border-radius:4px;padding:2px 8px;margin-left:4px;cursor:pointer;font-size:11px;">刷新</button>
          <button id="pet-log-close" style="background:#3a3d41;color:#d4d4d4;border:1px solid #4a4d51;border-radius:4px;padding:2px 8px;margin-left:4px;cursor:pointer;font-size:11px;">×</button>
        </span>
      </div>
      <pre id="pet-log-content" style="padding:8px 12px;overflow:auto;max-height:360px;margin:0;font-family:Consolas,monospace;font-size:11px;line-height:1.5;white-space:pre-wrap;word-break:break-all;color:#d4d4d4;"></pre>
    `;
    document.body.appendChild(panel);
    body = document.getElementById('pet-log-content');

    document.getElementById('pet-log-close').addEventListener('click', () => {
      panel.style.display = 'none';
    });
    document.getElementById('pet-log-refresh').addEventListener('click', loadLog);
  }

  async function loadLog() {
    ensurePanel();
    panel.style.display = 'flex';
    const text = await api.readLog();
    body.textContent = text || '（暂无日志）';
    body.scrollTop = body.scrollHeight;
  }

  // 记录触发（双写：内存 + 文件）
  const origSendBubble = api.sendBubble;
  if (origSendBubble && !api.__logHooked) {
    api.__logHooked = true;
    const rawSend = origSendBubble.bind(api);
    api.sendBubble = (text) => {
      rawSend(text);
      try { api.appendLog && api.appendLog('[气泡] ' + text); } catch (e) {}
    };
  }

  // 打开
  api.onLogView && api.onLogView(() => {
    loadLog();
  });

  // 清空
  api.onLogCleared && api.onLogCleared(() => {
    if (body) body.textContent = '（暂无日志）';
  });

  // 快捷键
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      if (panel && panel.style.display !== 'none') {
        panel.style.display = 'none';
      } else {
        loadLog();
      }
    }
  });

  console.log('pet-log.js 已加载（右键 → 查看日志 / Ctrl+L）');
})();
