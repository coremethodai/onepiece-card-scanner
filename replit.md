# One Piece Card Scanner

## Project Overview
A web application for One Piece trading cards with AI-powered card scanning, a catalog scraper, a collection dashboard, and manual card browsing/adding.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js with Google Gemini AI integration
- **Database**: Firebase Firestore
  - `Official_Catalog` — scraped card data from official site
  - `My_Collection` — user's scanned/collected cards
- **AI**: Google Gemini 2.0 Flash for card image recognition
- **Scraper**: Standalone Node.js script

## Key Files
- `client/src/App.tsx` — Main app with routing and sidebar/mobile nav
- `client/src/pages/dashboard.tsx` — Collection stats and scanned cards view
- `client/src/pages/scan.tsx` — AI scanner + catalog browser with search/filter
- `client/src/lib/firebase.ts` — Firebase client initialization
- `client/src/lib/types.ts` — TypeScript types for CatalogCard and ScannedCard
- `server/routes.ts` — API routes including POST /api/scan-card
- `server/index.ts` — Express server entry point (20mb JSON limit for images)
- `server/scrapeCatalog.js` — Standalone scraper script
- `shared/schema.ts` — Shared data types

## API Endpoints
- `POST /api/scan-card` — Accepts base64 image, uses Gemini to identify the card, returns card_id, name, rarity, type, is_alt_art

## Environment Variables
### Secrets
- `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`
- `GOOGLE_AI_API_KEY` — Google AI Studio key for Gemini
- `SESSION_SECRET`

### Environment Vars (shared)
- `VITE_FIREBASE_*` — Frontend Firebase config vars

## Running the Scraper
```bash
node server/scrapeCatalog.js
```

## Firestore Document IDs
Pattern: `{card_id}-standard` or `{card_id}-alt`

## Dependencies
- `axios` — HTTP client for scraping
- `cheerio` — HTML parser for scraping
- `firebase` — Firebase SDK for Firestore
- `@google/generative-ai` — Google Gemini AI SDK for card recognition
