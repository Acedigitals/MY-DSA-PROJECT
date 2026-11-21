import { createBooking, getEvent, pay } from '../api.js';
import { el, formatDate, formatPrice } from '../ui.js';

const details = document.querySelector('#event-details');
const checkout = document.querySelector('#checkout');
const status = document.querySelector('#event-status');
const eventId = new URLSearchParams(location.search).get('id');
let currentBooking;
let countdownTimer;

function startCountdown() {
  const end = Date.now() + 10 * 60 * 1000;
  const timer = checkout.querySelector('[data-countdown]');
  const update = () => {
    const seconds = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    timer.textContent = `Seats held for ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    if (seconds === 0) clearInterval(countdownTimer);
  };
  update();
  countdownTimer = setInterval(update, 1000);
}

function renderCheckout(booking) {
  currentBooking = booking;
  checkout.hidden = false;
  checkout.replaceChildren(
    el('h2', { textContent: 'Checkout' }),
    el('p', { className: 'countdown', 'data-countdown': '', role: 'timer' }),
    el('p', { textContent: `${booking.quantity} ticket${booking.quantity === 1 ? '' : 's'} · ${formatPrice(booking.totalCents)}` }),
    el('p', { className: 'muted', textContent: `Booking reference: ${booking.reference}` }),
    el('form', { className: 'checkout-form', onsubmit: handlePayment }, [
      el('div', { className: 'field' }, [
        el('label', { for: 'card-number', textContent: 'Mock card number' }),
        el('input', { id: 'card-number', name: 'cardNumber', inputmode: 'numeric', autocomplete: 'cc-number', required: '', placeholder: 'Any value is accepted' })
      ]),
      el('label', { className: 'checkbox-label' }, [
        el('input', { type: 'checkbox', name: 'decline' }),
        ' Simulate a declined card'
      ]),
      el('p', { className: 'form-error', id: 'payment-error', role: 'alert' }),
      el('button', { className: 'button', type: 'submit', textContent: 'Pay with mock card' })
    ])
  );
  startCountdown();
  checkout.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function handlePayment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const error = form.querySelector('#payment-error');
  error.textContent = '';
  try {
    const data = new FormData(form);
    const paid = await pay(currentBooking.reference, { decline: data.get('decline') === 'on' });
    clearInterval(countdownTimer);
    checkout.replaceChildren(
      el('h2', { textContent: 'Payment complete' }),
      el('p', { className: 'success', textContent: `Booking ${paid.reference} is confirmed.` }),
      el('a', { className: 'button button-secondary', href: '/', textContent: 'Browse more events' })
    );
  } catch (paymentError) {
    error.textContent = `${paymentError.message}. You can try again.`;
  }
}

function tierCard(event, tier) {
  const soldOut = tier.available === 0;
  const quantityId = `quantity-${tier.id}`;
  const form = el('form', { className: 'tier-card', onsubmit: (submitEvent) => handleBooking(submitEvent, event, tier) }, [
    el('div', { className: 'tier-heading' }, [
      el('h3', { textContent: tier.name }),
      el('span', { className: soldOut ? 'sold-out' : 'availability', textContent: soldOut ? 'Sold out' : `${tier.available} seats left` })
    ]),
    el('p', { className: 'price', textContent: formatPrice(tier.priceCents) }),
    el('div', { className: 'field' }, [
      el('label', { for: quantityId, textContent: 'Quantity' }),
      el('input', { id: quantityId, type: 'number', name: 'quantity', min: '1', max: String(Math.min(10, tier.available)), value: soldOut ? '0' : '1', disabled: soldOut ? '' : undefined, required: '' })
    ]),
    el('button', { className: 'button', type: 'submit', disabled: soldOut ? '' : undefined, textContent: soldOut ? 'Sold out' : 'Book tickets' })
  ]);
  return form;
}

async function handleBooking(event, eventData, tier) {
  event.preventDefault();
  const quantity = Number(new FormData(event.currentTarget).get('quantity'));
  try {
    const booking = await createBooking({ eventId: eventData.id, tierId: tier.id, quantity });
    renderCheckout(booking);
    status.textContent = '';
  } catch (error) {
    status.textContent = error.message;
  }
}

async function render() {
  if (!eventId) {
    status.textContent = 'No event was selected.';
    return;
  }
  try {
    const eventData = await getEvent(eventId);
    document.title = `${eventData.title} | Event Ticketing`;
    details.replaceChildren(
      el('section', { className: 'event-hero' }, [
        el('p', { className: 'eyebrow', textContent: `${eventData.city} · ${eventData.venue}` }),
        el('h1', { textContent: eventData.title }),
        el('p', { className: 'muted', textContent: formatDate(eventData.date) })
      ]),
      el('section', { className: 'tiers-section' }, [
        el('h2', { textContent: 'Choose your tickets' }),
        el('div', { className: 'tier-grid' }, eventData.tiers.map((tier) => tierCard(eventData, tier)))
      ])
    );
  } catch (error) {
    status.textContent = error.message;
  }
}

render();
