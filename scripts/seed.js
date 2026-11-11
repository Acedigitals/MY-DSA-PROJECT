import { createDatabase } from '../src/db/connection.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import { createEventService } from '../src/services/eventService.js';

const database = createDatabase();
const repository = createSqliteRepository(database);
const events = createEventService(repository);

try {
  if ((await repository.listEvents()).length === 0) {
    const event = await events.create({
      title: 'Lagos Tech Meetup',
      city: 'Lagos',
      venue: 'Civic Hall',
      date: '2026-12-05T17:00:00Z'
    });
    await events.addTier(event.id, {
      name: 'General',
      priceCents: 500000,
      capacity: 100
    });
    await events.publish(event.id);
    console.log(`Seeded event ${event.id}`);
  } else {
    console.log('Database already contains data; nothing was seeded.');
  }
} finally {
  database.close();
}
