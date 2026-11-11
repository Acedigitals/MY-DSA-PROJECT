import assert from 'node:assert/strict';
import test from 'node:test';
import { createDatabase } from '../src/db/connection.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import { createEventService } from '../src/services/eventService.js';
import { createBookingService } from '../src/services/bookingService.js';
import { createMockPaymentGateway } from '../src/lib/mockPaymentGateway.js';

test('SQLite allows exactly one simultaneous booking for the last seat', async () => {
  const database = createDatabase(':memory:');
  try {
    const repository = createSqliteRepository(database);
    const events = createEventService(repository);
    const bookings = createBookingService(repository, createMockPaymentGateway());
    const event = await events.create({
      title: 'Concurrency Test',
      city: 'Lagos',
      venue: 'Test Hall',
      date: '2026-12-05'
    });
    const tier = await events.addTier(event.id, {
      name: 'General',
      priceCents: 1000,
      capacity: 2
    });
    await events.publish(event.id);
    await bookings.book({ eventId: event.id, tierId: tier.id, userId: 'setup', quantity: 1 });

    const results = await Promise.all(Array.from({ length: 50 }, (_, index) =>
      bookings.book({
        eventId: event.id,
        tierId: tier.id,
        userId: `user-${index}`,
        quantity: 1
      }).then(() => ({ ok: true })).catch((error) => ({ ok: false, code: error.code }))
    ));

    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.equal(results.filter((result) => result.code === 'SOLD_OUT').length, 49);
    assert.equal((await repository.getTier(event.id, tier.id)).sold, 2);
  } finally {
    database.close();
  }
});
