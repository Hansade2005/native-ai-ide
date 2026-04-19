// PiPilot IDE — AI Chat panel (Phase 4 renderer)
// Streams Claude Agent SDK events via electronAPI.agent.send.

(function () {
  const api = window.electronAPI;
  const bus = window.PiPilot.bus;
  const state = window.PiPilot.state;

  let markedReady = false;
  let markedLoading = null;
  function loadMarked() {
    if (markedReady || window.marked) { markedReady = true; return Promise.resolve(); }
    if (markedLoading) return markedLoading;
    markedLoading = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/marked@12.0.0/marked.min.js';
      s.onload = () => {
        if (window.marked && window.marked.setOptions) {
          window.marked.setOptions({ breaks: true, gfm: true });
        }
        markedReady = true;
        resolve();
      };
      s.onerror = () => { markedReady = false; resolve(); };
      document.head.appendChild(s);
    });
    return markedLoading;
  }

  function injectStyles() {
    if (document.getElementById('chat-inline-styles')) return;
    const css = `
.msg { margin: 12px 14px; display: flex; flex-direction: column; gap: 6px; }
.msg-user { align-items: flex-end; }
.msg-user .msg-bubble {
  max-width: 88%; padding: 8px 12px; background: var(--surface-alt);
  border-radius: var(--radius-md); border-left: 2px solid var(--accent);
  color: var(--text-strong); font-size: var(--fs-sm); white-space: pre-wrap; word-wrap: break-word;
}
.msg-assistant { align-items: stretch; }
.msg-assistant .md-body { font-size: var(--fs-sm); color: var(--text); line-height: 1.6; }
.md-body p { margin: 0 0 8px; }
.md-body p:last-child { margin-bottom: 0; }
.md-body h1, .md-body h2, .md-body h3 { color: var(--text-strong); margin: 14px 0 6px; font-weight: 600; }
.md-body h1 { font-size: var(--fs-lg); }
.md-body h2 { font-size: var(--fs-md); }
.md-body h3 { font-size: var(--fs-base); }
.md-body ul, .md-body ol { margin: 0 0 8px 20px; }
.md-body li { margin: 2px 0; }
.md-body a { color: var(--info); }
.md-body code:not(pre code) {
  background: var(--surface-alt); padding: 1px 5px; border-radius: 3px;
  font-family: var(--font-mono); font-size: 12px; color: var(--accent-light);
}
.md-body pre {
  background: var(--surface-alt); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 10px 12px; margin: 8px 0;
  overflow-x: auto; position: relative;
}
.md-body pre code { font-family: var(--font-mono); font-size: 12px; color: var(--text-strong); }
.md-body pre .copy-code-btn {
  position: absolute; top: 4px; right: 4px; padding: 3px 8px; font-size: 10px;
  background: var(--surface-raised); color: var(--text-mid); border: 1px solid var(--border);
  border-radius: 3px; cursor: pointer; opacity: 0; transition: opacity var(--t);
}
.md-body pre:hover .copy-code-btn { opacity: 1; }
.md-body pre .copy-code-btn:hover { color: var(--accent); border-color: var(--accent); }
.md-body blockquote {
  border-left: 3px solid var(--border); padding-left: 10px; color: var(--text-mid); margin: 6px 0;
}
.md-body table { border-collapse: collapse; margin: 6px 0; font-size: 12px; }
.md-body th, .md-body td { border: 1px solid var(--border); padding: 4px 8px; }
.md-body th { background: var(--surface-alt); }

.tool-card {
  margin: 6px 0; background: var(--surface-alt); border: 1px solid var(--border);
  border-radius: var(--radius); overflow: hidden; font-size: 12px;
}
.tool-card-header {
  display: flex; align-items: center; gap: 8px; padding: 6px 10px;
  cursor: pointer; user-select: none;
}
.tool-card-header:hover { background: var(--surface-raised); }
.tool-card-icon { color: var(--accent); }
.tool-card-name { font-family: var(--font-mono); color: var(--text-strong); font-weight: 500; }
.tool-card-status { margin-left: auto; font-size: 10px; padding: 1px 6px; border-radius: 3px; }
.tool-card-status.running { background: rgba(255,107,53,0.15); color: var(--accent); }
.tool-card-status.success { background: rgba(86,211,100,0.12); color: var(--ok); }
.tool-card-status.error { background: rgba(229,83,75,0.15); color: var(--error); }
.tool-card-body {
  padding: 8px 10px; border-top: 1px solid var(--border);
  background: var(--bg); font-family: var(--font-mono); font-size: 11px;
  white-space: pre-wrap; word-break: break-word; max-height: 240px; overflow-y: auto;
}
.tool-card.collapsed .tool-card-body { display: none; }

.thinking-card {
  margin: 6px 0; padding: 6px 10px; background: rgba(138,138,148,0.08);
  border-left: 2px solid var(--text-faint); color: var(--text-mid);
  font-style: italic; font-size: 12px; border-radius: 3px; white-space: pre-wrap;
}

.error-box {
  margin: 8px 0; padding: 8px 12px; background: rgba(229,83,75,0.1);
  border-left: 2px solid var(--error); color: var(--error);
  border-radius: 3px; font-size: 12px;
}

.msg-footer {
  font-size: 10px; color: var(--text-dim); margin-top: 4px;
  display: flex; gap: 12px;
}

.mention-popup {
  position: absolute; background: var(--surface-raised); border: 1px solid var(--border);
  border-radius: var(--radius); box-shadow: var(--shadow-lg); max-height: 240px;
  overflow-y: auto; min-width: 240px; z-index: 10000;
}
.mention-item { padding: 6px 10px; font-size: 12px; cursor: pointer; }
.mention-item:hover, .mention-item.active { background: var(--accent-dim); color: var(--text-strong); }
.mention-item .path { color: var(--text-dim); font-size: 10px; margin-left: 6px; }

.attachment-chip {
  display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px;
  background: var(--surface-raised); border: 1px solid var(--border);
  border-radius: 12px; font-size: 11px; color: var(--text); margin: 2px 4px 2px 0;
}
.attachment-chip .x { cursor: pointer; color: var(--text-dim); }
.attachment-chip .x:hover { color: var(--error); }
`;
    const styleEl = document.createElement('style');
    styleEl.id = 'chat-inline-styles';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  // ---------- State ----------
  let currentSessionId = null;
  let activeStream = null;
  let messages = []; // current session messages (in-memory mirror)
  let attachments = []; // [{ path, name }]
  let currentAssistantEl = null;
  let userScrolledUp = false;

  // ---------- DOM refs ----------
  const messagesEl = document.getElementById('chat-messages');
  const inputEl = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const stopBtn = document.getElementById('chat-stop');
  const attachBtn = document.getElementById('chat-attach');
  const uploadBtn = document.getElementById('chat-upload');
  const modeSelect = document.getElementById('chat-mode-select');
  const modeBadge = document.getElementById('chat-mode-badge');
  const sessionSelect = document.getElementById('chat-session-select');
  const newBtn = document.getElementById('chat-new');
  const settingsBtn = document.getElementById('chat-settings');
  const attachmentsEl = document.getElementById('chat-attachments');
  const chatPanel = document.getElementById('chat-panel');
  const chatWelcome = messagesEl ? messagesEl.querySelector('.chat-welcome') : null;

  // ---------- Helpers ----------
  function scrollToBottom(force) {
    if (!messagesEl) return;
    if (force || !userScrolledUp) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  if (messagesEl) {
    messagesEl.addEventListener('scroll', () => {
      const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 40;
      userScrolledUp = !nearBottom;
    });
  }

  function hideWelcome() {
    if (chatWelcome && chatWelcome.parentNode) chatWelcome.remove();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderMarkdown(text) {
    if (window.marked && window.marked.parse) {
      try { return window.marked.parse(text); } catch { return escapeHtml(text); }
    }
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  function attachCopyButtons(root) {
    root.querySelectorAll('pre').forEach(pre => {
      if (pre.querySelector('.copy-code-btn')) return;
      const btn = document.createElement('button');
      btn.className = 'copy-code-btn';
      btn.textContent = 'Copy';
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const code = pre.querySelector('code')?.innerText || pre.innerText || '';
        try {
          await navigator.clipboard.writeText(code);
          btn.textContent = 'Copied';
          setTimeout(() => { btn.textContent = 'Copy'; }, 1200);
        } catch {}
      });
      pre.appendChild(btn);
    });
  }

  function appendUserMessage(text) {
    hideWelcome();
    const wrap = document.createElement('div');
    wrap.className = 'msg msg-user';
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;
    wrap.appendChild(bubble);
    if (attachments.length) {
      const meta = document.createElement('div');
      meta.style.fontSize = '10px';
      meta.style.color = 'var(--text-dim)';
      meta.textContent = attachments.map(a => a.name || a.path).join(' · ');
      wrap.appendChild(meta);
    }
    messagesEl.appendChild(wrap);
    scrollToBottom(true);
  }

  function ensureAssistantMessage() {
    if (currentAssistantEl) return currentAssistantEl;
    hideWelcome();
    const wrap = document.createElement('div');
    wrap.className = 'msg msg-assistant';
    const body = document.createElement('div');
    body.className = 'md-body';
    body.dataset.text = '';
    wrap.appendChild(body);
    messagesEl.appendChild(wrap);
    currentAssistantEl = wrap;
    scrollToBottom();
    return wrap;
  }

  function appendAssistantText(text) {
    const wrap = ensureAssistantMessage();
    const body = wrap.querySelector('.md-body');
    body.dataset.text = (body.dataset.text || '') + text;
    body.innerHTML = renderMarkdown(body.dataset.text);
    attachCopyButtons(body);
    scrollToBottom();
  }

  function appendToolCard(call) {
    const wrap = ensureAssistantMessage();
    const card = document.createElement('div');
    card.className = 'tool-card';
    card.dataset.toolId = call.id;
    const header = document.createElement('div');
    header.className = 'tool-card-header';
    header.innerHTML = `
      <span class="tool-card-icon">🔧</span>
      <span class="tool-card-name">${escapeHtml(call.name || 'tool')}</span>
      <span class="tool-card-status running">running</span>
    `;
    header.addEventListener('click', () => card.classList.toggle('collapsed'));
    const body = document.createElement('div');
    body.className = 'tool-card-body';
    let inputStr;
    try { inputStr = JSON.stringify(call.input, null, 2); }
    catch { inputStr = String(call.input); }
    body.textContent = inputStr.slice(0, 4000);
    card.appendChild(header);
    card.appendChild(body);
    card.classList.add('collapsed');
    wrap.appendChild(card);
    scrollToBottom();
  }

  function markToolResult(toolUseId, content, isError) {
    if (!currentAssistantEl) return;
    const card = currentAssistantEl.querySelector(`.tool-card[data-tool-id="${CSS.escape(toolUseId)}"]`);
    if (!card) return;
    const status = card.querySelector('.tool-card-status');
    if (status) {
      status.classList.remove('running');
      status.classList.add(isError ? 'error' : 'success');
      status.textContent = isError ? 'error' : 'done';
    }
    const body = card.querySelector('.tool-card-body');
    if (body) {
      const sep = document.createElement('div');
      sep.style.borderTop = '1px solid var(--border)';
      sep.style.margin = '6px 0';
      body.appendChild(sep);
      const out = document.createElement('div');
      const text = typeof content === 'string' ? content : (content == null ? '' : JSON.stringify(content));
      out.textContent = text.slice(0, 4000);
      body.appendChild(out);
    }
  }

  function appendThinking(text) {
    const wrap = ensureAssistantMessage();
    const card = document.createElement('div');
    card.className = 'thinking-card';
    card.textContent = text;
    wrap.appendChild(card);
    scrollToBottom();
  }

  function appendError(text) {
    const wrap = ensureAssistantMessage();
    const card = document.createElement('div');
    card.className = 'error-box';
    card.textContent = text;
    wrap.appendChild(card);
    scrollToBottom();
  }

  function finalizeResult(result) {
    if (!currentAssistantEl) return;
    const footer = document.createElement('div');
    footer.className = 'msg-footer';
    const cost = result && result.totalCostUsd ? `$${result.totalCostUsd.toFixed(4)}` : '';
    const dur = result && result.durationMs ? `${(result.durationMs / 1000).toFixed(1)}s` : '';
    const subtype = result && result.subtype ? result.subtype : 'done';
    footer.innerHTML = `<span>${escapeHtml(subtype)}</span>${dur ? `<span>${dur}</span>` : ''}${cost ? `<span>${cost}</span>` : ''}`;
    currentAssistantEl.appendChild(footer);
  }

  // ---------- Attachments ----------
  function renderAttachments() {
    if (!attachmentsEl) return;
    attachmentsEl.innerHTML = '';
    attachments.forEach((a, idx) => {
      const chip = document.createElement('span');
      chip.className = 'attachment-chip';
      chip.innerHTML = `📎 ${escapeHtml(a.name || a.path)} <span class="x">×</span>`;
      chip.querySelector('.x').addEventListener('click', () => {
        attachments.splice(idx, 1);
        renderAttachments();
      });
      attachmentsEl.appendChild(chip);
    });
  }

  if (attachBtn) {
    attachBtn.addEventListener('click', async () => {
      const picked = await api.pickFile({ multi: true });
      if (!picked) return;
      const arr = Array.isArray(picked) ? picked : [picked];
      arr.forEach(p => {
        const name = p.split(/[\\/]/).pop();
        attachments.push({ path: p, name });
      });
      renderAttachments();
    });
  }

  if (uploadBtn) {
    uploadBtn.addEventListener('click', async () => {
      if (attachBtn) attachBtn.click();
    });
  }

  // ---------- Mode selector ----------
  function setMode(mode) {
    state.agentMode = mode === 'plan' ? 'plan' : 'agent';
    if (modeBadge) {
      modeBadge.textContent = state.agentMode === 'plan' ? 'Plan' : 'Agent';
      modeBadge.classList.toggle('badge-info', state.agentMode === 'plan');
      modeBadge.classList.toggle('badge-accent', state.agentMode !== 'plan');
    }
    if (modeSelect && modeSelect.value !== state.agentMode) modeSelect.value = state.agentMode;
  }
  if (modeSelect) modeSelect.addEventListener('change', () => setMode(modeSelect.value));
  setMode('agent');

  // ---------- Sessions ----------
  async function refreshSessionList() {
    if (!sessionSelect || !state.projectPath) return;
    try {
      const result = await api.agent.listSessions(state.projectPath);
      const list = (result && result.sessions) || result || [];
      sessionSelect.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '— Select session —';
      sessionSelect.appendChild(placeholder);
      list.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.title || s.id;
        sessionSelect.appendChild(opt);
      });
      if (currentSessionId) sessionSelect.value = currentSessionId;
    } catch (e) {
      console.error('refreshSessionList', e);
    }
  }

  async function newSession() {
    if (!state.projectPath) return;
    try {
      const created = await api.agent.newSession(state.projectPath, `Chat ${new Date().toLocaleTimeString()}`);
      currentSessionId = created && created.id ? created.id : null;
      messages = [];
      messagesEl.innerHTML = '';
      currentAssistantEl = null;
      await refreshSessionList();
    } catch (e) {
      console.error('newSession', e);
    }
  }

  async function loadSession(sessionId) {
    if (!state.projectPath || !sessionId) return;
    try {
      const result = await api.agent.loadSession(state.projectPath, sessionId);
      const session = (result && result.session) || result;
      currentSessionId = sessionId;
      messages = (session && session.messages) || [];
      messagesEl.innerHTML = '';
      currentAssistantEl = null;
      messages.forEach(m => renderHistoryMessage(m));
      scrollToBottom(true);
    } catch (e) {
      console.error('loadSession', e);
    }
  }

  function renderHistoryMessage(m) {
    if (m.role === 'user') {
      hideWelcome();
      const wrap = document.createElement('div');
      wrap.className = 'msg msg-user';
      const bubble = document.createElement('div');
      bubble.className = 'msg-bubble';
      const text = (m.blocks && m.blocks[0] && m.blocks[0].text) || '';
      bubble.textContent = text;
      wrap.appendChild(bubble);
      messagesEl.appendChild(wrap);
    } else if (m.role === 'assistant') {
      hideWelcome();
      const wrap = document.createElement('div');
      wrap.className = 'msg msg-assistant';
      const body = document.createElement('div');
      body.className = 'md-body';
      let buf = '';
      (m.blocks || []).forEach(b => {
        if (b.type === 'text') buf += b.text + '\n';
        else if (b.type === 'thinking') {
          // skip rebuilding thinking cards from history
        } else if (b.type === 'tool_call') {
          // append a small inline note
          buf += `\n*[tool: ${b.name}]*\n`;
        }
      });
      body.dataset.text = buf;
      body.innerHTML = renderMarkdown(buf);
      attachCopyButtons(body);
      wrap.appendChild(body);
      messagesEl.appendChild(wrap);
    }
  }

  if (newBtn) newBtn.addEventListener('click', newSession);
  if (sessionSelect) {
    sessionSelect.addEventListener('change', () => {
      const id = sessionSelect.value;
      if (id) loadSession(id);
    });
  }

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => bus.emit('modal:settings'));
  }

  // ---------- Send ----------
  function setSending(sending) {
    if (sendBtn) sendBtn.classList.toggle('hidden', sending);
    if (stopBtn) stopBtn.classList.toggle('hidden', !sending);
    bus.emit('agent:status', sending ? 'thinking' : 'ready');
  }

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;
    if (!state.projectPath) {
      bus.emit('toast:show', { message: 'Open a project first', type: 'warn' });
      return;
    }
    if (!currentSessionId) {
      try {
        const created = await api.agent.newSession(state.projectPath, text.slice(0, 60));
        currentSessionId = created && created.id ? created.id : null;
        await refreshSessionList();
      } catch {}
    }

    inputEl.value = '';
    autoResize();
    appendUserMessage(text);
    currentAssistantEl = null;
    const sentAttachments = attachments.slice();
    attachments = [];
    renderAttachments();

    setSending(true);

    activeStream = api.agent.send({
      sessionId: currentSessionId,
      projectPath: state.projectPath,
      message: text,
      mode: state.agentMode,
      attachments: sentAttachments,
    }, (evt) => {
      handleAgentEvent(evt);
    });
  }

  function handleAgentEvent(evt) {
    if (!evt) return;
    switch (evt.type) {
      case 'system':
        // ignore for now
        break;
      case 'text':
        appendAssistantText(evt.text || '');
        break;
      case 'tool_call':
        appendToolCard(evt);
        break;
      case 'tool_result':
        markToolResult(evt.toolUseId, evt.content, evt.isError);
        break;
      case 'thinking':
        appendThinking(evt.text || '');
        break;
      case 'error':
        appendError(evt.message || 'Unknown error');
        setSending(false);
        bus.emit('agent:status', 'error');
        break;
      case 'result':
        finalizeResult(evt);
        setSending(false);
        if (activeStream && activeStream.dispose) activeStream.dispose();
        activeStream = null;
        break;
    }
  }

  if (sendBtn) sendBtn.addEventListener('click', sendMessage);
  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      if (activeStream && activeStream.stop) activeStream.stop();
      setSending(false);
      bus.emit('agent:status', 'ready');
    });
  }

  // ---------- Textarea behavior ----------
  function autoResize() {
    if (!inputEl) return;
    inputEl.style.height = 'auto';
    const h = Math.min(inputEl.scrollHeight, 6 * 22);
    inputEl.style.height = h + 'px';
  }

  if (inputEl) {
    inputEl.addEventListener('input', () => {
      autoResize();
      handleMentionTrigger();
    });
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !mentionPopup) {
        e.preventDefault();
        sendMessage();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // ---------- @ mentions ----------
  let mentionPopup = null;
  let mentionFiles = null;
  let mentionStartIdx = -1;

  async function ensureMentionFiles() {
    if (mentionFiles || !state.projectPath) return mentionFiles;
    try {
      const tree = await api.files.tree(state.projectPath);
      const flat = [];
      function walk(node) {
        if (!node) return;
        if (node.type === 'file') flat.push({ name: node.name, path: node.path });
        if (node.children) node.children.forEach(walk);
      }
      walk(tree);
      mentionFiles = flat;
    } catch {
      mentionFiles = [];
    }
    return mentionFiles;
  }

  function closeMentionPopup() {
    if (mentionPopup) { mentionPopup.remove(); mentionPopup = null; }
  }

  async function handleMentionTrigger() {
    const val = inputEl.value;
    const cursor = inputEl.selectionStart;
    const before = val.slice(0, cursor);
    const m = before.match(/@([\w./-]*)$/);
    if (!m) { closeMentionPopup(); return; }
    mentionStartIdx = cursor - m[0].length;
    const query = m[1].toLowerCase();
    await ensureMentionFiles();
    const matches = (mentionFiles || []).filter(f => f.name.toLowerCase().includes(query) || f.path.toLowerCase().includes(query)).slice(0, 12);
    if (!matches.length) { closeMentionPopup(); return; }
    if (!mentionPopup) {
      mentionPopup = document.createElement('div');
      mentionPopup.className = 'mention-popup';
      document.body.appendChild(mentionPopup);
    }
    mentionPopup.innerHTML = '';
    matches.forEach((f, i) => {
      const item = document.createElement('div');
      item.className = 'mention-item' + (i === 0 ? ' active' : '');
      item.innerHTML = `<span>${escapeHtml(f.name)}</span><span class="path">${escapeHtml(f.path.replace(state.projectPath + '/', ''))}</span>`;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        insertMention(f);
      });
      mentionPopup.appendChild(item);
    });
    const rect = inputEl.getBoundingClientRect();
    mentionPopup.style.left = rect.left + 'px';
    mentionPopup.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
  }

  function insertMention(file) {
    const val = inputEl.value;
    const cursor = inputEl.selectionStart;
    const before = val.slice(0, mentionStartIdx);
    const after = val.slice(cursor);
    const insert = '@' + file.path.replace(state.projectPath + '/', '');
    inputEl.value = before + insert + ' ' + after;
    inputEl.focus();
    const newPos = before.length + insert.length + 1;
    inputEl.setSelectionRange(newPos, newPos);
    closeMentionPopup();
    autoResize();
  }

  document.addEventListener('click', (e) => {
    if (mentionPopup && !mentionPopup.contains(e.target) && e.target !== inputEl) closeMentionPopup();
  });

  // ---------- Bus events ----------
  bus.on('project:opened', async () => {
    mentionFiles = null;
    messages = [];
    currentSessionId = null;
    if (messagesEl) messagesEl.innerHTML = '';
    currentAssistantEl = null;
    await refreshSessionList();
    await newSession();
  });

  bus.on('project:closed', () => {
    if (activeStream && activeStream.stop) activeStream.stop();
    activeStream = null;
    currentSessionId = null;
    messages = [];
    if (messagesEl) messagesEl.innerHTML = '';
    if (sessionSelect) sessionSelect.innerHTML = '<option>New Session</option>';
  });

  bus.on('chat:focus-with-prompt', (text) => {
    if (chatPanel) chatPanel.classList.remove('hidden');
    if (inputEl) {
      inputEl.value = text || '';
      inputEl.focus();
      autoResize();
    }
  });

  bus.on('menu:toggle-chat', () => {
    if (chatPanel) chatPanel.classList.toggle('hidden');
  });

  bus.on('chat:send', () => {
    if (document.activeElement === inputEl) sendMessage();
  });

  // ---------- Init ----------
  loadMarked().then(() => injectStyles());
  injectStyles();

  window.PiPilot.chat = {
    focus() { inputEl?.focus(); },
    sendMessage(text) { if (inputEl) { inputEl.value = text || ''; sendMessage(); } },
    newSession,
    stop() { if (activeStream && activeStream.stop) activeStream.stop(); },
    getCurrentSession() { return currentSessionId; },
  };
})();
