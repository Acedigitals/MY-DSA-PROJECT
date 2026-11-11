import { newId, newReference } from '../domain/ids.js';
import { DomainError } from '../domain/errors.js';

function eventFromRows(eventRow, tierRows) {
  if (!eventRow) return undefined;
  const tiers = new Map(tierRows.map((tier) => [tier.id, {
    id: tier.id,
    eventId: tier.event_id,
    name: tier.name,
    capacity: tier.capacity,
    sold: tier.sold,
    available: tier.capacity - tier.sold,
    priceCents: tier.price_cents
  }]));
  return {
    id: eventRow.id,
    title: eventRow.title,
    city: eventRow.city,
    venue: eventRow.venue,
    date: eventRow.date,
    status: eventRow.status,
    tiers
  };
}

function bookingFromRow(row) {
  if (!row) return undefined;
  return {
    id: row.id,
    reference: row.reference,
    eventId: row.event_id,
    tierId: row.tier_id,
    userId: row.user_id,
    quantity: row.quantity,
    totalCents: row.total_cents,
    status: row.status,
    createdAt: row.created_at,
    ...(row.paid_at ? { paidAt: row.paid_at } : {}),
    ...(row.cancelled_at ? { cancelledAt: row.cancelled_at } : {})
  };
}

function eventRows(database, eventId) {
  const event = database.prepare(
    'SELECT id, title, city, venue, date, status FROM events WHERE id = ?'
  ).get(eventId);
  if (!event) return undefined;
  const tiers = database.prepare(
    'SELECT id, event_id, name, price_cents, capacity, sold FROM ticket_tiers WHERE event_id = ? ORDER BY rowid'
  ).all(eventId);
  return eventFromRows(event, tiers);
}

export function createSqliteRepository(database) {
  if (!database || typeof database.prepare !== 'function') {
    throw new TypeError('database is required');
  }

  return {
    async createEvent({ title, city, venue, date }) {
      const id = newId();
      database.prepare(
        'INSERT INTO events (id, title, city, venue, date, status) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, title, city, venue, date, 'DRAFT');
      return eventRows(database, id);
    },

    async getEvent(eventId) {
      return eventRows(database, eventId);
    },

    async listEvents() {
      return database.prepare('SELECT id FROM events ORDER BY rowid').all()
        .map(({ id }) => eventRows(database, id));
    },

    async updateEvent(eventId, changes) {
      if (!eventRows(database, eventId)) return undefined;
      if (changes.status !== undefined) {
        database.prepare('UPDATE events SET status = ? WHERE id = ?').run(changes.status, eventId);
      }
      return eventRows(database, eventId);
    },

    async createTier(eventId, { name, priceCents, capacity }) {
      if (!eventRows(database, eventId)) return undefined;
      const id = newId();
      database.prepare(
        'INSERT INTO ticket_tiers (id, event_id, name, price_cents, capacity, sold) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, eventId, name, priceCents, capacity, 0);
      return eventRows(database, eventId).tiers.get(id);
    },

    async getTier(eventId, tierId) {
      return eventRows(database, eventId)?.tiers.get(tierId);
    },

    async updateTier(eventId, tierId, changes) {
      if (!eventRows(database, eventId)?.tiers.has(tierId)) return undefined;
      if (changes.sold !== undefined) {
        database.prepare('UPDATE ticket_tiers SET sold = ? WHERE id = ? AND event_id = ?')
          .run(changes.sold, tierId, eventId);
      }
      return eventRows(database, eventId).tiers.get(tierId);
    },

    async reserveSeats(eventId, tierId, quantity) {
      const result = database.prepare(
        'UPDATE ticket_tiers SET sold = sold + ? WHERE id = ? AND event_id = ? AND sold + ? <= capacity'
      ).run(quantity, tierId, eventId, quantity);
      if (result.changes === 0) {
        throw new DomainError('SOLD_OUT', 'Not enough seats available');
      }
      return eventRows(database, eventId).tiers.get(tierId);
    },

    async createBooking(details) {
      const id = newId();
      const reference = newReference();
      database.prepare('INSERT OR IGNORE INTO users (id, name) VALUES (?, ?)')
        .run(details.userId, details.userId);
      database.prepare(
        `INSERT INTO bookings
          (id, reference, event_id, tier_id, user_id, quantity, total_cents, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id, reference, details.eventId, details.tierId, details.userId,
        details.quantity, details.totalCents, details.status, details.createdAt
      );
      return bookingFromRow(database.prepare(
        'SELECT * FROM bookings WHERE reference = ?'
      ).get(reference));
    },

    async getBooking(reference) {
      return bookingFromRow(database.prepare('SELECT * FROM bookings WHERE reference = ?').get(reference));
    },

    async updateBooking(reference, changes) {
      if (changes.status !== undefined) {
        database.prepare('UPDATE bookings SET status = ? WHERE reference = ?').run(changes.status, reference);
      }
      if (changes.paidAt !== undefined) {
        database.prepare('UPDATE bookings SET paid_at = ? WHERE reference = ?').run(changes.paidAt, reference);
      }
      if (changes.cancelledAt !== undefined) {
        database.prepare('UPDATE bookings SET cancelled_at = ? WHERE reference = ?')
          .run(changes.cancelledAt, reference);
      }
      return this.getBooking(reference);
    }
  };
}
