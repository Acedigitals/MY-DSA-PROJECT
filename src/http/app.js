import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRouter } from './router.js';
import { createMemoryRepository } from '../repositories/memory.js';
import { createEventService } from '../services/eventService.js';
import { createBookingService } from '../services/bookingService.js';
import { createMockPaymentGateway } from '../lib/mockPaymentGateway.js';
import { DomainError } from '../domain/errors.js';

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

function statusForError(error) {
  if (error?.code === 'NOT_FOUND') return 404;
  if (error?.code === 'FORBIDDEN') return 403;
  if (error?.code === 'SOLD_OUT' || error?.code === 'INVALID_STATE'
    || error?.code === 'INVALID_TRANSITION' || error?.code === 'PAYMENT_DECLINED') return 409;
  if (error?.code === 'ALREADY_CANCELLED') return 409;
  if (error?.code === 'VALIDATION') return 400;
  return 500;
}

function userId(request) {
  const value = request.headers['x-user-id'];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('x-user-id header is required');
  }
  return value.trim();
}

function registerApiRoutes(router, eventService, bookingService) {
  router.post('/api/events', async (request, context) => eventService.create(context.body));
  router.post('/api/events/:id/tiers', async (request, context) => eventService.addTier(context.params.id, context.body));
  router.post('/api/events/:id/publish', async (request, context) => eventService.publish(context.params.id));
  router.get('/api/events', async (request, context) => {
    const query = new URL(request.url ?? '/', 'http://localhost').searchParams;
    const criteria = {};
    for (const key of ['q', 'city', 'from', 'to']) {
      if (query.has(key)) criteria[key] = query.get(key);
    }
    if (query.has('maxPriceCents')) criteria.maxPriceCents = Number(query.get('maxPriceCents'));
    if (query.has('onlyAvailable')) {
      const value = query.get('onlyAvailable');
      if (value !== 'true' && value !== 'false') {
        throw new DomainError('VALIDATION', 'onlyAvailable must be true or false');
      }
      criteria.onlyAvailable = value === 'true';
    }
    return eventService.search(criteria, query.get('sortBy') ?? 'date');
  });
  router.post('/api/bookings', async (request, context) => bookingService.book({
    ...context.body,
    userId: userId(request)
  }));
  router.post('/api/bookings/:reference/pay', async (request, context) => bookingService.pay(
    context.params.reference,
    userId(request),
    context.body ?? {}
  ));
  router.post('/api/bookings/:reference/cancel', async (request, context) => bookingService.cancel(
    context.params.reference,
    userId(request)
  ));
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

export function createApp({
  router = createRouter(),
  publicDir = defaultPublicDir,
  eventService,
  bookingService
} = {}) {
  const repository = eventService && bookingService ? null : createMemoryRepository();
  const events = eventService ?? createEventService(repository);
  const bookings = bookingService ?? createBookingService(repository, createMockPaymentGateway());
  registerApiRoutes(router, events, bookings);
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
        const code = error?.code ?? (error?.message === 'x-user-id header is required' ? 'VALIDATION' : 'INTERNAL_ERROR');
        sendError(response, statusForError(error), code, statusForError(error) === 500 ? 'Internal server error' : error.message);
      }
    }
  };
}
