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

.tool-pill {
  display: inline-flex; align-items: stretch; gap: 0;
  background: var(--surface-alt); border: 1px solid var(--border);
  border-radius: 999px; overflow: hidden; font-size: 11px;
  margin: 4px 0; max-width: 100%; transition: border-color var(--t), background var(--t);
  cursor: pointer; user-select: none; line-height: 1;
}
.tool-pill:hover { border-color: var(--border-hover); background: var(--surface-raised); }
.tool-pill.expanded { border-radius: var(--radius-md); display: flex; flex-direction: column; }
.tool-pill-head {
  display: flex; align-items: center; gap: 6px; padding: 5px 10px 5px 8px;
  min-height: 24px;
}
.tool-pill.expanded .tool-pill-head { border-bottom: 1px solid var(--border); padding: 7px 10px; }
.tool-pill-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; flex-shrink: 0;
}
.tool-pill-icon svg { width: 14px; height: 14px; }
.tool-pill-name {
  font-family: var(--font-mono); color: var(--text-strong);
  font-weight: 500; font-size: 11px; letter-spacing: 0.2px;
}
.tool-pill-preview {
  color: var(--text-mid); font-family: var(--font-mono); font-size: 11px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 260px; padding-left: 2px;
}
.tool-pill-chevron {
  color: var(--text-dim); margin-left: auto; font-size: 9px;
  transition: transform var(--t); flex-shrink: 0;
}
.tool-pill.expanded .tool-pill-chevron { transform: rotate(90deg); }
.tool-pill-status {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 9px; padding: 2px 7px; border-radius: 999px;
  font-family: var(--font-sans); letter-spacing: 0.4px; text-transform: uppercase;
  flex-shrink: 0; font-weight: 500;
}
.tool-pill-status.running { background: rgba(255,107,53,0.18); color: var(--accent); }
.tool-pill-status.running::before {
  content: ''; width: 5px; height: 5px; border-radius: 50%; background: var(--accent);
  animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.1); }
}
.tool-pill-status.success { background: rgba(86,211,100,0.14); color: var(--ok); }
.tool-pill-status.error { background: rgba(229,83,75,0.18); color: var(--error); }
.tool-pill-status.mcp { background: rgba(108,182,255,0.15); color: var(--info); }

.tool-pill-body {
  padding: 8px 12px; background: var(--bg);
  font-family: var(--font-mono); font-size: 11px;
  white-space: pre-wrap; word-break: break-word;
  max-height: 320px; overflow-y: auto;
  color: var(--text);
}
.tool-pill-body .section-label {
  color: var(--text-dim); font-size: 9px; text-transform: uppercase;
  letter-spacing: 0.6px; margin-bottom: 4px; font-family: var(--font-sans);
}
.tool-pill-body .section + .section { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); }
.tool-pill-body .result-ok { color: var(--text); }
.tool-pill-body .result-err { color: var(--error); }
.tool-pill.kind-mcp { border-color: rgba(108,182,255,0.35); }
.tool-pill.kind-mcp .tool-pill-icon { color: var(--info); }

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
  font-size: 10px; color: var(--text-dim); margin-top: 6px;
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
}
.msg-footer .footer-sep { color: var(--text-faint); margin: 0 2px; }
.msg-footer .footer-subtype {
  font-weight: 500; letter-spacing: 0.4px; text-transform: uppercase;
  padding: 1px 6px; border-radius: 3px; font-size: 9px;
}
.msg-footer .footer-ok { background: rgba(86,211,100,0.12); color: var(--ok); }
.msg-footer .footer-err { background: rgba(229,83,75,0.15); color: var(--error); }
.msg-footer .footer-warn { background: rgba(229,166,57,0.15); color: var(--warn); }

.boundary {
  display: flex; align-items: center; gap: 10px; margin: 14px 0; color: var(--text-faint);
}
.boundary-line { flex: 1; height: 1px; background: var(--border); }
.boundary-label {
  font-size: 10px; letter-spacing: 0.6px; text-transform: uppercase; color: var(--text-dim);
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

  // ---------- Tool metadata: icon + preview extractor per canonical SDK tool name ----------
  const TOOL_ICONS = {
    Bash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 17l6-6-6-6"/><path d="M12 19h8"/></svg>',
    BashOutput: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 10l3 2-3 2"/><path d="M13 14h4"/></svg>',
    KillShell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
    Read: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h7a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-7a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h8z"/></svg>',
    Write: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h4"/></svg>',
    Edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4z"/></svg>',
    Glob: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 17l9 4 9-4"/><path d="M3 12l9 4 9-4"/></svg>',
    Grep: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    NotebookEdit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v16h16V4z"/><path d="M4 9h16M9 4v16"/></svg>',
    TodoWrite: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    WebFetch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>',
    WebSearch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6M11 8v6"/></svg>',
    Task: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>',
    ExitPlanMode: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    AskUserQuestion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 1 1 5.8 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></svg>',
    default: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  };
  function iconFor(name, kind) {
    if (kind === 'mcp_tool_use' || (name && name.startsWith('mcp__'))) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
    }
    return TOOL_ICONS[name] || TOOL_ICONS.default;
  }
  function previewFor(name, input) {
    if (!input || typeof input !== 'object') return '';
    if (name === 'Bash' || name === 'BashOutput') return input.command || input.bash_id || '';
    if (name === 'Read') return input.file_path || input.path || '';
    if (name === 'Write') return input.file_path || '';
    if (name === 'Edit') return input.file_path || '';
    if (name === 'Glob') return input.pattern || '';
    if (name === 'Grep') return input.pattern || '';
    if (name === 'WebFetch' || name === 'WebSearch') return input.url || input.query || '';
    if (name === 'Task') return input.description || '';
    if (name === 'TodoWrite') return `${(input.todos || []).length} item(s)`;
    if (name === 'AskUserQuestion') return input.question?.header || '';
    if (name === 'NotebookEdit') return input.notebook_path || '';
    // Fallback: first string value in input
    for (const v of Object.values(input)) {
      if (typeof v === 'string' && v.length) return v;
    }
    return '';
  }
  function friendlyName(name, kind, serverName) {
    if (kind === 'mcp_tool_use' && name && name.startsWith('mcp__')) {
      const parts = name.split('__');
      if (parts.length >= 3) return `${parts[1]}·${parts.slice(2).join('·')}`;
    }
    if (serverName) return `${serverName}·${name}`;
    return name || 'tool';
  }

  function appendToolCard(call) {
    const wrap = ensureAssistantMessage();
    const pill = document.createElement('div');
    const isMcp = call.kind === 'mcp_tool_use' || (call.name && call.name.startsWith('mcp__'));
    pill.className = 'tool-pill' + (isMcp ? ' kind-mcp' : '');
    pill.dataset.toolId = call.id;

    const preview = previewFor(call.name, call.input);
    const head = document.createElement('div');
    head.className = 'tool-pill-head';
    head.innerHTML = `
      <span class="tool-pill-icon">${iconFor(call.name, call.kind)}</span>
      <span class="tool-pill-name">${escapeHtml(friendlyName(call.name, call.kind, call.serverName))}</span>
      ${preview ? `<span class="tool-pill-preview">${escapeHtml(preview)}</span>` : ''}
      <span class="tool-pill-status ${isMcp ? 'mcp' : 'running'}">${isMcp ? 'mcp' : 'running'}</span>
      <span class="tool-pill-chevron">▶</span>
    `;
    pill.appendChild(head);

    const body = document.createElement('div');
    body.className = 'tool-pill-body';
    const inputSection = document.createElement('div');
    inputSection.className = 'section';
    inputSection.innerHTML = `<div class="section-label">Input</div>`;
    const inputCode = document.createElement('div');
    let inputStr;
    try { inputStr = JSON.stringify(call.input, null, 2); }
    catch { inputStr = String(call.input); }
    inputCode.textContent = inputStr.slice(0, 6000);
    inputSection.appendChild(inputCode);
    body.appendChild(inputSection);

    pill.appendChild(body);
    // Collapsed by default — remove body from DOM until expanded
    body.style.display = 'none';
    head.addEventListener('click', () => {
      const expanded = pill.classList.toggle('expanded');
      body.style.display = expanded ? 'block' : 'none';
    });
    wrap.appendChild(pill);
    scrollToBottom();
  }

  function markToolResult(toolUseId, content, isError) {
    if (!currentAssistantEl) return;
    const pill = currentAssistantEl.querySelector(`.tool-pill[data-tool-id="${CSS.escape(toolUseId)}"]`);
    if (!pill) return;
    const status = pill.querySelector('.tool-pill-status');
    if (status && !status.classList.contains('mcp')) {
      status.classList.remove('running');
      status.classList.add(isError ? 'error' : 'success');
      status.textContent = isError ? 'error' : 'done';
    } else if (status && status.classList.contains('mcp')) {
      if (isError) {
        status.classList.remove('mcp');
        status.classList.add('error');
        status.textContent = 'error';
      }
    }
    const body = pill.querySelector('.tool-pill-body');
    if (body) {
      const sec = document.createElement('div');
      sec.className = 'section';
      const text = typeof content === 'string' ? content : (content == null ? '' : JSON.stringify(content));
      sec.innerHTML = `<div class="section-label">${isError ? 'Error' : 'Output'}</div>`;
      const out = document.createElement('div');
      out.className = isError ? 'result-err' : 'result-ok';
      out.textContent = text.slice(0, 8000) + (text.length > 8000 ? '\n… (truncated)' : '');
      sec.appendChild(out);
      body.appendChild(sec);
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
    const cost = result && (result.total_cost_usd || result.totalCostUsd);
    const dur = result && (result.duration_ms || result.durationMs);
    const apiDur = result && result.duration_api_ms;
    const turns = result && result.num_turns;
    const subtype = result && result.subtype ? result.subtype : 'done';
    const usage = result && result.usage;
    const parts = [];
    const subMap = {
      'success': { label: 'done', cls: 'ok' },
      'error_during_execution': { label: 'error', cls: 'err' },
      'error_max_turns': { label: 'max turns', cls: 'warn' },
      'error_max_budget_usd': { label: 'max budget', cls: 'warn' },
      'error_max_structured_output_retries': { label: 'max retries', cls: 'warn' },
      'aborted': { label: 'stopped', cls: 'warn' },
      'error': { label: 'error', cls: 'err' },
    };
    const s = subMap[subtype] || { label: subtype, cls: '' };
    parts.push(`<span class="footer-subtype footer-${s.cls}">${escapeHtml(s.label)}</span>`);
    if (turns) parts.push(`<span>${turns} turn${turns === 1 ? '' : 's'}</span>`);
    if (dur) parts.push(`<span>${(dur / 1000).toFixed(1)}s${apiDur ? ` (${(apiDur/1000).toFixed(1)}s api)` : ''}</span>`);
    if (usage && (usage.input_tokens || usage.output_tokens)) {
      const ci = usage.cache_read_input_tokens || 0;
      parts.push(`<span title="input/output${ci ? ' · cache read' : ''}">${usage.input_tokens || 0}↓ ${usage.output_tokens || 0}↑${ci ? ` · ${ci}⚡` : ''}</span>`);
    }
    if (cost && cost > 0) parts.push(`<span>$${cost.toFixed(4)}</span>`);
    if (result && result.permission_denials && result.permission_denials.length) {
      parts.push(`<span class="footer-err">${result.permission_denials.length} denied</span>`);
    }
    footer.innerHTML = parts.join('<span class="footer-sep">·</span>');
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
        // generic system — ignore
        break;
      case 'init':
      case 'system:init':
        // context: model / tools / mcp servers — could populate a header
        break;
      case 'compact_boundary':
        appendBoundary('Context compacted' + (evt.trigger ? ` (${evt.trigger})` : ''));
        break;
      case 'status':
        bus.emit('agent:status', evt.status || 'ready');
        break;
      case 'hook':
        // hook ran; could show a small chip
        break;
      case 'auth_status':
        if (evt.error) appendError('Auth: ' + evt.error);
        break;
      case 'tool_progress':
        updateToolProgress(evt.toolUseId, evt.elapsedSeconds);
        break;
      case 'text':
        appendAssistantText(evt.text || '');
        break;
      case 'text_delta':
        // Streaming text tokens — dedupe with final 'text' by only appending if no full 'text' has landed.
        // For simplicity we let marked re-render on each final 'text' and ignore deltas here.
        break;
      case 'block_start':
      case 'block_stop':
      case 'message_stop':
      case 'input_delta':
      case 'thinking_delta':
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

  function appendBoundary(label) {
    const wrap = ensureAssistantMessage();
    const el = document.createElement('div');
    el.className = 'boundary';
    el.innerHTML = `<span class="boundary-line"></span><span class="boundary-label">${escapeHtml(label)}</span><span class="boundary-line"></span>`;
    wrap.appendChild(el);
  }

  function updateToolProgress(toolUseId, elapsed) {
    if (!currentAssistantEl || !toolUseId) return;
    const pill = currentAssistantEl.querySelector(`.tool-pill[data-tool-id="${CSS.escape(toolUseId)}"]`);
    if (!pill) return;
    let chip = pill.querySelector('.tool-pill-elapsed');
    if (!chip) {
      chip = document.createElement('span');
      chip.className = 'tool-pill-elapsed';
      chip.style.cssText = 'color:var(--text-dim);font-size:10px;margin:0 4px;';
      const status = pill.querySelector('.tool-pill-status');
      if (status) status.parentNode.insertBefore(chip, status);
    }
    chip.textContent = elapsed ? `${elapsed.toFixed(1)}s` : '';
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
