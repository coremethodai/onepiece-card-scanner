# One Piece Card Scanner

## Project Overview
A web application for One Piece trading cards with a scraper that populates a Firestore database from the official card catalog.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js
- **Database**: Firebase Firestore (for card catalog)
- **Scraper**: Standalone Node.js script

## Key Files
- `server/scrapeCatalog.js` — Standalone scraper that fetches the official One Piece card catalog and uploads to Firestore `Official_Catalog` collection
- `server/index.ts` — Express server entry point
- `server/routes.ts` — API routes
- `shared/schema.ts` — Shared data types

## Environment Variables (Secrets)
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `SESSION_SECRET`

## Running the Scraper
```bash
node server/scrapeCatalog.js
```
This scrapes cards from `https://en.onepiece-cardgame.com/cardlist/?series=569114` and uploads them to the `Official_Catalog` Firestore collection. Document IDs follow the pattern `{card_id}-standard` or `{card_id}-alt`.

## Dependencies Added
- `axios` — HTTP client for fetching the card catalog page
- `cheerio` — HTML parser for extracting card data
- `firebase` — Firebase SDK for Firestore uploads
