// PiPilot IDE — Claude Agent SDK IPC (Phase 4)

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');

module.exports = function register(ipcMain, ctx) {
  const sessions = new Map(); // streamId -> { abortCtrl, projectPath, sessionId, pendingInputs: [] }
  const sessionStorage = new Map(); // sessionId -> { id, title, messages, createdAt, lastMessageAt, projectPath }

  const sessionsDir = path.join(ctx.userDataPath, 'sessions');
  try { fs.mkdirSync(sessionsDir, { recursive: true }); } catch {}

  let sdkModule = null;
  let sdkLoadError = null;
  function loadSdk() {
    if (sdkModule) return sdkModule;
    if (sdkLoadError) throw sdkLoadError;
    try {
      sdkModule = require('@anthropic-ai/claude-agent-sdk');
      return sdkModule;
    } catch (err) {
      sdkLoadError = err;
      throw err;
    }
  }

  function sessionFile(sessionId) {
    const safe = String(sessionId).replace(/[^a-zA-Z0-9._-]/g, '_');
    return path.join(sessionsDir, safe + '.json');
  }

  function loadSessionFromDisk(sessionId) {
    if (sessionStorage.has(sessionId)) return sessionStorage.get(sessionId);
    try {
      const raw = fs.readFileSync(sessionFile(sessionId), 'utf8');
      const parsed = JSON.parse(raw);
      sessionStorage.set(sessionId, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  function saveSessionToDisk(session) {
    if (!session || !session.id) return;
    try {
      fs.mkdirSync(sessionsDir, { recursive: true });
      fs.writeFileSync(sessionFile(session.id), JSON.stringify(session, null, 2), 'utf8');
    } catch (err) {
      console.error('session save failed:', err);
    }
  }

  function listSessionsForProject(projectPath) {
    let files = [];
    try { files = fs.readdirSync(sessionsDir); } catch { return []; }
    const out = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const raw = fs.readFileSync(path.join(sessionsDir, f), 'utf8');
        const s = JSON.parse(raw);
        if (projectPath && s.projectPath && s.projectPath !== projectPath) continue;
        out.push({
          id: s.id,
          title: s.title || 'Untitled',
          lastMessageAt: s.lastMessageAt || s.createdAt || 0,
          messageCount: Array.isArray(s.messages) ? s.messages.length : 0,
          projectPath: s.projectPath || null,
        });
      } catch {}
    }
    out.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
    return out;
  }

  function send(event, channel, payload) {
    try {
      const win = ctx.getWindow?.();
      if (win && !win.isDestroyed()) {
        win.webContents.send(channel, payload);
      } else if (event && event.sender && !event.sender.isDestroyed()) {
        event.sender.send(channel, payload);
      }
    } catch (err) {
      console.error('send failed:', err);
    }
  }

  function newSessionId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  ipcMain.handle('agent:send', async (event, { streamId, sessionId, projectPath, message, mode, attachments }) => {
    const ch = `agent:event:${streamId}`;

    let sdk;
    try {
      sdk = loadSdk();
    } catch (err) {
      send(event, ch, { type: 'error', message: `Failed to load Claude Agent SDK: ${err.message}. Is @anthropic-ai/claude-agent-sdk installed?` });
      send(event, ch, { type: 'result', subtype: 'error', totalCostUsd: 0, durationMs: 0, usage: null });
      return { ok: false, error: err.message };
    }

    let session = sessionId ? loadSessionFromDisk(sessionId) : null;
    if (!session) {
      session = {
        id: sessionId || newSessionId(),
        title: (message || 'New Chat').slice(0, 60),
        messages: [],
        createdAt: Date.now(),
        lastMessageAt: Date.now(),
        projectPath: projectPath || null,
      };
      sessionStorage.set(session.id, session);
    }
    if (projectPath && !session.projectPath) session.projectPath = projectPath;

    const abortCtrl = new AbortController();
    sessions.set(streamId, { abortCtrl, projectPath, sessionId: session.id, pendingInputs: [] });

    let promptText = String(message || '');
    if (Array.isArray(attachments) && attachments.length) {
      const lines = attachments.map(a => `@${typeof a === 'string' ? a : a.path}`).join('\n');
      promptText = `${promptText}\n\nAttached files:\n${lines}`.trim();
    }

    const userEntry = {
      role: 'user',
      blocks: [{ type: 'text', text: promptText }],
      attachments: attachments || [],
      at: Date.now(),
    };
    session.messages.push(userEntry);

    const assistantEntry = {
      role: 'assistant',
      blocks: [],
      at: Date.now(),
    };
    session.messages.push(assistantEntry);

    const model = process.env.ANTHROPIC_DEFAULT_SONNET_MODEL || 'claude-sonnet-4-6';
    const permissionMode = mode === 'plan' ? 'plan' : 'acceptEdits';

    let resultSummary = null;
    let lastError = null;

    try {
      const result = sdk.query({
        prompt: promptText,
        options: {
          cwd: projectPath || process.cwd(),
          model,
          permissionMode,
          systemPrompt: { type: 'preset', preset: 'claude_code' },
          settingSources: ['project'],
          abortController: abortCtrl,
        },
      });

      for await (const msg of result) {
        if (!msg || typeof msg !== 'object') continue;

        if (msg.type === 'system') {
          if (msg.subtype === 'init') {
            send(event, ch, {
              type: 'system',
              subtype: 'init',
              model: msg.model,
              cwd: msg.cwd,
              tools: msg.tools || [],
              mcp_servers: msg.mcp_servers || [],
              permission_mode: msg.permissionMode,
              slash_commands: msg.slash_commands || [],
              session_id: msg.session_id,
            });
          } else if (msg.subtype === 'compact_boundary') {
            send(event, ch, { type: 'compact_boundary', trigger: msg.compact_metadata?.trigger, preTokens: msg.compact_metadata?.pre_tokens });
          } else if (msg.subtype === 'status') {
            send(event, ch, { type: 'status', status: msg.status });
          } else if (msg.subtype === 'hook_response') {
            send(event, ch, { type: 'hook', hook: msg.hook_name, event: msg.hook_event, exitCode: msg.exit_code });
          } else {
            send(event, ch, { type: 'system', subtype: msg.subtype || null });
          }
          continue;
        }

        if (msg.type === 'assistant') {
          const content = msg.message?.content || [];
          for (const block of content) {
            if (!block || typeof block !== 'object') continue;
            if (block.type === 'text' && typeof block.text === 'string') {
              assistantEntry.blocks.push({ type: 'text', text: block.text });
              send(event, ch, { type: 'text', text: block.text });
            } else if (block.type === 'thinking' && typeof block.thinking === 'string') {
              assistantEntry.blocks.push({ type: 'thinking', text: block.thinking });
              send(event, ch, { type: 'thinking', text: block.thinking });
            } else if (block.type === 'redacted_thinking') {
              send(event, ch, { type: 'thinking', text: '[redacted]', redacted: true });
            } else if (block.type === 'tool_use' || block.type === 'mcp_tool_use' || block.type === 'server_tool_use') {
              const call = {
                type: 'tool_call',
                id: block.id,
                name: block.name,
                input: block.input,
                kind: block.type,
                serverName: block.server_name || null,
                parentToolUseId: msg.parent_tool_use_id || null,
              };
              assistantEntry.blocks.push(call);
              send(event, ch, call);
            }
          }
          continue;
        }

        if (msg.type === 'user') {
          const content = Array.isArray(msg.message?.content) ? msg.message.content : [];
          for (const block of content) {
            if (!block || typeof block !== 'object') continue;
            if (block.type === 'tool_result' || block.type === 'mcp_tool_result' || block.type === 'web_search_tool_result' || block.type === 'code_execution_tool_result' || block.type === 'bash_code_execution_tool_result' || block.type === 'text_editor_code_execution_tool_result') {
              let preview = block.content;
              if (Array.isArray(preview)) {
                preview = preview.map(p => (p && p.type === 'text') ? p.text : JSON.stringify(p)).join('\n');
              } else if (preview && typeof preview === 'object') {
                preview = JSON.stringify(preview);
              }
              const resultBlock = {
                type: 'tool_result',
                toolUseId: block.tool_use_id,
                content: typeof preview === 'string' ? preview : String(preview ?? ''),
                isError: !!block.is_error,
                kind: block.type,
              };
              assistantEntry.blocks.push(resultBlock);
              send(event, ch, resultBlock);
            }
          }
          continue;
        }

        if (msg.type === 'stream_event') {
          const evt = msg.event;
          if (!evt) continue;
          if (evt.type === 'content_block_delta' && evt.delta) {
            if (evt.delta.type === 'text_delta') {
              send(event, ch, { type: 'text_delta', text: evt.delta.text || '', index: evt.index });
            } else if (evt.delta.type === 'thinking_delta') {
              send(event, ch, { type: 'thinking_delta', text: evt.delta.thinking || '', index: evt.index });
            } else if (evt.delta.type === 'input_json_delta') {
              send(event, ch, { type: 'input_delta', partial: evt.delta.partial_json || '', index: evt.index });
            }
          } else if (evt.type === 'content_block_start') {
            send(event, ch, { type: 'block_start', block: evt.content_block, index: evt.index });
          } else if (evt.type === 'content_block_stop') {
            send(event, ch, { type: 'block_stop', index: evt.index });
          } else if (evt.type === 'message_stop') {
            send(event, ch, { type: 'message_stop' });
          }
          continue;
        }

        if (msg.type === 'tool_progress') {
          send(event, ch, { type: 'tool_progress', toolUseId: msg.tool_use_id, toolName: msg.tool_name, elapsedSeconds: msg.elapsed_time_seconds });
          continue;
        }

        if (msg.type === 'auth_status') {
          send(event, ch, { type: 'auth_status', isAuthenticating: msg.isAuthenticating, output: msg.output, error: msg.error });
          continue;
        }

        if (msg.type === 'result') {
          resultSummary = {
            subtype: msg.subtype || 'success',
            total_cost_usd: msg.total_cost_usd || 0,
            totalCostUsd: msg.total_cost_usd || 0,
            duration_ms: msg.duration_ms || 0,
            durationMs: msg.duration_ms || 0,
            duration_api_ms: msg.duration_api_ms || 0,
            num_turns: msg.num_turns || 0,
            is_error: !!msg.is_error,
            usage: msg.usage || null,
            modelUsage: msg.modelUsage || null,
            permission_denials: msg.permission_denials || [],
            result: msg.result || null,
            errors: msg.errors || null,
          };
          send(event, ch, { type: 'result', ...resultSummary });
          continue;
        }
      }
    } catch (err) {
      lastError = err;
      const aborted = abortCtrl.signal.aborted;
      send(event, ch, {
        type: 'error',
        message: aborted ? 'Stopped by user.' : (err && err.message) || String(err),
      });
      if (!resultSummary) {
        send(event, ch, {
          type: 'result',
          subtype: aborted ? 'aborted' : 'error',
          totalCostUsd: 0,
          durationMs: 0,
          usage: null,
        });
      }
    } finally {
      session.lastMessageAt = Date.now();
      if (!session.title || session.title === 'New Chat' || session.title === 'Untitled') {
        const first = (message || '').trim().split('\n')[0];
        if (first) session.title = first.slice(0, 60);
      }
      saveSessionToDisk(session);
      sessions.delete(streamId);
    }

    return { ok: !lastError, sessionId: session.id, result: resultSummary };
  });

  ipcMain.handle('agent:stop', async (_e, streamId) => {
    const s = sessions.get(streamId);
    if (s?.abortCtrl) {
      try { s.abortCtrl.abort(); } catch {}
    }
    return { ok: true };
  });

  ipcMain.handle('agent:answer', async (_e, { streamId, text }) => {
    const s = sessions.get(streamId);
    if (!s) return { ok: false, error: 'no active session' };
    s.pendingInputs.push(text);
    return { ok: true };
  });

  ipcMain.handle('agent:list-sessions', async (_e, projectPath) => {
    return listSessionsForProject(projectPath);
  });

  ipcMain.handle('agent:load-session', async (_e, { projectPath, sessionId }) => {
    const s = loadSessionFromDisk(sessionId);
    if (!s) return null;
    if (projectPath && s.projectPath && s.projectPath !== projectPath) return null;
    return {
      id: s.id,
      title: s.title,
      messages: s.messages || [],
      createdAt: s.createdAt,
      lastMessageAt: s.lastMessageAt,
      projectPath: s.projectPath,
    };
  });

  ipcMain.handle('agent:delete-session', async (_e, { projectPath, sessionId }) => {
    try {
      const s = loadSessionFromDisk(sessionId);
      if (s && projectPath && s.projectPath && s.projectPath !== projectPath) {
        return { ok: false, error: 'project mismatch' };
      }
      sessionStorage.delete(sessionId);
      await fsp.unlink(sessionFile(sessionId));
    } catch {}
    return { ok: true };
  });

  ipcMain.handle('agent:new-session', async (_e, { projectPath, title }) => {
    const id = newSessionId();
    const session = {
      id,
      title: title || `Chat ${new Date().toLocaleString()}`,
      messages: [],
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
      projectPath: projectPath || null,
    };
    sessionStorage.set(id, session);
    saveSessionToDisk(session);
    return { id: session.id, title: session.title };
  });
};
