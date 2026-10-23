import { DomainError } from './errors.js';

export const BOOKING_STATES = Object.freeze({
  PENDING: 'pending',
  PAID: 'paid',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  CHECKED_IN: 'checked_in'
});

const transitions = new Map([
  ['pending', new Set(['paid', 'cancelled'])],
  ['paid', new Set(['checked_in', 'refunded', 'cancelled'])],
  ['cancelled', new Set()],
  ['refunded', new Set()],
  ['checked_in', new Set()]
]);

export function canTransition(from, to) {
  return transitions.has(from) && transitions.has(to) && transitions.get(from).has(to);
}

export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new DomainError(
      'INVALID_TRANSITION',
      `Booking cannot transition from ${from} to ${to}`
    );
  }
  return true;
}
