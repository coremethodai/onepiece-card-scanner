import axios from "axios";

export interface SaleRecord {
  purchasePrice: number;
  shippingPrice: number;
  orderDate: string;
  condition: string;
  quantity: number;
  listingType: string;
  title: string;
}

export interface SalesHistoryResult {
  mostRecentSale: number | null;
  recentSales: SaleRecord[];
  error?: string;
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Fetch the most recent sales from TCGPlayer's latest-sales API.
 *
 * API: POST https://mpapi.tcgplayer.com/v2/product/{productId}/latestsales
 *
 * This is the same endpoint that powers the "Sales History Snapshot" modal
 * on tcgplayer.com product pages. It returns individual sale records with
 * purchasePrice, shippingPrice, orderDate, condition, and quantity.
 */
export async function fetchLatestSales(
  productId: string | number,
  limit: number = 10,
  conditions: string[] = [],
  languages: number[] = [1] // 1 = English
): Promise<SalesHistoryResult> {
  try {
    const url = `https://mpapi.tcgplayer.com/v2/product/${productId}/latestsales`;

    const resp = await axios.post(
      url,
      {
        conditions,
        languages,
        variants: [],
        listingType: "All",
        limit: Math.min(Math.max(limit, 1), 25),
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

    const salesData = resp.data?.data ?? resp.data?.results ?? resp.data ?? [];

    if (!Array.isArray(salesData) || salesData.length === 0) {
      return { mostRecentSale: null, recentSales: [] };
    }

    const recentSales: SaleRecord[] = salesData.slice(0, limit).map((s: any) => ({
      purchasePrice: s.purchasePrice ?? 0,
      shippingPrice: s.shippingPrice ?? 0,
      orderDate: s.orderDate ?? "",
      condition: s.condition ?? "Unknown",
      quantity: s.quantity ?? 1,
      listingType: s.listingType ?? "",
      title: s.title ?? "",
    }));

    const mostRecentSale = recentSales.length > 0 ? recentSales[0].purchasePrice : null;

    return { mostRecentSale, recentSales };
  } catch (error: any) {
    if (error.response?.status === 429) {
      return {
        mostRecentSale: null,
        recentSales: [],
        error: "Rate limited (429). Try again later.",
      };
    }
    if (error.response?.status === 403) {
      return {
        mostRecentSale: null,
        recentSales: [],
        error: "Access denied (403). IP may be temporarily blocked.",
      };
    }
    return {
      mostRecentSale: null,
      recentSales: [],
      error: `Sales history fetch failed: ${error.message}`,
    };
  }
}

/**
 * Resolve a card's TCGPlayer product ID using the search API.
 * This reuses the same search endpoint as scrapePrice.ts.
 */
export async function resolveProductId(
  cardId: string,
  cardName: string
): Promise<string | null> {
  try {
    const resp = await axios.post(
      `https://mp-search-api.tcgplayer.com/v1/search/request?q=${encodeURIComponent(cardName)}&isList=false`,
      {
        algorithm: "sales_synonym_v2",
        from: 0,
        size: 10,
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

    const results = resp.data?.results?.[0]?.results || [];
    if (results.length === 0) return null;

    // Try to find a match by card ID in product name or custom attributes
    const cardIdLower = cardId.toLowerCase();
    const nameLower = cardName.toLowerCase();

    for (const r of results) {
      const pName = (r.productName || "").toLowerCase();
      const pCustom = JSON.stringify(r.customAttributes || {}).toLowerCase();

      if (
        pName.includes(cardIdLower) ||
        pName.includes(nameLower) ||
        pCustom.includes(cardIdLower)
      ) {
        return String(r.productId);
      }
    }

    // Fall back to first result
    return results[0]?.productId ? String(results[0].productId) : null;
  } catch {
    return null;
  }
}
