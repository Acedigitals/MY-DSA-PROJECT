import { DomainError } from './errors.js';
import { newId, newReference } from './ids.js';
import { Queue } from './waitlistQueue.js';

const bookingStatuses = new Set(['CONFIRMED', 'CANCELLED']);

function requireObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError('VALIDATION', `${label} must be an object`);
  }
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('VALIDATION', `${label} must be a non-empty string`);
  }
  return value.trim();
}

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new DomainError('VALIDATION', `${label} must be a positive integer`);
  }
  return value;
}

function requireCents(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainError('VALIDATION', `${label} must be whole cents`);
  }
  return value;
}

function requireStore(store) {
  requireObject(store, 'store');
  if (!(store.events instanceof Map) || !(store.bookings instanceof Map)) {
    throw new DomainError('VALIDATION', 'store is not a valid inventory store');
  }
}

function getEvent(store, eventOrId) {
  const eventId = typeof eventOrId === 'string' ? eventOrId : eventOrId?.id;
  if (typeof eventId !== 'string' || eventId.trim() === '') {
    throw new DomainError('VALIDATION', 'eventId must be a non-empty string');
  }
  const event = store.events.get(eventId);
  if (!event) {
    throw new DomainError('NOT_FOUND', `Event ${eventId} was not found`);
  }
  return event;
}

function getTier(event, tierOrId) {
  const tierId = typeof tierOrId === 'string' ? tierOrId : tierOrId?.id;
  if (typeof tierId !== 'string' || tierId.trim() === '') {
    throw new DomainError('VALIDATION', 'tierId must be a non-empty string');
  }
  const tier = event.tiers.get(tierId);
  if (!tier) {
    throw new DomainError('NOT_FOUND', `Tier ${tierId} was not found`);
  }
  return tier;
}

export function createStore() {
  return {
    events: new Map(),
    bookings: new Map()
  };
}

export function createEvent(store, details) {
  requireStore(store);
  requireObject(details, 'event details');
  const name = requireNonEmptyString(details.name, 'event name');
  const event = {
    id: newId(),
    name,
    date: details.date === undefined ? null : requireNonEmptyString(details.date, 'event date'),
    tiers: new Map()
  };
  store.events.set(event.id, event);
  return event;
}

export function addTier(store, eventOrId, details) {
  requireStore(store);
  const event = getEvent(store, eventOrId);
  requireObject(details, 'tier details');
  const name = requireNonEmptyString(details.name, 'tier name');
  const capacity = requirePositiveInteger(details.capacity, 'tier capacity');
  const priceCents = requireCents(details.priceCents, 'tier priceCents');
  const tier = {
    id: newId(),
    eventId: event.id,
    name,
    capacity,
    available: capacity,
    priceCents,
    waitlist: new Queue()
  };
  event.tiers.set(tier.id, tier);
  return tier;
}

export function bookTickets(store, details) {
  requireStore(store);
  requireObject(details, 'booking details');
  const event = getEvent(store, details.eventId);
  const tier = getTier(event, details.tierId);
  const customerName = requireNonEmptyString(details.customerName, 'customerName');
  const quantity = requirePositiveInteger(details.quantity, 'quantity');
  if (quantity > 10) {
    throw new DomainError('VALIDATION', 'quantity must be between 1 and 10');
  }
  if (tier.available < quantity) {
    throw new DomainError('SOLD_OUT', `Not enough seats in ${tier.name}`);
  }

  tier.available -= quantity;
  const booking = {
    id: newId(),
    reference: newReference(),
    eventId: event.id,
    tierId: tier.id,
    customerName,
    quantity,
    totalCents: tier.priceCents * quantity,
    status: 'CONFIRMED',
    createdAt: new Date().toISOString()
  };
  store.bookings.set(booking.reference, booking);
  return booking;
}

export function cancelBooking(store, reference) {
  requireStore(store);
  const bookingReference = requireNonEmptyString(reference, 'reference');
  const booking = store.bookings.get(bookingReference);
  if (!booking) {
    throw new DomainError('NOT_FOUND', `Booking ${bookingReference} was not found`);
  }
  if (booking.status === 'CANCELLED') {
    throw new DomainError('ALREADY_CANCELLED', `Booking ${bookingReference} is already cancelled`);
  }
  if (!bookingStatuses.has(booking.status)) {
    throw new DomainError('VALIDATION', `Booking ${bookingReference} has an invalid status`);
  }

  const event = getEvent(store, booking.eventId);
  const tier = getTier(event, booking.tierId);
  tier.available += booking.quantity;
  booking.status = 'CANCELLED';
  booking.cancelledAt = new Date().toISOString();
  return booking;
}

export function findBookingByReference(store, reference) {
  requireStore(store);
  const bookingReference = requireNonEmptyString(reference, 'reference');
  return store.bookings.get(bookingReference);
}

export function joinWaitlist(store, details) {
  requireStore(store);
  requireObject(details, 'waitlist details');
  const event = getEvent(store, details.eventId);
  const tier = getTier(event, details.tierId);
  const customerName = requireNonEmptyString(details.customerName, 'customerName');
  const quantity = requirePositiveInteger(details.quantity, 'quantity');
  if (quantity > 10) {
    throw new DomainError('VALIDATION', 'quantity must be between 1 and 10');
  }

  const entry = {
    id: newId(),
    eventId: event.id,
    tierId: tier.id,
    customerName,
    quantity,
    joinedAt: new Date().toISOString()
  };
  tier.waitlist.enqueue(entry);
  return entry;
}
