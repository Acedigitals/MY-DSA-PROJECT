import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addTier,
  bookTickets,
  cancelBooking,
  createEvent,
  createStore,
  listEventSummaries,
  publishEvent
} from '../src/domain/inventory.js';
import { DomainError } from '../src/domain/errors.js';
import { filterEvents, searchEvents, sortEvents } from '../src/domain/eventSearch.js';
import { mergeSort } from '../src/domain/sorting.js';

function errorCode(action, code) {
  assert.throws(action, (error) => error instanceof DomainError && error.code === code);
}

function buildEvent(store, details = {}) {
  const event = createEvent(store, {
    title: 'Lagos Tech Meetup',
    city: 'Lagos',
    venue: 'Civic Hall',
    date: '2026-12-05T17:00:00Z',
    ...details
  });
  const tier = addTier(store, event.id, {
    name: 'General',
    priceCents: 500000,
    capacity: 100
  });
  return { event, tier };
}

test('S02: creates a draft event with title, city, venue, date and id', () => {
  const store = createStore();
  const { event } = buildEvent(store);
  assert.equal(event.status, 'DRAFT');
  assert.equal(event.title, 'Lagos Tech Meetup');
  assert.equal(event.city, 'Lagos');
  assert.equal(event.venue, 'Civic Hall');
  assert.match(event.id, /^[0-9a-f-]{36}$/);
  assert.equal(listEventSummaries(store).length, 0);
});

test('S02: rejects missing fields and invalid dates without saving', () => {
  const store = createStore();
  errorCode(() => createEvent(store, {
    title: 'Missing City',
    venue: 'Hall',
    date: '2026-12-05'
  }), 'VALIDATION');
  errorCode(() => createEvent(store, {
    title: 'Bad Date',
    city: 'Lagos',
    venue: 'Hall',
    date: '2026-02-30'
  }), 'VALIDATION');
  errorCode(() => createEvent(store, {
    title: 'Bad Date Time',
    city: 'Lagos',
    venue: 'Hall',
    date: '2026-02-30T17:00:00Z'
  }), 'VALIDATION');
  assert.equal(store.events.size, 0);
});

test('S03: saves a tier with whole-cent price, zero sold and available capacity', () => {
  const store = createStore();
  const { tier } = buildEvent(store);
  assert.equal(tier.priceCents, 500000);
  assert.equal(tier.sold, 0);
  assert.equal(tier.available, 100);
});

test('S03: rejects invalid tier price and capacity', () => {
  const store = createStore();
  const { event } = buildEvent(store);
  errorCode(() => addTier(store, event.id, { name: 'Bad', priceCents: 1.5, capacity: 10 }), 'VALIDATION');
  errorCode(() => addTier(store, event.id, { name: 'Bad', priceCents: 100, capacity: 0 }), 'VALIDATION');
  errorCode(() => addTier(store, 'missing', { name: 'Bad', priceCents: 100, capacity: 10 }), 'NOT_FOUND');
});

test('S04: publishing a draft with a tier makes it public', () => {
  const store = createStore();
  const draft = createEvent(store, {
    title: 'Draft',
    city: 'Lagos',
    venue: 'Hall',
    date: '2026-12-05'
  });
  addTier(store, draft.id, { name: 'General', priceCents: 100, capacity: 10 });
  const published = publishEvent(store, draft.id);
  assert.equal(published.status, 'PUBLISHED');
  assert.equal(listEventSummaries(store).length, 1);
});

test('S04: drafts are hidden by default and visible when explicitly requested', () => {
  const store = createStore();
  const draft = createEvent(store, {
    title: 'Draft',
    city: 'Lagos',
    venue: 'Hall',
    date: '2026-12-05'
  });
  addTier(store, draft.id, { name: 'General', priceCents: 100, capacity: 10 });
  assert.equal(listEventSummaries(store).length, 0);
  assert.equal(listEventSummaries(store, { publishedOnly: false }).length, 1);
});

test('S04: publishing without tiers returns INVALID_STATE and remains a draft', () => {
  const store = createStore();
  const draft = createEvent(store, {
    title: 'No Tiers',
    city: 'Lagos',
    venue: 'Hall',
    date: '2026-12-05'
  });
  errorCode(() => publishEvent(store, draft.id), 'INVALID_STATE');
  assert.equal(draft.status, 'DRAFT');
  assert.equal(listEventSummaries(store, { publishedOnly: false })[0].status, 'DRAFT');
});

test('publishing an unknown event returns NOT_FOUND', () => {
  errorCode(() => publishEvent(createStore(), 'missing'), 'NOT_FOUND');
});

test('S05: filters by query, case-insensitive city, date range, price and availability', () => {
  const summaries = [
    { id: 'a', title: 'Lagos Tech Meetup', venue: 'Civic Hall', city: 'Lagos', date: '2026-12-05T17:00:00Z', tiers: [{ priceCents: 500, available: 0 }], availableSeats: 0 },
    { id: 'b', title: 'Abuja Jazz Night', venue: 'Blue Room', city: 'Abuja', date: '2026-12-06T19:00:00Z', tiers: [{ priceCents: 300, available: 5 }], availableSeats: 5 },
    { id: 'c', title: 'Free Gallery', venue: 'Civic Hall', city: 'Lagos', date: '2026-12-05T12:00:00Z', tiers: [], availableSeats: 10 }
  ];
  assert.deepEqual(filterEvents(summaries, { q: 'JAZZ' }).map((event) => event.id), ['b']);
  assert.deepEqual(filterEvents(summaries, { city: 'lagos' }).map((event) => event.id), ['a', 'c']);
  assert.deepEqual(filterEvents(summaries, { to: '2026-12-05' }).map((event) => event.id), ['a', 'c']);
  assert.deepEqual(filterEvents(summaries, { maxPriceCents: 400 }).map((event) => event.id), ['b']);
  assert.deepEqual(filterEvents(summaries, { onlyAvailable: true }).map((event) => event.id), ['b', 'c']);
});

test('S05: sorts by date, price and availability with deterministic tie breaks', () => {
  const summaries = [
    { id: '2', title: 'Bravo', date: '2026-12-05T18:00:00Z', tiers: [{ priceCents: 100 }], availableSeats: 3 },
    { id: '1', title: 'Alpha', date: '2026-12-05T17:00:00Z', tiers: [{ priceCents: 100 }], availableSeats: 3 },
    { id: '3', title: 'No Price', date: '2026-12-06T17:00:00Z', tiers: [], availableSeats: 9 }
  ];
  assert.deepEqual(sortEvents(summaries, 'date').map((event) => event.id), ['1', '2', '3']);
  assert.deepEqual(sortEvents(summaries, 'price').map((event) => event.id), ['1', '2', '3']);
  assert.deepEqual(sortEvents(summaries, 'availability').map((event) => event.id), ['3', '1', '2']);
});

test('S05: search filters before sorting and rejects bad criteria', () => {
  const summaries = [
    { id: 'a', title: 'A', date: '2026-12-05', tiers: [{ priceCents: 100 }], availableSeats: 1 },
    { id: 'b', title: 'B', date: '2026-12-04', tiers: [{ priceCents: 200 }], availableSeats: 1 }
  ];
  assert.deepEqual(searchEvents(summaries, { maxPriceCents: 150 }, 'date').map((event) => event.id), ['a']);
  errorCode(() => filterEvents(summaries, { from: 'not-a-date' }), 'VALIDATION');
  errorCode(() => filterEvents(summaries, { from: '2026-02-30T17:00:00Z' }), 'VALIDATION');
  errorCode(() => filterEvents(summaries, { maxPriceCents: 1.2 }), 'VALIDATION');
  errorCode(() => sortEvents(summaries, 'unknown'), 'VALIDATION');
});

test('S05: sorting and filtering do not mutate the original list, including empty lists', () => {
  const summaries = [{ id: 'b', title: 'B', date: '2026-12-05', tiers: [], availableSeats: 0 }, { id: 'a', title: 'A', date: '2026-12-04', tiers: [], availableSeats: 0 }];
  const original = structuredClone(summaries);
  assert.deepEqual(sortEvents(summaries, 'date').map((event) => event.id), ['a', 'b']);
  assert.deepEqual(filterEvents(summaries, { q: 'B' }).map((event) => event.id), ['b']);
  assert.deepEqual(summaries, original);
  assert.deepEqual(filterEvents([], {}), []);
  assert.deepEqual(sortEvents([], 'date'), []);
});

test('mergeSort is stable, returns a new array and does not mutate input', () => {
  const items = [{ key: 1, order: 'first' }, { key: 1, order: 'second' }, { key: 0, order: 'third' }];
  const sorted = mergeSort(items, (left, right) => left.key - right.key);
  assert.notEqual(sorted, items);
  assert.deepEqual(sorted.map((item) => item.order), ['third', 'first', 'second']);
  assert.deepEqual(items.map((item) => item.order), ['first', 'second', 'third']);
});

test('S06: books published-event tickets with whole-cent pricing and remaining seats', () => {
  const store = createStore();
  const { event, tier } = buildEvent(store, { title: 'Published Event' });
  publishEvent(store, event.id);
  tier.available = 3;
  const booking = bookTickets(store, { eventId: event.id, tierId: tier.id, customerName: 'A', quantity: 2 });
  assert.equal(booking.status, 'PENDING');
  assert.equal(booking.totalCents, 1000000);
  assert.equal(tier.available, 1);
});

test('S06: rejects overselling without changing state', () => {
  const store = createStore();
  const { event, tier } = buildEvent(store);
  const before = { available: tier.available, bookings: store.bookings.size };
  errorCode(() => bookTickets(store, { eventId: event.id, tierId: tier.id, customerName: 'A', quantity: 101 }), 'VALIDATION');
  tier.available = 1;
  errorCode(() => bookTickets(store, { eventId: event.id, tierId: tier.id, customerName: 'A', quantity: 2 }), 'SOLD_OUT');
  assert.equal(tier.available, 1);
  assert.equal(store.bookings.size, before.bookings);
});

test('S06: rejects zero, negative, fractional and over-limit quantities', () => {
  const store = createStore();
  const { event, tier } = buildEvent(store);
  for (const quantity of [0, -1, 1.5, 11]) {
    errorCode(() => bookTickets(store, { eventId: event.id, tierId: tier.id, customerName: 'A', quantity }), 'VALIDATION');
  }
});

test('all existing domain error codes remain observable', () => {
  const store = createStore();
  const { event, tier } = buildEvent(store);
  tier.available = 0;
  errorCode(() => bookTickets(store, { eventId: event.id, tierId: tier.id, customerName: 'A', quantity: 1 }), 'SOLD_OUT');
  errorCode(() => bookTickets(store, { eventId: event.id, tierId: tier.id, customerName: 'A', quantity: 0 }), 'VALIDATION');
  errorCode(() => cancelBooking(store, 'missing'), 'NOT_FOUND');
  const cancellableStore = createStore();
  const { event: cancellableEvent, tier: cancellableTier } = buildEvent(cancellableStore);
  const booking = bookTickets(cancellableStore, {
    eventId: cancellableEvent.id,
    tierId: cancellableTier.id,
    customerName: 'A',
    quantity: 1
  });
  cancelBooking(cancellableStore, booking.reference);
  errorCode(() => cancelBooking(cancellableStore, booking.reference), 'ALREADY_CANCELLED');
});
