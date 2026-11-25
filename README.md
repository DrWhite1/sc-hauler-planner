# SC Hauler Planner

Star Citizen hauler mission planner focused on contract stacking and optimal multi-stop routes.

## Features (Phase 1)

- Ship selector with real SCU capacities
- Manual mission entry (pickup, dropoff, reward, SCU)
- Basic route optimizer (greedy: all pickups then deliveries)
- Capacity warning
- aUEC/hour estimate
- Persistent local storage (Zustand)

## Planned next

- Screenshot OCR (Tesseract.js)
- Better location data + travel times
- Genetic algorithm optimizer
- Packing suggestions
- PWA installable

## Development

```bash
npm install
npm run dev
```

Built as a Next.js PWA in the same style as other personal tools.