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

.commits-list { max-height: 320px; overflow-y: auto; }
.commit-row { padding: 6px 12px; font-size: 11px; border-bottom: 1px solid var(--border); cursor: pointer; }
.commit-row:hover { background: var(--surface-alt); }
.commit-row .hash { color: var(--accent); font-family: var(--font-mono); }
.commit-row .msg { color: var(--text); }
.commit-row .meta { color: var(--text-dim); font-size: 10px; }

.git-section { padding: 0; }
.git-sec-head {
  display: flex; align-items: center; gap: 6px; padding: 6px 10px;
  cursor: pointer; user-select: none; border-bottom: 1px solid var(--border);
  background: var(--surface); font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;
  color: var(--text-mid); font-weight: 600;
}
.git-sec-head:hover { background: var(--surface-alt); }
.git-chev { color: var(--text-dim); font-size: 10px; display: inline-flex; align-items: center; width: 10px; }
.git-sec-title { flex: 1; color: var(--text-strong); }
.git-count {
  font-size: 10px; padding: 0 6px; background: var(--surface-alt);
  color: var(--text-mid); border-radius: 10px; font-weight: 500;
}
.git-group-actions { display: flex; gap: 2px; }
.git-group-actions .icon-btn { width: 20px; height: 20px; font-size: 11px; }
.git-sec-body { padding: 4px 0; }
.git-section.collapsed .git-sec-body { display: none; }
.git-empty { padding: 4px 16px; font-size: 11px; color: var(--text-faint); }

.git-row { padding: 3px 10px; font-size: var(--fs-sm); }
.git-row .name { font-weight: 400; color: var(--text); }
.git-row .git-dir {
  color: var(--text-faint); font-size: 10px; padding-left: 6px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 120px;
}
.git-row .row-actions { margin-right: 6px; }
.git-row .row-actions button { width: 20px; height: 18px; padding: 0; font-size: 11px; line-height: 1; }
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
  // Maps one Porcelain XY status pair to a single letter (prefer index when
  // present) and a descriptive title. Mirrors how VS Code's SCM view renders
  // the M/A/D/R/U badges.
  function statusLetter(f) {
    const i = (f.index || '').trim();
    const w = (f.working_dir || '').trim();
    if (i === '?' || w === '?') return { letter: 'U', title: 'Untracked' };
    if (i === 'A') return { letter: 'A', title: 'Added' };
    if (i === 'D' || w === 'D') return { letter: 'D', title: 'Deleted' };
    if (i === 'R') return { letter: 'R', title: 'Renamed' };
    if (i === 'C') return { letter: 'C', title: 'Copied' };
    if (i === 'M' || w === 'M') return { letter: 'M', title: 'Modified' };
    if (i === 'U' || w === 'U' || (f.conflicted)) return { letter: '!', title: 'Conflicted' };
    return { letter: '?', title: 'Changed' };
  }

  function guessLanguage(filePath) {
    const ext = (filePath.split('.').pop() || '').toLowerCase();
    const map = {
      js: 'javascript', mjs: 'javascript', jsx: 'javascript',
      ts: 'typescript', tsx: 'typescript',
      json: 'json', md: 'markdown', html: 'html', css: 'css', scss: 'scss',
      py: 'python', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin',
      c: 'c', h: 'c', cpp: 'cpp', cs: 'csharp', php: 'php',
      sh: 'shell', bash: 'shell', yml: 'yaml', yaml: 'yaml', toml: 'ini',
    };
    return map[ext] || 'plaintext';
  }

  async function openGitDiff(projectPath, file, staged) {
    try {
      const res = await api.git.fileVersions(projectPath, file, staged);
      if (!res || res.ok === false) {
        bus.emit('toast:show', { message: 'Diff unavailable: ' + (res?.error || 'unknown'), type: 'error' });
        return;
      }
      const id = `pipilot://git-diff/${staged ? 'index' : 'working'}/${file}`;
      const label = staged ? 'Index ↔ HEAD' : 'Working ↔ HEAD';
      window.PiPilot.editor?.openDiffTab?.({
        id,
        name: file.split('/').pop() + ' (Git)',
        original: res.original || '',
        modified: res.modified || '',
        language: guessLanguage(file),
        originalTitle: `${file}  (HEAD)`,
        modifiedTitle: `${file}  (${staged ? 'Index' : 'Working'})`,
      });
      bus.emit('toast:show', { message: label, type: 'info' });
    } catch (e) {
      bus.emit('toast:show', { message: 'Diff failed: ' + e.message, type: 'error' });
    }
  }

  async function renderGitPanel(container, projectPath) {
    container.innerHTML = '<div class="p-section"><div style="color:var(--text-dim);font-size:11px;">Loading source control…</div></div>';
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

    // ---------- Header: branch + ahead/behind + sync/refresh ----------
    const ahead = status.ahead || 0;
    const behind = status.behind || 0;
    const syncLabel = (ahead || behind) ? `${behind ? '↓' + behind : ''}${ahead ? ' ↑' + ahead : ''}`.trim() : '';
    const header = el('div', { class: 'panel-header' },
      el('span', { class: 'panel-title' },
        el('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } },
          el('span', null, '⎇ ' + (status.branch || '(detached)')),
          syncLabel ? el('span', { style: { color: 'var(--text-dim)', fontSize: '10px' } }, syncLabel) : null,
        )
      ),
      el('div', { class: 'panel-actions' },
        el('button', { class: 'icon-btn', title: 'Refresh', onClick: () => renderGitPanel(container, projectPath) }, '↻'),
        el('button', { class: 'icon-btn', title: 'Pull (fetch + merge)', onClick: async () => {
          bus.emit('toast:show', { message: 'Pulling…', type: 'info' });
          const r = await api.git.pull(projectPath);
          bus.emit('toast:show', { message: r?.ok === false ? 'Pull failed: ' + r.error : 'Pulled', type: r?.ok === false ? 'error' : 'success' });
          renderGitPanel(container, projectPath);
        } }, '⬇'),
        el('button', { class: 'icon-btn', title: 'Push', onClick: async () => {
          bus.emit('toast:show', { message: 'Pushing…', type: 'info' });
          const r = await api.git.push(projectPath);
          bus.emit('toast:show', { message: r?.ok === false ? 'Push failed: ' + r.error : 'Pushed', type: r?.ok === false ? 'error' : 'success' });
          renderGitPanel(container, projectPath);
        } }, '⬆'),
      )
    );
    container.appendChild(header);

    // ---------- Commit message composer ----------
    const commitBox = el('div', { class: 'p-commit' });
    const textarea = el('textarea', { id: 'git-commit-msg', placeholder: 'Commit message (Ctrl+Enter to commit)' });
    commitBox.appendChild(textarea);

    const commitActions = el('div', { class: 'p-commit-actions' });
    const commitBtn = el('button', {
      class: 'btn btn-primary btn-small',
      style: { flex: '1' },
      onClick: async () => {
        const msg = textarea.value.trim();
        if (!msg) { bus.emit('toast:show', { message: 'Enter a commit message', type: 'warn' }); return; }
        const stagedCount = (status.files || []).filter(f => f.index && f.index !== ' ' && f.index !== '?').length;
        if (!stagedCount) {
          const addAll = await window.PiPilot.modal.confirm({ title: 'Nothing staged', message: 'Stage all changes and commit?', confirmText: 'Stage & Commit' });
          if (!addAll) return;
          await api.git.add(projectPath, '.');
        }
        const r = await api.git.commit(projectPath, msg);
        if (r?.ok === false) bus.emit('toast:show', { message: 'Commit failed: ' + r.error, type: 'error' });
        else {
          bus.emit('toast:show', { message: 'Committed ' + (r.hash || '').slice(0, 7), type: 'success' });
          textarea.value = '';
          renderGitPanel(container, projectPath);
        }
      },
    }, 'Commit');
    const aiBtn = el('button', {
      class: 'btn btn-secondary btn-small',
      title: 'Generate commit message with AI',
      onClick: async () => {
        aiBtn.disabled = true;
        aiBtn.textContent = '…';
        try {
          const diffResp = await api.git.diff(projectPath, null);
          const stagedDiff = await api.git.diff(projectPath, null);
          const diff = stagedDiff?.diff || diffResp?.diff || '';
          if (!diff.trim()) {
            bus.emit('toast:show', { message: 'No changes to summarize', type: 'warn' });
            return;
          }
          const r = await api.codestral.commitMessage({ diff });
          if (r?.ok && r.text) {
            textarea.value = r.text;
            textarea.focus();
          } else {
            bus.emit('toast:show', { message: 'AI commit message failed: ' + (r?.error || 'unknown'), type: 'error' });
          }
        } catch (e) {
          bus.emit('toast:show', { message: 'AI commit message failed: ' + e.message, type: 'error' });
        } finally {
          aiBtn.disabled = false;
          aiBtn.textContent = '✦ AI';
        }
      },
    }, '✦ AI');
    commitActions.appendChild(aiBtn);
    commitActions.appendChild(commitBtn);
    commitBox.appendChild(commitActions);
    container.appendChild(commitBox);

    textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        commitBtn.click();
      }
    });

    // ---------- File sections ----------
    function renderFileSection(title, files, opts = {}) {
      const sec = el('div', { class: 'p-section git-section' });
      if (opts.collapseKey) sec.dataset.key = opts.collapseKey;

      const headerRow = el('div', { class: 'git-sec-head' });
      const chev = el('span', { class: 'git-chev' }, '▾');
      headerRow.appendChild(chev);
      headerRow.appendChild(el('span', { class: 'git-sec-title' }, title));
      headerRow.appendChild(el('span', { class: 'git-count' }, String(files.length)));

      const groupActions = el('div', { class: 'git-group-actions' });
      if (opts.canStageAll && files.length) {
        groupActions.appendChild(el('button', { class: 'icon-btn', title: 'Stage All', onClick: async (e) => {
          e.stopPropagation();
          await api.git.add(projectPath, files.map(f => f.path));
          renderGitPanel(container, projectPath);
        } }, '+'));
      }
      if (opts.canUnstageAll && files.length) {
        groupActions.appendChild(el('button', { class: 'icon-btn', title: 'Unstage All', onClick: async (e) => {
          e.stopPropagation();
          await api.git.unstage(projectPath, files.map(f => f.path));
          renderGitPanel(container, projectPath);
        } }, '−'));
      }
      if (opts.canDiscardAll && files.length) {
        groupActions.appendChild(el('button', { class: 'icon-btn', title: 'Discard All', onClick: async (e) => {
          e.stopPropagation();
          if (await window.PiPilot.modal.confirm({ title: 'Discard all changes?', message: `${files.length} file(s) will lose local changes.`, danger: true })) {
            for (const f of files) await api.git.discard(projectPath, f.path);
            renderGitPanel(container, projectPath);
          }
        } }, '↺'));
      }
      headerRow.appendChild(groupActions);
      sec.appendChild(headerRow);

      const body = el('div', { class: 'git-sec-body' });
      if (!files.length) {
        body.appendChild(el('div', { class: 'git-empty' }, 'None'));
      }
      files.forEach(f => {
        const filePath = f.path;
        const { letter, title: statusTitle } = statusLetter(f);
        const row = el('div', {
          class: 'p-row git-row',
          title: filePath,
          onClick: () => openGitDiff(projectPath, filePath, !!opts.isStaged),
        });
        const letterCls = letter === 'U' || letter === '?' ? 'U' : letter;
        row.appendChild(el('span', { class: 'name' }, filePath.split('/').pop()));
        row.appendChild(el('span', { class: 'git-dir' }, filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : ''));
        const actions = el('div', { class: 'row-actions' });

        actions.appendChild(el('button', {
          title: 'Open File',
          onClick: (e) => {
            e.stopPropagation();
            bus.emit('file:open', { path: projectPath + '/' + filePath });
          },
        }, '↗'));

        if (opts.canDiscard) {
          actions.appendChild(el('button', {
            title: 'Discard Changes',
            onClick: async (e) => {
              e.stopPropagation();
              if (await window.PiPilot.modal.confirm({ title: 'Discard changes?', message: 'Local changes to ' + filePath + ' will be lost.', danger: true })) {
                await api.git.discard(projectPath, filePath);
                renderGitPanel(container, projectPath);
              }
            },
          }, '↺'));
        }
        if (opts.canStage) {
          actions.appendChild(el('button', {
            title: 'Stage Changes',
            onClick: async (e) => {
              e.stopPropagation();
              await api.git.add(projectPath, [filePath]);
              renderGitPanel(container, projectPath);
            },
          }, '+'));
        }
        if (opts.canUnstage) {
          actions.appendChild(el('button', {
            title: 'Unstage Changes',
            onClick: async (e) => {
              e.stopPropagation();
              await api.git.unstage(projectPath, [filePath]);
              renderGitPanel(container, projectPath);
            },
          }, '−'));
        }
        row.appendChild(actions);
        row.appendChild(el('span', { class: 'badge-mini badge-' + letterCls, title: statusTitle }, letter));
        body.appendChild(row);
      });
      sec.appendChild(body);

      headerRow.addEventListener('click', () => {
        const collapsed = sec.classList.toggle('collapsed');
        chev.textContent = collapsed ? '▸' : '▾';
      });

      container.appendChild(sec);
    }

    // Split files into VS Code-style buckets. A file can appear in both
    // Staged AND Changes when it has edits in the index AND more edits in
    // the working tree — mirror that behavior to stay truthful.
    const allFiles = status.files || [];
    const stagedFiles = allFiles.filter(f => f.index && f.index !== ' ' && f.index !== '?');
    const unstagedFiles = allFiles.filter(f => f.working_dir && f.working_dir !== ' ' && f.working_dir !== '?' && f.index !== '?');
    const untrackedFiles = allFiles.filter(f => f.index === '?' || f.working_dir === '?');
    const conflicted = allFiles.filter(f => f.index === 'U' || f.working_dir === 'U' || (Array.isArray(status.conflicted) && status.conflicted.includes(f.path)));

    if (conflicted.length) {
      renderFileSection('Merge Changes', conflicted, { collapseKey: 'conflict' });
    }
    renderFileSection('Staged Changes', stagedFiles, {
      isStaged: true, canUnstage: true, canUnstageAll: true, collapseKey: 'staged',
    });
    renderFileSection('Changes', unstagedFiles, {
      canStage: true, canDiscard: true, canStageAll: true, canDiscardAll: true, collapseKey: 'changes',
    });
    renderFileSection('Untracked', untrackedFiles, {
      canStage: true, canStageAll: true, collapseKey: 'untracked',
    });

    // ---------- Recent commits ----------
    try {
      const logResp = await api.git.log(projectPath, { limit: 10 });
      const commits = (logResp && logResp.commits) || [];
      if (commits.length) {
        const sec = el('div', { class: 'p-section git-section' });
        const headerRow = el('div', { class: 'git-sec-head' });
        const chev = el('span', { class: 'git-chev' }, '▾');
        headerRow.appendChild(chev);
        headerRow.appendChild(el('span', { class: 'git-sec-title' }, 'Recent Commits'));
        headerRow.appendChild(el('span', { class: 'git-count' }, String(commits.length)));
        sec.appendChild(headerRow);

        const list = el('div', { class: 'commits-list git-sec-body' });
        commits.forEach(c => {
          const r = el('div', {
            class: 'commit-row',
            title: `${c.hash}\n${c.author} <${c.email}>\n${c.date}`,
            onClick: async () => {
              const resp = await api.git.show(projectPath, c.hash);
              if (!resp || resp.ok === false) {
                bus.emit('toast:show', { message: 'Show failed: ' + (resp?.error || 'unknown'), type: 'error' });
                return;
              }
              window.PiPilot.editor?.openVirtualTab?.({
                id: 'pipilot://commit/' + c.hash,
                name: (c.abbreviatedHash || c.hash.slice(0, 7)) + ' ' + (c.message || '').split('\n')[0].slice(0, 40),
                mount: (container) => {
                  const div = document.createElement('div');
                  div.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:auto;padding:16px 20px;font-family:var(--font-sans);color:var(--text);';
                  const commit = resp.commit || {};
                  const meta = document.createElement('div');
                  meta.style.cssText = 'border:1px solid var(--border);border-radius:6px;padding:12px 14px;background:var(--surface);margin-bottom:14px;';
                  meta.innerHTML = `
                    <div style="font-size:13px;font-weight:600;color:var(--text-strong);margin-bottom:6px;">${commit.subject || ''}</div>
                    <div style="font-size:11px;color:var(--text-mid);margin-bottom:4px;"><span style="color:var(--accent);font-family:var(--font-mono);">${commit.hash || ''}</span></div>
                    <div style="font-size:11px;color:var(--text-mid);">${commit.author || ''} &lt;${commit.email || ''}&gt; · ${commit.date || ''}</div>
                    ${commit.body ? `<pre style="white-space:pre-wrap;font-size:12px;color:var(--text);margin-top:8px;font-family:var(--font-sans);">${commit.body}</pre>` : ''}
                  `;
                  div.appendChild(meta);
                  if (resp.stat) {
                    const stat = document.createElement('pre');
                    stat.style.cssText = 'font-family:var(--font-mono);font-size:11px;color:var(--text-mid);background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:10px 12px;margin-bottom:14px;white-space:pre-wrap;';
                    stat.textContent = resp.stat;
                    div.appendChild(stat);
                  }
                  if (resp.diff) {
                    const diff = document.createElement('pre');
                    diff.style.cssText = 'font-family:var(--font-mono);font-size:12px;line-height:1.5;white-space:pre;overflow:auto;padding:10px 12px;border:1px solid var(--border);border-radius:6px;background:var(--bg);';
                    // minimal diff colorization
                    const frag = document.createDocumentFragment();
                    resp.diff.split('\n').forEach(line => {
                      const span = document.createElement('span');
                      if (line.startsWith('+') && !line.startsWith('+++')) span.style.color = 'var(--ok)';
                      else if (line.startsWith('-') && !line.startsWith('---')) span.style.color = 'var(--error)';
                      else if (line.startsWith('@@')) span.style.color = 'var(--accent)';
                      else if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ')) span.style.color = 'var(--text-mid)';
                      span.textContent = line + '\n';
                      frag.appendChild(span);
                    });
                    diff.appendChild(frag);
                    div.appendChild(diff);
                  }
                  container.appendChild(div);
                },
              });
            },
          });
          r.appendChild(el('div', null,
            el('span', { class: 'hash' }, (c.abbreviatedHash || c.hash || '').slice(0, 7) + ' '),
            el('span', { class: 'msg' }, (c.message || '').split('\n')[0])
          ));
          r.appendChild(el('div', { class: 'meta' }, `${c.author || ''} · ${c.date || ''}`));
          list.appendChild(r);
        });
        sec.appendChild(list);

        headerRow.addEventListener('click', () => {
          const collapsed = sec.classList.toggle('collapsed');
          chev.textContent = collapsed ? '▸' : '▾';
        });
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
