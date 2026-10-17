import { performance } from 'node:perf_hooks';
import { createStore } from '../src/domain/inventory.js';

const store = createStore();

for (let index = 0; index < 100000; index += 1) {
  const booking = { reference: `BK-${index}` };
  store.bookings.set(booking.reference, booking);
}

const bookings = [...store.bookings.values()];
const targetReference = bookings.at(-1).reference;
const iterations = 100;

let start = performance.now();
for (let index = 0; index < iterations; index += 1) {
  store.bookings.get(targetReference);
}
const mapMilliseconds = performance.now() - start;

start = performance.now();
for (let index = 0; index < iterations; index += 1) {
  bookings.find((booking) => booking.reference === targetReference);
}
const arrayMilliseconds = performance.now() - start;

console.log(`Map.get:     ${mapMilliseconds.toFixed(3)} ms`);
console.log(`Array.find:  ${arrayMilliseconds.toFixed(3)} ms`);
console.log('Map lookup is O(1) on average; Array.find is O(n).');
