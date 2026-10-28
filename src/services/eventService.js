import { DomainError } from '../domain/errors.js';
import { filterEvents, sortEvents } from '../domain/eventSearch.js';

function requireObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError('VALIDATION', `${label} must be an object`);
  }
}

function requireText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('VALIDATION', `${label} must be a non-empty string`);
  }
  return value.trim();
}

function requireDate(value) {
  const date = requireText(value, 'date');
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(date);
  if ((!dateOnly && !date.includes('T')) || Number.isNaN(Date.parse(date))) {
    throw new DomainError('VALIDATION', 'date must be a valid ISO date');
  }
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  const checked = new Date(Date.UTC(year, month - 1, day));
  if (checked.getUTCFullYear() !== year || checked.getUTCMonth() !== month - 1 || checked.getUTCDate() !== day) {
    throw new DomainError('VALIDATION', 'date must be a valid ISO date');
  }
  return date;
}

function requireCents(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainError('VALIDATION', 'priceCents must be whole cents');
  }
  return value;
}

function requireCapacity(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new DomainError('VALIDATION', 'capacity must be a positive integer');
  }
  return value;
}

function requireRepository(repository) {
  if (!repository || typeof repository.getEvent !== 'function') {
    throw new TypeError('event repository is required');
  }
}

function summary(event) {
  const tiers = [...event.tiers.values()];
  return {
    id: event.id,
    title: event.title,
    city: event.city,
    venue: event.venue,
    date: event.date,
    status: event.status,
    tiers,
    cheapestPriceCents: tiers.length === 0 ? null : Math.min(...tiers.map((tier) => tier.priceCents)),
    availableSeats: tiers.reduce((total, tier) => total + tier.available, 0)
  };
}

export function createEventService(repository) {
  requireRepository(repository);
  return {
    async create(details) {
      requireObject(details, 'event details');
      return repository.createEvent({
        title: requireText(details.title, 'title'),
        city: requireText(details.city, 'city'),
        venue: requireText(details.venue, 'venue'),
        date: requireDate(details.date)
      });
    },

    async addTier(eventId, details) {
      requireText(eventId, 'eventId');
      requireObject(details, 'tier details');
      if (!await repository.getEvent(eventId)) {
        throw new DomainError('NOT_FOUND', `Event ${eventId} was not found`);
      }
      return repository.createTier(eventId, {
        name: requireText(details.name, 'name'),
        priceCents: requireCents(details.priceCents),
        capacity: requireCapacity(details.capacity)
      });
    },

    async publish(eventId) {
      const event = await repository.getEvent(requireText(eventId, 'eventId'));
      if (!event) throw new DomainError('NOT_FOUND', `Event ${eventId} was not found`);
      if (event.tiers.size === 0) {
        throw new DomainError('INVALID_STATE', 'An event must have at least one ticket tier before publishing');
      }
      return repository.updateEvent(event.id, { status: 'PUBLISHED' });
    },

    async search(criteria = {}, sortBy = 'date') {
      const events = (await repository.listEvents()).map(summary);
      const visible = events.filter((event) => event.status === 'PUBLISHED');
      return sortEvents(filterEvents(visible, criteria), sortBy);
    }
  };
}
