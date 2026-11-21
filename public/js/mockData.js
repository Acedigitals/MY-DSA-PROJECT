export const mockEvents = [
  {
    id: 'event-lagos-tech',
    title: 'Lagos Tech Meetup',
    city: 'Lagos',
    venue: 'Civic Hall',
    date: '2026-12-05T17:00:00Z',
    status: 'PUBLISHED',
    tiers: [
      { id: 'tier-tech-general', name: 'General', priceCents: 250000, capacity: 100, sold: 38, available: 62 },
      { id: 'tier-tech-vip', name: 'VIP', priceCents: 500000, capacity: 20, sold: 20, available: 0 }
    ]
  },
  {
    id: 'event-abuja-jazz',
    title: 'Abuja Jazz Night',
    city: 'Abuja',
    venue: 'Blue Room',
    date: '2026-12-12T19:30:00Z',
    status: 'PUBLISHED',
    tiers: [
      { id: 'tier-jazz-standard', name: 'Standard', priceCents: 150000, capacity: 80, sold: 24, available: 56 },
      { id: 'tier-jazz-premium', name: 'Premium', priceCents: 300000, capacity: 12, sold: 12, available: 0 }
    ]
  },
  {
    id: 'event-ibadan-art',
    title: 'Ibadan Art Walk',
    city: 'Ibadan',
    venue: 'Heritage Gallery',
    date: '2026-12-20T11:00:00Z',
    status: 'PUBLISHED',
    tiers: [
      { id: 'tier-art-entry', name: 'Entry', priceCents: 50000, capacity: 40, sold: 5, available: 35 }
    ]
  }
];
