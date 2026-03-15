import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ScannedCard, CatalogCard } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SalesHistoryModal } from "@/components/ui/sales-history-modal";
import {
  LayoutDashboard,
  Layers,
  Star,
  Sparkles,
  Package,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
} from "lucide-react";

const RARITY_COLORS: Record<string, string> = {
  L: "bg-amber-500 text-white",
  SEC: "bg-purple-600 text-white",
  SP: "bg-pink-500 text-white",
  SR: "bg-yellow-500 text-black",
  R: "bg-blue-500 text-white",
  UC: "bg-green-600 text-white",
  C: "bg-zinc-400 dark:bg-zinc-600 text-white",
};

const TYPE_ICONS: Record<string, string> = {
  CHARACTER: "👤",
  EVENT: "⚡",
  STAGE: "🏟️",
  LEADER: "👑",
};

function getRarityClass(rarity: string) {
  return RARITY_COLORS[rarity] || "bg-muted text-muted-foreground";
}

export default function Dashboard() {
  const [scannedCards, setScannedCards] = useState<ScannedCard[]>([]);
  const [catalogCards, setCatalogCards] = useState<CatalogCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [salesModalOpen, setSalesModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<ScannedCard | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [scannedSnap, catalogSnap] = await Promise.all([
          getDocs(collection(db, "My_Collection")),
          getDocs(collection(db, "Official_Catalog")),
        ]);

        const scanned = scannedSnap.docs.map(
          (doc) => ({ ...doc.data() } as ScannedCard)
        );
        const catalog = catalogSnap.docs.map(
          (doc) => ({ ...doc.data() } as CatalogCard)
        );

        setScannedCards(scanned);
        setCatalogCards(catalog);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const totalCatalog = catalogCards.length;
  const uniqueCatalogIds = new Set(catalogCards.map((c) => c.card_id)).size;
  const totalScanned = scannedCards.length;
  const uniqueScannedIds = new Set(scannedCards.map((c) => c.card_id)).size;
  const completionPercent =
    uniqueCatalogIds > 0
      ? Math.round((uniqueScannedIds / uniqueCatalogIds) * 100)
      : 0;

  const rarityCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  scannedCards.forEach((c) => {
    rarityCounts[c.rarity] = (rarityCounts[c.rarity] || 0) + 1;
    typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
  });

  const totalValue = scannedCards.reduce((sum, c) => {
    const price = c.current_price ?? 0;
    return sum + price * c.quantity;
  }, 0);
  const cardsWithPrices = scannedCards.filter((c) => c.current_price != null).length;

  if (loading) {
    return (
      <div className="p-6 space-y-6" data-testid="dashboard-loading">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <LayoutDashboard className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">
          Collection Dashboard
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-stat-scanned">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cards Scanned
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-scanned-count">
              {totalScanned}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {uniqueScannedIds} unique cards
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-catalog">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Catalog
            </CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-catalog-count">
              {totalCatalog}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {uniqueCatalogIds} unique cards
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-completion">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completion
            </CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-completion-percent">
              {completionPercent}%
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-value">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Collection Value
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-collection-value">
              ${totalValue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {cardsWithPrices} of {totalScanned} cards priced
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">My Scanned Cards</CardTitle>
        </CardHeader>
        <CardContent>
          {scannedCards.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 text-center"
              data-testid="empty-collection"
            >
              <Package className="h-16 w-16 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground">
                No cards scanned yet
              </h3>
              <p className="text-sm text-muted-foreground/70 mt-1 max-w-sm">
                Head over to the Scan page to start adding cards to your
                collection.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {scannedCards.map((card, i) => (
                  <div
                    key={`${card.card_id}-${card.is_alt_art}-${i}`}
                    className="flex items-center gap-3 p-3 rounded-md border bg-card"
                    data-testid={`card-scanned-${card.card_id}-${i}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold">
                          {card.card_id}
                        </span>
                        {card.is_alt_art && (
                          <Badge variant="outline" className="text-xs">
                            ALT
                          </Badge>
                        )}
                      </div>
                      <p
                        className="text-sm truncate mt-0.5"
                        data-testid={`text-card-name-${card.card_id}`}
                      >
                        {card.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge
                          className={`text-xs ${getRarityClass(card.rarity)}`}
                        >
                          {card.rarity}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {card.type}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {card.current_price != null ? (
                        <div
                          className="text-right cursor-pointer hover:opacity-80 transition-opacity"
                          data-testid={`price-${card.card_id}-${i}`}
                          onClick={() => {
                            setSelectedCard(card);
                            setSalesModalOpen(true);
                          }}
                          title="Click to view sales history"
                        >
                          <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                            ${card.current_price.toFixed(2)}
                          </div>
                          {card.most_recent_sale != null && card.most_recent_sale !== card.current_price && (
                            <div className="flex items-center gap-0.5 justify-end">
                              <ShoppingCart className="h-3 w-3 text-blue-500" />
                              <span className="text-[10px] text-blue-500" title="Most recent sold price">
                                ${card.most_recent_sale.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {card.previous_price != null && card.previous_price !== card.current_price && (
                            <div className="flex items-center gap-0.5 justify-end">
                              {card.current_price > card.previous_price ? (
                                <TrendingUp className="h-3 w-3 text-green-500" />
                              ) : (
                                <TrendingDown className="h-3 w-3 text-red-500" />
                              )}
                              <span className={`text-[10px] ${card.current_price > card.previous_price ? "text-green-500" : "text-red-500"}`}>
                                ${card.previous_price.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/50" data-testid={`price-na-${card.card_id}-${i}`}>
                          --
                        </span>
                      )}
                      {card.quantity > 1 && (
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold">
                          x{card.quantity}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      {selectedCard && (
        <SalesHistoryModal
          open={salesModalOpen}
          onOpenChange={setSalesModalOpen}
          cardName={selectedCard.name}
          cardId={selectedCard.card_id}
          tcgProductId={selectedCard.tcg_product_id}
          marketPrice={selectedCard.current_price}
        />
      )}
    </div>
  );
}
