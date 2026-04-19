// PiPilot IDE — Modals (Phase 6)
// window.PiPilot.modal: show/prompt/confirm/alert + built-in modal handlers via bus events.

(function () {
  const api = window.electronAPI;
  const bus = window.PiPilot.bus;
  const state = window.PiPilot.state;

  function injectStyles() {
    if (document.getElementById('modals-inline-styles')) return;
    const css = `
.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.55);
  backdrop-filter: blur(2px); z-index: 9000;
  display: flex; align-items: center; justify-content: center;
  animation: modalFade 0.15s ease;
}
@keyframes modalFade { from { opacity: 0; } to { opacity: 1; } }
.modal-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
  width: 100%; max-height: 85vh; overflow: hidden;
  display: flex; flex-direction: column;
  animation: modalSlide 0.18s ease;
}
@keyframes modalSlide { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.modal-header {
  display: flex; align-items: center; padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}
.modal-title { font-size: var(--fs-lg); color: var(--text-strong); font-weight: 600; }
.modal-close {
  margin-left: auto; background: none; border: none; color: var(--text-mid);
  font-size: 18px; cursor: pointer; padding: 0 4px;
}
.modal-close:hover { color: var(--text-strong); }
.modal-body { padding: 18px; overflow-y: auto; flex: 1; font-size: var(--fs-base); color: var(--text); }
.modal-footer {
  display: flex; gap: 8px; justify-content: flex-end;
  padding: 12px 18px; border-top: 1px solid var(--border);
}
.modal-form-row { margin-bottom: 12px; }
.modal-form-row label {
  display: block; font-size: var(--fs-sm); color: var(--text-mid); margin-bottom: 4px;
}
.modal-form-row input[type="text"],
.modal-form-row input[type="url"],
.modal-form-row input[type="number"],
.modal-form-row select,
.modal-form-row textarea {
  width: 100%; padding: 7px 10px; background: var(--surface-alt);
  border: 1px solid var(--border); border-radius: var(--radius);
  color: var(--text-strong); font-family: var(--font-sans); font-size: var(--fs-sm);
}
.modal-form-row textarea { font-family: var(--font-mono); resize: vertical; min-height: 70px; }
.modal-form-row input:focus, .modal-form-row select:focus, .modal-form-row textarea:focus {
  outline: none; border-color: var(--accent);
}
.modal-tabs {
  display: flex; gap: 0; border-bottom: 1px solid var(--border); margin-bottom: 14px;
}
.modal-tab {
  padding: 8px 14px; font-size: var(--fs-sm); color: var(--text-mid);
  background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer;
}
.modal-tab.active { color: var(--text-strong); border-bottom-color: var(--accent); }
.modal-tab:hover { color: var(--text); }
.progress {
  width: 100%; height: 6px; background: var(--surface-alt); border-radius: 3px; overflow: hidden;
}
.progress-bar { height: 100%; background: var(--accent); transition: width 0.2s; }

.tutorial-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9500;
  display: flex; align-items: center; justify-content: center;
}
.tutorial-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 24px; max-width: 460px;
  text-align: center; box-shadow: var(--shadow-lg);
}
.tutorial-card h3 { color: var(--text-strong); font-size: var(--fs-xl); margin-bottom: 8px; }
.tutorial-card p { color: var(--text); font-size: var(--fs-sm); line-height: 1.6; margin-bottom: 18px; }
.tutorial-footer {
  display: flex; align-items: center; justify-content: space-between; margin-top: 14px;
}
.tutorial-dots { display: flex; gap: 6px; }
.tutorial-dot {
  width: 6px; height: 6px; border-radius: 50%; background: var(--border);
}
.tutorial-dot.active { background: var(--accent); }
`;
    const s = document.createElement('style');
    s.id = 'modals-inline-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }
  injectStyles();

  const root = document.getElementById('modal-root');

  function show(content, opts = {}) {
    const closable = opts.closable !== false;
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const card = document.createElement('div');
    card.className = 'modal-card';
    card.style.maxWidth = (opts.width || 600) + 'px';

    if (opts.title || closable) {
      const header = document.createElement('div');
      header.className = 'modal-header';
      const title = document.createElement('div');
      title.className = 'modal-title';
      title.textContent = opts.title || '';
      header.appendChild(title);
      if (closable) {
        const x = document.createElement('button');
        x.className = 'modal-close';
        x.innerHTML = '×';
        x.addEventListener('click', close);
        header.appendChild(x);
      }
      card.appendChild(header);
    }

    const body = document.createElement('div');
    body.className = 'modal-body';
    if (typeof content === 'string') body.innerHTML = content;
    else body.appendChild(content);
    card.appendChild(body);

    if (opts.footer) {
      const footer = document.createElement('div');
      footer.className = 'modal-footer';
      if (typeof opts.footer === 'string') footer.innerHTML = opts.footer;
      else footer.appendChild(opts.footer);
      card.appendChild(footer);
    }

    backdrop.appendChild(card);
    if (closable) {
      backdrop.addEventListener('mousedown', (e) => {
        if (e.target === backdrop) close();
      });
    }
    root.appendChild(backdrop);

    const escHandler = (e) => { if (e.key === 'Escape' && closable) close(); };
    document.addEventListener('keydown', escHandler);

    function close() {
      backdrop.remove();
      document.removeEventListener('keydown', escHandler);
      if (opts.onClose) opts.onClose();
    }

    return { close, backdrop, card, body };
  }

  function prompt({ title, label, defaultValue, placeholder, confirmText = 'OK', cancelText = 'Cancel' } = {}) {
    return new Promise((resolve) => {
      const body = document.createElement('div');
      const row = document.createElement('div');
      row.className = 'modal-form-row';
      const lab = document.createElement('label');
      lab.textContent = label || '';
      const input = document.createElement('input');
      input.type = 'text';
      input.value = defaultValue || '';
      input.placeholder = placeholder || '';
      row.appendChild(lab);
      row.appendChild(input);
      body.appendChild(row);

      const footer = document.createElement('div');
      const cancel = document.createElement('button');
      cancel.className = 'btn btn-secondary btn-small';
      cancel.textContent = cancelText;
      const confirm = document.createElement('button');
      confirm.className = 'btn btn-primary btn-small';
      confirm.textContent = confirmText;
      footer.appendChild(cancel);
      footer.appendChild(confirm);

      const handle = show(body, { title, footer, width: 460, onClose: () => resolve(null) });
      cancel.addEventListener('click', () => { handle.close(); resolve(null); });
      confirm.addEventListener('click', () => { const v = input.value; handle.close(); resolve(v); });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { confirm.click(); }
      });
      setTimeout(() => input.focus(), 30);
    });
  }

  function confirm({ title = 'Confirm', message = '', confirmText = 'OK', cancelText = 'Cancel', danger = false } = {}) {
    return new Promise((resolve) => {
      const body = document.createElement('div');
      body.textContent = message;
      const footer = document.createElement('div');
      const cancel = document.createElement('button');
      cancel.className = 'btn btn-secondary btn-small';
      cancel.textContent = cancelText;
      const ok = document.createElement('button');
      ok.className = 'btn btn-primary btn-small';
      ok.textContent = confirmText;
      if (danger) ok.style.background = 'var(--error)';
      footer.appendChild(cancel);
      footer.appendChild(ok);
      const handle = show(body, { title, footer, width: 420, onClose: () => resolve(false) });
      cancel.addEventListener('click', () => { handle.close(); resolve(false); });
      ok.addEventListener('click', () => { handle.close(); resolve(true); });
    });
  }

  function alertDialog({ title = 'Notice', message = '', confirmText = 'OK' } = {}) {
    return new Promise((resolve) => {
      const body = document.createElement('div');
      body.textContent = message;
      const footer = document.createElement('div');
      const ok = document.createElement('button');
      ok.className = 'btn btn-primary btn-small';
      ok.textContent = confirmText;
      footer.appendChild(ok);
      const handle = show(body, { title, footer, width: 420, onClose: () => resolve() });
      ok.addEventListener('click', () => { handle.close(); resolve(); });
    });
  }

  // ---------- Built-in modals ----------

  // Clone repo
  bus.on('modal:clone-repo', async () => {
    const home = await api.getHome();
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="modal-form-row">
        <label>Repository URL</label>
        <input type="url" id="clone-url" placeholder="https://github.com/user/repo.git" />
      </div>
      <div class="modal-form-row">
        <label>Target Directory</label>
        <div style="display:flex;gap:6px;">
          <input type="text" id="clone-dir" value="${home}/Projects" style="flex:1;" />
          <button class="btn btn-secondary btn-small" id="clone-browse">Browse…</button>
        </div>
      </div>
      <div class="progress hidden" id="clone-progress"><div class="progress-bar" id="clone-bar" style="width:0%;"></div></div>
      <div id="clone-status" style="font-size:11px;color:var(--text-dim);margin-top:6px;"></div>
    `;
    const footer = document.createElement('div');
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-secondary btn-small';
    cancel.textContent = 'Cancel';
    const cloneBtn = document.createElement('button');
    cloneBtn.className = 'btn btn-primary btn-small';
    cloneBtn.textContent = 'Clone';
    footer.appendChild(cancel);
    footer.appendChild(cloneBtn);

    const handle = show(body, { title: 'Clone Repository', footer, width: 540 });
    cancel.addEventListener('click', () => handle.close());

    body.querySelector('#clone-browse').addEventListener('click', async () => {
      const dir = await api.pickFolder();
      if (dir) body.querySelector('#clone-dir').value = dir;
    });

    cloneBtn.addEventListener('click', async () => {
      const url = body.querySelector('#clone-url').value.trim();
      const baseDir = body.querySelector('#clone-dir').value.trim();
      if (!url) return;
      const repoName = url.split('/').pop().replace(/\.git$/, '');
      const target = baseDir.endsWith('/') || baseDir.endsWith('\\') ? baseDir + repoName : baseDir + '/' + repoName;

      cloneBtn.disabled = true;
      cancel.disabled = true;
      body.querySelector('#clone-progress').classList.remove('hidden');
      const bar = body.querySelector('#clone-bar');
      const status = body.querySelector('#clone-status');
      status.textContent = 'Starting clone…';

      try {
        const result = await api.git.clone(url, target, (p) => {
          if (p && typeof p.percent === 'number') bar.style.width = p.percent + '%';
          if (p && p.message) status.textContent = p.message;
        });
        if (result && result.ok === false) {
          status.textContent = 'Failed: ' + result.error;
          cloneBtn.disabled = false;
          cancel.disabled = false;
          return;
        }
        status.textContent = 'Done. Opening project…';
        bar.style.width = '100%';
        setTimeout(() => {
          handle.close();
          window.PiPilot.openProject?.(target);
        }, 400);
      } catch (err) {
        status.textContent = 'Error: ' + err.message;
        cloneBtn.disabled = false;
        cancel.disabled = false;
      }
    });
  });

  // Settings modal
  bus.on('modal:settings', async () => {
    let settingsResp;
    try { settingsResp = await api.settings.all(); } catch { settingsResp = { settings: {} }; }
    const settings = (settingsResp && settingsResp.settings) || {};
    let profiles = [];
    try { profiles = await api.terminal.profiles(); } catch {}
    let appVersion = ''; try { appVersion = await api.getVersion(); } catch {}

    const tabs = ['General', 'Editor', 'Terminal', 'AI', 'About'];
    let activeTab = 0;

    const body = document.createElement('div');

    function render() {
      body.innerHTML = '';
      const tabBar = document.createElement('div');
      tabBar.className = 'modal-tabs';
      tabs.forEach((t, i) => {
        const b = document.createElement('button');
        b.className = 'modal-tab' + (i === activeTab ? ' active' : '');
        b.textContent = t;
        b.addEventListener('click', () => { activeTab = i; render(); });
        tabBar.appendChild(b);
      });
      body.appendChild(tabBar);

      const content = document.createElement('div');
      if (activeTab === 0) {
        content.innerHTML = `
          <div class="modal-form-row"><label>Theme</label><select data-key="theme"><option value="midnight">Midnight Studio</option></select></div>
          <div class="modal-form-row"><label>Font Size: <span id="fs-val">${settings.fontSize}</span></label><input type="range" min="10" max="24" value="${settings.fontSize}" data-key="fontSize" /></div>
          <div class="modal-form-row"><label>Font Family</label><input type="text" data-key="fontFamily" value="${settings.fontFamily || ''}" /></div>
          <div class="modal-form-row"><label>Cursor Style</label><select data-key="cursorStyle">
            <option value="line"${settings.cursorStyle === 'line' ? ' selected' : ''}>Line</option>
            <option value="block"${settings.cursorStyle === 'block' ? ' selected' : ''}>Block</option>
            <option value="underline"${settings.cursorStyle === 'underline' ? ' selected' : ''}>Underline</option>
          </select></div>
        `;
      } else if (activeTab === 1) {
        content.innerHTML = `
          <div class="modal-form-row"><label>Tab Size</label><input type="number" min="1" max="8" value="${settings.tabSize}" data-key="tabSize" /></div>
          <div class="modal-form-row"><label>Word Wrap</label><select data-key="wordWrap">
            <option value="off"${settings.wordWrap === 'off' ? ' selected' : ''}>Off</option>
            <option value="on"${settings.wordWrap === 'on' ? ' selected' : ''}>On</option>
          </select></div>
          <div class="modal-form-row"><label><input type="checkbox" data-key="minimap" ${settings.minimap ? 'checked' : ''} /> Minimap</label></div>
          <div class="modal-form-row"><label><input type="checkbox" data-key="lineNumbers" ${settings.lineNumbers ? 'checked' : ''} /> Line Numbers</label></div>
          <div class="modal-form-row"><label><input type="checkbox" data-key="formatOnSave" ${settings.formatOnSave ? 'checked' : ''} /> Format On Save</label></div>
        `;
      } else if (activeTab === 2) {
        const opts = profiles.map(p => `<option value="${p.id}"${(settings.terminalProfile === p.id || (!settings.terminalProfile && p.default)) ? ' selected' : ''}>${p.name} (${p.path})</option>`).join('');
        content.innerHTML = `
          <div class="modal-form-row"><label>Default Shell</label><select data-key="terminalProfile">${opts}</select></div>
          <div class="modal-form-row"><label>Terminal Font Size</label><input type="number" min="10" max="24" value="${settings.terminalFontSize}" data-key="terminalFontSize" /></div>
        `;
      } else if (activeTab === 3) {
        content.innerHTML = `
          <div class="modal-form-row"><label>Default Agent Mode</label><select data-key="agentDefaultMode">
            <option value="agent"${settings.agentDefaultMode === 'agent' ? ' selected' : ''}>Agent</option>
            <option value="plan"${settings.agentDefaultMode === 'plan' ? ' selected' : ''}>Plan</option>
          </select></div>
          <p style="color:var(--text-dim);font-size:11px;">API endpoint and model are configured via the .env file in the project root.</p>
        `;
      } else if (activeTab === 4) {
        content.innerHTML = `
          <div style="text-align:center;padding:20px 0;">
            <div style="font-size:32px;color:var(--accent);">PiPilot IDE</div>
            <div style="color:var(--text-dim);margin-top:6px;">Version ${appVersion}</div>
            <div style="color:var(--text-dim);font-size:11px;margin-top:14px;">
              Native AI development environment.<br/>
              Built with Electron + Claude Agent SDK.
            </div>
          </div>
        `;
      }
      body.appendChild(content);

      content.querySelectorAll('[data-key]').forEach(input => {
        const key = input.dataset.key;
        const handler = async () => {
          let value;
          if (input.type === 'checkbox') value = input.checked;
          else if (input.type === 'number' || input.type === 'range') value = parseInt(input.value, 10);
          else value = input.value;
          settings[key] = value;
          if (key === 'fontSize') { const sp = body.querySelector('#fs-val'); if (sp) sp.textContent = value; }
          try { await api.settings.set(key, value); bus.emit('settings:changed', { key, value }); } catch {}
        };
        input.addEventListener('change', handler);
        if (input.type === 'range') input.addEventListener('input', handler);
      });
    }
    render();
    show(body, { title: 'Settings', width: 600 });
  });

  // Add MCP server
  bus.on('modal:add-mcp', () => {
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="modal-form-row"><label>Name</label><input type="text" id="mcp-name" placeholder="my-mcp-server" /></div>
      <div class="modal-form-row"><label>Command</label><input type="text" id="mcp-cmd" placeholder="node" /></div>
      <div class="modal-form-row"><label>Args (one per line)</label><textarea id="mcp-args" rows="3" placeholder="./server.js"></textarea></div>
      <div class="modal-form-row"><label>Env (KEY=VALUE per line)</label><textarea id="mcp-env" rows="3" placeholder="API_KEY=abc"></textarea></div>
    `;
    const footer = document.createElement('div');
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-secondary btn-small';
    cancel.textContent = 'Cancel';
    const save = document.createElement('button');
    save.className = 'btn btn-primary btn-small';
    save.textContent = 'Add';
    footer.appendChild(cancel);
    footer.appendChild(save);
    const handle = show(body, { title: 'Add MCP Server', footer, width: 480 });
    cancel.addEventListener('click', () => handle.close());
    save.addEventListener('click', async () => {
      const name = body.querySelector('#mcp-name').value.trim();
      const command = body.querySelector('#mcp-cmd').value.trim();
      const args = body.querySelector('#mcp-args').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const envLines = body.querySelector('#mcp-env').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const env = {};
      envLines.forEach(line => {
        const eq = line.indexOf('=');
        if (eq > 0) env[line.slice(0, eq)] = line.slice(eq + 1);
      });
      if (!name || !command) { bus.emit('toast:show', { message: 'Name and command required', type: 'warn' }); return; }
      const result = await api.mcp.addServer({ name, command, args, env, enabled: true });
      handle.close();
      bus.emit('toast:show', { message: 'MCP server added', type: 'success' });
      bus.emit('panels:refresh', 'extensions');
    });
  });

  // Connect cloud provider
  bus.on('modal:connect-cloud', async (providerId) => {
    let connectors = [];
    try {
      const r = await api.cloud.listConnectors();
      connectors = (r && r.connectors) || r || [];
    } catch {}
    const provider = connectors.find(c => c.id === providerId) || { id: providerId, name: providerId, authUrl: '' };

    const body = document.createElement('div');
    body.innerHTML = `
      <p style="margin-bottom:12px;color:var(--text);">Paste your personal access token for <strong>${provider.name}</strong>.</p>
      ${provider.authUrl ? `<p style="margin-bottom:12px;font-size:11px;"><a href="#" id="cloud-link">Get a token →</a></p>` : ''}
      <div class="modal-form-row"><label>Token</label><input type="password" id="cloud-token" placeholder="ghp_..." /></div>
      <div id="cloud-status" style="font-size:11px;color:var(--text-dim);margin-top:8px;"></div>
    `;
    const footer = document.createElement('div');
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-secondary btn-small';
    cancel.textContent = 'Cancel';
    const save = document.createElement('button');
    save.className = 'btn btn-primary btn-small';
    save.textContent = 'Connect';
    footer.appendChild(cancel);
    footer.appendChild(save);
    const handle = show(body, { title: `Connect ${provider.name}`, footer, width: 480 });
    cancel.addEventListener('click', () => handle.close());
    const link = body.querySelector('#cloud-link');
    if (link) link.addEventListener('click', (e) => { e.preventDefault(); api.shell.openExternal(provider.authUrl); });
    save.addEventListener('click', async () => {
      const token = body.querySelector('#cloud-token').value.trim();
      const status = body.querySelector('#cloud-status');
      if (!token) { status.textContent = 'Token required'; return; }
      save.disabled = true;
      status.textContent = 'Saving…';
      const saveRes = await api.cloud.saveToken(provider.id, token, {});
      if (saveRes && saveRes.ok === false) { status.textContent = 'Save failed: ' + saveRes.error; save.disabled = false; return; }
      status.textContent = 'Testing connection…';
      const test = await api.cloud.testConnection(provider.id);
      if (test && test.ok === false) {
        status.textContent = 'Connected, but test failed: ' + test.error;
      } else {
        status.textContent = 'Connected as ' + ((test && test.username) || '✓');
      }
      setTimeout(() => { handle.close(); bus.emit('panels:refresh', 'extensions'); }, 700);
    });
  });

  bus.on('modal:about', async () => {
    let v = ''; try { v = await api.getVersion(); } catch {}
    alertDialog({ title: 'About PiPilot IDE', message: `Version ${v}\nNative AI development environment.` });
  });

  // Tutorial overlay
  const TUTORIALS = {
    'get-started': [
      { title: 'Welcome to PiPilot', body: 'A native AI-powered IDE. Let\'s take a quick tour.' },
      { title: 'Open a Folder', body: 'Click "Open Folder" on the welcome screen, or press Ctrl+O.' },
      { title: 'File Explorer', body: 'Browse, search, and edit files from the left sidebar.' },
      { title: 'AI Chat', body: 'Press Ctrl+I to chat with the AI agent. It can read and edit your code.' },
    ],
    'ai-power': [
      { title: 'Ctrl+I', body: 'Open the chat anytime, anywhere.' },
      { title: '@ Mentions', body: 'Type @ to attach files from your project.' },
      { title: 'Plan Mode', body: 'Switch the chat to Plan mode to discuss before changes are applied.' },
      { title: 'Checkpoints', body: 'Snapshot your project before risky AI operations.' },
      { title: 'Tools', body: 'The agent uses tools to read, write, and run commands. Click any tool card to inspect it.' },
    ],
  };

  bus.on('tutorial:show', (id) => {
    const steps = TUTORIALS[id];
    if (!steps || !steps.length) return;
    let i = 0;
    const overlay = document.createElement('div');
    overlay.className = 'tutorial-overlay';
    function render() {
      const s = steps[i];
      overlay.innerHTML = `
        <div class="tutorial-card">
          <h3>${s.title}</h3>
          <p>${s.body}</p>
          <div class="tutorial-footer">
            <a href="#" id="tut-skip" style="color:var(--text-dim);font-size:11px;">Skip</a>
            <div class="tutorial-dots">${steps.map((_, j) => `<span class="tutorial-dot${j === i ? ' active' : ''}"></span>`).join('')}</div>
            <button class="btn btn-primary btn-small" id="tut-next">${i === steps.length - 1 ? 'Done' : 'Next'}</button>
          </div>
        </div>
      `;
      overlay.querySelector('#tut-skip').addEventListener('click', (e) => { e.preventDefault(); overlay.remove(); });
      overlay.querySelector('#tut-next').addEventListener('click', () => {
        i++;
        if (i >= steps.length) overlay.remove();
        else render();
      });
    }
    render();
    document.body.appendChild(overlay);
  });

  window.PiPilot.modal = { show, prompt, confirm, alert: alertDialog };
})();
