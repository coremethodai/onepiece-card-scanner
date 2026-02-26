# One Piece Card Scanner

## Project Overview
A web application for One Piece trading cards with AI-powered card scanning (single and batch), a catalog scraper, a collection dashboard, and manual card browsing/adding.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js with Google Gemini AI integration
- **Database**: Firebase Firestore
  - `Official_Catalog` — scraped card data from official site
  - `My_Collection` — user's scanned/collected cards
- **AI**: Google Gemini 2.5 Flash for card image recognition
- **Image Processing**: sharp (used for batch card detection via CV)
- **Scraper**: Standalone Node.js script

## Key Files
- `client/src/App.tsx` — Main app with routing and sidebar/mobile nav
- `client/src/pages/dashboard.tsx` — Collection stats and scanned cards view
- `client/src/pages/scan.tsx` — AI scanner (single + batch modes) + catalog browser with search/filter
- `client/src/lib/firebase.ts` — Firebase client initialization
- `client/src/lib/types.ts` — TypeScript types for CatalogCard and ScannedCard
- `server/routes.ts` — API routes: POST /api/scan-card, POST /api/scan-batch
- `server/batchDetect.ts` — CV-based card detection using sharp (grayscale → threshold → connected-component labeling → crop)
- `server/index.ts` — Express server entry point (50mb JSON limit for batch images)
- `server/scrapeCatalog.js` — Standalone scraper script
- `shared/schema.ts` — Shared data types

## API Endpoints
- `POST /api/scan-card` — Accepts base64 image, uses Gemini to identify a single card
- `POST /api/scan-batch` — Accepts base64 image of multiple cards, uses CV detection + Gemini (with AI-native fallback), returns array of identified cards

## Batch Scanning
- Two detection methods: CV pipeline (sharp-based contour detection) and AI-native (Gemini identifies all cards in one call)
- CV is used when >1 card region detected; falls back to AI-native if CV fails or finds ≤1 region
- Frontend uses glassmorphism UI with neon purple/blue accents for batch mode
- Batch save uses Firestore `writeBatch()` for atomic writes

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
Pattern: `{card_id}-standard`, `{card_id}-alt`, `{card_id}-alt2`, `{card_id}-alt3`

## Dependencies
- `axios` — HTTP client for scraping
- `cheerio` — HTML parser for scraping
- `firebase` — Firebase SDK for Firestore
- `@google/generative-ai` — Google Gemini AI SDK for card recognition
- `sharp` — Image processing for batch card detection (grayscale, threshold, crop)
