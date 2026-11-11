import { createDatabase } from '../src/db/connection.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import { createEventService } from '../src/services/eventService.js';
import { createBookingService } from '../src/services/bookingService.js';
import { createMockPaymentGateway } from '../src/lib/mockPaymentGateway.js';

const database = createDatabase(':memory:');
const repository = createSqliteRepository(database);
const events = createEventService(repository);
const bookings = createBookingService(repository, createMockPaymentGateway());

try {
  const event = await events.create({
    title: 'Last Seat Demo',
    city: 'Lagos',
    venue: 'Demo Hall',
    date: '2026-12-05'
  });
  const tier = await events.addTier(event.id, {
    name: 'General',
    priceCents: 1000,
    capacity: 2
  });
  await events.publish(event.id);
  await bookings.book({ eventId: event.id, tierId: tier.id, userId: 'initial-buyer', quantity: 1 });

  const results = await Promise.all(Array.from({ length: 50 }, (_, index) =>
    bookings.book({
      eventId: event.id,
      tierId: tier.id,
      userId: `buyer-${index}`,
      quantity: 1
    }).then(() => 'success').catch((error) => error.code)
  ));
  const finalTier = await repository.getTier(event.id, tier.id);
  console.log(`Successful bookings: ${results.filter((result) => result === 'success').length}`);
  console.log(`SOLD_OUT responses: ${results.filter((result) => result === 'SOLD_OUT').length}`);
  console.log(`Seats sold: ${finalTier.sold}`);
} finally {
  database.close();
}
