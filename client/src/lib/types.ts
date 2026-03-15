export interface CatalogCard {
  card_id: string;
  name: string;
  rarity: string;
  type: string;
  is_alt_art: boolean;
  alt_art_number?: number;
  set_name?: string;
}

export interface SaleRecord {
  purchasePrice: number;
  shippingPrice: number;
  orderDate: string;
  condition: string;
  quantity: number;
  listingType?: string;
  title?: string;
}

export interface ScannedCard {
  card_id: string;
  name: string;
  rarity: string;
  type: string;
  is_alt_art: boolean;
  alt_art_number?: number;
  set_name?: string;
  scanned_at: string;
  quantity: number;
  current_price?: number | null;
  previous_price?: number | null;
  lowest_price?: number | null;
  most_recent_sale?: number | null;
  tcg_product_id?: string | null;
  last_updated?: string | null;
}
