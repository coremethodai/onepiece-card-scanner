import axios from "axios";
import { fetchLatestSales } from "./fetchSalesHistory";

export interface PriceResult {
  marketPrice: number | null;
  lowestPrice: number | null;
  mostRecentSale: number | null;
  productId: string | null;
  productName: string | null;
  tcgSetName: string | null;
  error?: string;
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function extractSetCode(cardId: string): string {
  const match = cardId.match(/^([A-Z]+\d*)-/i);
  return match ? match[1].toUpperCase() : "";
}

async function searchTCGPlayer(
  query: string
): Promise<any[]> {
  const resp = await axios.post(
    `https://mp-search-api.tcgplayer.com/v1/search/request?q=${encodeURIComponent(query)}&isList=false`,
    {
      algorithm: "sales_synonym_v2",
      from: 0,
      size: 24,
      filters: {
        term: { productLineName: ["one-piece-card-game"] },
        range: {},
        match: {},
      },
      listingSearch: {
        filters: {
          term: {},
          range: {},
          exclude: { channelExclusion: 0 },
        },
      },
      context: { cart: {}, shippingCountry: "US" },
      sort: {},
    },
    {
      headers: {
        "User-Agent": getRandomUserAgent(),
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: "https://www.tcgplayer.com",
        Referer: "https://www.tcgplayer.com/",
      },
      timeout: 15000,
    }
  );

  return resp.data?.results?.[0]?.results || [];
}

function findBestMatch(
  results: any[],
  cardId: string,
  cardName: string
): any | null {
  const setCode = extractSetCode(cardId);
  const cardNumber = cardId.split("-")[1] || "";
  const nameLower = cardName.toLowerCase();

  for (const r of results) {
    const pName = (r.productName || "").toLowerCase();
    const pSet = (r.setName || "").toLowerCase();
    const pCustom = JSON.stringify(r.customAttributes || {}).toLowerCase();

    const nameMatch =
      pName.includes(nameLower) || nameLower.includes(pName.split(" - ")[0]);
    const setMatch =
      pSet.includes(setCode.toLowerCase()) ||
      pCustom.includes(cardId.toLowerCase());
    const numberMatch =
      pName.includes(cardId.toLowerCase()) ||
      pCustom.includes(cardNumber);

    if (nameMatch && (setMatch || numberMatch)) return r;
    if (numberMatch && setMatch) return r;
  }

  for (const r of results) {
    const pName = (r.productName || "").toLowerCase();
    if (pName.includes(nameLower) || pName.includes(cardId.toLowerCase())) {
      return r;
    }
  }

  return results.length > 0 ? null : null;
}

export async function scrapePrice(
  cardId: string,
  cardName: string
): Promise<PriceResult> {
  try {
    let results = await searchTCGPlayer(cardName);

    if (results.length === 0) {
      results = await searchTCGPlayer(cardId);
    }

    if (results.length === 0) {
      results = await searchTCGPlayer(`${cardName} ${extractSetCode(cardId)}`);
    }

    if (results.length === 0) {
      return {
        marketPrice: null,
        lowestPrice: null,
        mostRecentSale: null,
        productId: null,
        productName: null,
        tcgSetName: null,
      };
    }

    const match = findBestMatch(results, cardId, cardName);

    if (!match) {
      return {
        marketPrice: null,
        lowestPrice: null,
        mostRecentSale: null,
        productId: null,
        productName: results[0]?.productName || null,
        tcgSetName: results[0]?.setName || null,
      };
    }

    // Fetch most recent actual sale price from the latestsales API
    const matchProductId = match.productId ? String(match.productId) : null;
    let mostRecentSale: number | null = null;

    if (matchProductId) {
      try {
        const salesResult = await fetchLatestSales(matchProductId, 1);
        mostRecentSale = salesResult.mostRecentSale;
      } catch (err: any) {
        console.log(`Sales history fetch failed for ${matchProductId}: ${err.message}`);
      }
    }

    return {
      marketPrice: match.marketPrice ?? null,
      lowestPrice: match.lowestPrice ?? null,
      mostRecentSale,
      productId: matchProductId,
      productName: match.productName || null,
      tcgSetName: match.setName || null,
    };
  } catch (error: any) {
    if (error.response?.status === 429) {
      return {
        marketPrice: null,
        lowestPrice: null,
        mostRecentSale: null,
        productId: null,
        productName: null,
        tcgSetName: null,
        error: "Rate limited (429). Consider increasing delay between requests.",
      };
    }
    if (error.response?.status === 403) {
      return {
        marketPrice: null,
        lowestPrice: null,
        mostRecentSale: null,
        productId: null,
        productName: null,
        tcgSetName: null,
        error: "Access denied (403). IP may be temporarily blocked.",
      };
    }
    return {
      marketPrice: null,
      lowestPrice: null,
      mostRecentSale: null,
      productId: null,
      productName: null,
      tcgSetName: null,
      error: `Scrape failed: ${error.message}`,
    };
  }
}
