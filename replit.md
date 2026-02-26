# One Piece Card Scanner

## Project Overview
A web application for One Piece trading cards with AI-powered card scanning (single and batch), a catalog scraper, a collection dashboard, manual card browsing/adding, and automated TCGPlayer price tracking.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js with Google Gemini AI integration
- **Database**: Firebase Firestore
  - `Official_Catalog` — scraped card data from official site
  - `My_Collection` — user's scanned/collected cards (with price data)
- **AI**: Google Gemini 2.5 Flash for card image recognition
- **Image Processing**: sharp (used for batch card detection via CV)
- **Price Scraper**: TCGPlayer market price scraper via their search API
- **Catalog Scraper**: Standalone Node.js script for official card data

## Key Files
- `client/src/App.tsx` — Main app with routing and sidebar/mobile nav
- `client/src/pages/dashboard.tsx` — Collection stats and scanned cards view
- `client/src/pages/scan.tsx` — AI scanner (single + batch modes) + catalog browser with search/filter
- `client/src/lib/firebase.ts` — Firebase client initialization
- `client/src/lib/types.ts` — TypeScript types for CatalogCard and ScannedCard
- `server/routes.ts` — API routes: POST /api/scan-card, POST /api/scan-batch
- `server/batchDetect.ts` — CV-based card detection using sharp (grayscale → threshold → connected-component labeling → crop)
- `server/index.ts` — Express server entry point (50mb JSON limit for batch images)
- `server/scrapeCatalog.js` — Standalone catalog scraper script
- `server/jobs/scrapePrice.ts` — TCGPlayer price scraper utility (uses their search API, no headless browser needed)
- `server/jobs/updatePrices.ts` — Standalone cron job script: fetches My_Collection cards, scrapes prices sequentially with random delays (3-8s), updates Firestore
- `shared/schema.ts` — Shared data types

## API Endpoints
- `POST /api/scan-card` — Accepts base64 image, uses Gemini to identify a single card
- `POST /api/scan-batch` — Accepts base64 image of multiple cards, uses CV detection + Gemini (with AI-native fallback), returns array of identified cards

## Batch Scanning
- Two detection methods: CV pipeline (sharp-based contour detection) and AI-native (Gemini identifies all cards in one call)
- CV is used when >1 card region detected; falls back to AI-native if CV fails or finds ≤1 region
- Frontend uses glassmorphism UI with neon purple/blue accents for batch mode
- Batch save uses Firestore `writeBatch()` for atomic writes

## Price Tracking
- `server/jobs/updatePrices.ts` — standalone script for scheduled execution
- Uses TCGPlayer's search API (`mp-search-api.tcgplayer.com`) — no headless browser needed
- Sequential card processing with 3-8 second random delays to avoid IP blocking
- Updates: `current_price`, `previous_price`, `lowest_price`, `last_updated` fields
- Run manually: `npx tsx server/jobs/updatePrices.ts`
- Exits with `process.exit(0)` for Replit Scheduled Deployments compatibility

## Environment Variables
### Secrets
- `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`
- `GOOGLE_AI_API_KEY` — Google AI Studio key for Gemini
- `SESSION_SECRET`

### Environment Vars (shared)
- `VITE_FIREBASE_*` — Frontend Firebase config vars

## Running Scripts
```bash
# Run catalog scraper
node server/scrapeCatalog.js

# Run price updater (for cron/scheduled deployment)
npx tsx server/jobs/updatePrices.ts
```

## Firestore Security Rules
- `firestore.rules` — defines access control for Firestore collections
- `firebase.json` — Firebase config pointing to the rules file
- **Official_Catalog**: read-only from client; writes only via Admin SDK (scraper)
- **My_Collection**: read allowed; create validated (7 required fields, 2 optional); update allows `quantity`, `current_price`, `previous_price`, `lowest_price`, `last_updated`; delete denied
- Deploy rules via: `firebase deploy --only firestore:rules` (requires Firebase CLI)

## Firestore Document IDs
Pattern: `{card_id}-standard`, `{card_id}-alt`, `{card_id}-alt2`, `{card_id}-alt3`

## Dependencies
- `axios` — HTTP client for scraping
- `cheerio` — HTML parser for scraping
- `firebase` — Firebase SDK for Firestore
- `@google/generative-ai` — Google Gemini AI SDK for card recognition
- `sharp` — Image processing for batch card detection (grayscale, threshold, crop)
