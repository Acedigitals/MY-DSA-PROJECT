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

## Build 2: Event search, sorting and first tests

### Prompt 1: Build 2 implementation

- **What I asked:**
  I asked the AI to read `README.md`, `docs/user-stories.md`, `docs/build-2.md`, and all existing domain files, then add stable non-mutating merge sort, event publishing and summaries, pure event filtering and sorting, acceptance-criterion tests, and an `npm test` script without breaking Build 1.

- **What came back:**
  The AI added `src/domain/sorting.js`, `src/domain/eventSearch.js`, and `test/build-2.test.js`; extended `inventory.js` with publishing and summaries; added Build 2 event fields and draft/published state; and added the `test` script to `package.json`.

- **What was wrong:**
  The supplied S04 section said that three publishing criteria should be written in class, but it contained only a placeholder. Also, Build 1 bookings were marked `CONFIRMED`, while the Build 2 S06 criterion requires new bookings to be `PENDING`.

- **What I changed:**
  I documented three concrete S04 publishing criteria in `docs/build-2.md`, created a separate test for each criterion, and changed new bookings to `PENDING` while keeping cancellation valid for both pending and confirmed bookings. I also verified that the merge sort does not call `Array.prototype.sort`, that input lists remain unchanged, and that the original demo and benchmark still pass.

### Prompt 2: Build 2 review and release check

- **What I asked:**
  I asked the AI to review the complete codebase against the exact Build 1 and Build 2 requirements, run all required commands, check the test suite, and confirm whether the files were ready to push to GitHub.

- **What came back:**
  The AI confirmed that Build 1 was complete and that the Build 2 implementation covered the supplied S02, S03, S04, S05, S06, and S16 criteria. The initial review showed 17 passing tests, and the Build 1 demo and benchmark still worked.

- **What was wrong:**
  A real date-validation bug was found. JavaScript normalised invalid date-times such as `2026-02-30T17:00:00Z` instead of rejecting them. Both event creation and event search accepted this invalid date, even though the requirements say dates must be valid ISO dates and invalid dates must produce `VALIDATION`.

  The review also identified that the broader S04 story title mentions unpublishing, but the supplied Build 2 prompt and the three written S04 acceptance criteria only require publishing and hiding drafts. No `unpublishEvent` function was added because it was not part of the exact implementation request or written criteria.

- **What I changed:**
  I added strict calendar-date validation to `src/domain/inventory.js` and `src/domain/eventSearch.js`, including date-times. Invalid dates such as `2026-02-30T17:00:00Z` now throw a `DomainError` with code `VALIDATION`. I added regression tests for the invalid date-time case, reran the complete suite, and confirmed that all 17 tests pass. I also confirmed that `npm run demo`, `npm run benchmark`, and `git diff --check` pass.

  ## Build 3: Architecture, state machine and server skeleton

  ### Prompt 1: Build 3 implementation

  - **What I asked:**
    I asked the AI to read the project requirements and existing domain code, then add the layered architecture diagrams, booking state machine, HTTP router, static-file server, configuration, start script and Build 3 tests without changing the working Build 1/2 behavior.

  - **What came back:**
    The AI added the architecture documentation, explicit booking transitions, a parameter-aware router, a `node:http` application with `/health`, JSON error responses and safe static-file serving, a configurable server entry point, a public index file, and tests for the state machine, router and real HTTP requests.

  - **What was wrong:**
    Nothing remained wrong after review. The only implementation choice worth recording is that the Build 3 skeleton does not add business endpoints; it provides the requested health endpoint and infrastructure for later API builds.

  - **What I changed:**
    I ran the complete test suite, which passed all 22 tests, including the existing Build 1/2 tests. I also started the server on a temporary port and verified that `GET /health` returned HTTP 200 with `{"status":"ok"}`. The malformed JSON and unknown API tests confirmed that responses contain structured errors without stack traces.

  ### Prompt 2: Cross-build alignment review

  - **What I asked:**
    I asked the AI to check the complete repository against the Build 1, Build 2 and Build 3 requirements and run the relevant regression and server checks.

  - **What came back:**
    The tests, demo, benchmark, live health endpoint, static file serving, API 404 handling and traversal protection all worked.

  - **What was wrong:**
    Two small Build 3 alignment issues were identified during review: `canTransition` treated unknown states as validation errors instead of returning `false`, and requesting `/` did not serve the public index file.

  - **What I changed:**
    I changed `canTransition` to return `false` for unknown or unsupported transitions, while `assertTransition` consistently throws `INVALID_TRANSITION`. I also mapped `/` to `public/index.html` and added a regression assertion. The complete suite still passes all 22 tests.

    ## Build 4: Working REST API in memory

    ### Prompt 1: Build 4 implementation

    - **What I asked:**
      I asked the AI to read the Build 4 requirements, architecture, and existing source, then add an async in-memory repository, injected event and booking services, a mock payment gateway, REST routes, API examples, and real HTTP API tests without breaking Builds 1–3.

    - **What came back:**
      The project now has `src/repositories/memory.js`, event and booking services, a mock payment adapter, API routes for events, tiers, publishing, searching, booking, payment, and cancellation, Build 4 curl examples, and end-to-end tests that start a real server on a free port.

    - **What was wrong:**
      The first draft of the Build 4 test helper used asynchronous import syntax inside a non-async Promise callback. The first cancellation implementation also needed to enforce Build 4's unpaid-only rule rather than relying on the broader state machine transition list.

    - **What I changed:**
      I corrected the test helper to use a normal `node:http` import and changed paid bookings to be rejected when cancellation is requested. The API now keeps declined payments pending, checks booking ownership through `x-user-id`, and returns the shared JSON error shape.

    - **Validation:**
      `npm test` passes all 24 tests, including the existing Build 1–3 tests and the Build 4 real-server API tests.
