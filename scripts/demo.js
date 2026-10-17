import {
  addTier,
  bookTickets,
  cancelBooking,
  createEvent,
  createStore,
  joinWaitlist
} from '../src/domain/inventory.js';
import { DomainError } from '../src/domain/errors.js';

const store = createStore();
const event = createEvent(store, { name: 'Terminal Summer Festival', date: '2026-07-18' });
const tier = addTier(store, event, { name: 'General Admission', capacity: 2, priceCents: 2500 });

console.log(`Event: ${event.name}`);
console.log(`Tickets available: ${tier.available}`);

const firstBooking = bookTickets(store, {
  eventId: event.id,
  tierId: tier.id,
  customerName: 'Amina',
  quantity: 2
});
console.log(`${firstBooking.customerName} booked ${firstBooking.quantity} tickets (${firstBooking.reference}).`);

try {
  bookTickets(store, {
    eventId: event.id,
    tierId: tier.id,
    customerName: 'Daniel',
    quantity: 1
  });
} catch (error) {
  if (!(error instanceof DomainError) || error.code !== 'SOLD_OUT') {
    throw error;
  }
  console.log('Daniel tried to book, but the event is sold out.');
}

const firstWaiter = joinWaitlist(store, {
  eventId: event.id,
  tierId: tier.id,
  customerName: 'Daniel',
  quantity: 1
});
const secondWaiter = joinWaitlist(store, {
  eventId: event.id,
  tierId: tier.id,
  customerName: 'Priya',
  quantity: 1
});
console.log(`${firstWaiter.customerName} joined the waitlist.`);
console.log(`${secondWaiter.customerName} joined the waitlist.`);

cancelBooking(store, firstBooking.reference);
console.log(`${firstBooking.customerName} cancelled; ${tier.available} ticket is now available.`);
const nextInLine = tier.waitlist.dequeue();
console.log(`Next in line: ${nextInLine.customerName} (${nextInLine.quantity} ticket).`);
