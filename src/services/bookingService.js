import { DomainError } from '../domain/errors.js';
import { assertTransition } from '../domain/bookingStateMachine.js';

function requireText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('VALIDATION', `${label} must be a non-empty string`);
  }
  return value.trim();
}

function requireQuantity(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 10) {
    throw new DomainError('VALIDATION', 'quantity must be between 1 and 10');
  }
  return value;
}

function requireRepository(repository) {
  if (!repository || typeof repository.getEvent !== 'function' || typeof repository.getBooking !== 'function') {
    throw new TypeError('booking repository is required');
  }
}

export function createBookingService(repository, paymentGateway) {
  requireRepository(repository);
  if (!paymentGateway || typeof paymentGateway.charge !== 'function') {
    throw new TypeError('payment gateway is required');
  }

  return {
    async book({ eventId, tierId, userId, quantity }) {
      const event = await repository.getEvent(requireText(eventId, 'eventId'));
      if (!event) throw new DomainError('NOT_FOUND', `Event ${eventId} was not found`);
      const tier = event.tiers.get(requireText(tierId, 'tierId'));
      if (!tier) throw new DomainError('NOT_FOUND', `Tier ${tierId} was not found`);
      const owner = requireText(userId, 'userId');
      const count = requireQuantity(quantity);
      if (tier.available < count) throw new DomainError('SOLD_OUT', `Not enough seats in ${tier.name}`);

      await repository.updateTier(event.id, tier.id, {
        available: tier.available - count,
        sold: tier.sold + count
      });
      return repository.createBooking({
        eventId: event.id,
        tierId: tier.id,
        userId: owner,
        quantity: count,
        totalCents: tier.priceCents * count,
        status: 'PENDING',
        createdAt: new Date().toISOString()
      });
    },

    async pay(reference, userId, options = {}) {
      const bookingReference = requireText(reference, 'reference');
      const owner = requireText(userId, 'userId');
      const booking = await repository.getBooking(bookingReference);
      if (!booking) throw new DomainError('NOT_FOUND', `Booking ${bookingReference} was not found`);
      if (booking.userId !== owner) throw new DomainError('FORBIDDEN', 'Only the booking owner can pay');
      if (booking.status !== 'PENDING') {
        assertTransition(booking.status.toLowerCase(), 'paid');
      }
      const result = await paymentGateway.charge({
        amountCents: booking.totalCents,
        decline: options.decline === true
      });
      if (!result.success) throw new DomainError('PAYMENT_DECLINED', 'Payment was declined');
      assertTransition(booking.status.toLowerCase(), 'paid');
      return repository.updateBooking(booking.reference, { status: 'PAID', paidAt: new Date().toISOString() });
    },

    async cancel(reference, userId) {
      const bookingReference = requireText(reference, 'reference');
      const owner = requireText(userId, 'userId');
      const booking = await repository.getBooking(bookingReference);
      if (!booking) throw new DomainError('NOT_FOUND', `Booking ${bookingReference} was not found`);
      if (booking.userId !== owner) throw new DomainError('FORBIDDEN', 'Only the booking owner can cancel');
      if (booking.status !== 'PENDING') {
        throw new DomainError('INVALID_TRANSITION', `Booking cannot transition from ${booking.status.toLowerCase()} to cancelled`);
      }

      const event = await repository.getEvent(booking.eventId);
      const tier = event?.tiers.get(booking.tierId);
      if (!tier) throw new DomainError('NOT_FOUND', 'Booking tier was not found');
      await repository.updateTier(event.id, tier.id, {
        available: tier.available + booking.quantity,
        sold: tier.sold - booking.quantity
      });
      return repository.updateBooking(booking.reference, {
        status: 'CANCELLED',
        cancelledAt: new Date().toISOString()
      });
    }
  };
}
