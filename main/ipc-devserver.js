// PiPilot IDE — Dev server / preview process IPC handlers (Phase 5)

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

module.exports = function register(ipcMain, ctx) {
  const servers = new Map();
  const MAX_LOG_LINES = 5000;

  function ok(data) { return { ok: true, ...(data || {}) }; }
  function fail(err) { return { ok: false, error: err && err.message ? err.message : String(err) }; }

  function newId() {
    return 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  }

  async function detectCommand(projectPath) {
    const pkgPath = path.join(projectPath, 'package.json');
    try {
      const raw = await fsp.readFile(pkgPath, 'utf8');
      const pkg = JSON.parse(raw);
      const scripts = pkg.scripts || {};
      if (scripts.dev) return 'npm run dev';
      if (scripts.start) return 'npm start';
      if (scripts.serve) return 'npm run serve';
    } catch {}
    return null;
  }

  function emitLog(id, line) {
    const srv = servers.get(id);
    if (!srv) return;
    srv.logs.push(line);
    if (srv.logs.length > MAX_LOG_LINES) srv.logs.splice(0, srv.logs.length - MAX_LOG_LINES);
    try {
      const win = ctx.getWindow && ctx.getWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send(`devserver:log:${id}`, line);
      }
    } catch {}
  }

  function detectUrl(line) {
    const m = line.match(/(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::(\d+))?[^\s]*)/i);
    if (m) return { url: m[1], port: m[2] ? parseInt(m[2], 10) : null };
    const m2 = line.match(/Local:\s+(https?:\/\/[^\s]+)/i);
    if (m2) {
      const portMatch = m2[1].match(/:(\d+)/);
      return { url: m2[1], port: portMatch ? parseInt(portMatch[1], 10) : null };
    }
    return null;
  }

  function toLines(buffer, chunk) {
    const text = (buffer.tail || '') + chunk.toString('utf8');
    const parts = text.split(/\r?\n/);
    buffer.tail = parts.pop();
    return parts;
  }

  function summarize(srv) {
    return {
      id: srv.id,
      projectPath: srv.projectPath,
      cmd: srv.cmd,
      status: srv.status,
      port: srv.port,
      url: srv.url,
      pid: srv.child && srv.child.pid,
      startedAt: srv.startedAt,
      exitCode: srv.exitCode,
    };
  }

  ipcMain.handle('devserver:start', async (_e, payload) => {
    try {
      const { projectPath } = payload || {};
      let { cmd } = payload || {};
      if (!projectPath) throw new Error('projectPath required');
      if (!cmd) cmd = await detectCommand(projectPath);
      if (!cmd) throw new Error('No dev/start/serve script found in package.json. Pass cmd explicitly.');

      const id = newId();
      const child = spawn(cmd, {
        cwd: projectPath,
        shell: true,
        env: { ...process.env, FORCE_COLOR: '1', NODE_ENV: process.env.NODE_ENV || 'development' },
      });

      const srv = {
        id,
        projectPath,
        cmd,
        child,
        status: 'running',
        port: null,
        url: null,
        logs: [],
        startedAt: Date.now(),
        exitCode: null,
        _stdoutBuf: { tail: '' },
        _stderrBuf: { tail: '' },
      };
      servers.set(id, srv);

      const onChunk = (chunk, buf) => {
        const lines = toLines(buf, chunk);
        for (const line of lines) {
          emitLog(id, line);
          if (!srv.url) {
            const detected = detectUrl(line);
            if (detected) {
              srv.url = detected.url;
              if (detected.port) srv.port = detected.port;
              emitLog(id, `[pipilot] detected-url ${detected.url}`);
            }
          }
        }
      };

      child.stdout.on('data', (c) => onChunk(c, srv._stdoutBuf));
      child.stderr.on('data', (c) => onChunk(c, srv._stderrBuf));

      child.on('exit', (code) => {
        srv.status = 'stopped';
        srv.exitCode = code;
        emitLog(id, `[pipilot] process exited with code ${code}`);
        try {
          const win = ctx.getWindow && ctx.getWindow();
          if (win && !win.isDestroyed()) {
            win.webContents.send('devserver:status-changed', summarize(srv));
          }
        } catch {}
      });
      child.on('error', (err) => {
        emitLog(id, `[pipilot] error: ${err.message}`);
        srv.status = 'error';
      });

      return ok(summarize(srv));
    } catch (err) { return fail(err); }
  });

  ipcMain.handle('devserver:stop', async (_e, id) => {
    try {
      const srv = servers.get(id);
      if (!srv) throw new Error('Server not found: ' + id);
      if (srv.child && srv.status === 'running') {
        try {
          if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', String(srv.child.pid), '/T', '/F']);
          } else {
            srv.child.kill('SIGTERM');
            setTimeout(() => {
              if (srv.status === 'running') {
                try { srv.child.kill('SIGKILL'); } catch {}
              }
            }, 2000);
          }
        } catch (err) {
          emitLog(id, `[pipilot] kill error: ${err.message}`);
        }
      }
      srv.status = 'stopped';
      return ok(summarize(srv));
    } catch (err) { return fail(err); }
  });

  ipcMain.handle('devserver:status', async (_e, id) => {
    try {
      const srv = servers.get(id);
      if (!srv) return ok({ server: null });
      return ok({ server: summarize(srv) });
    } catch (err) { return fail(err); }
  });

  ipcMain.handle('devserver:list', async () => {
    try {
      const list = Array.from(servers.values()).map(summarize);
      return ok({ servers: list });
    } catch (err) { return fail(err); }
  });
};
