// PiPilot IDE — File system IPC handlers (Phase 2)

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const os = require('os');
const { shell } = require('electron');
const chokidar = require('chokidar');

const IGNORED = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.pipilot',
  'out',
  '.DS_Store',
  '.cache',
  '.turbo',
]);

const MAX_DEPTH = 12;
const BINARY_THRESHOLD_BYTES = 1024 * 1024;
const SEARCH_MAX_RESULTS = 500;
const SEARCH_MAX_FILE_BYTES = 512 * 1024;
const BINARY_VIEWER_MAX_BYTES = 25 * 1024 * 1024; // 25 MB cap for in-editor viewing

const MIME_BY_EXT = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', ico: 'image/x-icon', svg: 'image/svg+xml',
  avif: 'image/avif', tiff: 'image/tiff', tif: 'image/tiff',
  pdf: 'application/pdf',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska',
  ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2', eot: 'application/vnd.ms-fontobject',
};

const ARCHIVE_EXTS = new Set([
  'zip', 'tar', 'gz', 'tgz', 'tbz', 'tbz2', 'bz2', 'xz', '7z', 'rar',
  'jar', 'war', 'ear', 'iso', 'dmg', 'pkg', 'deb', 'rpm', 'apk',
]);

function extOf(p) {
  const name = path.basename(p).toLowerCase();
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1) : '';
}

function classifyBinary(filePath) {
  const ext = extOf(filePath);
  const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
  let kind = 'binary';
  if (ARCHIVE_EXTS.has(ext)) kind = 'archive';
  else if (mime.startsWith('image/')) kind = 'image';
  else if (mime === 'application/pdf') kind = 'pdf';
  else if (mime.startsWith('audio/')) kind = 'audio';
  else if (mime.startsWith('video/')) kind = 'video';
  else if (mime.startsWith('font/') || ext === 'eot') kind = 'font';
  return { ext, mime, kind };
}

function safeAbsolute(p) {
  if (typeof p !== 'string' || !p) throw new Error('Path is required');
  if (!path.isAbsolute(p)) throw new Error('Path must be absolute: ' + p);
  // Block any traversal segments in the literal string
  const norm = path.normalize(p);
  if (norm.split(path.sep).includes('..')) throw new Error('Path traversal not allowed');
  return norm;
}

async function walkTree(dir, depth = 0) {
  if (depth > MAX_DEPTH) return null;
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  const dirs = [];
  const files = [];
  for (const ent of entries) {
    if (IGNORED.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      const children = await walkTree(full, depth + 1);
      dirs.push({
        name: ent.name,
        path: full,
        type: 'dir',
        children: children || [],
      });
    } else if (ent.isFile() || ent.isSymbolicLink()) {
      files.push({
        name: ent.name,
        path: full,
        type: 'file',
      });
    }
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));
  return [...dirs, ...files];
}

function isLikelyBinary(buf) {
  const len = Math.min(buf.length, 8000);
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

async function listChildren(dirPath, includeHidden = false) {
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  const out = [];
  for (const ent of entries) {
    const isHidden = ent.name.startsWith('.');
    if (!includeHidden && isHidden) continue;
    out.push({
      name: ent.name,
      path: path.join(dirPath, ent.name),
      isDir: ent.isDirectory(),
      isHidden,
    });
  }
  out.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return out;
}

async function searchInProject(projectPath, query, opts = {}) {
  const results = [];
  const caseSensitive = !!opts.caseSensitive;
  const useRegex = !!opts.regex;
  let matcher;
  if (useRegex) {
    try {
      matcher = new RegExp(query, caseSensitive ? 'g' : 'gi');
    } catch (e) {
      throw new Error('Invalid regex: ' + e.message);
    }
  } else {
    const q = caseSensitive ? query : query.toLowerCase();
    matcher = {
      test(line) {
        return (caseSensitive ? line : line.toLowerCase()).includes(q);
      },
      find(line) {
        const hay = caseSensitive ? line : line.toLowerCase();
        const idx = hay.indexOf(q);
        return idx === -1 ? null : { index: idx, length: query.length };
      },
    };
  }

  async function walk(dir) {
    if (results.length >= SEARCH_MAX_RESULTS) return;
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      if (results.length >= SEARCH_MAX_RESULTS) return;
      if (IGNORED.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
      } else if (ent.isFile()) {
        try {
          const stat = await fsp.stat(full);
          if (stat.size > SEARCH_MAX_FILE_BYTES) continue;
          const buf = await fsp.readFile(full);
          if (isLikelyBinary(buf)) continue;
          const text = buf.toString('utf8');
          const lines = text.split(/\r?\n/);
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (useRegex) {
              matcher.lastIndex = 0;
              const m = matcher.exec(line);
              if (m) {
                results.push({
                  file: full,
                  line: i + 1,
                  col: m.index + 1,
                  preview: line.slice(0, 300),
                });
                if (results.length >= SEARCH_MAX_RESULTS) return;
              }
            } else {
              const m = matcher.find(line);
              if (m) {
                results.push({
                  file: full,
                  line: i + 1,
                  col: m.index + 1,
                  preview: line.slice(0, 300),
                });
                if (results.length >= SEARCH_MAX_RESULTS) return;
              }
            }
          }
        } catch {
          // ignore unreadable files
        }
      }
    }
  }

  await walk(projectPath);
  return results;
}

module.exports = function register(ipcMain, ctx) {
  const watchers = new Map();

  ipcMain.handle('files:tree', async (_e, projectPath) => {
    const root = safeAbsolute(projectPath);
    const children = await walkTree(root, 0);
    const name = path.basename(root) || root;
    return {
      name,
      path: root,
      type: 'dir',
      children: children || [],
    };
  });

  ipcMain.handle('files:read', async (_e, filePath) => {
    const p = safeAbsolute(filePath);
    const stat = await fsp.stat(p);
    const meta = classifyBinary(p);
    if (stat.size > BINARY_THRESHOLD_BYTES) {
      return { binary: true, size: stat.size, kind: meta.kind, ext: meta.ext, mime: meta.mime };
    }
    const buf = await fsp.readFile(p);
    if (isLikelyBinary(buf) || meta.kind !== 'binary') {
      // Image SVG is technically text but editor layer routes it as an image when
      // the user double-clicks, so we only report "binary" when the sniffer flags
      // it OR the extension clearly indicates a known media/archive format.
      const isTextExt = meta.kind === 'binary' && !isLikelyBinary(buf);
      if (isTextExt) {
        return { content: buf.toString('utf8'), encoding: 'utf8', size: stat.size, mtime: stat.mtimeMs };
      }
      return { binary: true, size: stat.size, kind: meta.kind, ext: meta.ext, mime: meta.mime };
    }
    return {
      content: buf.toString('utf8'),
      encoding: 'utf8',
      size: stat.size,
      mtime: stat.mtimeMs,
    };
  });

  // Read a binary file for in-editor viewing (images, PDFs, audio, video, fonts).
  // Returns base64-encoded bytes + MIME type + classification. Archives and files
  // larger than BINARY_VIEWER_MAX_BYTES are rejected with a descriptive error.
  ipcMain.handle('files:read-binary', async (_e, filePath) => {
    const p = safeAbsolute(filePath);
    const stat = await fsp.stat(p);
    const meta = classifyBinary(p);
    if (meta.kind === 'archive') {
      return { ok: false, error: 'Archive files cannot be viewed in the editor', kind: 'archive', ext: meta.ext, size: stat.size };
    }
    if (stat.size > BINARY_VIEWER_MAX_BYTES) {
      return { ok: false, error: `File too large to view (${(stat.size / 1024 / 1024).toFixed(1)} MB > 25 MB)`, size: stat.size, kind: meta.kind };
    }
    const buf = await fsp.readFile(p);
    return {
      ok: true,
      kind: meta.kind,
      mime: meta.mime,
      ext: meta.ext,
      size: stat.size,
      mtime: stat.mtimeMs,
      base64: buf.toString('base64'),
    };
  });

  ipcMain.handle('files:write', async (_e, { filePath, content }) => {
    const p = safeAbsolute(filePath);
    await fsp.mkdir(path.dirname(p), { recursive: true });
    await fsp.writeFile(p, content ?? '', 'utf8');
    const stat = await fsp.stat(p);
    return { ok: true, mtime: stat.mtimeMs, size: stat.size };
  });

  ipcMain.handle('files:mkdir', async (_e, dirPath) => {
    const p = safeAbsolute(dirPath);
    await fsp.mkdir(p, { recursive: true });
    return { ok: true };
  });

  ipcMain.handle('files:delete', async (_e, targetPath) => {
    const p = safeAbsolute(targetPath);
    await fsp.rm(p, { recursive: true, force: true });
    return { ok: true };
  });

  ipcMain.handle('files:rename', async (_e, { from, to }) => {
    const src = safeAbsolute(from);
    const dst = safeAbsolute(to);
    await fsp.mkdir(path.dirname(dst), { recursive: true });
    await fsp.rename(src, dst);
    return { ok: true };
  });

  ipcMain.handle('files:stat', async (_e, p) => {
    try {
      const abs = safeAbsolute(p);
      const stat = await fsp.stat(abs);
      return {
        exists: true,
        isDir: stat.isDirectory(),
        size: stat.size,
        mtime: stat.mtimeMs,
      };
    } catch {
      return { exists: false, isDir: false, size: 0, mtime: 0 };
    }
  });

  ipcMain.handle('files:list', async (_e, dirPath) => {
    const p = safeAbsolute(dirPath);
    return listChildren(p, false);
  });

  ipcMain.handle('files:search', async (_e, { projectPath, query, opts }) => {
    if (!query) return [];
    const root = safeAbsolute(projectPath);
    return searchInProject(root, query, opts || {});
  });

  ipcMain.handle('files:watch:start', async (e, { streamId, projectPath }) => {
    const root = safeAbsolute(projectPath);
    if (watchers.has(streamId)) return { ok: true };

    const watcher = chokidar.watch(root, {
      ignored: (p) => {
        const base = path.basename(p);
        return IGNORED.has(base);
      },
      ignoreInitial: true,
      depth: MAX_DEPTH,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 50 },
    });

    const send = (type, p) => {
      const win = ctx.getWindow?.();
      if (win && !win.isDestroyed()) {
        win.webContents.send(`files:watch:${streamId}`, { type, path: p });
      }
    };

    watcher
      .on('add', (p) => send('add', p))
      .on('change', (p) => send('change', p))
      .on('unlink', (p) => send('unlink', p))
      .on('addDir', (p) => send('addDir', p))
      .on('unlinkDir', (p) => send('unlinkDir', p))
      .on('error', (err) => console.error('watcher error:', err));

    watchers.set(streamId, watcher);
    return { ok: true };
  });

  ipcMain.handle('files:watch:stop', async (_e, streamId) => {
    const w = watchers.get(streamId);
    if (w) {
      try { await w.close(); } catch {}
      watchers.delete(streamId);
    }
    return { ok: true };
  });

  ipcMain.handle('fs:home', () => os.homedir());

  ipcMain.handle('fs:list', async (_e, dirPath) => {
    const p = safeAbsolute(dirPath || os.homedir());
    return listChildren(p, false);
  });

  ipcMain.handle('shell:open-external', async (_e, url) => {
    await shell.openExternal(url);
    return { ok: true };
  });

  ipcMain.handle('shell:show-in-folder', async (_e, p) => {
    const abs = safeAbsolute(p);
    shell.showItemInFolder(abs);
    return { ok: true };
  });
};
