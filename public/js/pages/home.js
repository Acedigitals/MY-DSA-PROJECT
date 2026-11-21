import { listEvents } from '../api.js';
import { el, formatDate, formatPrice } from '../ui.js';

const list = document.querySelector('#event-list');
const status = document.querySelector('#results-status');
const form = document.querySelector('#filters');

function eventCard(event) {
  const available = event.availableSeats > 0;
  return el('article', { className: 'event-card card' }, [
    el('div', { className: 'event-card-top' }, [
      el('span', { className: 'eyebrow', textContent: event.city }),
      el('span', { className: available ? 'availability' : 'sold-out', textContent: available ? `${event.availableSeats} seats left` : 'Sold out' })
    ]),
    el('h2', { textContent: event.title }),
    el('p', { className: 'muted', textContent: `${formatDate(event.date)} · ${event.venue}` }),
    el('p', { className: 'price', textContent: `From ${formatPrice(event.cheapestPriceCents)}` }),
    el('a', { className: 'button', href: `/event.html?id=${encodeURIComponent(event.id)}`, textContent: 'View event' })
  ]);
}

async function render(criteria = {}, sortBy = 'date') {
  status.textContent = 'Loading events...';
  try {
    const events = await listEvents(criteria, sortBy);
    list.replaceChildren(...events.map(eventCard));
    status.textContent = `${events.length} event${events.length === 1 ? '' : 's'} found`;
    if (events.length === 0) {
      list.append(el('p', { className: 'empty-state', textContent: 'No events match those filters.' }));
    }
  } catch (error) {
    status.textContent = error.message;
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const maxPrice = data.get('maxPrice');
  render({
    q: data.get('query')?.trim() || undefined,
    city: data.get('city')?.trim() || undefined,
    maxPriceCents: maxPrice === '' ? undefined : Number(maxPrice) * 100
  }, data.get('sort'));
});

render();
