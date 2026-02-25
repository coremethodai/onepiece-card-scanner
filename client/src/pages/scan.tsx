import { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CatalogCard, ScannedCard } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  ScanLine,
  Plus,
  Check,
  Filter,
  X,
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

function getRarityClass(rarity: string) {
  return RARITY_COLORS[rarity] || "bg-muted text-muted-foreground";
}

const RARITY_OPTIONS = ["C", "UC", "R", "SR", "SEC", "L", "SP"];
const TYPE_OPTIONS = ["CHARACTER", "EVENT", "STAGE", "LEADER"];

export default function Scan() {
  const [catalogCards, setCatalogCards] = useState<CatalogCard[]>([]);
  const [scannedIds, setScannedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRarity, setSelectedRarity] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchData() {
      try {
        const [catalogSnap, scannedSnap] = await Promise.all([
          getDocs(collection(db, "Official_Catalog")),
          getDocs(collection(db, "My_Collection")),
        ]);

        const catalog = catalogSnap.docs.map(
          (doc) => ({ ...doc.data() } as CatalogCard)
        );
        setCatalogCards(catalog);

        const ids = new Set<string>();
        scannedSnap.docs.forEach((d) => ids.add(d.id));
        setScannedIds(ids);
      } catch (err) {
        console.error("Error fetching catalog:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredCards = catalogCards.filter((card) => {
    const matchesSearch =
      !searchQuery ||
      card.card_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRarity = !selectedRarity || card.rarity === selectedRarity;
    const matchesType = !selectedType || card.type === selectedType;
    return matchesSearch && matchesRarity && matchesType;
  });

  const handleAddToCollection = useCallback(
    async (card: CatalogCard) => {
      const suffix = card.is_alt_art ? "alt" : "standard";
      const docId = `${card.card_id}-${suffix}`;
      setAddingId(docId);

      try {
        const docRef = doc(db, "My_Collection", docId);
        const existing = await getDoc(docRef);

        if (existing.exists()) {
          await updateDoc(docRef, { quantity: increment(1) });
          toast({
            title: "Quantity Updated",
            description: `Added another copy of ${card.name} (${card.card_id})`,
          });
        } else {
          const scannedCard: ScannedCard = {
            ...card,
            scanned_at: new Date().toISOString(),
            quantity: 1,
          };
          await setDoc(docRef, scannedCard);
          setScannedIds((prev) => {
            const next = new Set(Array.from(prev));
            next.add(docId);
            return next;
          });
          toast({
            title: "Card Added",
            description: `${card.name} (${card.card_id}) added to your collection!`,
          });
        }
      } catch (err) {
        console.error("Error adding card:", err);
        toast({
          title: "Error",
          description: "Failed to add card. Please try again.",
          variant: "destructive",
        });
      } finally {
        setAddingId(null);
      }
    },
    [toast]
  );

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedRarity(null);
    setSelectedType(null);
  };

  const hasFilters = searchQuery || selectedRarity || selectedType;

  if (loading) {
    return (
      <div className="p-6 space-y-6" data-testid="scan-loading">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <ScanLine className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-scan-title">
          Scan Cards
        </h1>
      </div>

      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by card ID or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground mr-1">Rarity:</span>
            {RARITY_OPTIONS.map((r) => (
              <Badge
                key={r}
                className={`cursor-pointer text-xs ${
                  selectedRarity === r
                    ? getRarityClass(r)
                    : "bg-muted text-muted-foreground"
                }`}
                onClick={() =>
                  setSelectedRarity(selectedRarity === r ? null : r)
                }
                data-testid={`filter-rarity-${r}`}
              >
                {r}
              </Badge>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground mr-1">Type:</span>
            {TYPE_OPTIONS.map((t) => (
              <Badge
                key={t}
                className={`cursor-pointer text-xs ${
                  selectedType === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
                onClick={() =>
                  setSelectedType(selectedType === t ? null : t)
                }
                data-testid={`filter-type-${t}`}
              >
                {t}
              </Badge>
            ))}
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="ml-2"
                data-testid="button-clear-filters"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground" data-testid="text-results-count">
          Showing {filteredCards.length} of {catalogCards.length} cards
        </p>
      </div>

      <ScrollArea className="h-[calc(100vh-380px)]">
        {filteredCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">
              No cards found
            </h3>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Try adjusting your search or filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCards.map((card, i) => {
              const suffix = card.is_alt_art ? "alt" : "standard";
              const docId = `${card.card_id}-${suffix}`;
              const isInCollection = scannedIds.has(docId);
              const isAdding = addingId === docId;

              return (
                <div
                  key={`${docId}-${i}`}
                  className={`flex items-center gap-3 p-3 rounded-md border transition-colors ${
                    isInCollection
                      ? "bg-primary/5 border-primary/20"
                      : "bg-card"
                  }`}
                  data-testid={`card-catalog-${docId}`}
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
                      {isInCollection && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p
                      className="text-sm truncate mt-0.5"
                      data-testid={`text-catalog-name-${docId}`}
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
                  <Button
                    size="icon"
                    variant={isInCollection ? "secondary" : "default"}
                    onClick={() => handleAddToCollection(card)}
                    disabled={isAdding}
                    data-testid={`button-add-${docId}`}
                  >
                    {isAdding ? (
                      <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
