import { mockEvents } from './mockData.js';

const bookings = new Map();
let referenceNumber = 1;

function clone(value) {
  return structuredClone(value);
}

function summary(event) {
  const tiers = event.tiers.map((tier) => ({ ...tier }));
  return {
    id: event.id,
    title: event.title,
    city: event.city,
    venue: event.venue,
    date: event.date,
    status: event.status,
    tiers,
    cheapestPriceCents: Math.min(...tiers.map((tier) => tier.priceCents)),
    availableSeats: tiers.reduce((total, tier) => total + tier.available, 0)
  };
}

export async function listEvents(criteria = {}, sortBy = 'date') {
  const q = criteria.q?.toLocaleLowerCase() ?? '';
  const city = criteria.city?.toLocaleLowerCase() ?? '';
  const maxPrice = criteria.maxPriceCents;
  const filtered = mockEvents
    .filter((event) => event.status === 'PUBLISHED')
    .map(summary)
    .filter((event) => (
      (!q || event.title.toLocaleLowerCase().includes(q) || event.venue.toLocaleLowerCase().includes(q))
      && (!city || event.city.toLocaleLowerCase() === city)
      && (maxPrice === undefined || event.cheapestPriceCents <= maxPrice)
    ));

  const result = filtered.sort((left, right) => {
    if (sortBy === 'price') return left.cheapestPriceCents - right.cheapestPriceCents;
    if (sortBy === 'availability') return right.availableSeats - left.availableSeats;
    return Date.parse(left.date) - Date.parse(right.date);
  });
  return clone(result);
}

export async function getEvent(eventId) {
  const event = mockEvents.find((item) => item.id === eventId);
  if (!event) throw new Error('Event was not found');
  return clone(event);
}

export async function createBooking({ eventId, tierId, quantity, userId = 'demo-attendee' }) {
  const event = mockEvents.find((item) => item.id === eventId);
  const tier = event?.tiers.find((item) => item.id === tierId);
  if (!tier) throw new Error('Ticket tier was not found');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    throw new Error('Quantity must be between 1 and 10');
  }
  if (quantity > tier.available) throw new Error('Not enough seats available');
  tier.available -= quantity;
  tier.sold += quantity;
  const booking = {
    id: `booking-${referenceNumber}`,
    reference: `BK-MOCK-${String(referenceNumber).padStart(4, '0')}`,
    eventId,
    tierId,
    userId,
    quantity,
    totalCents: tier.priceCents * quantity,
    status: 'PENDING'
  };
  referenceNumber += 1;
  bookings.set(booking.reference, booking);
  return clone(booking);
}

export async function pay(reference, { decline = false } = {}) {
  const booking = bookings.get(reference);
  if (!booking) throw new Error('Booking was not found');
  if (decline) throw new Error('Payment was declined');
  booking.status = 'PAID';
  return clone(booking);
}
