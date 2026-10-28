import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import test from 'node:test';
import { createApp } from '../src/http/app.js';

async function startServer() {
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, resolve));
  return server;
}

async function stopServer(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function apiRequest(server, method, path, body, headers = {}) {
  const address = server.address();
  return new Promise((resolve, reject) => {
    const clientRequest = request({
      port: address.port,
      method,
      path,
      headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers }
    }, (response) => {
      let data = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: data ? JSON.parse(data) : null }));
    });
    clientRequest.on('error', reject);
    clientRequest.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

test('Build 4 API supports create, publish, search, book, decline, pay and ownership', async () => {
  const server = await startServer();
  try {
    const created = await apiRequest(server, 'POST', '/api/events', {
      title: 'API Meetup', city: 'Lagos', venue: 'Hall', date: '2026-12-05T17:00:00Z'
    });
    assert.equal(created.status, 200);
    const eventId = created.body.id;

    const tier = await apiRequest(server, 'POST', `/api/events/${eventId}/tiers`, {
      name: 'General', priceCents: 500, capacity: 3
    });
    assert.equal(tier.status, 200);
    const published = await apiRequest(server, 'POST', `/api/events/${eventId}/publish`);
    assert.equal(published.body.status, 'PUBLISHED');

    const search = await apiRequest(server, 'GET', '/api/events?q=meetup&city=lagos&sortBy=price');
    assert.equal(search.status, 200);
    assert.equal(search.body.length, 1);

    const booking = await apiRequest(server, 'POST', '/api/bookings', {
      eventId, tierId: tier.body.id, quantity: 2
    }, { 'x-user-id': 'user-1' });
    assert.equal(booking.status, 200);
    assert.equal(booking.body.status, 'PENDING');

    const declined = await apiRequest(server, 'POST', `/api/bookings/${booking.body.reference}/pay`, {
      decline: true
    }, { 'x-user-id': 'user-1' });
    assert.equal(declined.status, 409);
    assert.equal(declined.body.error.code, 'PAYMENT_DECLINED');

    const forbidden = await apiRequest(server, 'POST', `/api/bookings/${booking.body.reference}/pay`, {
      decline: false
    }, { 'x-user-id': 'user-2' });
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.error.code, 'FORBIDDEN');

    const paid = await apiRequest(server, 'POST', `/api/bookings/${booking.body.reference}/pay`, {
      decline: false
    }, { 'x-user-id': 'user-1' });
    assert.equal(paid.status, 200);
    assert.equal(paid.body.status, 'PAID');
  } finally {
    await stopServer(server);
  }
});

test('Build 4 API cancels an unpaid booking and preserves error shape', async () => {
  const server = await startServer();
  try {
    const event = await apiRequest(server, 'POST', '/api/events', {
      title: 'Cancel Meetup', city: 'Lagos', venue: 'Hall', date: '2026-12-05'
    });
    const tier = await apiRequest(server, 'POST', `/api/events/${event.body.id}/tiers`, {
      name: 'General', priceCents: 100, capacity: 1
    });
    const booking = await apiRequest(server, 'POST', '/api/bookings', {
      eventId: event.body.id, tierId: tier.body.id, quantity: 1
    }, { 'x-user-id': 'user-1' });
    const cancelled = await apiRequest(server, 'POST', `/api/bookings/${booking.body.reference}/cancel`, undefined, { 'x-user-id': 'user-1' });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.status, 'CANCELLED');

    const payCancelled = await apiRequest(server, 'POST', `/api/bookings/${booking.body.reference}/pay`, {}, { 'x-user-id': 'user-1' });
    assert.equal(payCancelled.status, 409);
    assert.equal(payCancelled.body.error.code, 'INVALID_TRANSITION');
    assert.deepEqual(Object.keys(payCancelled.body), ['error']);
  } finally {
    await stopServer(server);
  }
});
