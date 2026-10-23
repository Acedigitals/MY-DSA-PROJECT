import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRouter } from './router.js';

const defaultPublicDir = path.resolve(fileURLToPath(new URL('../../public', import.meta.url)));

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8']
]);

function sendJson(response, statusCode, body) {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload)
  });
  response.end(payload);
}

function sendError(response, statusCode, code, message) {
  sendJson(response, statusCode, { error: { code, message } });
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let data = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('Request body is too large'));
        request.destroy();
      }
    });
    request.on('end', () => {
      if (data.trim() === '') {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new SyntaxError('Request body must be valid JSON'));
      }
    });
    request.on('error', reject);
  });
}

function safeFilePath(publicDir, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const candidate = path.resolve(publicDir, `.${decodedPath}`);
  const relative = path.relative(publicDir, candidate);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return null;
  }
  return candidate;
}

async function serveStatic(response, publicDir, pathname) {
  const filePath = safeFilePath(publicDir, pathname === '/' ? '/index.html' : pathname);
  if (!filePath) {
    sendError(response, 404, 'NOT_FOUND', 'File not found');
    return;
  }
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'content-type': contentTypes.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream',
      'content-length': stats.size
    });
    createReadStream(filePath).pipe(response);
  } catch {
    sendError(response, 404, 'NOT_FOUND', 'File not found');
  }
}

export function createApp({ router = createRouter(), publicDir = defaultPublicDir } = {}) {
  router.get('/health', (_request, _context) => ({ status: 'ok' }));

  return async function app(request, response) {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      let body = null;
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        try {
          body = await readJson(request);
        } catch (error) {
          sendError(response, 400, 'BAD_JSON', error instanceof Error ? error.message : 'Bad JSON');
          return;
        }
      }

      const match = router.match(request.method ?? 'GET', url.pathname);
      if (match) {
        const result = await match.handler(request, {
          params: match.params,
          body
        });
        if (!response.writableEnded) sendJson(response, 200, result);
        return;
      }

      if (url.pathname.startsWith('/api/')) {
        sendError(response, 404, 'NOT_FOUND', 'API route not found');
        return;
      }
      await serveStatic(response, publicDir, url.pathname);
    } catch (error) {
      if (!response.writableEnded) {
        sendError(response, 500, 'INTERNAL_ERROR', 'Internal server error');
      }
    }
  };
}
