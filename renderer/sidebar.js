// PiPilot IDE — Sidebar (file explorer, search, placeholders)

(function () {
  const api = window.electronAPI;
  const bus = window.PiPilot.bus;
  const state = window.PiPilot.state;
  const debounce = window.PiPilot.debounce;

  const root = document.getElementById('side-panel-inner');
  if (!root) return;

  let activePanel = 'explorer';
  let treeData = null;
  let expanded = new Set();
  let filterText = '';
  let watchDispose = null;
  let isLinked = false;

  const refresh = debounce(async () => {
    await loadTree();
    if (activePanel === 'explorer') renderExplorer();
  }, 200);

  function basename(p) {
    if (!p) return '';
    const parts = p.split(/[\\/]/);
    return parts[parts.length - 1] || p;
  }

  function extOf(name) {
    const i = name.lastIndexOf('.');
    return i > 0 ? name.slice(i + 1).toLowerCase() : '';
  }

  const ICON_COLORS = {
    js: '#f1dd35', jsx: '#f1dd35', mjs: '#f1dd35', cjs: '#f1dd35',
    ts: '#3178c6', tsx: '#3178c6',
    json: '#cbcb41', jsonc: '#cbcb41',
    md: '#6cb6ff', mdx: '#6cb6ff',
    css: '#6cb6ff', scss: '#cf649a', sass: '#cf649a', less: '#1d365d',
    html: '#e34c26', htm: '#e34c26',
    py: '#3572a5', go: '#00add8', rs: '#dea584',
    rb: '#cc342d', php: '#787cb5',
    java: '#b07219', kt: '#a97bff', swift: '#ffac45',
    c: '#a8b9cc', h: '#a8b9cc', cpp: '#f34b7d', hpp: '#f34b7d',
    sh: '#89e051', bash: '#89e051', zsh: '#89e051',
    yml: '#cb171e', yaml: '#cb171e', toml: '#9c4221',
    sql: '#e38c00',
    vue: '#41b883', svelte: '#ff3e00',
    png: '#a074c4', jpg: '#a074c4', jpeg: '#a074c4', gif: '#a074c4', svg: '#ffb13b',
    lock: '#6b6b76',
    env: '#e5a639',
    gitignore: '#f54d27',
  };

  function fileIcon(name) {
    const ext = extOf(name);
    const color = ICON_COLORS[ext] || 'var(--text-dim)';
    return `<svg class="file-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 2h6l4 4v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1"/><path d="M9 2v4h4" stroke="${color}" stroke-width="1" fill="none"/></svg>`;
  }

  function folderIcon(open) {
    const color = 'var(--accent-light)';
    if (open) {
      return `<svg class="folder-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1.5 4a1 1 0 0 1 1-1h3.5l1.5 1.5h6a1 1 0 0 1 1 1V6H2.5L1.5 4z" fill="${color}" fill-opacity="0.35"/><path d="M2.5 6h11.5l-1.5 6.5a1 1 0 0 1-1 .8H2a1 1 0 0 1-1-1L2 6.5z" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="0.75"/></svg>`;
    }
    return `<svg class="folder-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1.5 4a1 1 0 0 1 1-1h3.5l1.5 1.5h6a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4z" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="0.75"/></svg>`;
  }

  function chevron() {
    return `<svg class="tree-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M3 2l4 3-4 3V2z" fill="currentColor"/></svg>`;
  }

  async function checkLinked(projectPath) {
    try {
      const s = await api.files.stat(projectPath + '/.git');
      return !!(s && s.exists && s.isDir);
    } catch {
      return false;
    }
  }

  async function loadTree() {
    if (!state.projectPath) {
      treeData = null;
      return;
    }
    try {
      treeData = await api.files.tree(state.projectPath);
      isLinked = await checkLinked(state.projectPath);
    } catch (e) {
      console.error('files.tree failed', e);
      treeData = null;
    }
  }

  function matchesFilter(name) {
    if (!filterText) return true;
    return name.toLowerCase().includes(filterText.toLowerCase());
  }

  function nodeContainsMatch(node) {
    if (!filterText) return true;
    if (matchesFilter(node.name)) return true;
    if (node.type === 'dir' && node.children) {
      return node.children.some(nodeContainsMatch);
    }
    return false;
  }

  function renderTreeNode(node, depth) {
    if (filterText && !nodeContainsMatch(node)) return null;

    const isDir = node.type === 'dir';
    const isExpanded = isDir && (filterText ? true : expanded.has(node.path));
    const row = h('div', {
      class: 'tree-node' + (state.activeFile === node.path ? ' active' : ''),
      dataset: { path: node.path, type: node.type },
      style: { paddingLeft: (6 + depth * 10) + 'px' },
      draggable: 'true',
    });

    const chev = h('span', {
      class: 'tree-chevron' + (isExpanded ? ' expanded' : ''),
      style: { visibility: isDir ? 'visible' : 'hidden' },
      html: isDir ? chevron() : '',
    });
    row.appendChild(chev);

    const iconWrap = h('span', {
      class: 'tree-icon',
      html: isDir ? folderIcon(isExpanded) : fileIcon(node.name),
    });
    row.appendChild(iconWrap);

    const label = h('span', { class: 'tree-label' }, node.name);
    row.appendChild(label);

    row.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isDir) {
        if (expanded.has(node.path)) expanded.delete(node.path);
        else expanded.add(node.path);
        renderExplorer();
      } else {
        bus.emit('file:open', { path: node.path });
      }
    });

    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showTreeContextMenu(e, node);
    });

    // Drag & drop
    row.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/pipilot-path', node.path);
      e.dataTransfer.effectAllowed = 'move';
    });
    if (isDir) {
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        row.classList.add('drop-target');
      });
      row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
      row.addEventListener('drop', async (e) => {
        e.preventDefault();
        row.classList.remove('drop-target');
        const src = e.dataTransfer.getData('application/pipilot-path');
        if (!src || src === node.path) return;
        const name = basename(src);
        const dest = node.path + '/' + name;
        if (dest === src) return;
        try {
          await api.files.rename(src, dest);
          bus.emit('toast:show', { type: 'ok', message: `Moved ${name}` });
          await loadTree();
          renderExplorer();
        } catch (err) {
          bus.emit('toast:show', { type: 'error', message: 'Move failed: ' + err.message });
        }
      });
    }

    const container = h('div', { class: 'tree-item' }, row);

    if (isDir && isExpanded && node.children && node.children.length) {
      const kids = h('div', { class: 'tree-children' });
      for (const c of node.children) {
        const el = renderTreeNode(c, depth + 1);
        if (el) kids.appendChild(el);
      }
      container.appendChild(kids);
    }

    return container;
  }

  function showTreeContextMenu(e, node) {
    const isDir = node.type === 'dir';
    const items = [];
    if (isDir) {
      items.push({ label: 'New File', onClick: () => createEntry(node.path, 'file') });
      items.push({ label: 'New Folder', onClick: () => createEntry(node.path, 'dir') });
      items.push({ type: 'separator' });
    }
    items.push({ label: 'Rename', onClick: () => renameEntry(node) });
    items.push({ label: 'Delete', onClick: () => deleteEntry(node) });
    items.push({ type: 'separator' });
    items.push({ label: 'Reveal in File Manager', onClick: () => api.shell.showItemInFolder(node.path) });
    items.push({ label: 'Copy Path', onClick: () => {
      navigator.clipboard.writeText(node.path).catch(() => {});
      bus.emit('toast:show', { type: 'info', message: 'Path copied' });
    }});
    items.push({ label: 'Copy Relative Path', onClick: () => {
      const rel = state.projectPath && node.path.startsWith(state.projectPath)
        ? node.path.slice(state.projectPath.length + 1)
        : node.path;
      navigator.clipboard.writeText(rel).catch(() => {});
      bus.emit('toast:show', { type: 'info', message: 'Relative path copied' });
    }});

    bus.emit('contextmenu:show', { x: e.clientX, y: e.clientY, items, target: node });
  }

  async function createEntry(parentPath, kind) {
    const name = window.prompt(`Enter ${kind === 'dir' ? 'folder' : 'file'} name:`);
    if (!name) return;
    const target = parentPath + '/' + name;
    try {
      if (kind === 'dir') {
        await api.files.mkdir(target);
      } else {
        await api.files.write(target, '');
      }
      expanded.add(parentPath);
      await loadTree();
      renderExplorer();
      if (kind === 'file') bus.emit('file:open', { path: target });
    } catch (err) {
      bus.emit('toast:show', { type: 'error', message: 'Create failed: ' + err.message });
    }
  }

  async function renameEntry(node) {
    const newName = window.prompt('Rename to:', node.name);
    if (!newName || newName === node.name) return;
    const parent = node.path.slice(0, node.path.length - node.name.length - 1);
    const dest = parent + '/' + newName;
    try {
      await api.files.rename(node.path, dest);
      bus.emit('file:renamed', { from: node.path, to: dest });
      await loadTree();
      renderExplorer();
    } catch (err) {
      bus.emit('toast:show', { type: 'error', message: 'Rename failed: ' + err.message });
    }
  }

  async function deleteEntry(node) {
    if (!window.confirm(`Delete ${node.name}?`)) return;
    try {
      await api.files.delete(node.path);
      bus.emit('file:deleted', { path: node.path });
      await loadTree();
      renderExplorer();
    } catch (err) {
      bus.emit('toast:show', { type: 'error', message: 'Delete failed: ' + err.message });
    }
  }

  function renderExplorer() {
    root.innerHTML = '';
    if (!state.projectPath) {
      root.appendChild(h('div', { class: 'panel-empty' }, 'No project open'));
      return;
    }

    const header = h('div', { class: 'panel-header' },
      h('div', { class: 'panel-title' },
        h('span', { class: 'panel-title-text' }, state.projectName || basename(state.projectPath)),
        isLinked ? h('span', { class: 'badge badge-ok' }, 'LINKED') : null
      )
    );
    root.appendChild(header);

    const actions = h('div', { class: 'panel-actions' },
      h('button', {
        class: 'icon-btn', title: 'New File',
        onClick: () => createEntry(state.projectPath, 'file'),
      }, h('span', { html: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 2h5l3 3v9H4z"/><path d="M9 2v3h3"/><path d="M8 8v4M6 10h4" stroke-linecap="round"/></svg>' })),
      h('button', {
        class: 'icon-btn', title: 'New Folder',
        onClick: () => createEntry(state.projectPath, 'dir'),
      }, h('span', { html: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h4l1 1.5h7V13H2z"/><path d="M8 8v4M6 10h4" stroke-linecap="round"/></svg>' })),
      h('button', {
        class: 'icon-btn', title: 'Refresh',
        onClick: async () => { await loadTree(); renderExplorer(); },
      }, h('span', { html: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 8a6 6 0 1 0 2-4.5"/><path d="M2 2v3h3"/></svg>' })),
      h('button', {
        class: 'icon-btn', title: 'Collapse All',
        onClick: () => { expanded.clear(); renderExplorer(); },
      }, h('span', { html: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6l4 4 4-4"/></svg>' })),
    );
    root.appendChild(actions);

    const search = h('div', { class: 'panel-search' },
      h('input', {
        type: 'text', class: 'panel-search-input',
        placeholder: 'filter files...',
        value: filterText,
        oninput: (e) => { filterText = e.target.value; renderExplorer(); refocusFilter(); },
      })
    );
    root.appendChild(search);

    const tree = h('div', { class: 'file-tree' });
    if (treeData && treeData.children && treeData.children.length) {
      for (const c of treeData.children) {
        const el = renderTreeNode(c, 0);
        if (el) tree.appendChild(el);
      }
    } else {
      tree.appendChild(h('div', { class: 'panel-empty' }, 'Empty project'));
    }
    root.appendChild(tree);

    // Root-level drop target / context menu
    tree.addEventListener('contextmenu', (e) => {
      if (e.target !== tree) return;
      e.preventDefault();
      bus.emit('contextmenu:show', {
        x: e.clientX, y: e.clientY,
        items: [
          { label: 'New File', onClick: () => createEntry(state.projectPath, 'file') },
          { label: 'New Folder', onClick: () => createEntry(state.projectPath, 'dir') },
          { type: 'separator' },
          { label: 'Refresh', onClick: async () => { await loadTree(); renderExplorer(); } },
          { label: 'Reveal in File Manager', onClick: () => api.shell.showItemInFolder(state.projectPath) },
        ],
      });
    });
    tree.addEventListener('dragover', (e) => {
      if (e.target === tree) { e.preventDefault(); }
    });
    tree.addEventListener('drop', async (e) => {
      if (e.target !== tree) return;
      e.preventDefault();
      const src = e.dataTransfer.getData('application/pipilot-path');
      if (!src) return;
      const name = basename(src);
      const dest = state.projectPath + '/' + name;
      if (dest === src) return;
      try {
        await api.files.rename(src, dest);
        await loadTree();
        renderExplorer();
      } catch (err) {
        bus.emit('toast:show', { type: 'error', message: 'Move failed: ' + err.message });
      }
    });
  }

  function refocusFilter() {
    const input = root.querySelector('.panel-search-input');
    if (input) {
      input.focus();
      const val = input.value;
      input.setSelectionRange(val.length, val.length);
    }
  }

  // ---------- Search panel ----------
  let searchState = {
    query: '',
    caseSensitive: false,
    regex: false,
    results: [],
    running: false,
  };

  const runSearch = debounce(async () => {
    if (!state.projectPath || !searchState.query) {
      searchState.results = [];
      renderSearchResults();
      return;
    }
    searchState.running = true;
    renderSearchResults();
    try {
      const results = await api.files.search(state.projectPath, searchState.query, {
        caseSensitive: searchState.caseSensitive,
        regex: searchState.regex,
      });
      searchState.results = results || [];
    } catch (e) {
      searchState.results = [];
      bus.emit('toast:show', { type: 'error', message: 'Search failed: ' + e.message });
    } finally {
      searchState.running = false;
      renderSearchResults();
    }
  }, 280);

  function renderSearch() {
    root.innerHTML = '';
    root.appendChild(h('div', { class: 'panel-header' },
      h('div', { class: 'panel-title' },
        h('span', { class: 'panel-title-text' }, 'Search')
      )
    ));

    const input = h('input', {
      type: 'text', class: 'panel-search-input',
      placeholder: 'Search in project...',
      value: searchState.query,
      oninput: (e) => { searchState.query = e.target.value; runSearch(); },
    });
    root.appendChild(h('div', { class: 'panel-search' }, input));

    root.appendChild(h('div', { class: 'panel-actions search-opts' },
      h('button', {
        class: 'icon-btn' + (searchState.caseSensitive ? ' toggled' : ''),
        title: 'Match Case',
        onClick: () => { searchState.caseSensitive = !searchState.caseSensitive; renderSearch(); runSearch(); restoreSearchFocus(); },
      }, 'Aa'),
      h('button', {
        class: 'icon-btn' + (searchState.regex ? ' toggled' : ''),
        title: 'Use Regex',
        onClick: () => { searchState.regex = !searchState.regex; renderSearch(); runSearch(); restoreSearchFocus(); },
      }, '.*'),
    ));

    root.appendChild(h('div', { class: 'search-results', id: 'search-results' }));
    renderSearchResults();
    input.focus();
    const v = input.value;
    try { input.setSelectionRange(v.length, v.length); } catch {}
  }

  function restoreSearchFocus() {
    const input = root.querySelector('.panel-search-input');
    if (input) input.focus();
  }

  function renderSearchResults() {
    const container = document.getElementById('search-results');
    if (!container) return;
    container.innerHTML = '';
    if (searchState.running) {
      container.appendChild(h('div', { class: 'panel-empty' }, 'Searching...'));
      return;
    }
    if (!searchState.query) {
      container.appendChild(h('div', { class: 'panel-empty' }, 'Type to search'));
      return;
    }
    if (!searchState.results.length) {
      container.appendChild(h('div', { class: 'panel-empty' }, 'No results'));
      return;
    }

    const grouped = new Map();
    for (const r of searchState.results) {
      if (!grouped.has(r.file)) grouped.set(r.file, []);
      grouped.get(r.file).push(r);
    }

    container.appendChild(h('div', { class: 'search-summary' },
      `${searchState.results.length} result${searchState.results.length === 1 ? '' : 's'} in ${grouped.size} file${grouped.size === 1 ? '' : 's'}`
    ));

    for (const [file, hits] of grouped) {
      const rel = state.projectPath && file.startsWith(state.projectPath)
        ? file.slice(state.projectPath.length + 1) : file;
      const group = h('div', { class: 'search-group' });
      group.appendChild(h('div', { class: 'search-file' },
        h('span', { class: 'tree-icon', html: fileIcon(basename(file)) }),
        h('span', { class: 'search-file-path' }, rel),
        h('span', { class: 'search-file-count' }, String(hits.length))
      ));
      for (const hit of hits) {
        const row = h('div', { class: 'search-hit' },
          h('span', { class: 'search-hit-line' }, String(hit.line)),
          h('span', { class: 'search-hit-preview' }, hit.preview.trim())
        );
        row.addEventListener('click', () => {
          bus.emit('file:open', { path: hit.file, line: hit.line, col: hit.col });
        });
        group.appendChild(row);
      }
      container.appendChild(group);
    }
  }

  // ---------- Placeholders ----------
  function renderPlaceholder(title, subtitle) {
    root.innerHTML = '';
    root.appendChild(h('div', { class: 'panel-header' },
      h('div', { class: 'panel-title' },
        h('span', { class: 'panel-title-text' }, title)
      )
    ));
    root.appendChild(h('div', { class: 'panel-placeholder' },
      h('div', { class: 'panel-placeholder-title' }, 'Coming up...'),
      h('div', { class: 'panel-placeholder-sub' }, subtitle)
    ));
  }

  // ---------- Panel switching ----------
  function renderPanel() {
    switch (activePanel) {
      case 'explorer': renderExplorer(); break;
      case 'search': renderSearch(); break;
      case 'git': renderPlaceholder('Source Control', 'Git integration arrives in Phase 5.'); break;
      case 'extensions': renderPlaceholder('Extensions & MCP', 'Extension marketplace arrives in Phase 5.'); break;
      case 'checkpoints': renderPlaceholder('Checkpoints', 'Workspace checkpoints arrive in Phase 5.'); break;
      case 'deploy': renderPlaceholder('Deploy', 'Deployment tooling arrives in Phase 5.'); break;
      case 'chat': renderPlaceholder('AI Chat', 'Use the chat panel on the right.'); break;
      default: renderExplorer();
    }
  }

  // ---------- Wire up ----------
  bus.on('panel:switch', (panel) => {
    activePanel = panel || 'explorer';
    renderPanel();
  });

  bus.on('project:opened', async (payload) => {
    if (payload?.path) {
      state.projectPath = payload.path;
      state.projectName = payload.name || basename(payload.path);
    }
    expanded.clear();
    filterText = '';
    await loadTree();
    if (state.projectPath) {
      if (watchDispose) { try { watchDispose(); } catch {} }
      watchDispose = api.files.watch(state.projectPath, () => refresh());
    }
    if (activePanel === 'explorer') renderExplorer();
  });

  bus.on('project:closed', () => {
    treeData = null;
    state.projectPath = null;
    state.projectName = null;
    expanded.clear();
    if (watchDispose) { try { watchDispose(); } catch {} }
    watchDispose = null;
    renderPanel();
  });

  bus.on('editor:active-changed', () => {
    if (activePanel === 'explorer') renderExplorer();
  });

  // Initial render
  renderPanel();

  // Expose a minimal API for other phases
  window.PiPilot.sidebar = {
    refresh: async () => { await loadTree(); renderPanel(); },
    switchPanel: (p) => { activePanel = p; renderPanel(); },
  };
})();
