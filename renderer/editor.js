// PiPilot IDE — Monaco editor + tabs + breadcrumb (Phase 2)

(function () {
  const api = window.electronAPI;
  const bus = window.PiPilot.bus;
  const state = window.PiPilot.state;

  const hostEl = document.getElementById('monaco-host');
  const virtualHostEl = document.getElementById('virtual-host');
  const emptyEl = document.getElementById('editor-empty');
  const tabBarEl = document.getElementById('tab-bar');
  const breadcrumbEl = document.getElementById('breadcrumb');
  if (!hostEl || !tabBarEl) return;

  let monaco = null;
  let editor = null;
  let monacoLoading = null;

  // path -> { model, viewState, dirty, originalContent, name }   (file tabs)
  // virtualId -> { virtual: true, name, icon, mount, unmount, container, dirty: false }   (virtual tabs)
  const openDocs = new Map();
  let activePath = null;
  let tabOrder = []; // paths/ids in display order

  // ---------- Utilities ----------
  function basename(p) {
    if (!p) return '';
    const parts = p.split(/[\\/]/);
    return parts[parts.length - 1] || p;
  }

  const LANG_MAP = {
    js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    json: 'json', jsonc: 'json',
    md: 'markdown', mdx: 'markdown',
    html: 'html', htm: 'html', xml: 'xml', svg: 'xml',
    css: 'css', scss: 'scss', sass: 'scss', less: 'less',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
    java: 'java', kt: 'kotlin', swift: 'swift',
    c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp', cs: 'csharp',
    php: 'php', sh: 'shell', bash: 'shell', zsh: 'shell',
    yml: 'yaml', yaml: 'yaml', toml: 'ini', ini: 'ini',
    sql: 'sql', lua: 'lua', r: 'r',
    dockerfile: 'dockerfile',
    vue: 'html', svelte: 'html',
  };

  function detectLanguage(filePath) {
    const name = basename(filePath).toLowerCase();
    if (name === 'dockerfile') return 'dockerfile';
    if (name === 'makefile') return 'makefile';
    const ext = name.includes('.') ? name.split('.').pop() : '';
    return LANG_MAP[ext] || 'plaintext';
  }

  // ---------- Monaco loader ----------
  function loadMonaco() {
    if (monaco) return Promise.resolve(monaco);
    if (monacoLoading) return monacoLoading;
    monacoLoading = new Promise((resolve, reject) => {
      const onReady = () => {
        window.require.config({
          paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' },
        });
        window.require(['vs/editor/editor.main'], () => {
          monaco = window.monaco;
          defineTheme();
          try { window.PiPilot?.bus?.emit('monaco:ready', monaco); } catch {}
          resolve(monaco);
        }, reject);
      };
      if (window.require && window.require.config) {
        onReady();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js';
      script.onload = onReady;
      script.onerror = () => reject(new Error('Failed to load Monaco loader'));
      document.head.appendChild(script);
    });
    return monacoLoading;
  }

  function defineTheme() {
    monaco.editor.defineTheme('midnight', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: '', foreground: 'b0b0b8', background: '16161a' },
        { token: 'comment', foreground: '6b6b76', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'FF8C61' },
        { token: 'string', foreground: '56d364' },
        { token: 'number', foreground: '6cb6ff' },
        { token: 'type', foreground: 'FF8C61' },
        { token: 'function', foreground: 'e5a639' },
        { token: 'variable', foreground: 'd9d9de' },
        { token: 'constant', foreground: '6cb6ff' },
        { token: 'tag', foreground: 'FF6B35' },
        { token: 'attribute.name', foreground: 'e5a639' },
        { token: 'attribute.value', foreground: '56d364' },
      ],
      colors: {
        'editor.background': '#16161a',
        'editor.foreground': '#b0b0b8',
        'editor.lineHighlightBackground': '#1c1c21',
        'editor.selectionBackground': '#FF6B3540',
        'editor.inactiveSelectionBackground': '#FF6B3520',
        'editorCursor.foreground': '#FF6B35',
        'editorLineNumber.foreground': '#42424a',
        'editorLineNumber.activeForeground': '#8a8a94',
        'editorIndentGuide.background': '#232329',
        'editorIndentGuide.activeBackground': '#2e2e35',
        'editorWhitespace.foreground': '#2a2a31',
        'editorGutter.background': '#16161a',
        'editor.selectionHighlightBackground': '#FF6B3520',
        'editor.wordHighlightBackground': '#FF6B3520',
        'editor.findMatchBackground': '#FF6B3560',
        'editor.findMatchHighlightBackground': '#FF6B3530',
        'editorBracketMatch.background': '#FF6B3530',
        'editorBracketMatch.border': '#FF6B35',
        'scrollbarSlider.background': '#2e2e3580',
        'scrollbarSlider.hoverBackground': '#44444d80',
        'scrollbarSlider.activeBackground': '#44444dcc',
        'editorWidget.background': '#1c1c21',
        'editorWidget.border': '#2e2e35',
        'editorSuggestWidget.background': '#1c1c21',
        'editorSuggestWidget.border': '#2e2e35',
        'editorSuggestWidget.selectedBackground': '#FF6B3528',
        'editorHoverWidget.background': '#1c1c21',
        'editorHoverWidget.border': '#2e2e35',
        'editorError.foreground': '#e5534b',
        'editorWarning.foreground': '#e5a639',
        'editorInfo.foreground': '#6cb6ff',
        'editorOverviewRuler.errorForeground': '#e5534b',
        'editorOverviewRuler.warningForeground': '#e5a639',
      },
    });
  }

  function ensureEditor() {
    if (editor) return editor;
    if (!monaco) return null;
    editor = monaco.editor.create(hostEl, {
      theme: 'midnight',
      automaticLayout: true,
      fontFamily: '"Geist Mono", "Cascadia Code", "JetBrains Mono", "SF Mono", Consolas, monospace',
      fontSize: state.settings.fontSize || 13,
      fontLigatures: true,
      lineHeight: 1.55,
      minimap: { enabled: true, scale: 1 },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorSmoothCaretAnimation: 'on',
      cursorBlinking: 'smooth',
      cursorStyle: state.settings.cursorStyle || 'line',
      tabSize: state.settings.tabSize || 2,
      wordWrap: state.settings.wordWrap || 'off',
      renderWhitespace: 'selection',
      renderLineHighlight: 'all',
      folding: true,
      foldingHighlight: true,
      guides: { bracketPairs: true, indentation: true },
      bracketPairColorization: { enabled: true },
      padding: { top: 8 },
    });

    editor.onDidChangeCursorPosition((e) => {
      bus.emit('editor:position', { line: e.position.lineNumber, col: e.position.column });
    });

    editor.onDidChangeModel(() => {
      const model = editor.getModel();
      if (!model) return;
      bus.emit('editor:language', { language: model.getLanguageId() });
      updateProblemsCount();
    });

    editor.onDidChangeModelContent(() => {
      if (!activePath) return;
      const doc = openDocs.get(activePath);
      if (!doc) return;
      const nowContent = doc.model.getValue();
      const isDirty = nowContent !== doc.originalContent;
      if (doc.dirty !== isDirty) {
        doc.dirty = isDirty;
        renderTabs();
        bus.emit('editor:dirty-changed', { path: activePath, dirty: isDirty });
      }
    });

    // Ctrl+S / Cmd+S override
    editor.addCommand(
      // KeyMod.CtrlCmd | KeyCode.KeyS
      (monaco.KeyMod.CtrlCmd) | monaco.KeyCode.KeyS,
      () => { saveFile(activePath); }
    );

    // Problems count from markers
    const mdl = monaco.editor;
    if (mdl.onDidChangeMarkers) {
      mdl.onDidChangeMarkers(() => updateProblemsCount());
    }

    return editor;
  }

  function updateProblemsCount() {
    if (!monaco) return;
    const markers = monaco.editor.getModelMarkers({});
    let errors = 0, warnings = 0;
    for (const m of markers) {
      if (m.severity === monaco.MarkerSeverity.Error) errors++;
      else if (m.severity === monaco.MarkerSeverity.Warning) warnings++;
    }
    bus.emit('problems:count', { errors, warnings, total: errors + warnings });
  }

  // ---------- Tab management ----------
  function renderTabs() {
    tabBarEl.innerHTML = '';
    for (const p of tabOrder) {
      const doc = openDocs.get(p);
      if (!doc) continue;
      const isActive = p === activePath;
      const tab = h('div', {
        class: 'tab' + (isActive ? ' active' : '') + (doc.dirty ? ' dirty' : ''),
        dataset: { path: p },
        draggable: 'true',
        title: p,
      });
      tab.appendChild(h('span', { class: 'tab-icon', html: smallFileIcon(doc.name) }));
      tab.appendChild(h('span', { class: 'tab-name' }, doc.name));
      const closeBtn = h('button', {
        class: 'tab-close',
        title: 'Close',
        onClick: (e) => { e.stopPropagation(); closeFile(p); },
      });
      closeBtn.appendChild(h('span', {
        class: 'tab-close-icon',
        html: doc.dirty
          ? '<svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="3" fill="currentColor"/></svg>'
          : '<svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.5"><path d="M2 2l6 6M8 2l-6 6"/></svg>',
      }));
      tab.appendChild(closeBtn);

      tab.addEventListener('click', () => switchTo(p));
      tab.addEventListener('mousedown', (e) => { if (e.button === 1) { e.preventDefault(); closeFile(p); } });

      tab.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/pipilot-tab', p);
        e.dataTransfer.effectAllowed = 'move';
        tab.classList.add('dragging');
      });
      tab.addEventListener('dragend', () => tab.classList.remove('dragging'));
      tab.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      tab.addEventListener('drop', (e) => {
        e.preventDefault();
        const src = e.dataTransfer.getData('application/pipilot-tab');
        if (!src || src === p) return;
        const from = tabOrder.indexOf(src);
        const to = tabOrder.indexOf(p);
        if (from < 0 || to < 0) return;
        tabOrder.splice(from, 1);
        tabOrder.splice(to, 0, src);
        renderTabs();
      });

      tabBarEl.appendChild(tab);
    }
  }

  function smallFileIcon(name) {
    const ext = name.lastIndexOf('.') > 0 ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
    const colors = {
      js: '#f1dd35', jsx: '#f1dd35', ts: '#3178c6', tsx: '#3178c6',
      json: '#cbcb41', md: '#6cb6ff', css: '#6cb6ff', html: '#e34c26',
      py: '#3572a5', go: '#00add8', rs: '#dea584',
    };
    const color = colors[ext] || 'var(--text-dim)';
    return `<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 2h6l4 4v8a1 1 0 0 1-1 1H3z" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="1"/><path d="M9 2v4h4" stroke="${color}" stroke-width="1"/></svg>`;
  }

  function updateBreadcrumb() {
    if (!breadcrumbEl) return;
    breadcrumbEl.innerHTML = '';
    if (!activePath) {
      breadcrumbEl.textContent = '';
      return;
    }
    const projRoot = state.projectPath;
    const projName = state.projectName || (projRoot ? basename(projRoot) : '');
    let rel = activePath;
    if (projRoot && activePath.startsWith(projRoot)) {
      rel = activePath.slice(projRoot.length + 1);
    }
    const parts = rel.split(/[\\/]/).filter(Boolean);
    const crumbs = projName ? [projName, ...parts] : parts;
    crumbs.forEach((c, i) => {
      if (i > 0) {
        breadcrumbEl.appendChild(h('span', { class: 'breadcrumb-sep' }, ' › '));
      }
      breadcrumbEl.appendChild(h('span', { class: 'breadcrumb-item' }, c));
    });
  }

  function updateEmptyState() {
    const hasFiles = openDocs.size > 0;
    if (emptyEl) emptyEl.style.display = hasFiles ? 'none' : 'flex';
    if (hostEl) hostEl.style.display = hasFiles ? 'block' : 'none';
  }

  // ---------- Core operations ----------
  async function openFile(filePath, opts = {}) {
    if (!filePath) return;
    await loadMonaco();

    if (!openDocs.has(filePath)) {
      let data;
      try {
        data = await api.files.read(filePath);
      } catch (e) {
        bus.emit('toast:show', { type: 'error', message: 'Open failed: ' + e.message });
        return;
      }
      if (data && data.binary) {
        // Route binary files to the appropriate viewer (image, pdf, audio,
        // video, font, or hex). Archives are rejected.
        if (data.kind === 'archive') {
          bus.emit('toast:show', { type: 'warn', message: `Archive files (.${data.ext}) can't be viewed in the editor` });
          return;
        }
        await openBinaryTab(filePath, data);
        return;
      }
      const content = (data && data.content) || '';
      const lang = detectLanguage(filePath);
      const uri = monaco.Uri.file(filePath);
      let model = monaco.editor.getModel(uri);
      if (!model) {
        model = monaco.editor.createModel(content, lang, uri);
      } else {
        model.setValue(content);
        monaco.editor.setModelLanguage(model, lang);
      }
      openDocs.set(filePath, {
        model,
        viewState: null,
        dirty: false,
        originalContent: content,
        name: basename(filePath),
      });
      tabOrder.push(filePath);
    }

    switchTo(filePath, opts);
  }

  // ---------- Binary viewer ----------
  function fmtBytes(n) {
    if (n == null) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  async function openBinaryTab(filePath, meta) {
    if (openDocs.has(filePath)) { switchTo(filePath); return; }

    const res = await api.files.readBinary(filePath);
    if (!res || res.ok === false) {
      bus.emit('toast:show', { type: 'warn', message: res?.error || 'Cannot open binary file' });
      return;
    }

    const dataUrl = `data:${res.mime};base64,${res.base64}`;
    const ext = (res.ext || '').toLowerCase();
    const kind = res.kind || meta?.kind || 'binary';

    openVirtualTab({
      id: filePath,
      name: basename(filePath),
      mount: (container) => {
        const wrap = document.createElement('div');
        wrap.className = 'binary-viewer';
        wrap.style.cssText = 'display:flex;flex-direction:column;width:100%;height:100%;background:var(--bg);color:var(--text);';

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;gap:12px;padding:6px 14px;font-size:11px;color:var(--text-mid);border-bottom:1px solid var(--border);background:var(--surface);';
        header.innerHTML = `<span style="color:var(--text-strong);font-weight:500;">${basename(filePath)}</span><span>${kind.toUpperCase()}</span><span>${res.mime}</span><span>${fmtBytes(res.size)}</span>`;
        wrap.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = 'flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:auto;padding:20px;';

        if (kind === 'image') {
          const img = document.createElement('img');
          img.src = dataUrl;
          img.alt = basename(filePath);
          img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;background:repeating-conic-gradient(#1c1c21 0% 25%, #16161a 0% 50%) 50% / 20px 20px;border:1px solid var(--border);';
          body.appendChild(img);
        } else if (kind === 'pdf') {
          const iframe = document.createElement('iframe');
          iframe.src = dataUrl;
          iframe.style.cssText = 'width:100%;height:100%;border:none;background:white;';
          body.style.padding = '0';
          body.appendChild(iframe);
        } else if (kind === 'audio') {
          const audio = document.createElement('audio');
          audio.src = dataUrl;
          audio.controls = true;
          audio.style.cssText = 'width:80%;max-width:500px;';
          body.appendChild(audio);
        } else if (kind === 'video') {
          const video = document.createElement('video');
          video.src = dataUrl;
          video.controls = true;
          video.style.cssText = 'max-width:100%;max-height:100%;background:#000;';
          body.appendChild(video);
        } else if (kind === 'font') {
          body.style.flexDirection = 'column';
          body.style.alignItems = 'stretch';
          body.style.padding = '20px 40px';
          const style = document.createElement('style');
          const fontFamily = `pipilot-font-${Date.now()}`;
          style.textContent = `@font-face{font-family:'${fontFamily}';src:url('${dataUrl}');}`;
          container.appendChild(style);
          const preview = document.createElement('div');
          preview.style.cssText = `font-family:'${fontFamily}',sans-serif;color:var(--text-strong);`;
          preview.innerHTML = `
            <div style="font-size:42px;line-height:1.2;margin-bottom:18px;">The quick brown fox jumps over the lazy dog.</div>
            <div style="font-size:28px;margin-bottom:14px;">ABCDEFGHIJKLMNOPQRSTUVWXYZ</div>
            <div style="font-size:28px;margin-bottom:14px;">abcdefghijklmnopqrstuvwxyz</div>
            <div style="font-size:28px;margin-bottom:24px;">0123456789 !@#$%^&amp;*()</div>
            <div style="font-size:20px;line-height:1.55;color:var(--text-mid);">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.</div>
          `;
          body.appendChild(preview);
        } else {
          // Generic hex viewer for unrecognized binaries.
          const bytes = Uint8Array.from(atob(res.base64), c => c.charCodeAt(0));
          const pre = document.createElement('pre');
          pre.style.cssText = 'font-family:var(--font-mono);font-size:12px;color:var(--text);line-height:1.45;margin:0;white-space:pre;overflow:auto;width:100%;max-height:100%;';
          const rowsLimit = 2048; // cap hex output so massive files don't lag the DOM
          const lines = [];
          for (let i = 0; i < bytes.length && lines.length < rowsLimit; i += 16) {
            const slice = bytes.slice(i, i + 16);
            const hex = Array.from(slice).map(b => b.toString(16).padStart(2, '0')).join(' ').padEnd(48, ' ');
            const ascii = Array.from(slice).map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
            lines.push(`${i.toString(16).padStart(8, '0')}  ${hex}  ${ascii}`);
          }
          if (bytes.length > rowsLimit * 16) lines.push(`… ${fmtBytes(bytes.length - rowsLimit * 16)} more (truncated)`);
          pre.textContent = lines.join('\n');
          body.style.padding = '12px 14px';
          body.style.alignItems = 'flex-start';
          body.appendChild(pre);
        }
        wrap.appendChild(body);
        container.appendChild(wrap);
      },
    });
  }

  function switchTo(filePath, opts = {}) {
    // Save view state of previous file (skip for virtual tabs)
    if (activePath && openDocs.has(activePath) && editor) {
      const prev = openDocs.get(activePath);
      if (!prev.virtual) prev.viewState = editor.saveViewState();
    }

    const doc = openDocs.get(filePath);
    if (!doc) return;

    activePath = filePath;
    state.activeFile = filePath;

    if (doc.virtual) {
      // Hide Monaco host, show virtual content
      hostEl.classList.add('hidden');
      virtualHostEl.classList.remove('hidden');
      // Mount on first activation; reuse the container otherwise
      if (!doc.mounted) {
        const container = document.createElement('div');
        container.className = 'virtual-tab-content';
        container.style.cssText = 'width:100%;height:100%;overflow:auto;';
        doc.container = container;
        virtualHostEl.innerHTML = '';
        virtualHostEl.appendChild(container);
        try { doc.unmount = doc.mount(container) || (() => {}); } catch (e) { console.error('virtual mount', e); }
        doc.mounted = true;
      } else {
        virtualHostEl.innerHTML = '';
        virtualHostEl.appendChild(doc.container);
      }
      bus.emit('editor:active-changed', { path: filePath, virtual: true });
      bus.emit('editor:language', { language: '' });
    } else {
      ensureEditor();
      // Show Monaco, hide virtual
      virtualHostEl.classList.add('hidden');
      hostEl.classList.remove('hidden');
      if (editor) {
        editor.setModel(doc.model);
        if (doc.viewState) editor.restoreViewState(doc.viewState);
        if (opts.line) {
          const col = opts.col || 1;
          editor.revealLineInCenter(opts.line);
          editor.setPosition({ lineNumber: opts.line, column: col });
        }
        editor.focus();
      }
      bus.emit('editor:active-changed', { path: filePath });
      bus.emit('editor:language', { language: doc.model.getLanguageId() });
    }

    renderTabs();
    updateBreadcrumb();
    updateEmptyState();

    state.openFiles = tabOrder.map((p) => {
      const d = openDocs.get(p);
      return { path: p, name: d.name, dirty: d.dirty, virtual: !!d.virtual };
    });
  }

  async function closeFile(filePath) {
    const doc = openDocs.get(filePath);
    if (!doc) return;
    if (doc.dirty && !doc.virtual) {
      const ok = window.confirm(`"${doc.name}" has unsaved changes. Close without saving?`);
      if (!ok) return;
    }
    if (doc.virtual) {
      try { doc.unmount?.(); } catch {}
      if (doc.container && doc.container.parentNode === virtualHostEl) {
        virtualHostEl.removeChild(doc.container);
      }
    } else {
      try { doc.model.dispose(); } catch {}
    }
    openDocs.delete(filePath);
    tabOrder = tabOrder.filter((p) => p !== filePath);

    if (activePath === filePath) {
      activePath = null;
      state.activeFile = null;
      if (tabOrder.length) {
        switchTo(tabOrder[tabOrder.length - 1]);
      } else {
        if (editor) editor.setModel(null);
        virtualHostEl.classList.add('hidden');
        virtualHostEl.innerHTML = '';
        hostEl.classList.remove('hidden');
        renderTabs();
        updateBreadcrumb();
        updateEmptyState();
        bus.emit('editor:active-changed', { path: null });
      }
    } else {
      renderTabs();
    }

    state.openFiles = tabOrder.map((p) => {
      const d = openDocs.get(p);
      return { path: p, name: d.name, dirty: d.dirty };
    });
  }

  async function saveFile(filePath) {
    if (!filePath) filePath = activePath;
    if (!filePath) return;
    const doc = openDocs.get(filePath);
    if (!doc) return;
    if (!doc.dirty) return;
    const content = doc.model.getValue();
    try {
      await api.files.write(filePath, content);
      doc.originalContent = content;
      doc.dirty = false;
      renderTabs();
      bus.emit('editor:dirty-changed', { path: filePath, dirty: false });
      bus.emit('file:saved', { path: filePath });
      bus.emit('toast:show', { type: 'ok', message: `Saved ${doc.name}` });
    } catch (e) {
      bus.emit('toast:show', { type: 'error', message: 'Save failed: ' + e.message });
    }
  }

  async function saveAllFiles() {
    const dirty = [...openDocs.entries()].filter(([, d]) => d.dirty);
    for (const [p] of dirty) {
      await saveFile(p);
    }
  }

  function getDirtyFiles() {
    return [...openDocs.entries()].filter(([, d]) => d.dirty).map(([p]) => p);
  }

  function getActiveFile() {
    return activePath;
  }

  // ---------- Bus wiring ----------
  bus.on('file:open', (payload) => {
    if (!payload) return;
    const p = typeof payload === 'string' ? payload : payload.path;
    openFile(p, { line: payload?.line, col: payload?.col });
  });

  bus.on('menu:save', () => saveFile(activePath));
  bus.on('menu:save-all', () => saveAllFiles());

  bus.on('project:closed', () => {
    for (const [p, doc] of openDocs) {
      try { doc.model.dispose(); } catch {}
    }
    openDocs.clear();
    tabOrder = [];
    activePath = null;
    state.activeFile = null;
    state.openFiles = [];
    if (editor) editor.setModel(null);
    renderTabs();
    updateBreadcrumb();
    updateEmptyState();
  });

  bus.on('file:renamed', ({ from, to }) => {
    if (!openDocs.has(from)) return;
    // Close old, open new at same view state
    const doc = openDocs.get(from);
    const wasActive = activePath === from;
    const vs = editor ? editor.saveViewState() : null;
    try { doc.model.dispose(); } catch {}
    openDocs.delete(from);
    tabOrder = tabOrder.filter((p) => p !== from);
    if (wasActive) {
      activePath = null;
      state.activeFile = null;
    }
    if (wasActive) openFile(to).then(() => {
      if (editor && vs) editor.restoreViewState(vs);
    });
  });

  bus.on('file:deleted', ({ path }) => {
    if (openDocs.has(path)) closeFile(path);
  });

  // Global keyboard shortcuts (fallback if Monaco not focused)
  window.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      saveFile(activePath);
    } else if (mod && e.shiftKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      saveAllFiles();
    } else if (mod && (e.key === 'w' || e.key === 'W')) {
      if (activePath) { e.preventDefault(); closeFile(activePath); }
    }
  });

  // Listen for main-process menu events (if available)
  if (api.onMenu) {
    api.onMenu('save', () => saveFile(activePath));
    api.onMenu('save-all', () => saveAllFiles());
  }

  // Initial empty state
  updateEmptyState();
  renderTabs();
  updateBreadcrumb();

  // ---------- Virtual tab API (Settings, Diff, Commit details, etc.) ----------
  function openVirtualTab({ id, name, icon, mount }) {
    if (!id || typeof mount !== 'function') return;
    if (openDocs.has(id)) {
      switchTo(id);
      return;
    }
    openDocs.set(id, {
      virtual: true,
      name: name || id,
      icon,
      mount,
      mounted: false,
      dirty: false,
    });
    tabOrder.push(id);
    switchTo(id);
  }

  async function openDiffTab({ id, name, original, modified, language, originalTitle, modifiedTitle }) {
    await loadMonaco();
    const tabId = id || `pipilot://diff/${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    if (openDocs.has(tabId)) { switchTo(tabId); return; }

    let diffEditor = null;
    let originalModel = null;
    let modifiedModel = null;

    openVirtualTab({
      id: tabId,
      name: name || 'Diff',
      mount: (container) => {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;width:100%;height:100%;';
        if (originalTitle || modifiedTitle) {
          const header = document.createElement('div');
          header.style.cssText = 'display:flex;font-size:11px;color:var(--text-mid);padding:4px 12px;border-bottom:1px solid var(--border);background:var(--surface);';
          const left = document.createElement('div');
          left.style.flex = '1';
          left.textContent = originalTitle || 'Original';
          const right = document.createElement('div');
          right.style.flex = '1';
          right.style.borderLeft = '1px solid var(--border)';
          right.style.paddingLeft = '12px';
          right.textContent = modifiedTitle || 'Modified';
          header.appendChild(left);
          header.appendChild(right);
          wrap.appendChild(header);
        }
        const diffHost = document.createElement('div');
        diffHost.style.cssText = 'flex:1;min-height:0;';
        wrap.appendChild(diffHost);
        container.appendChild(wrap);

        // Defer Monaco creation to allow layout
        setTimeout(() => {
          try {
            originalModel = monaco.editor.createModel(original || '', language || 'plaintext');
            modifiedModel = monaco.editor.createModel(modified || '', language || 'plaintext');
            diffEditor = monaco.editor.createDiffEditor(diffHost, {
              automaticLayout: true,
              theme: 'midnight',
              readOnly: true,
              renderSideBySide: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 13,
              fontFamily: 'Geist Mono, monospace',
            });
            diffEditor.setModel({ original: originalModel, modified: modifiedModel });
          } catch (e) { console.error('diff editor', e); }
        }, 30);

        return () => {
          try { diffEditor?.dispose(); } catch {}
          try { originalModel?.dispose(); } catch {}
          try { modifiedModel?.dispose(); } catch {}
        };
      },
    });
  }

  // Public API
  window.PiPilot.editor = {
    openFile,
    closeFile,
    saveFile,
    saveAllFiles,
    getActiveFile,
    getDirtyFiles,
    getMonaco: () => monaco,
    getEditor: () => editor,
    openVirtualTab,
    openDiffTab,
    isVirtualTab: (id) => !!openDocs.get(id)?.virtual,
  };
})();
