import { DomainError } from './errors.js';
import { mergeSort } from './sorting.js';

function requireSummaries(summaries) {
  if (!Array.isArray(summaries)) {
    throw new DomainError('VALIDATION', 'summaries must be an array');
  }
}

function parseDate(value, label, endOfDay = false) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('VALIDATION', `${label} must be an ISO date`);
  }
  const date = value.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(date);
  if ((!dateOnly && !date.includes('T')) || Number.isNaN(Date.parse(date))) {
    throw new DomainError('VALIDATION', `${label} must be a valid ISO date`);
  }
  const timestamp = dateOnly && endOfDay ? Date.parse(`${date}T23:59:59.999Z`) : Date.parse(date);
  const parsedDate = new Date(timestamp);
  if (parsedDate.getUTCFullYear() !== Number(date.slice(0, 4))
    || parsedDate.getUTCMonth() !== Number(date.slice(5, 7)) - 1
    || parsedDate.getUTCDate() !== Number(date.slice(8, 10))) {
    throw new DomainError('VALIDATION', `${label} must be a valid ISO date`);
  }
  return timestamp;
}

function cheapestPrice(summary) {
  if (Number.isSafeInteger(summary.cheapestPriceCents)) {
    return summary.cheapestPriceCents;
  }
  if (!Array.isArray(summary.tiers) || summary.tiers.length === 0) {
    return null;
  }
  return Math.min(...summary.tiers.map((tier) => tier.priceCents));
}

function titleOf(summary) {
  return String(summary.title ?? summary.name ?? '');
}

export function filterEvents(summaries, criteria = {}) {
  requireSummaries(summaries);
  if (criteria === null || typeof criteria !== 'object' || Array.isArray(criteria)) {
    throw new DomainError('VALIDATION', 'criteria must be an object');
  }

  if (criteria.q !== undefined && typeof criteria.q !== 'string') {
    throw new DomainError('VALIDATION', 'q must be a string');
  }
  if (criteria.city !== undefined && typeof criteria.city !== 'string') {
    throw new DomainError('VALIDATION', 'city must be a string');
  }
  const q = criteria.q === undefined ? null : criteria.q.toLocaleLowerCase();
  const city = criteria.city === undefined ? null : criteria.city.toLocaleLowerCase();
  const from = criteria.from === undefined ? null : parseDate(criteria.from, 'from');
  const to = criteria.to === undefined ? null : parseDate(criteria.to, 'to', true);
  const maxPrice = criteria.maxPriceCents === undefined ? null : criteria.maxPriceCents;
  if (maxPrice !== null && (!Number.isSafeInteger(maxPrice) || maxPrice < 0)) {
    throw new DomainError('VALIDATION', 'maxPriceCents must be a whole number');
  }
  if (criteria.onlyAvailable !== undefined && typeof criteria.onlyAvailable !== 'boolean') {
    throw new DomainError('VALIDATION', 'onlyAvailable must be a boolean');
  }

  return summaries.filter((summary) => {
    const title = titleOf(summary).toLocaleLowerCase();
    const venue = String(summary.venue ?? '').toLocaleLowerCase();
    if (q !== null && !title.includes(q) && !venue.includes(q)) return false;
    if (city !== null && String(summary.city ?? '').toLocaleLowerCase() !== city) return false;
    const eventDate = parseDate(summary.date, 'event date');
    if (from !== null && eventDate < from) return false;
    if (to !== null && eventDate > to) return false;
    const price = cheapestPrice(summary);
    if (maxPrice !== null && (price === null || price > maxPrice)) return false;
    if (criteria.onlyAvailable === true && summary.availableSeats <= 0) return false;
    return true;
  });
}

export function sortEvents(summaries, sortBy) {
  requireSummaries(summaries);
  if (!['date', 'price', 'availability'].includes(sortBy)) {
    throw new DomainError('VALIDATION', 'sortBy must be date, price, or availability');
  }

  const compareText = (left, right) => {
    const titleComparison = titleOf(left).localeCompare(titleOf(right));
    return titleComparison || String(left.id).localeCompare(String(right.id));
  };
  const compare = (left, right) => {
    let result = 0;
    if (sortBy === 'date') {
      result = parseDate(left.date, 'event date') - parseDate(right.date, 'event date');
    } else if (sortBy === 'price') {
      const leftPrice = cheapestPrice(left);
      const rightPrice = cheapestPrice(right);
      if (leftPrice === null && rightPrice !== null) return 1;
      if (leftPrice !== null && rightPrice === null) return -1;
      result = (leftPrice ?? 0) - (rightPrice ?? 0);
    } else {
      result = Number(right.availableSeats) - Number(left.availableSeats);
    }
    return result || compareText(left, right);
  };
  return mergeSort(summaries, compare);
}

export function searchEvents(summaries, criteria = {}, sortBy) {
  const filtered = filterEvents(summaries, criteria);
  return sortBy === undefined ? filtered : sortEvents(filtered, sortBy);
}
