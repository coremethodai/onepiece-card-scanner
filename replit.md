# One Piece Card Scanner

## Project Overview
A web application for One Piece trading cards with a scraper that populates a Firestore database from the official card catalog, a dashboard showing collection progress, and a scan page to add cards to your personal collection.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js
- **Database**: Firebase Firestore
  - `Official_Catalog` — scraped card data from official site
  - `My_Collection` — user's scanned/collected cards
- **Scraper**: Standalone Node.js script

## Key Files
- `client/src/App.tsx` — Main app with routing and sidebar/mobile nav
- `client/src/pages/dashboard.tsx` — Collection stats and scanned cards view
- `client/src/pages/scan.tsx` — Browse catalog, search/filter, add cards to collection
- `client/src/lib/firebase.ts` — Firebase client initialization
- `client/src/lib/types.ts` — TypeScript types for CatalogCard and ScannedCard
- `server/scrapeCatalog.js` — Standalone scraper script
- `server/index.ts` — Express server entry point
- `server/routes.ts` — API routes
- `shared/schema.ts` — Shared data types

## Environment Variables
### Secrets
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `SESSION_SECRET`

### Environment Vars (shared)
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

## Running the Scraper
```bash
node server/scrapeCatalog.js
```
Scrapes cards from `https://en.onepiece-cardgame.com/cardlist/?series=569114` and uploads to the `Official_Catalog` Firestore collection.

## Firestore Document IDs
Pattern: `{card_id}-standard` or `{card_id}-alt`

## Dependencies Added
- `axios` — HTTP client for fetching the card catalog page
- `cheerio` — HTML parser for extracting card data
- `firebase` — Firebase SDK for Firestore reads/writes
