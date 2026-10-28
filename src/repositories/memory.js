import { newId, newReference } from '../domain/ids.js';
import { Queue } from '../domain/waitlistQueue.js';

function cloneTier(tier) {
  return {
    id: tier.id,
    eventId: tier.eventId,
    name: tier.name,
    capacity: tier.capacity,
    sold: tier.sold,
    available: tier.available,
    priceCents: tier.priceCents
  };
}

function cloneEvent(event) {
  return {
    id: event.id,
    title: event.title,
    city: event.city,
    venue: event.venue,
    date: event.date,
    status: event.status,
    tiers: new Map([...event.tiers].map(([id, tier]) => [id, cloneTier(tier)]))
  };
}

function cloneBooking(booking) {
  return { ...booking };
}

export function createMemoryRepository() {
  const events = new Map();
  const bookings = new Map();

  return {
    async createEvent({ title, city, venue, date }) {
      const event = {
        id: newId(),
        title,
        city,
        venue,
        date,
        status: 'DRAFT',
        tiers: new Map()
      };
      events.set(event.id, event);
      return cloneEvent(event);
    },

    async getEvent(eventId) {
      const event = events.get(eventId);
      return event ? cloneEvent(event) : undefined;
    },

    async listEvents() {
      return [...events.values()].map(cloneEvent);
    },

    async updateEvent(eventId, changes) {
      const event = events.get(eventId);
      if (!event) return undefined;
      Object.assign(event, changes);
      return cloneEvent(event);
    },

    async createTier(eventId, { name, priceCents, capacity }) {
      const event = events.get(eventId);
      if (!event) return undefined;
      const tier = {
        id: newId(),
        eventId,
        name,
        priceCents,
        capacity,
        sold: 0,
        available: capacity,
        waitlist: new Queue()
      };
      event.tiers.set(tier.id, tier);
      return cloneTier(tier);
    },

    async getTier(eventId, tierId) {
      const event = events.get(eventId);
      const tier = event?.tiers.get(tierId);
      return tier ? cloneTier(tier) : undefined;
    },

    async updateTier(eventId, tierId, changes) {
      const event = events.get(eventId);
      const tier = event?.tiers.get(tierId);
      if (!tier) return undefined;
      Object.assign(tier, changes);
      return cloneTier(tier);
    },

    async createBooking(details) {
      const booking = {
        id: newId(),
        reference: newReference(),
        ...details
      };
      bookings.set(booking.reference, booking);
      return cloneBooking(booking);
    },

    async getBooking(reference) {
      const booking = bookings.get(reference);
      return booking ? cloneBooking(booking) : undefined;
    },

    async updateBooking(reference, changes) {
      const booking = bookings.get(reference);
      if (!booking) return undefined;
      Object.assign(booking, changes);
      return cloneBooking(booking);
    }
  };
}
