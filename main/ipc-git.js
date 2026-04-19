// PiPilot IDE — Git IPC handlers (Phase 5)

const path = require('path');

let simpleGit = null;
try {
  simpleGit = require('simple-git');
} catch (e) {
  console.warn('[ipc-git] simple-git not available:', e.message);
}

module.exports = function register(ipcMain, ctx) {
  function ensureGit() {
    if (!simpleGit) throw new Error('simple-git is not installed. Run `npm install` to enable Git features.');
  }

  function g(p) {
    ensureGit();
    if (!p) throw new Error('projectPath required');
    return simpleGit({ baseDir: p, binary: 'git', maxConcurrentProcesses: 3 });
  }

  function ok(data) { return { ok: true, ...(data || {}) }; }
  function fail(err) {
    const msg = err && err.message ? err.message : String(err);
    return { ok: false, error: msg };
  }

  function notifyChanged() {
    try {
      const win = ctx.getWindow && ctx.getWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('git:changed', { at: Date.now() });
      }
    } catch {}
  }

  function normalizeStatus(s) {
    return {
      branch: s.current || null,
      tracking: s.tracking || null,
      ahead: s.ahead || 0,
      behind: s.behind || 0,
      detached: !!s.detached,
      files: (s.files || []).map(f => ({
        path: f.path,
        index: f.index,
        working_dir: f.working_dir,
        status: (f.index && f.index !== ' ' ? f.index : '') + (f.working_dir && f.working_dir !== ' ' ? f.working_dir : ''),
      })),
      staged: s.staged || [],
      modified: s.modified || [],
      not_added: s.not_added || [],
      conflicted: s.conflicted || [],
      deleted: s.deleted || [],
      renamed: (s.renamed || []).map(r => typeof r === 'string' ? r : (r.to || r.from || '')),
      created: s.created || [],
    };
  }

  ipcMain.handle('git:status', async (_e, projectPath) => {
    try {
      const s = await g(projectPath).status();
      return ok({ status: normalizeStatus(s), ...normalizeStatus(s) });
    } catch (err) { return fail(err); }
  });

  ipcMain.handle('git:log', async (_e, payload) => {
    try {
      const { projectPath, opts } = payload || {};
      const limit = (opts && opts.limit) || 50;
      const file = opts && opts.file;
      const args = { maxCount: limit };
      if (file) args.file = file;
      const log = await g(projectPath).log(args);
      const commits = (log.all || []).map(c => ({
        hash: c.hash,
        abbreviatedHash: (c.hash || '').slice(0, 7),
        author: c.author_name,
        email: c.author_email,
        date: c.date,
        message: c.message,
        body: c.body,
        refs: c.refs,
      }));
      return ok({ commits, total: log.total });
    } catch (err) { return fail(err); }
  });

  ipcMain.handle('git:diff', async (_e, payload) => {
    try {
      const { projectPath, file, staged } = payload || {};
      const args = [];
      if (staged) args.push('--staged');
      if (file) args.push('--', file);
      const diff = await g(projectPath).diff(args);
      return ok({ diff: diff || '' });
    } catch (err) { return fail(err); }
  });

  ipcMain.handle('git:add', async (_e, payload) => {
    try {
      const { projectPath, files } = payload || {};
      const target = Array.isArray(files) ? files : (files ? [files] : ['.']);
      await g(projectPath).add(target);
      notifyChanged();
      return ok();
    } catch (err) { return fail(err); }
  });

  ipcMain.handle('git:commit', async (_e, payload) => {
    try {
      const { projectPath, msg } = payload || {};
      if (!msg || !msg.trim()) throw new Error('Commit message is required');
      const result = await g(projectPath).commit(msg);
      notifyChanged();
      return ok({ hash: result.commit, summary: result.summary, branch: result.branch });
    } catch (err) { return fail(err); }
  });

  ipcMain.handle('git:push', async (_e, payload) => {
    try {
      const { projectPath, opts } = payload || {};
      const repo = g(projectPath);
      const status = await repo.status();
      const branch = (opts && opts.branch) || status.current;
      const remote = (opts && opts.remote) || 'origin';
      if (!branch) throw new Error('No current branch to push');
      let result;
      if (!status.tracking) {
        result = await repo.push(['-u', remote, branch]);
      } else {
        result = await repo.push(remote, branch);
      }
      notifyChanged();
      return ok({ pushed: true, result });
    } catch (err) { return fail(err); }
  });

  ipcMain.handle('git:pull', async (_e, payload) => {
    try {
      const { projectPath, opts } = payload || {};
      const repo = g(projectPath);
      const remote = (opts && opts.remote) || 'origin';
      const status = await repo.status();
      const branch = (opts && opts.branch) || status.current;
      const result = branch ? await repo.pull(remote, branch) : await repo.pull();
      notifyChanged();
      return ok({ result });
    } catch (err) { return fail(err); }
  });

  ipcMain.handle('git:branches', async (_e, projectPath) => {
    try {
      const repo = g(projectPath);
      const local = await repo.branchLocal();
      let remote = { all: [] };
      try { remote = await repo.branch(['-r']); } catch {}
      return ok({
        current: local.current,
        all: local.all,
        local: local.all,
        remote: remote.all || [],
        branches: local.branches,
      });
    } catch (err) { return fail(err); }
  });

  ipcMain.handle('git:checkout', async (_e, payload) => {
    try {
      const { projectPath, branch } = payload || {};
      if (!branch) throw new Error('Branch name required');
      await g(projectPath).checkout(branch);
      notifyChanged();
      return ok();
    } catch (err) { return fail(err); }
  });

  ipcMain.handle('git:create-branch', async (_e, payload) => {
    try {
      const { projectPath, name } = payload || {};
      if (!name) throw new Error('Branch name required');
      await g(projectPath).checkoutLocalBranch(name);
      notifyChanged();
      return ok({ branch: name });
    } catch (err) { return fail(err); }
  });

  ipcMain.handle('git:clone', async (_e, payload) => {
    try {
      const { streamId, url, dir } = payload || {};
      if (!url) throw new Error('Repo URL required');
      if (!dir) throw new Error('Target directory required');
      if (!simpleGit) throw new Error('simple-git not available');

      const win = ctx.getWindow && ctx.getWindow();
      const sendProgress = (progress) => {
        if (win && !win.isDestroyed() && streamId) {
          win.webContents.send(`git:clone:progress:${streamId}`, progress);
        }
      };

      const progressHandler = ({ method, stage, progress }) => {
        sendProgress({
          phase: stage || method || 'clone',
          percent: typeof progress === 'number' ? progress : null,
          message: `${method || 'clone'}:${stage || ''} ${progress != null ? progress + '%' : ''}`.trim(),
        });
      };

      const git = simpleGit({ progress: progressHandler });
      git.outputHandler((_cmd, _stdout, stderr) => {
        stderr.on('data', (chunk) => {
          const text = chunk.toString('utf8');
          const lines = text.split(/\r?\n/);
          for (const line of lines) {
            if (!line.trim()) continue;
            const m = line.match(/(\d+)%/);
            sendProgress({
              phase: 'clone',
              percent: m ? parseInt(m[1], 10) : null,
              message: line.trim(),
            });
          }
        });
      });

      await git.clone(url, dir, ['--progress']);
      sendProgress({ phase: 'done', percent: 100, message: 'Clone complete' });
      return ok({ dir });
    } catch (err) { return fail(err); }
  });

  ipcMain.handle('git:stash', async (_e, payload) => {
    try {
      const { projectPath, opts } = payload || {};
      const repo = g(projectPath);
      const action = (opts && opts.action) || 'push';
      let result;
      switch (action) {
        case 'push': {
          const args = ['push'];
          if (opts && opts.message) args.push('-m', opts.message);
          result = await repo.stash(args);
          break;
        }
        case 'pop': result = await repo.stash(['pop']); break;
        case 'apply': result = await repo.stash(['apply']); break;
        case 'drop': result = await repo.stash(['drop']); break;
        case 'list': result = await repo.stash(['list']); break;
        default: throw new Error('Unknown stash action: ' + action);
      }
      notifyChanged();
      return ok({ result });
    } catch (err) { return fail(err); }
  });

  ipcMain.handle('git:discard', async (_e, payload) => {
    try {
      const { projectPath, file } = payload || {};
      if (!file) throw new Error('File path required');
      await g(projectPath).checkout(['--', file]);
      notifyChanged();
      return ok();
    } catch (err) { return fail(err); }
  });

  ipcMain.handle('git:init', async (_e, projectPath) => {
    try {
      await g(projectPath).init();
      notifyChanged();
      return ok();
    } catch (err) { return fail(err); }
  });
};
