# AI log

## Build 1: Domain core in the terminal

### Prompt 1: Build 1 domain implementation

- **What I asked:**  
  I asked the AI to read `README.md` and `docs/build-1.md`, then create the Build 1 domain core in plain JavaScript ES modules for Node 22.13 or newer, with no outside packages. The requested work included:
  - a `DomainError` class with machine-readable error codes;
  - cryptographically generated IDs and readable booking references;
  - a linked-list FIFO queue with private fields and O(1) operations;
  - in-memory event, tier, booking, cancellation, lookup, and waitlist operations;
  - whole-cent money handling and input validation;
  - an event-ticketing demo;
  - a `Map.get` versus `Array.find` benchmark;
  - `"type": "module"` and `demo` and `benchmark` scripts in `package.json`.

- **What came back:**  
  The AI created:
  - `package.json`;
  - `src/domain/errors.js`;
  - `src/domain/ids.js`;
  - `src/domain/waitlistQueue.js`;
  - `src/domain/inventory.js`;
  - `scripts/demo.js`;
  - `scripts/benchmark-lookup.js`.

  The implementation uses `Map` for events and bookings, a linked-list queue for waitlists, `node:crypto` for IDs, whole cents for prices, and `DomainError` codes such as `VALIDATION`, `NOT_FOUND`, `SOLD_OUT`, and `ALREADY_CANCELLED`.

- **What was wrong:**  
  The first benchmark implementation created 100,000 complete bookings during setup and took too long to reach the lookup comparison. That setup measured cryptographic ID generation and domain object creation in addition to lookup performance.

- **What I changed:**  
  I changed the benchmark to use prebuilt booking records in the store, so it measures lookup operations more directly. The benchmark also initially used 10,000 repetitions over 100,000 records, which caused an unnecessarily large number of `Array.find` comparisons. I reduced the repetitions to 100 while preserving the O(1) versus O(n) comparison.

### Prompt 2: Validation and review

- **What I asked:**  
  I asked the AI to run the demo, run the benchmark, check JavaScript syntax, and verify the important inventory invariants: FIFO queue behavior, failed bookings leaving inventory and booking maps unchanged, booking lookup by reference, cancellation releasing seats, and double cancellation producing an error.

- **What came back:**  
  The demo showed:
  - an event selling out;
  - a booking being refused with `SOLD_OUT`;
  - two people joining the waitlist;
  - a booking being cancelled;
  - the first waitlisted person being named.

  The invariant checks passed. Syntax checks passed. The final benchmark showed:

  ```text
  Map.get:     0.048 ms
  Array.find:  1355.694 ms
  Map lookup is O(1) on average; Array.find is O(n).
  ```

- **What was wrong:**  
  Nothing remained wrong with the Build 1 implementation after the benchmark setup was corrected.

- **What I changed:**  
  I recorded the validation results here and confirmed that the implementation satisfies the Build 1 requirements. One design choice remains explicit: cancelling a booking releases its seats but does not automatically create a booking for the waitlist. The demo dequeues and names the next person in line, matching the requested Build 1 story.
