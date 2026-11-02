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

async function apiRequest(server, method, path, body) {
  const address = server.address();
  return new Promise((resolve, reject) => {
    const clientRequest = request({
      port: address.port,
      method,
      path,
      headers: body === undefined ? {} : { 'content-type': 'application/json' }
    }, (response) => {
      let data = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => resolve({
        status: response.statusCode,
        body: data ? JSON.parse(data) : null
      }));
    });
    clientRequest.on('error', reject);
    clientRequest.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

test('API can view and unpublish an event', async () => {
  const server = await startServer();
  try {
    const created = await apiRequest(server, 'POST', '/api/events', {
      title: 'API Event',
      city: 'Lagos',
      venue: 'Hall',
      date: '2026-12-05'
    });
    const eventId = created.body.id;
    await apiRequest(server, 'POST', `/api/events/${eventId}/tiers`, {
      name: 'General',
      priceCents: 500,
      capacity: 10
    });

    const viewed = await apiRequest(server, 'GET', `/api/events/${eventId}`);
    assert.equal(viewed.status, 200);
    assert.equal(viewed.body.status, 'DRAFT');

    const published = await apiRequest(server, 'POST', `/api/events/${eventId}/publish`);
    assert.equal(published.body.status, 'PUBLISHED');

    const unpublished = await apiRequest(server, 'POST', `/api/events/${eventId}/unpublish`);
    assert.equal(unpublished.status, 200);
    assert.equal(unpublished.body.status, 'DRAFT');

    const visibleEvents = await apiRequest(server, 'GET', '/api/events');
    assert.deepEqual(visibleEvents.body, []);
  } finally {
    await stopServer(server);
  }
});
