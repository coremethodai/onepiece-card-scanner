export interface CatalogCard {
  card_id: string;
  name: string;
  rarity: string;
  type: string;
  is_alt_art: boolean;
}

export interface ScannedCard {
  card_id: string;
  name: string;
  rarity: string;
  type: string;
  is_alt_art: boolean;
  scanned_at: string;
  quantity: number;
}
