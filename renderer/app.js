(() => {
  const { bus, state, api } = window.PiPilot;

  const LAYOUT_KEY = 'pipilot:layout';
  const LAST_PROJECT_KEY = 'pipilot:last-project';

  function basename(p) {
    if (!p) return '';
    const norm = String(p).replace(/[\\/]+$/, '');
    const parts = norm.split(/[\\/]/);
    return parts[parts.length - 1] || norm;
  }

  function saveLayout() {
    const root = $('#ide-root');
    if (!root) return;
    const layout = {
      gridTemplateColumns: root.style.gridTemplateColumns || '',
      bottomHeight: $('#bottom-panel')?.style.height || '',
      sideCollapsed: root.classList.contains('side-collapsed'),
      chatCollapsed: root.classList.contains('chat-collapsed'),
      bottomCollapsed: $('#main-area')?.classList.contains('bottom-collapsed') || false,
      statusbarHidden: root.classList.contains('statusbar-hidden'),
      bottomRows: $('#main-area')?.style.gridTemplateRows || '',
    };
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch {}
  }

  function restoreLayout() {
    const root = $('#ide-root');
    if (!root) return;
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (!raw) return;
      const layout = JSON.parse(raw);
      if (layout.gridTemplateColumns) root.style.gridTemplateColumns = layout.gridTemplateColumns;
      if (layout.bottomHeight) {
        const bp = $('#bottom-panel');
        const main = $('#main-area');
        if (bp && main) {
          main.style.gridTemplateRows = `auto auto 1fr 4px ${layout.bottomHeight}`;
        }
      }
      if (layout.sideCollapsed) root.classList.add('side-collapsed');
      if (layout.chatCollapsed) root.classList.add('chat-collapsed');
      if (layout.bottomCollapsed) $('#main-area')?.classList.add('bottom-collapsed');
      if (layout.statusbarHidden) root.classList.add('statusbar-hidden');
      if (layout.bottomRows) {
        const main = $('#main-area');
        if (main) main.style.gridTemplateRows = layout.bottomRows;
      }
    } catch {}
  }

  async function openProject(projectPath) {
    if (!projectPath) return;
    const name = basename(projectPath);
    state.projectPath = projectPath;
    state.projectName = name;

    $('#welcome-screen')?.classList.add('hidden');
    $('#ide-root')?.classList.remove('hidden');

    const nameEl = $('#project-name');
    if (nameEl) nameEl.textContent = name;

    try { await api.recentProjects.add({ path: projectPath, name }); } catch {}
    try { localStorage.setItem(LAST_PROJECT_KEY, projectPath); } catch {}

    restoreLayout();
    bus.emit('project:opened', { path: projectPath, name });
  }

  function closeProject() {
    const prev = { path: state.projectPath, name: state.projectName };
    state.projectPath = null;
    state.projectName = null;
    state.openFiles = [];
    state.activeFile = null;

    $('#ide-root')?.classList.add('hidden');
    $('#welcome-screen')?.classList.remove('hidden');

    try { localStorage.removeItem(LAST_PROJECT_KEY); } catch {}
    bus.emit('project:closed', prev);
  }

  window.PiPilot.openProject = openProject;
  window.PiPilot.closeProject = closeProject;

  function wireActivityBar() {
    const btns = $$('#activity-bar .activity-btn[data-panel]');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = btn.dataset.panel;
        // The Chat activity button toggles the right panel instead of
        // switching the left sidebar — clicking while open closes it.
        if (panel === 'chat') {
          if (isChatVisible()) {
            hideChatPanel();
            btn.classList.remove('active');
          } else {
            revealChatPanel();
            btn.classList.add('active');
          }
          return;
        }
        btns.forEach(b => b.classList.toggle('active', b === btn));
        bus.emit('panel:switch', panel);
      });
    });

    $('#open-settings')?.addEventListener('click', () => bus.emit('modal:settings'));
    $('#chat-close')?.addEventListener('click', () => {
      hideChatPanel();
      $('#activity-bar .activity-btn[data-panel="chat"]')?.classList.remove('active');
    });
  }

  function revealChatPanel() {
    // Make sure the chat panel is visible (not hidden + not collapsed) and focus it.
    $('#chat-panel')?.classList.remove('hidden');
    $('#ide-root')?.classList.remove('chat-collapsed');
    saveLayout();
    window.PiPilot?.chat?.focus?.();
  }

  function hideChatPanel() {
    $('#ide-root')?.classList.add('chat-collapsed');
    saveLayout();
  }

  function isChatVisible() {
    const root = $('#ide-root');
    return !!(root && !root.classList.contains('chat-collapsed'));
  }

  function wireProjectSwitcher() {
    $('#project-switcher')?.addEventListener('click', () => {
      closeProject();
    });
  }

  function wireBottomPanel() {
    const tabs = $$('.bottom-tab[data-bottom]');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const key = tab.dataset.bottom;
        tabs.forEach(t => t.classList.toggle('active', t === tab));
        $$('.bottom-pane').forEach(p => {
          p.classList.toggle('active', p.id === `${key}-pane`);
        });
        $('#main-area')?.classList.remove('bottom-collapsed');
        saveLayout();
        bus.emit('bottom:switch', key);
      });
    });

    $('#bottom-close')?.addEventListener('click', () => {
      const main = $('#main-area');
      if (!main) return;
      setBottomCollapsed(main, !main.classList.contains('bottom-collapsed'));
      saveLayout();
    });

    $('#terminal-new')?.addEventListener('click', () => bus.emit('terminal:new'));
  }

  function toggleSidebar() {
    $('#ide-root')?.classList.toggle('side-collapsed');
    saveLayout();
  }
  function toggleChat() {
    $('#ide-root')?.classList.toggle('chat-collapsed');
    saveLayout();
  }
  function setBottomCollapsed(main, collapsed) {
    if (collapsed) {
      main.classList.add('bottom-collapsed');
      if (main.style.gridTemplateRows) {
        main.dataset.prevRows = main.style.gridTemplateRows;
        main.style.gridTemplateRows = '';
      }
    } else {
      main.classList.remove('bottom-collapsed');
      if (main.dataset.prevRows) {
        main.style.gridTemplateRows = main.dataset.prevRows;
        delete main.dataset.prevRows;
      }
    }
  }

  function toggleTerminal() {
    const main = $('#main-area');
    if (!main) return;
    const isCollapsed = main.classList.contains('bottom-collapsed');
    const termTab = $('.bottom-tab[data-bottom="terminal"]');
    const termActive = termTab?.classList.contains('active');
    const focusedInTerm = document.activeElement?.closest('#terminal-pane');

    if (isCollapsed) {
      // Closed → open on Terminal tab and focus it
      setBottomCollapsed(main, false);
      termTab?.click();
      bus.emit('terminal:focus');
    } else if (!termActive) {
      // Open but on another tab → switch to Terminal and focus
      termTab?.click();
      bus.emit('terminal:focus');
    } else if (!focusedInTerm) {
      // Terminal tab active but focus elsewhere → focus terminal
      bus.emit('terminal:focus');
    } else {
      // Terminal open & focused → close
      setBottomCollapsed(main, true);
    }
    saveLayout();
  }

  function toggleStatusbar() {
    $('#ide-root')?.classList.toggle('statusbar-hidden');
    saveLayout();
  }

  function setupVerticalResizer(el, which) {
    if (!el) return;
    let dragging = false;
    let startX = 0;
    let startCols = '';
    let startActivity = 0, startSide = 0, startChat = 0;

    const onDown = (e) => {
      dragging = true;
      startX = e.clientX;
      const root = $('#ide-root');
      if (!root) return;
      const cs = getComputedStyle(root);
      const cols = cs.gridTemplateColumns.split(' ').map(parseFloat);
      startActivity = cols[0];
      startSide = cols[1];
      startChat = cols[5];
      el.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      e.preventDefault();
    };

    const onMove = (e) => {
      if (!dragging) return;
      const root = $('#ide-root');
      if (!root) return;
      const dx = e.clientX - startX;
      if (which === 'side') {
        const newSide = Math.max(160, Math.min(640, startSide + dx));
        root.style.gridTemplateColumns = `${startActivity}px ${newSide}px 4px 1fr 4px ${startChat}px`;
      } else {
        const newChat = Math.max(240, Math.min(720, startChat - dx));
        root.style.gridTemplateColumns = `${startActivity}px ${startSide}px 4px 1fr 4px ${newChat}px`;
      }
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('dragging');
      document.body.style.cursor = '';
      saveLayout();
    };

    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function setupHorizontalResizer(el) {
    if (!el) return;
    let dragging = false;
    let startY = 0;
    let startHeight = 0;

    const onDown = (e) => {
      dragging = true;
      startY = e.clientY;
      const bp = $('#bottom-panel');
      if (!bp) return;
      startHeight = bp.getBoundingClientRect().height;
      el.classList.add('dragging');
      document.body.style.cursor = 'row-resize';
      e.preventDefault();
    };

    const onMove = (e) => {
      if (!dragging) return;
      const main = $('#main-area');
      if (!main) return;
      const dy = startY - e.clientY;
      const newH = Math.max(80, Math.min(700, startHeight + dy));
      main.style.gridTemplateRows = `auto auto 1fr 4px ${newH}px`;
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('dragging');
      document.body.style.cursor = '';
      saveLayout();
    };

    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function wireResizers() {
    setupVerticalResizer($('#resizer-side'), 'side');
    setupVerticalResizer($('#resizer-chat'), 'chat');
    setupHorizontalResizer($('#resizer-bottom'));
  }

  function wireMenuEvents() {
    if (!api || !api.onMenu) return;
    const map = {
      'open-folder': 'menu:file:open-folder',
      'new-file': 'menu:file:new-file',
      'save': 'menu:file:save',
      'save-all': 'menu:file:save-all',
      'toggle-sidebar': 'menu:view:toggle-sidebar',
      'toggle-terminal': 'menu:view:toggle-terminal',
      'toggle-chat': 'menu:view:toggle-chat',
    };
    for (const [evt, busEvt] of Object.entries(map)) {
      try { api.onMenu(evt, (...args) => bus.emit(busEvt, args[0])); } catch {}
    }
  }

  function wireBusHandlers() {
    bus.on('menu:view:toggle-sidebar', toggleSidebar);
    bus.on('menu:view:toggle-terminal', toggleTerminal);
    bus.on('menu:view:toggle-chat', toggleChat);
    bus.on('menu:view:toggle-statusbar', toggleStatusbar);

    // Mirror shortcut-style events (emitted by shortcuts.js + other modules)
    bus.on('menu:toggle-sidebar', toggleSidebar);
    bus.on('menu:toggle-terminal', toggleTerminal);
    bus.on('menu:toggle-chat', toggleChat);
    bus.on('menu:toggle-statusbar', toggleStatusbar);

    // Bottom-panel helpers — jump directly to a specific tab
    bus.on('bottom:show', (key) => {
      const main = $('#main-area');
      if (!main) return;
      main.classList.remove('bottom-collapsed');
      const tab = $(`.bottom-tab[data-bottom="${key}"]`);
      tab?.click();
      saveLayout();
    });
    bus.on('bottom:hide', () => {
      $('#main-area')?.classList.add('bottom-collapsed');
      saveLayout();
    });

    bus.on('menu:view:toggle-problems', () => bus.emit('bottom:show', 'problems'));
    bus.on('chat:reveal', revealChatPanel);
    bus.on('chat:hide', hideChatPanel);
    bus.on('menu:view:zen', () => {
      const root = $('#ide-root');
      if (!root) return;
      const isZen = root.classList.toggle('side-collapsed');
      root.classList.toggle('chat-collapsed', isZen);
      root.classList.toggle('statusbar-hidden', isZen);
      $('#main-area')?.classList.toggle('bottom-collapsed', isZen);
      saveLayout();
    });

    bus.on('menu:file:open-folder', async () => {
      try {
        const p = await api.pickFolder();
        if (p) openProject(p);
      } catch {}
    });
    bus.on('menu:file:close-folder', () => closeProject());
  }

  async function boot() {
    wireActivityBar();
    wireProjectSwitcher();
    wireBottomPanel();
    wireResizers();
    wireMenuEvents();
    wireBusHandlers();

    let lastProject = null;
    try { lastProject = localStorage.getItem(LAST_PROJECT_KEY); } catch {}

    if (lastProject) {
      try {
        const stat = await api.files.stat(lastProject);
        if (stat && stat.exists !== false) {
          openProject(lastProject);
          return;
        }
      } catch {}
    }

    $('#ide-root')?.classList.add('hidden');
    $('#welcome-screen')?.classList.remove('hidden');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
