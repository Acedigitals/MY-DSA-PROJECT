# Build 3 architecture

## Layers

```mermaid
flowchart TD
  Routes[Routes] --> Services[Services]
  Services --> Rules[Domain rules]
  Services --> Repositories[Repositories]
  Repositories --> Data[(Data)]
```

- **Routes** may translate HTTP requests and responses, but may not contain business rules or access data directly.
- **Services** may coordinate use cases and call rules and repositories, but may not know HTTP details.
- **Rules** may enforce domain invariants, but may not call routes, services, or repositories.
- **Repositories** may load and store data, but may not decide business policy or call upward layers.
- **Data** may hold persisted state, but may not depend on application layers.

## Data model

```mermaid
erDiagram
  EVENTS ||--o{ TICKET_TIERS : has
  EVENTS ||--o{ BOOKINGS : receives
  USERS ||--o{ BOOKINGS : makes
  TICKET_TIERS ||--o{ BOOKINGS : contains
  EVENTS {
    string id
    string title
    string date
    string status
  }
  TICKET_TIERS {
    string id
    string event_id
    integer capacity
    integer price_cents
  }
  BOOKINGS {
    string id
    string user_id
    string tier_id
    string state
    integer quantity
  }
  USERS {
    string id
    string name
    string email
  }
```

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
