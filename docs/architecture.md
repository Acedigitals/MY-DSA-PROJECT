# Event Ticketing architecture

This document describes the project as it exists at the end of Build 3. The
application is a plain JavaScript ES-module project for Node.js 22.13 or
newer. It currently uses an in-memory store and has a server skeleton; the
business API routes will be added in later builds.

## Project structure

```text
src/
├── config.js                         PORT configuration
├── server.js                         Node HTTP server entry point
├── domain/
│   ├── errors.js                     DomainError and error codes
│   ├── ids.js                        secure IDs and booking references
│   ├── waitlistQueue.js              linked-list FIFO queue
│   ├── inventory.js                  events, tiers, bookings, and waitlists
│   ├── sorting.js                    stable merge sort
│   ├── eventSearch.js                pure event filtering and sorting
│   └── bookingStateMachine.js        booking lifecycle rules
└── http/
    ├── router.js                     method and parameter route matching
    └── app.js                        HTTP responses and static files

public/
└── index.html                         current static landing page
```

## Layers and current request flow

```mermaid
flowchart TD
  Browser[Browser or HTTP client] --> Server[src/server.js]
  Server --> App[src/http/app.js]
  App --> Router[src/http/router.js]
  Router --> Health[GET /health]
  App --> Static[public/index.html and other public files]
  App --> Errors[JSON error responses]
  App -. future API routes .-> Routes[Application routes]
  Routes -. future use cases .-> Services[Application services]
  Services -. future domain calls .-> Rules[src/domain rules]
  Services -. future persistence .-> Repository[Repository layer]
  Rules --> Inventory[src/domain/inventory.js]
  Rules --> Search[src/domain/eventSearch.js]
  Rules --> StateMachine[src/domain/bookingStateMachine.js]
  Inventory --> Store[(In-memory Maps and Queue objects)]
```

- **HTTP entry point (`src/server.js`)** starts `node:http` with the configured
  port; it may start the server but may not contain business rules.
- **HTTP application and routes (`src/http/app.js` and `router.js`)** parse
  requests, match methods and `:params`, serve `public/`, and format responses;
  they may not decide ticket, booking, or payment policy.
- **Application services** are planned for a later build; they will coordinate
  use cases without knowing HTTP details.
- **Domain rules (`src/domain/`)** validate input and enforce inventory,
  searching, sorting, queue, error, and booking-state rules; they must not
  depend on HTTP.
- **Repositories/data** are currently represented by `createStore()` in
  `src/domain/inventory.js`, using `Map` for events and bookings and a linked
  queue for tier waitlists. A persistent repository is planned for a later
  build.

## Data model

```mermaid
erDiagram
  EVENT ||--o{ TICKET_TIER : has
  EVENT ||--o{ BOOKING : receives
  EVENT ||--o{ WAITLIST_ENTRY : offers
  TICKET_TIER ||--o{ BOOKING : contains
  TICKET_TIER ||--o{ WAITLIST_ENTRY : queues
  EVENT {
    string id
    string title
    string city
    string venue
    string date
    string status
  }
  TICKET_TIER {
    string id
    string event_id
    string name
    integer capacity
    integer sold
    integer available
    integer price_cents
  }
  BOOKING {
    string id
    string reference
    string event_id
    string tier_id
    string user_id
    string customer_name
    integer quantity
    integer total_cents
    string status
  }
  USER ||--o{ BOOKING : makes
  USER {
    string id
    string name
    string email
  }
  WAITLIST_ENTRY {
    string id
    string event_id
    string tier_id
    string customer_name
    integer quantity
    string joined_at
  }
```

### Current data behavior

- `createStore()` creates in-memory `Map` objects for events and bookings.
- Events begin as `DRAFT` and become `PUBLISHED` through `publishEvent()`.
- Ticket tiers store money as whole `priceCents` and track `capacity`, `sold`,
  and `available`.
- `bookTickets()` creates `PENDING` bookings and stores them by reference for
  O(1)-average lookup with `Map.get()`.
- `cancelBooking()` releases the seats and rejects a second cancellation.
- Each tier has a linked-list `Queue` for FIFO waitlist entries.
- There is not yet a user or authentication model; `customerName` is the
  current booking identity. Users are planned for a later build.

## Booking life cycle

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> paid
  pending --> cancelled
  paid --> checked_in
  paid --> refunded
  paid --> cancelled
  cancelled --> [*]
  refunded --> [*]
  checked_in --> [*]
```

The lifecycle is represented as data in
`src/domain/bookingStateMachine.js`. `canTransition(from, to)` returns whether
a move is allowed, while `assertTransition(from, to)` throws a
`DomainError` with `INVALID_TRANSITION` for an illegal move. `cancelled`,
`refunded`, and `checked_in` are final states.

The current Build 1/2 inventory implementation still uses the booking status
values `PENDING`, `CONFIRMED`, and `CANCELLED`; the state machine provides the
lowercase lifecycle contract that later payment, refund, expiry, and
check-in services will adopt.

## HTTP behavior delivered in Build 3

| Request | Current result |
|---|---|
| `GET /` | Serves `public/index.html` |
| `GET /health` | Returns `{"status":"ok"}` |
| Unknown `/api/...` path | JSON `404` with `{ "error": { "code", "message" } }` |
| Invalid JSON request body | JSON `400` with the same error shape |
| Missing public file | JSON `404` |
| Path attempting to escape `public/` | Rejected with JSON `404` |

All unexpected server errors return a generic JSON `500` response. Stack
traces are not sent to clients.
