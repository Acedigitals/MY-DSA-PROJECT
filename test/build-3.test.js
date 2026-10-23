import assert from 'node:assert/strict';
import { request } from 'node:http';
import test from 'node:test';
import { createApp } from '../src/http/app.js';
import { createRouter } from '../src/http/router.js';
import { assertTransition, canTransition } from '../src/domain/bookingStateMachine.js';
import { DomainError } from '../src/domain/errors.js';

test('booking state machine allows every specified transition', () => {
  for (const [from, targets] of [
    ['pending', ['paid', 'cancelled']],
    ['paid', ['checked_in', 'refunded', 'cancelled']]
  ]) {
    for (const to of targets) {
      assert.equal(canTransition(from, to), true);
      assert.equal(assertTransition(from, to), true);
    }
  }
});

test('booking state machine rejects every illegal transition', () => {
  const states = ['pending', 'paid', 'cancelled', 'refunded', 'checked_in'];
  const allowed = new Set(['pending:paid', 'pending:cancelled', 'paid:checked_in', 'paid:refunded', 'paid:cancelled']);
  for (const from of states) {
    for (const to of states) {
      if (allowed.has(`${from}:${to}`)) continue;
      assert.equal(canTransition(from, to), false);
      assert.throws(() => assertTransition(from, to), (error) => (
        error instanceof DomainError && error.code === 'INVALID_TRANSITION'
      ));
    }
  }
  assert.equal(canTransition('unknown', 'paid'), false);
  assert.throws(() => assertTransition('unknown', 'paid'), (error) => (
    error instanceof DomainError && error.code === 'INVALID_TRANSITION'
  ));
});

test('router matches methods and parameters', () => {
  const router = createRouter();
  const handler = () => 'ok';
  router.get('/events/:eventId', handler);
  assert.equal(router.match('GET', '/events/abc').handler, handler);
  assert.deepEqual(router.match('GET', '/events/abc').params, { eventId: 'abc' });
  assert.equal(router.match('POST', '/events/abc'), null);
});

test('real HTTP request to /health returns JSON', async () => {
  const server = (await import('node:http')).createServer(createApp());
  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  const response = await new Promise((resolve, reject) => {
    const requestOptions = { port: address.port, path: '/health', method: 'GET' };
    const clientRequest = request(requestOptions, (clientResponse) => {
      let data = '';
      clientResponse.setEncoding('utf8');
      clientResponse.on('data', (chunk) => { data += chunk; });
      clientResponse.on('end', () => resolve({ statusCode: clientResponse.statusCode, data }));
    });
    clientRequest.on('error', reject);
    clientRequest.end();
  });
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.data), { status: 'ok' });
});

test('app returns safe JSON errors for unknown API paths and bad JSON', async () => {
  const server = (await import('node:http')).createServer(createApp());
  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  const get = (options, body = '') => new Promise((resolve, reject) => {
    const clientRequest = request({ port: address.port, ...options }, (clientResponse) => {
      let data = '';
      clientResponse.on('data', (chunk) => { data += chunk; });
      clientResponse.on('end', () => resolve({ statusCode: clientResponse.statusCode, data }));
    });
    clientRequest.on('error', reject);
    clientRequest.end(body);
  });
  const missing = await get({ method: 'GET', path: '/api/missing' });
  const invalid = await get({ method: 'POST', path: '/api/events', headers: { 'content-type': 'application/json' } }, '{');
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  assert.equal(missing.statusCode, 404);
  assert.deepEqual(JSON.parse(missing.data), { error: { code: 'NOT_FOUND', message: 'API route not found' } });
  assert.equal(invalid.statusCode, 400);
  assert.equal(JSON.parse(invalid.data).error.code, 'BAD_JSON');
  assert.equal(JSON.parse(invalid.data).error.stack, undefined);
});
