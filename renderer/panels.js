// PiPilot IDE — Sidebar panel renderers (Phase 5)
// Registered on window.PiPilot.panels — sidebar.js calls these for git/extensions/checkpoints/deploy.

(function () {
  const api = window.electronAPI;
  const bus = window.PiPilot.bus;
  const state = window.PiPilot.state;

  function injectStyles() {
    if (document.getElementById('panels-inline-styles')) return;
    const css = `
.p-section { padding: 8px 12px; border-bottom: 1px solid var(--border); }
.p-section h4 { color: var(--text-mid); font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; font-weight: 600; }
.p-row {
  display: flex; align-items: center; gap: 6px; padding: 4px 6px; font-size: var(--fs-sm);
  border-radius: 3px; cursor: pointer;
}
.p-row:hover { background: var(--surface-alt); }
.p-row .name { flex: 1; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.p-row .badge-mini { font-size: 10px; padding: 1px 5px; border-radius: 3px; font-family: var(--font-mono); }
.p-row .badge-M { background: rgba(108,182,255,0.15); color: var(--info); }
.p-row .badge-A { background: rgba(86,211,100,0.15); color: var(--ok); }
.p-row .badge-D { background: rgba(229,83,75,0.15); color: var(--error); }
.p-row .badge-U, .p-row .badge-\\? { background: rgba(229,166,57,0.15); color: var(--warn); }
.p-row .row-actions { display: none; gap: 2px; }
.p-row:hover .row-actions { display: inline-flex; }
.p-row .row-actions button { padding: 1px 4px; font-size: 10px; color: var(--text-dim); background: transparent; border: 1px solid var(--border); border-radius: 3px; }
.p-row .row-actions button:hover { color: var(--accent); border-color: var(--accent); }

.p-commit {
  padding: 8px 12px; border-bottom: 1px solid var(--border);
}
.p-commit textarea {
  width: 100%; min-height: 50px; max-height: 140px; padding: 6px 8px;
  background: var(--surface-alt); border: 1px solid var(--border); border-radius: var(--radius);
  color: var(--text-strong); font-family: var(--font-sans); font-size: var(--fs-sm); resize: vertical;
}
.p-commit-actions { display: flex; gap: 6px; margin-top: 6px; }

.p-tabs { display: flex; border-bottom: 1px solid var(--border); }
.p-tab {
  flex: 1; padding: 8px; font-size: var(--fs-sm); color: var(--text-mid);
  background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer;
}
.p-tab.active { color: var(--text-strong); border-bottom-color: var(--accent); }

.connector-card {
  display: flex; gap: 10px; padding: 10px; border: 1px solid var(--border);
  border-radius: var(--radius); margin: 6px 0; align-items: center;
}
.connector-card .icon { font-size: 22px; }
.connector-card .info { flex: 1; }
.connector-card .info .name { color: var(--text-strong); font-weight: 500; font-size: var(--fs-sm); }
.connector-card .info .desc { color: var(--text-dim); font-size: 11px; }
.connector-card .info .conn { color: var(--ok); font-size: 11px; margin-top: 2px; }

.toggle {
  position: relative; width: 28px; height: 16px; background: var(--border);
  border-radius: 8px; cursor: pointer; transition: background var(--t);
}
.toggle.on { background: var(--accent); }
.toggle::after {
  content: ''; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px;
  background: white; border-radius: 50%; transition: transform var(--t);
}
.toggle.on::after { transform: translateX(12px); }

.cp-item {
  padding: 10px; border-bottom: 1px solid var(--border);
}
.cp-item .label { color: var(--text-strong); font-weight: 500; font-size: var(--fs-sm); }
.cp-item .meta { color: var(--text-dim); font-size: 11px; margin: 2px 0 6px; }
.cp-item .actions { display: flex; gap: 6px; }

.dev-item {
  padding: 10px; border-bottom: 1px solid var(--border);
}
.dev-item .cmd { font-family: var(--font-mono); font-size: 11px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dev-item .url { color: var(--info); font-size: 11px; margin-top: 2px; }
.dev-item .status-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 4px; }
.dev-item .status-dot.running { background: var(--ok); }
.dev-item .status-dot.stopped { background: var(--text-faint); }
.dev-item .status-dot.error { background: var(--error); }

.commits-list { max-height: 240px; overflow-y: auto; }
.commit-row { padding: 6px 12px; font-size: 11px; border-bottom: 1px solid var(--border); }
.commit-row .hash { color: var(--accent); font-family: var(--font-mono); }
.commit-row .msg { color: var(--text); }
.commit-row .meta { color: var(--text-dim); font-size: 10px; }
`;
    const s = document.createElement('style');
    s.id = 'panels-inline-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }
  injectStyles();

  function timeAgo(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    const d = Math.floor(h / 24);
    return d + 'd ago';
  }

  function fmtSize(n) {
    if (!n) return '0B';
    if (n < 1024) return n + 'B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + 'KB';
    return (n / 1024 / 1024).toFixed(1) + 'MB';
  }

  function el(tag, props, ...children) {
    const e = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'onClick') e.addEventListener('click', v);
        else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
        else e.setAttribute(k, v);
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  // ---------------- GIT PANEL ----------------
  async function renderGitPanel(container, projectPath) {
    container.innerHTML = '<div class="p-section"><h4>Source Control</h4><div style="color:var(--text-dim);font-size:11px;">Loading…</div></div>';
    let statusResp;
    try { statusResp = await api.git.status(projectPath); } catch (e) { statusResp = { ok: false, error: e.message }; }
    if (!statusResp || statusResp.ok === false) {
      container.innerHTML = `<div class="p-section"><h4>Source Control</h4><div style="color:var(--text-dim);font-size:11px;">${statusResp ? statusResp.error : 'Not a git repository'}</div><button class="btn btn-secondary btn-small" id="git-init" style="margin-top:8px;">Initialize Git Repo</button></div>`;
      const btn = container.querySelector('#git-init');
      if (btn) btn.addEventListener('click', async () => { await api.git.init(projectPath); renderGitPanel(container, projectPath); });
      return;
    }

    const status = statusResp.status || statusResp;
    bus.emit('git:branch-changed', status.branch);

    container.innerHTML = '';
    const header = el('div', { class: 'panel-header' },
      el('span', { class: 'panel-title' }, status.branch || '(detached)'),
      el('div', { class: 'panel-actions' },
        el('button', { class: 'icon-btn', title: 'Refresh', onClick: () => renderGitPanel(container, projectPath) }, '↻'),
        el('button', { class: 'icon-btn', title: 'Pull', onClick: async () => { await api.git.pull(projectPath); renderGitPanel(container, projectPath); } }, '⬇'),
        el('button', { class: 'icon-btn', title: 'Push', onClick: async () => { const r = await api.git.push(projectPath); bus.emit('toast:show', { message: r && r.ok === false ? 'Push failed: ' + r.error : 'Pushed', type: r && r.ok === false ? 'error' : 'success' }); } }, '⬆')
      )
    );
    container.appendChild(header);

    const commitBox = el('div', { class: 'p-commit' },
      el('textarea', { id: 'git-commit-msg', placeholder: 'Commit message…' }),
      el('div', { class: 'p-commit-actions' },
        el('button', { class: 'btn btn-primary btn-small', style: { flex: '1' }, onClick: async () => {
          const msg = container.querySelector('#git-commit-msg').value.trim();
          if (!msg) { bus.emit('toast:show', { message: 'Enter a commit message', type: 'warn' }); return; }
          await api.git.add(projectPath, '.');
          const r = await api.git.commit(projectPath, msg);
          if (r && r.ok === false) bus.emit('toast:show', { message: 'Commit failed: ' + r.error, type: 'error' });
          else { bus.emit('toast:show', { message: 'Committed ' + (r.hash || '').slice(0, 7), type: 'success' }); renderGitPanel(container, projectPath); }
        } }, 'Commit')
      )
    );
    container.appendChild(commitBox);

    function renderFileSection(title, files, opts = {}) {
      const sec = el('div', { class: 'p-section' });
      sec.appendChild(el('h4', null, `${title} (${files.length})`));
      files.forEach(f => {
        const row = el('div', { class: 'p-row', onClick: () => bus.emit('file:open', { path: typeof f === 'string' ? f : (f.path || f) }) });
        const status = (f.status || (opts.status || '?')).trim() || '?';
        const safe = status.replace(/[^a-zA-Z?]/g, '');
        row.appendChild(el('span', { class: 'badge-mini badge-' + (safe || '?') }, status));
        row.appendChild(el('span', { class: 'name' }, typeof f === 'string' ? f : f.path));
        const actions = el('div', { class: 'row-actions' });
        if (opts.canStage) {
          const stageBtn = el('button', { onClick: async (e) => { e.stopPropagation(); await api.git.add(projectPath, [typeof f === 'string' ? f : f.path]); renderGitPanel(container, projectPath); } }, '+');
          actions.appendChild(stageBtn);
        }
        if (opts.canDiscard) {
          const disBtn = el('button', { onClick: async (e) => {
            e.stopPropagation();
            if (await window.PiPilot.modal.confirm({ title: 'Discard changes?', message: 'Local changes to ' + (typeof f === 'string' ? f : f.path) + ' will be lost.', danger: true })) {
              await api.git.discard(projectPath, typeof f === 'string' ? f : f.path);
              renderGitPanel(container, projectPath);
            }
          } }, '↺');
          actions.appendChild(disBtn);
        }
        row.appendChild(actions);
        sec.appendChild(row);
      });
      container.appendChild(sec);
    }

    const stagedFiles = (status.files || []).filter(f => f.index && f.index !== ' ' && f.index !== '?');
    const unstagedFiles = (status.files || []).filter(f => f.working_dir && f.working_dir !== ' ' && f.index !== '?');
    const untrackedFiles = (status.files || []).filter(f => f.index === '?' || f.working_dir === '?');

    renderFileSection('Staged Changes', stagedFiles, { canStage: false });
    renderFileSection('Changes', unstagedFiles, { canStage: true, canDiscard: true });
    renderFileSection('Untracked', untrackedFiles, { canStage: true });

    // Recent commits
    try {
      const logResp = await api.git.log(projectPath, { limit: 10 });
      const commits = (logResp && logResp.commits) || [];
      if (commits.length) {
        const sec = el('div', { class: 'p-section' });
        sec.appendChild(el('h4', null, 'Recent Commits'));
        const list = el('div', { class: 'commits-list' });
        commits.forEach(c => {
          const r = el('div', { class: 'commit-row' });
          r.appendChild(el('div', null,
            el('span', { class: 'hash' }, (c.abbreviatedHash || c.hash || '').slice(0, 7) + ' '),
            el('span', { class: 'msg' }, c.message || '')
          ));
          r.appendChild(el('div', { class: 'meta' }, `${c.author || ''} · ${c.date || ''}`));
          list.appendChild(r);
        });
        sec.appendChild(list);
        container.appendChild(sec);
      }
    } catch {}
  }

  // ---------------- EXTENSIONS PANEL ----------------
  async function renderExtensionsPanel(container, projectPath) {
    container.innerHTML = '';
    let activeTab = 'mcp';

    async function render() {
      container.innerHTML = '';
      const header = el('div', { class: 'panel-header' }, el('span', { class: 'panel-title' }, 'Extensions'));
      container.appendChild(header);

      const tabs = el('div', { class: 'p-tabs' });
      ['mcp', 'cloud'].forEach(t => {
        const b = el('button', { class: 'p-tab' + (activeTab === t ? ' active' : ''), onClick: () => { activeTab = t; render(); } }, t === 'mcp' ? 'MCP Servers' : 'Cloud Connectors');
        tabs.appendChild(b);
      });
      container.appendChild(tabs);

      if (activeTab === 'mcp') {
        const sec = el('div', { class: 'p-section' });
        sec.appendChild(el('button', { class: 'btn btn-secondary btn-small', style: { width: '100%', marginBottom: '8px' }, onClick: () => bus.emit('modal:add-mcp') }, '+ Add MCP Server'));
        let resp;
        try { resp = await api.mcp.listServers(); } catch { resp = { servers: [] }; }
        const servers = (resp && resp.servers) || [];
        if (!servers.length) {
          sec.appendChild(el('div', { style: { color: 'var(--text-dim)', fontSize: '11px' } }, 'No MCP servers configured'));
        }
        servers.forEach(s => {
          const card = el('div', { class: 'connector-card' },
            el('div', { class: 'icon' }, '🧩'),
            el('div', { class: 'info' },
              el('div', { class: 'name' }, s.name),
              el('div', { class: 'desc', style: { fontFamily: 'var(--font-mono)', fontSize: '10px' } }, `${s.command || ''} ${(s.args || []).join(' ')}`)
            ),
            el('div', { class: 'toggle' + (s.enabled ? ' on' : ''), onClick: async () => { await api.mcp.toggleServer(s.id, !s.enabled); render(); } })
          );
          card.appendChild(el('button', { class: 'icon-btn', onClick: async () => { await api.mcp.removeServer(s.id); render(); } }, '×'));
          sec.appendChild(card);
        });
        container.appendChild(sec);
      } else {
        const sec = el('div', { class: 'p-section' });
        let resp;
        try { resp = await api.cloud.listConnectors(); } catch { resp = { connectors: [] }; }
        const list = (resp && resp.connectors) || resp || [];
        list.forEach(c => {
          const card = el('div', { class: 'connector-card' },
            el('div', { class: 'icon' }, c.icon || '☁'),
            el('div', { class: 'info' },
              el('div', { class: 'name' }, c.name),
              el('div', { class: 'desc' }, c.desc || ''),
              c.connected ? el('div', { class: 'conn' }, c.username ? `Connected as @${c.username}` : 'Connected') : null
            )
          );
          if (c.connected) {
            card.appendChild(el('button', { class: 'btn btn-secondary btn-small', onClick: async () => {
              if (await window.PiPilot.modal.confirm({ title: 'Disconnect?', message: `Disconnect ${c.name}?` })) {
                await api.cloud.deleteToken(c.id);
                render();
              }
            } }, 'Disconnect'));
          } else {
            card.appendChild(el('button', { class: 'btn btn-primary btn-small', onClick: () => bus.emit('modal:connect-cloud', c.id) }, 'Connect'));
          }
          sec.appendChild(card);
        });
        container.appendChild(sec);
      }
    }
    render();
  }

  // ---------------- CHECKPOINTS PANEL ----------------
  async function renderCheckpointsPanel(container, projectPath) {
    async function render() {
      container.innerHTML = '';
      const header = el('div', { class: 'panel-header' },
        el('span', { class: 'panel-title' }, 'Checkpoints'),
        el('div', { class: 'panel-actions' },
          el('button', { class: 'icon-btn', title: 'Create checkpoint', onClick: async () => {
            const label = await window.PiPilot.modal.prompt({ title: 'Create Checkpoint', label: 'Label', placeholder: 'before-refactor' });
            if (label == null) return;
            bus.emit('toast:show', { message: 'Creating checkpoint…', type: 'info' });
            const r = await api.checkpoints.create(projectPath, label || 'snapshot');
            if (r && r.ok === false) bus.emit('toast:show', { message: 'Failed: ' + r.error, type: 'error' });
            else bus.emit('toast:show', { message: 'Checkpoint created', type: 'success' });
            render();
          } }, '+')
        )
      );
      container.appendChild(header);

      let resp;
      try { resp = await api.checkpoints.list(projectPath); } catch { resp = { checkpoints: [] }; }
      const list = (resp && resp.checkpoints) || [];
      if (!list.length) {
        container.appendChild(el('div', { class: 'empty-state' }, 'No checkpoints yet'));
        return;
      }
      list.forEach(cp => {
        const item = el('div', { class: 'cp-item' },
          el('div', { class: 'label' }, cp.label || cp.id),
          el('div', { class: 'meta' }, `${timeAgo(cp.createdAt)} · ${fmtSize(cp.sizeBytes)}${cp.auto ? ' · auto' : ''}`),
          el('div', { class: 'actions' },
            el('button', { class: 'btn btn-secondary btn-small', onClick: async () => {
              if (await window.PiPilot.modal.confirm({ title: 'Restore checkpoint?', message: 'This will overwrite current files. A backup will be auto-created.', danger: true, confirmText: 'Restore' })) {
                bus.emit('toast:show', { message: 'Restoring…', type: 'info' });
                const r = await api.checkpoints.restore(projectPath, cp.id);
                if (r && r.ok === false) bus.emit('toast:show', { message: 'Restore failed: ' + r.error, type: 'error' });
                else bus.emit('toast:show', { message: 'Restored', type: 'success' });
                render();
              }
            } }, 'Restore'),
            el('button', { class: 'btn btn-secondary btn-small', onClick: async () => {
              if (await window.PiPilot.modal.confirm({ title: 'Delete checkpoint?', message: cp.label, danger: true })) {
                await api.checkpoints.delete(projectPath, cp.id);
                render();
              }
            } }, 'Delete')
          )
        );
        container.appendChild(item);
      });
    }
    render();
  }

  // ---------------- DEPLOY PANEL ----------------
  async function renderDeployPanel(container, projectPath) {
    async function render() {
      container.innerHTML = '';
      const header = el('div', { class: 'panel-header' },
        el('span', { class: 'panel-title' }, 'Deploy'),
        el('div', { class: 'panel-actions' },
          el('button', { class: 'icon-btn', title: 'Refresh', onClick: render }, '↻')
        )
      );
      container.appendChild(header);

      const sec1 = el('div', { class: 'p-section' });
      sec1.appendChild(el('h4', null, 'Dev Servers'));
      sec1.appendChild(el('button', { class: 'btn btn-primary btn-small', style: { width: '100%', marginBottom: '8px' }, onClick: async () => {
        bus.emit('toast:show', { message: 'Starting dev server…', type: 'info' });
        const r = await api.devServer.start(projectPath);
        if (r && r.ok === false) bus.emit('toast:show', { message: 'Start failed: ' + r.error, type: 'error' });
        else bus.emit('toast:show', { message: 'Dev server started', type: 'success' });
        render();
      } }, '▶ Start Dev Server'));

      let resp;
      try { resp = await api.devServer.list(); } catch { resp = { servers: [] }; }
      const servers = ((resp && resp.servers) || []).filter(s => s.projectPath === projectPath);
      if (!servers.length) {
        sec1.appendChild(el('div', { style: { color: 'var(--text-dim)', fontSize: '11px' } }, 'No dev servers running'));
      }
      servers.forEach(s => {
        const item = el('div', { class: 'dev-item' });
        item.appendChild(el('div', null,
          el('span', { class: 'status-dot ' + s.status }),
          el('span', { class: 'cmd' }, s.cmd)
        ));
        if (s.url) item.appendChild(el('div', { class: 'url', onClick: () => api.shell.openExternal(s.url), style: { cursor: 'pointer' } }, s.url));
        const actions = el('div', { class: 'actions', style: { display: 'flex', gap: '6px', marginTop: '6px' } });
        if (s.status === 'running') {
          actions.appendChild(el('button', { class: 'btn btn-secondary btn-small', onClick: async () => { await api.devServer.stop(s.id); render(); } }, 'Stop'));
        }
        item.appendChild(actions);
        sec1.appendChild(item);
      });
      container.appendChild(sec1);

      const sec2 = el('div', { class: 'p-section' });
      sec2.appendChild(el('h4', null, 'Cloud Deploy'));
      let connResp;
      try { connResp = await api.cloud.listConnectors(); } catch { connResp = { connectors: [] }; }
      const connectors = ((connResp && connResp.connectors) || connResp || []).filter(c => ['vercel', 'netlify', 'cloudflare'].includes(c.id));
      connectors.forEach(c => {
        const card = el('div', { class: 'connector-card' },
          el('div', { class: 'icon' }, c.icon),
          el('div', { class: 'info' },
            el('div', { class: 'name' }, c.name),
            el('div', { class: 'desc' }, c.connected ? 'Connected' : 'Not connected')
          ),
          el('button', { class: 'btn btn-primary btn-small', disabled: !c.connected ? '' : null, onClick: () => {
            if (!c.connected) bus.emit('modal:connect-cloud', c.id);
            else bus.emit('toast:show', { message: `${c.name} deploy: coming soon`, type: 'info' });
          } }, c.connected ? 'Deploy' : 'Connect')
        );
        sec2.appendChild(card);
      });
      container.appendChild(sec2);
    }
    render();
  }

  window.PiPilot.panels = {
    git: renderGitPanel,
    extensions: renderExtensionsPanel,
    checkpoints: renderCheckpointsPanel,
    deploy: renderDeployPanel,
  };

  bus.on('panels:refresh', (panel) => {
    bus.emit('panel:switch', panel);
  });

  bus.on('git:changed', () => {
    const sidePanel = document.getElementById('side-panel-inner');
    if (sidePanel && sidePanel.dataset.panel === 'git' && state.projectPath) {
      renderGitPanel(sidePanel, state.projectPath);
    }
  });
})();
