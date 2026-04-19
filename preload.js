// PiPilot IDE — Preload script
// Exposes a safe IPC bridge to the renderer via window.electronAPI.

const { contextBridge, ipcRenderer } = require('electron');

// Track active streams so renderer can clean them up
const streamListeners = new Map();

contextBridge.exposeInMainWorld('electronAPI', {
  // ---------- App ----------
  pickFolder: () => ipcRenderer.invoke('app:pick-folder'),
  pickFile: (opts) => ipcRenderer.invoke('app:pick-file', opts),
  getPlatform: () => ipcRenderer.invoke('app:get-platform'),
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  getHome: () => ipcRenderer.invoke('app:get-home'),
  recentProjects: {
    get: () => ipcRenderer.invoke('app:recent-projects:get'),
    add: (p) => ipcRenderer.invoke('app:recent-projects:add', p),
    remove: (p) => ipcRenderer.invoke('app:recent-projects:remove', p),
  },

  onMenu: (event, handler) => {
    const ch = `menu:${event}`;
    const fn = (_e, ...args) => handler(...args);
    ipcRenderer.on(ch, fn);
    return () => ipcRenderer.removeListener(ch, fn);
  },

  // ---------- Files ----------
  files: {
    tree: (projectPath) => ipcRenderer.invoke('files:tree', projectPath),
    read: (filePath) => ipcRenderer.invoke('files:read', filePath),
    write: (filePath, content) => ipcRenderer.invoke('files:write', { filePath, content }),
    mkdir: (dirPath) => ipcRenderer.invoke('files:mkdir', dirPath),
    delete: (targetPath) => ipcRenderer.invoke('files:delete', targetPath),
    rename: (from, to) => ipcRenderer.invoke('files:rename', { from, to }),
    stat: (p) => ipcRenderer.invoke('files:stat', p),
    list: (dirPath) => ipcRenderer.invoke('files:list', dirPath),
    search: (projectPath, query, opts) => ipcRenderer.invoke('files:search', { projectPath, query, opts }),
    watch: (projectPath, onEvent) => {
      const streamId = `watch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const ch = `files:watch:${streamId}`;
      const fn = (_e, evt) => onEvent(evt);
      ipcRenderer.on(ch, fn);
      streamListeners.set(streamId, { ch, fn });
      ipcRenderer.invoke('files:watch:start', { streamId, projectPath });
      return () => {
        ipcRenderer.invoke('files:watch:stop', streamId);
        ipcRenderer.removeListener(ch, fn);
        streamListeners.delete(streamId);
      };
    },
  },

  fs: {
    home: () => ipcRenderer.invoke('fs:home'),
    list: (dirPath) => ipcRenderer.invoke('fs:list', dirPath),
  },

  // ---------- Terminal ----------
  terminal: {
    profiles: () => ipcRenderer.invoke('terminal:profiles'),
    create: (opts) => ipcRenderer.invoke('terminal:create', opts),
    write: (id, data) => ipcRenderer.invoke('terminal:write', { id, data }),
    resize: (id, cols, rows) => ipcRenderer.invoke('terminal:resize', { id, cols, rows }),
    destroy: (id) => ipcRenderer.invoke('terminal:destroy', id),
    onData: (id, handler) => {
      const ch = `terminal:data:${id}`;
      const fn = (_e, data) => handler(data);
      ipcRenderer.on(ch, fn);
      return () => ipcRenderer.removeListener(ch, fn);
    },
    onExit: (id, handler) => {
      const ch = `terminal:exit:${id}`;
      const fn = (_e, code) => handler(code);
      ipcRenderer.on(ch, fn);
      return () => ipcRenderer.removeListener(ch, fn);
    },
  },

  // ---------- Agent (AI) ----------
  agent: {
    send: (payload, onEvent) => {
      const streamId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const ch = `agent:event:${streamId}`;
      const fn = (_e, evt) => onEvent(evt);
      ipcRenderer.on(ch, fn);
      streamListeners.set(streamId, { ch, fn });
      ipcRenderer.invoke('agent:send', { streamId, ...payload });
      return {
        stop: () => ipcRenderer.invoke('agent:stop', streamId),
        answer: (text) => ipcRenderer.invoke('agent:answer', { streamId, text }),
        dispose: () => {
          ipcRenderer.removeListener(ch, fn);
          streamListeners.delete(streamId);
        },
      };
    },
    stop: (streamId) => ipcRenderer.invoke('agent:stop', streamId),
    listSessions: (projectPath) => ipcRenderer.invoke('agent:list-sessions', projectPath),
    loadSession: (projectPath, sessionId) => ipcRenderer.invoke('agent:load-session', { projectPath, sessionId }),
    deleteSession: (projectPath, sessionId) => ipcRenderer.invoke('agent:delete-session', { projectPath, sessionId }),
    newSession: (projectPath, title) => ipcRenderer.invoke('agent:new-session', { projectPath, title }),
  },

  // ---------- Git ----------
  git: {
    status: (p) => ipcRenderer.invoke('git:status', p),
    log: (p, opts) => ipcRenderer.invoke('git:log', { projectPath: p, opts }),
    diff: (p, file) => ipcRenderer.invoke('git:diff', { projectPath: p, file }),
    add: (p, files) => ipcRenderer.invoke('git:add', { projectPath: p, files }),
    commit: (p, msg) => ipcRenderer.invoke('git:commit', { projectPath: p, msg }),
    push: (p, opts) => ipcRenderer.invoke('git:push', { projectPath: p, opts }),
    pull: (p, opts) => ipcRenderer.invoke('git:pull', { projectPath: p, opts }),
    branches: (p) => ipcRenderer.invoke('git:branches', p),
    checkout: (p, branch) => ipcRenderer.invoke('git:checkout', { projectPath: p, branch }),
    createBranch: (p, name) => ipcRenderer.invoke('git:create-branch', { projectPath: p, name }),
    clone: (url, dir, onProgress) => {
      const streamId = `clone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const ch = `git:clone:progress:${streamId}`;
      const fn = (_e, progress) => onProgress?.(progress);
      ipcRenderer.on(ch, fn);
      const done = ipcRenderer.invoke('git:clone', { streamId, url, dir });
      done.finally(() => ipcRenderer.removeListener(ch, fn));
      return done;
    },
    stash: (p, opts) => ipcRenderer.invoke('git:stash', { projectPath: p, opts }),
    discard: (p, file) => ipcRenderer.invoke('git:discard', { projectPath: p, file }),
    init: (p) => ipcRenderer.invoke('git:init', p),
    show: (p, hash) => ipcRenderer.invoke('git:show', { projectPath: p, hash }),
    fileVersions: (p, file, staged) => ipcRenderer.invoke('git:file-versions', { projectPath: p, file, staged }),
  },

  // ---------- Cloud connectors ----------
  cloud: {
    listConnectors: () => ipcRenderer.invoke('cloud:list'),
    saveToken: (provider, token, meta) => ipcRenderer.invoke('cloud:save-token', { provider, token, meta }),
    getToken: (provider) => ipcRenderer.invoke('cloud:get-token', provider),
    deleteToken: (provider) => ipcRenderer.invoke('cloud:delete-token', provider),
    testConnection: (provider) => ipcRenderer.invoke('cloud:test', provider),
  },

  mcp: {
    listServers: () => ipcRenderer.invoke('mcp:list'),
    addServer: (server) => ipcRenderer.invoke('mcp:add', server),
    removeServer: (id) => ipcRenderer.invoke('mcp:remove', id),
    toggleServer: (id, enabled) => ipcRenderer.invoke('mcp:toggle', { id, enabled }),
  },

  // ---------- Checkpoints ----------
  checkpoints: {
    list: (p) => ipcRenderer.invoke('checkpoints:list', p),
    create: (p, label) => ipcRenderer.invoke('checkpoints:create', { projectPath: p, label }),
    restore: (p, id) => ipcRenderer.invoke('checkpoints:restore', { projectPath: p, id }),
    delete: (p, id) => ipcRenderer.invoke('checkpoints:delete', { projectPath: p, id }),
  },

  // ---------- Dev server / preview ----------
  devServer: {
    start: (p, cmd) => ipcRenderer.invoke('devserver:start', { projectPath: p, cmd }),
    stop: (id) => ipcRenderer.invoke('devserver:stop', id),
    status: (id) => ipcRenderer.invoke('devserver:status', id),
    list: () => ipcRenderer.invoke('devserver:list'),
    onLog: (id, handler) => {
      const ch = `devserver:log:${id}`;
      const fn = (_e, line) => handler(line);
      ipcRenderer.on(ch, fn);
      return () => ipcRenderer.removeListener(ch, fn);
    },
  },

  // ---------- Codestral (FIM completions + inline chat) ----------
  codestral: {
    status: () => ipcRenderer.invoke('codestral:status'),
    fim: (payload) => ipcRenderer.invoke('codestral:fim', payload),
    cancel: (requestId) => ipcRenderer.invoke('codestral:cancel', requestId),
    chat: (payload) => ipcRenderer.invoke('codestral:chat', payload),
    commitMessage: (payload) => ipcRenderer.invoke('codestral:commit-message', payload),
    chatStream: (payload, onEvent) => {
      const streamId = `codestral-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const ch = `codestral:chat:${streamId}`;
      const fn = (_e, evt) => onEvent(evt);
      ipcRenderer.on(ch, fn);
      const done = ipcRenderer.invoke('codestral:chat-stream', { streamId, ...payload });
      return {
        streamId,
        done,
        stop: () => ipcRenderer.invoke('codestral:cancel', streamId),
        dispose: () => ipcRenderer.removeListener(ch, fn),
      };
    },
  },

  // ---------- Settings ----------
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', { key, value }),
    all: () => ipcRenderer.invoke('settings:all'),
  },

  // ---------- Shell ----------
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
    showItemInFolder: (p) => ipcRenderer.invoke('shell:show-in-folder', p),
  },
});
