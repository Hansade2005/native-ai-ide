(() => {
  const { bus } = window.PiPilot;

  function setBranch(name) {
    const el = $('#status-branch');
    if (!el) return;
    el.textContent = `⎇ ${name || '—'}`;
  }

  function setProblems(count) {
    const el = $('#status-problems');
    if (!el) return;
    const raw = (count && typeof count === 'object')
      ? (count.total ?? count.count ?? 0)
      : count;
    const n = Number(raw) || 0;
    el.textContent = `⚠ ${n}`;
    el.classList.toggle('ok', n === 0);
    el.classList.toggle('warn', n > 0);
  }

  function setPosition(pos) {
    const el = $('#status-position');
    if (!el) return;
    const { line = 1, col = 1 } = pos || {};
    el.textContent = `Ln ${line}, Col ${col}`;
  }

  function LANG_LABEL(id) {
    if (!id) return 'Plain Text';
    const map = {
      javascript: 'JavaScript', typescript: 'TypeScript', json: 'JSON',
      markdown: 'Markdown', html: 'HTML', css: 'CSS', scss: 'SCSS',
      python: 'Python', go: 'Go', rust: 'Rust', java: 'Java',
      kotlin: 'Kotlin', swift: 'Swift', c: 'C', cpp: 'C++',
      csharp: 'C#', php: 'PHP', shell: 'Shell', yaml: 'YAML',
      ini: 'INI', sql: 'SQL', lua: 'Lua', r: 'R',
      dockerfile: 'Dockerfile', makefile: 'Makefile', xml: 'XML',
      plaintext: 'Plain Text',
    };
    return map[id] || id.charAt(0).toUpperCase() + id.slice(1);
  }

  function setLanguage(lang) {
    const el = $('#status-language');
    if (!el) return;
    const id = (lang && typeof lang === 'object') ? (lang.language || lang.id || '') : lang;
    el.textContent = LANG_LABEL(id);
  }

  function setAgent(status) {
    const el = $('#status-agent');
    if (!el) return;
    el.classList.remove('ok', 'warn', 'error', 'accent');
    switch (status) {
      case 'thinking':
        el.textContent = '● Thinking…';
        el.classList.add('accent');
        break;
      case 'error':
        el.textContent = '● Error';
        el.classList.add('error');
        break;
      case 'ready':
      default:
        el.textContent = '● Ready';
        el.classList.add('ok');
        break;
    }
  }

  function init() {
    setBranch('main');
    setProblems(0);
    setPosition({ line: 1, col: 1 });
    setLanguage('Plain Text');
    setAgent('ready');

    bus.on('git:branch-changed', (name) => setBranch(name));
    bus.on('problems:count', (count) => setProblems(count));
    bus.on('editor:position', (pos) => setPosition(pos));
    bus.on('editor:language', (lang) => setLanguage(lang));
    bus.on('agent:status', (s) => setAgent(s));

    $('#status-branch')?.addEventListener('click', () => {
      const btns = $$('#activity-bar .activity-btn[data-panel]');
      btns.forEach(b => b.classList.toggle('active', b.dataset.panel === 'git'));
      bus.emit('panel:switch', 'git');
    });

    $('#status-problems')?.addEventListener('click', () => {
      const tabs = $$('.bottom-tab[data-bottom]');
      tabs.forEach(t => t.classList.toggle('active', t.dataset.bottom === 'problems'));
      $$('.bottom-pane').forEach(p => p.classList.toggle('active', p.id === 'problems-pane'));
      $('#main-area')?.classList.remove('bottom-collapsed');
      bus.emit('bottom:switch', 'problems');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
