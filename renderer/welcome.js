(() => {
  const { bus, api } = window.PiPilot;

  function timeAgo(ts) {
    if (!ts) return '';
    const n = Date.now() - Number(ts);
    if (n < 0) return 'just now';
    const s = Math.floor(n / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    const mo = Math.floor(d / 30);
    if (mo < 12) return `${mo}mo ago`;
    return `${Math.floor(mo / 12)}y ago`;
  }

  function basename(p) {
    if (!p) return '';
    const norm = String(p).replace(/[\\/]+$/, '');
    const parts = norm.split(/[\\/]/);
    return parts[parts.length - 1] || norm;
  }

  async function refreshRecent() {
    const list = $('#recent-projects-list');
    if (!list) return;
    let items = [];
    try { items = (await api.recentProjects.get()) || []; } catch { items = []; }

    list.innerHTML = '';
    if (!items.length) {
      list.appendChild(h('li', { class: 'recent-empty' }, 'No recent projects'));
      return;
    }

    items.forEach(item => {
      const name = item.name || basename(item.path);
      const row = h('li', {},
        h('button', {
          class: 'recent-item',
          onclick: (e) => {
            if (e.target.closest('.recent-item-remove')) return;
            window.PiPilot.openProject(item.path);
          },
        },
          h('div', { class: 'recent-item-body' },
            h('div', { class: 'recent-item-name' }, name),
            h('div', { class: 'recent-item-path' }, item.path || '')
          ),
          h('span', { class: 'recent-item-ago' }, timeAgo(item.openedAt || item.lastOpened || item.ts)),
          h('button', {
            class: 'icon-btn recent-item-remove',
            title: 'Remove from list',
            onclick: async (e) => {
              e.stopPropagation();
              try { await api.recentProjects.remove(item.path); } catch {}
              refreshRecent();
            },
          }, '×')
        )
      );
      list.appendChild(row);
    });
  }

  function wireActions() {
    $('#welcome-open-folder')?.addEventListener('click', async () => {
      try {
        const p = await api.pickFolder();
        if (p) window.PiPilot.openProject(p);
      } catch {}
    });

    $('#welcome-clone-repo')?.addEventListener('click', () => {
      bus.emit('modal:clone-repo');
    });

    $('#welcome-ai-generate')?.addEventListener('click', async () => {
      try {
        const home = await api.getHome();
        const ts = Date.now();
        const tempName = `pipilot-project-${ts}`;
        const sep = home.includes('\\') ? '\\' : '/';
        const tempPath = `${home}${sep}${tempName}`;
        try { await api.files.mkdir(tempPath); } catch {}
        window.PiPilot.openProject(tempPath);
        setTimeout(() => bus.emit('chat:focus-with-prompt', 'Generate a new project: '), 200);
      } catch (e) {
        console.error('ai-generate failed', e);
      }
    });

    $$('.tutorial-card').forEach(card => {
      card.addEventListener('click', () => {
        bus.emit('tutorial:show', card.dataset.tutorial);
      });
    });
  }

  function init() {
    wireActions();
    refreshRecent();
    bus.on('project:opened', refreshRecent);
    bus.on('project:closed', refreshRecent);
    bus.on('recent:refresh', refreshRecent);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
