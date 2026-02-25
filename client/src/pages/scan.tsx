import { useState, useEffect, useCallback, useRef } from "react";
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
import { apiRequest } from "@/lib/queryClient";
import {
  Search,
  ScanLine,
  Plus,
  Check,
  Filter,
  X,
  Camera,
  Upload,
  Loader2,
  ImageIcon,
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

interface ScanResult {
  card_id: string;
  name: string;
  rarity: string;
  type: string;
  is_alt_art: boolean;
}

export default function Scan() {
  const [catalogCards, setCatalogCards] = useState<CatalogCard[]>([]);
  const [scannedIds, setScannedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRarity, setSelectedRarity] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  useEffect(() => {
    async function fetchData() {
      try {
        const [catalogSnap, scannedSnap] = await Promise.all([
          getDocs(collection(db, "Official_Catalog")),
          getDocs(collection(db, "My_Collection")),
        ]);

        const catalog = catalogSnap.docs.map((d) => ({
          ...d.data(),
          _docId: d.id,
        })) as (CatalogCard & { _docId: string })[];
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

  const getDocId = useCallback((card: CatalogCard) => {
    if ((card as any)._docId) return (card as any)._docId as string;
    if (!card.is_alt_art) return `${card.card_id}-standard`;
    if (card.alt_art_number && card.alt_art_number > 1) return `${card.card_id}-alt${card.alt_art_number}`;
    return `${card.card_id}-alt`;
  }, []);

  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setScanResult(null);
      setScanError(null);

      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setPreviewImage(dataUrl);
      };
      reader.readAsDataURL(file);
    },
    []
  );

  const handleScanImage = useCallback(async () => {
    if (!previewImage) return;

    setScanning(true);
    setScanResult(null);
    setScanError(null);

    try {
      const res = await apiRequest("POST", "/api/scan-card", {
        image: previewImage,
      });
      const data = await res.json();

      if (data.error) {
        setScanError(data.error);
      } else {
        setScanResult(data);
      }
    } catch (err: any) {
      setScanError("Failed to scan card. Please try again.");
    } finally {
      setScanning(false);
    }
  }, [previewImage]);

  const handleAddScanResult = useCallback(async () => {
    if (!scanResult) return;

    const docId = getDocId(scanResult);
    setAddingId(docId);

    try {
      const docRef = doc(db, "My_Collection", docId);
      const existing = await getDoc(docRef);

      if (existing.exists()) {
        await updateDoc(docRef, { quantity: increment(1) });
        toast({
          title: "Quantity Updated",
          description: `Added another copy of ${scanResult.name} (${scanResult.card_id})`,
        });
      } else {
        const scannedCard: ScannedCard = {
          ...scanResult,
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
          description: `${scanResult.name} (${scanResult.card_id}) added to your collection!`,
        });
      }

      setScanResult(null);
      setPreviewImage(null);
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
  }, [scanResult, toast, getDocId]);

  const clearScan = () => {
    setPreviewImage(null);
    setScanResult(null);
    setScanError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

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
      const docId = getDocId(card);
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
          const { ...cardData } = card;
          delete (cardData as any)._docId;
          const scannedCard: ScannedCard = {
            ...cardData,
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
    [toast, getDocId]
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
        <Skeleton className="h-48 rounded-lg" />
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
        <h1
          className="text-2xl font-bold tracking-tight"
          data-testid="text-scan-title"
        >
          Scan Cards
        </h1>
      </div>

      <Card data-testid="card-scanner">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="h-5 w-5" />
            AI Card Scanner
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!previewImage ? (
            <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-muted-foreground/20 rounded-lg">
              <ImageIcon className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Take a photo or upload an image of your card
              </p>
              <div className="flex items-center gap-3 flex-wrap justify-center">
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleImageSelect}
                  data-testid="input-camera"
                />
                <Button
                  onClick={() => cameraInputRef.current?.click()}
                  data-testid="button-camera"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Take Photo
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                  data-testid="input-upload"
                />
                <Button
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-upload"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Image
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative w-full sm:w-48 shrink-0">
                  <img
                    src={previewImage}
                    alt="Card preview"
                    className="w-full rounded-lg border object-contain max-h-64"
                    data-testid="img-preview"
                  />
                </div>

                <div className="flex-1 space-y-3">
                  {scanning && (
                    <div
                      className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20"
                      data-testid="scan-analyzing"
                    >
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      <div>
                        <p className="text-sm font-medium">Analyzing card...</p>
                        <p className="text-xs text-muted-foreground">
                          Using AI to identify your card
                        </p>
                      </div>
                    </div>
                  )}

                  {scanError && (
                    <div
                      className="p-4 rounded-lg bg-destructive/10 border border-destructive/20"
                      data-testid="scan-error"
                    >
                      <p className="text-sm text-destructive font-medium">
                        {scanError}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Try taking a clearer photo or uploading a different
                        image.
                      </p>
                    </div>
                  )}

                  {scanResult && (
                    <div
                      className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3"
                      data-testid="scan-result"
                    >
                      <p className="text-sm font-semibold text-primary">
                        Card Identified!
                      </p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-base font-bold">
                            {scanResult.card_id}
                          </span>
                          {scanResult.is_alt_art && (
                            <Badge variant="outline" className="text-xs">
                              ALT ART
                            </Badge>
                          )}
                        </div>
                        <p
                          className="text-lg font-semibold"
                          data-testid="text-scan-result-name"
                        >
                          {scanResult.name}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            className={`text-xs ${getRarityClass(scanResult.rarity)}`}
                          >
                            {scanResult.rarity}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {scanResult.type}
                          </span>
                        </div>
                      </div>
                      <Button
                        onClick={handleAddScanResult}
                        disabled={addingId === getDocId(scanResult)}
                        className="w-full sm:w-auto"
                        data-testid="button-add-scan-result"
                      >
                        {addingId === getDocId(scanResult) ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        Add to Collection
                      </Button>
                    </div>
                  )}

                  {!scanning && !scanResult && !scanError && (
                    <p className="text-sm text-muted-foreground">
                      Click "Identify Card" to analyze this image with AI.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {!scanResult && (
                  <Button
                    onClick={handleScanImage}
                    disabled={scanning}
                    data-testid="button-identify"
                  >
                    {scanning ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ScanLine className="h-4 w-4 mr-2" />
                    )}
                    Identify Card
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={clearScan}
                  data-testid="button-clear-scan"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Browse Catalog</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <div className="flex items-center justify-between">
            <p
              className="text-sm text-muted-foreground"
              data-testid="text-results-count"
            >
              Showing {filteredCards.length} of {catalogCards.length} cards
            </p>
          </div>

          <ScrollArea className="h-[400px]">
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
                  const docId = getDocId(card);
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
                          {card.set_name && (
                            <span className="text-xs text-muted-foreground/60 truncate max-w-[120px]">
                              {card.set_name.replace(/^.*?-\s*/, "").replace(/\s*\[.*\]/, "")}
                            </span>
                          )}
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
        </CardContent>
      </Card>
    </div>
  );
}
