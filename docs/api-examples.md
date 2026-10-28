Invoke-WebRequest http://localhost:3000/api/unknown# Build 4 API examples

Set the server URL and caller identity before running the examples:

```bash
BASE=http://localhost:3000
USER_ID=attendee-1
```

## 1. Create an event

```bash
curl -X POST "$BASE/api/events" \
  -H "content-type: application/json" \
  -d '{"title":"Lagos Tech Meetup","city":"Lagos","venue":"Civic Hall","date":"2026-12-05T17:00:00Z"}'
```

Save the returned event `id` as `EVENT_ID`.

## 2. Add a ticket tier

```bash
curl -X POST "$BASE/api/events/$EVENT_ID/tiers" \
  -H "content-type: application/json" \
  -d '{"name":"General","priceCents":500000,"capacity":100}'
```

Save the returned tier `id` as `TIER_ID`.

## 3. Publish the event

```bash
curl -X POST "$BASE/api/events/$EVENT_ID/publish"
```

## 4. Search published events

```bash
curl "$BASE/api/events?q=tech&city=lagos&sortBy=date"
```

## 5. Book tickets

```bash
curl -X POST "$BASE/api/bookings" \
  -H "content-type: application/json" \
  -H "x-user-id: $USER_ID" \
  -d "{\"eventId\":\"$EVENT_ID\",\"tierId\":\"$TIER_ID\",\"quantity\":2}"
```

Save the returned booking `reference` as `REFERENCE`.

## 6. Pay for the booking

```bash
curl -X POST "$BASE/api/bookings/$REFERENCE/pay" \
  -H "content-type: application/json" \
  -H "x-user-id: $USER_ID" \
  -d '{"decline":false}'
```

## 7. Cancel an unpaid booking

```bash
curl -X POST "$BASE/api/bookings/$REFERENCE/cancel" \
  -H "x-user-id: $USER_ID"
```
