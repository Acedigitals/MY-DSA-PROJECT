# Event Ticketing architecture

This document describes the project as it exists at the end of Build 4. The
application is a plain JavaScript ES-module project for Node.js 22.13 or
newer. It uses an in-memory repository and a working REST API.

## Project structure

```text
src/
├── config.js                         PORT configuration
├── server.js                         Node HTTP server entry point
├── repositories/
│   └── memory.js                     async in-memory repository
├── services/
│   ├── eventService.js               event rules and search use cases
│   └── bookingService.js             booking and payment use cases
├── lib/
│   └── mockPaymentGateway.js         mock payment adapter
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
  App --> Routes[API routes]
  Routes --> Services[Application services]
  Services --> Rules[src/domain rules]
  Services --> Repository[Async memory repository]
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
- **Application services (`src/services/`)** coordinate API use cases and call
  domain rules and repositories; they do not know HTTP details.
- **Domain rules (`src/domain/`)** validate input and enforce inventory,
  searching, sorting, queue, error, and booking-state rules; they must not
  depend on HTTP.
- **Repository/data (`src/repositories/memory.js`)** provides async event,
  tier, and booking operations over in-memory `Map` objects. It does not own
  business policy.

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
- Build 4 identifies callers with the `x-user-id` request header; it does not
  yet implement accounts or authentication.

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

## HTTP behavior delivered in Build 4

| Request | Current result |
|---|---|
| `GET /` | Serves `public/index.html` |
| `GET /health` | Returns `{"status":"ok"}` |
| `POST /api/events` | Creates a draft event |
| `POST /api/events/:id/tiers` | Adds a ticket tier |
| `POST /api/events/:id/publish` | Publishes an event |
| `GET /api/events` | Searches published events |
| `POST /api/bookings` | Creates a pending booking |
| `POST /api/bookings/:reference/pay` | Pays with the mock gateway |
| `POST /api/bookings/:reference/cancel` | Cancels an unpaid booking |
| Unknown `/api/...` path | JSON `404` with `{ "error": { "code", "message" } }` |
| Invalid JSON request body | JSON `400` with the same error shape |
| Missing public file | JSON `404` |
| Path attempting to escape `public/` | Rejected with JSON `404` |

All unexpected server errors return a generic JSON `500` response. Stack
traces are not sent to clients.
