import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  increment,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CatalogCard, ScannedCard } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Layers,
  LayoutGrid,
  Save,
  Trash2,
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

interface BatchResponse {
  cards: ScanResult[];
  count: number;
  method: "cv" | "ai";
  totalDetected: number;
  failedCount: number;
}

type ScanMode = "single" | "batch";

export default function Scan() {
  const [catalogCards, setCatalogCards] = useState<CatalogCard[]>([]);
  const [scannedIds, setScannedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRarity, setSelectedRarity] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedSet, setSelectedSet] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);

  const [scanMode, setScanMode] = useState<ScanMode>("single");

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [batchPreviewImage, setBatchPreviewImage] = useState<string | null>(null);
  const [batchScanning, setBatchScanning] = useState(false);
  const [batchResults, setBatchResults] = useState<ScanResult[]>([]);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchScanPhase, setBatchScanPhase] = useState<string>("");
  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const batchCameraInputRef = useRef<HTMLInputElement>(null);

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

  const getDocId = useCallback((card: CatalogCard | ScanResult) => {
    if ((card as any)._docId) return (card as any)._docId as string;
    if (!card.is_alt_art) return `${card.card_id}-standard`;
    if ((card as any).alt_art_number && (card as any).alt_art_number > 1)
      return `${card.card_id}-alt${(card as any).alt_art_number}`;
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

  const handleBatchImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setBatchResults([]);
      setBatchError(null);

      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setBatchPreviewImage(dataUrl);
      };
      reader.readAsDataURL(file);
    },
    []
  );

  const handleBatchScan = useCallback(async () => {
    if (!batchPreviewImage) return;

    setBatchScanning(true);
    setBatchResults([]);
    setBatchError(null);
    setBatchScanPhase("Detecting cards...");

    try {
      setBatchScanPhase("Analyzing image with AI...");

      const res = await apiRequest("POST", "/api/scan-batch", {
        image: batchPreviewImage,
      });
      const data: BatchResponse = await res.json();

      if (data.cards.length === 0) {
        setBatchError("No cards could be identified in the image. Make sure cards are clearly visible on a dark background.");
      } else {
        setBatchResults(data.cards);
        setBatchScanPhase("");
        toast({
          title: "Batch Scan Complete",
          description: `Identified ${data.count} card(s) using ${data.method === "cv" ? "computer vision" : "AI detection"}.${data.failedCount > 0 ? ` ${data.failedCount} card(s) could not be identified.` : ""}`,
        });
      }
    } catch (err: any) {
      setBatchError("Failed to scan batch. Please try again with a clearer image.");
    } finally {
      setBatchScanning(false);
      setBatchScanPhase("");
    }
  }, [batchPreviewImage, toast]);

  const removeBatchCard = useCallback((index: number) => {
    setBatchResults((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSaveAllToCollection = useCallback(async () => {
    if (batchResults.length === 0) return;

    setBatchSaving(true);

    try {
      const batch = writeBatch(db);
      const newIds: string[] = [];

      const cardCounts = new Map<string, { card: ScanResult; count: number }>();
      for (const card of batchResults) {
        const docId = getDocId(card);
        const existing = cardCounts.get(docId);
        if (existing) {
          existing.count++;
        } else {
          cardCounts.set(docId, { card, count: 1 });
        }
      }

      for (const [docId, { card, count }] of cardCounts) {
        const docRef = doc(db, "My_Collection", docId);
        const existing = await getDoc(docRef);

        if (existing.exists()) {
          batch.update(docRef, { quantity: increment(count) });
        } else {
          const scannedCard: ScannedCard = {
            ...card,
            scanned_at: new Date().toISOString(),
            quantity: count,
          };
          batch.set(docRef, scannedCard);
          newIds.push(docId);
        }
      }

      await batch.commit();

      setScannedIds((prev) => {
        const next = new Set(Array.from(prev));
        newIds.forEach((id) => next.add(id));
        return next;
      });

      toast({
        title: "Collection Updated",
        description: `Successfully saved ${batchResults.length} card(s) to your collection!`,
      });

      setBatchResults([]);
      setBatchPreviewImage(null);
      if (batchFileInputRef.current) batchFileInputRef.current.value = "";
      if (batchCameraInputRef.current) batchCameraInputRef.current.value = "";
    } catch (err) {
      console.error("Batch save error:", err);
      toast({
        title: "Error",
        description: "Failed to save cards. Please try again.",
        variant: "destructive",
      });
    } finally {
      setBatchSaving(false);
    }
  }, [batchResults, toast, getDocId]);

  const handleAddSingleBatchCard = useCallback(
    async (card: ScanResult, index: number) => {
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

        setBatchResults((prev) => prev.filter((_, i) => i !== index));
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

  const clearBatchScan = () => {
    setBatchPreviewImage(null);
    setBatchResults([]);
    setBatchError(null);
    setBatchScanPhase("");
    if (batchFileInputRef.current) batchFileInputRef.current.value = "";
    if (batchCameraInputRef.current) batchCameraInputRef.current.value = "";
  };

  const availableSets = Array.from(
    new Set(catalogCards.map((c) => c.set_name).filter(Boolean))
  ).sort() as string[];

  const filteredCards = catalogCards.filter((card) => {
    const matchesSearch =
      !searchQuery ||
      card.card_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRarity = !selectedRarity || card.rarity === selectedRarity;
    const matchesType = !selectedType || card.type === selectedType;
    const matchesSet = !selectedSet || card.set_name === selectedSet;
    return matchesSearch && matchesRarity && matchesType && matchesSet;
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
    setSelectedSet(null);
  };

  const hasFilters = searchQuery || selectedRarity || selectedType || selectedSet;

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
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Camera className="h-5 w-5" />
              AI Card Scanner
            </CardTitle>
            <div
              className="flex rounded-lg border overflow-hidden"
              data-testid="scan-mode-toggle"
            >
              <button
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  scanMode === "single"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => setScanMode("single")}
                data-testid="button-mode-single"
              >
                <ScanLine className="h-3.5 w-3.5 inline mr-1.5" />
                Single
              </button>
              <button
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  scanMode === "batch"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => setScanMode("batch")}
                data-testid="button-mode-batch"
              >
                <LayoutGrid className="h-3.5 w-3.5 inline mr-1.5" />
                Batch
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {scanMode === "single" ? (
            <>
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
            </>
          ) : (
            <div className="space-y-4">
              {!batchPreviewImage && batchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-lg border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-blue-500/5">
                  <LayoutGrid className="h-12 w-12 text-purple-400/50 mb-4" />
                  <p className="text-sm font-medium text-foreground mb-1">
                    Batch Card Scanner
                  </p>
                  <p className="text-xs text-muted-foreground mb-4 text-center max-w-xs">
                    Place up to 20 cards on a dark, contrasting background and take a photo
                  </p>
                  <div className="flex items-center gap-3 flex-wrap justify-center">
                    <input
                      ref={batchCameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleBatchImageSelect}
                      data-testid="input-batch-camera"
                    />
                    <Button
                      onClick={() => batchCameraInputRef.current?.click()}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      data-testid="button-batch-camera"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Take Photo
                    </Button>
                    <input
                      ref={batchFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleBatchImageSelect}
                      data-testid="input-batch-upload"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => batchFileInputRef.current?.click()}
                      data-testid="button-batch-upload"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Image
                    </Button>
                  </div>
                </div>
              ) : batchScanning ? (
                <div
                  className="relative rounded-xl overflow-hidden"
                  data-testid="batch-scanning-overlay"
                >
                  {batchPreviewImage && (
                    <img
                      src={batchPreviewImage}
                      alt="Batch preview"
                      className="w-full rounded-xl object-contain max-h-72 opacity-30"
                    />
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xl rounded-xl">
                    <div
                      className="relative p-8 rounded-2xl"
                      style={{
                        background: "rgba(0, 0, 0, 0.5)",
                        boxShadow:
                          "0 0 40px rgba(168, 85, 247, 0.3), 0 0 80px rgba(59, 130, 246, 0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
                        border: "1px solid rgba(168, 85, 247, 0.3)",
                      }}
                    >
                      <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                          <Loader2
                            className="h-10 w-10 animate-spin"
                            style={{ color: "#a855f7" }}
                          />
                          <div
                            className="absolute inset-0 animate-ping"
                            style={{
                              background: "radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, transparent 70%)",
                            }}
                          />
                        </div>
                        <div className="text-center">
                          <p
                            className="text-sm font-semibold"
                            style={{ color: "#c084fc" }}
                          >
                            {batchScanPhase || "Processing..."}
                          </p>
                          <p className="text-xs mt-1" style={{ color: "#93c5fd" }}>
                            This may take a moment for multiple cards
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : batchPreviewImage && batchResults.length === 0 && !batchError ? (
                <div className="space-y-4">
                  <div className="relative">
                    <img
                      src={batchPreviewImage}
                      alt="Batch preview"
                      className="w-full rounded-lg border object-contain max-h-72"
                      data-testid="img-batch-preview"
                    />
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Button
                      onClick={handleBatchScan}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      data-testid="button-batch-identify"
                    >
                      <ScanLine className="h-4 w-4 mr-2" />
                      Identify All Cards
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={clearBatchScan}
                      data-testid="button-batch-clear"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Clear
                    </Button>
                  </div>
                </div>
              ) : null}

              {batchError && (
                <div
                  className="p-4 rounded-lg border"
                  style={{
                    background: "rgba(239, 68, 68, 0.08)",
                    borderColor: "rgba(239, 68, 68, 0.25)",
                  }}
                  data-testid="batch-error"
                >
                  <p className="text-sm text-destructive font-medium">
                    {batchError}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ensure cards are spread out on a dark background with good lighting.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={clearBatchScan}
                    className="mt-3"
                    data-testid="button-batch-error-clear"
                  >
                    Try Again
                  </Button>
                </div>
              )}

              {batchResults.length > 0 && (
                <div className="space-y-4" data-testid="batch-results">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Check
                        className="h-5 w-5"
                        style={{ color: "#a855f7" }}
                      />
                      <span className="text-sm font-semibold">
                        {batchResults.length} Card{batchResults.length !== 1 ? "s" : ""} Detected
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={clearBatchScan}
                        data-testid="button-batch-results-clear"
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Clear All
                      </Button>
                    </div>
                  </div>

                  <div
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                    data-testid="batch-results-grid"
                  >
                    {batchResults.map((card, index) => {
                      const docId = getDocId(card);
                      const isInCollection = scannedIds.has(docId);
                      const isAdding = addingId === docId;

                      return (
                        <div
                          key={`batch-${index}-${card.card_id}`}
                          className="relative group rounded-xl p-3 border transition-all"
                          style={{
                            background:
                              "linear-gradient(135deg, rgba(15, 15, 25, 0.85) 0%, rgba(20, 15, 35, 0.9) 100%)",
                            backdropFilter: "blur(12px)",
                            borderColor: isInCollection
                              ? "rgba(168, 85, 247, 0.4)"
                              : "rgba(168, 85, 247, 0.15)",
                            boxShadow: isInCollection
                              ? "0 0 15px rgba(168, 85, 247, 0.15)"
                              : "0 2px 8px rgba(0, 0, 0, 0.2)",
                          }}
                          data-testid={`batch-card-${index}`}
                        >
                          <button
                            className="absolute top-2 right-2 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{
                              background: "rgba(239, 68, 68, 0.2)",
                              color: "#f87171",
                            }}
                            onClick={() => removeBatchCard(index)}
                            data-testid={`button-batch-remove-${index}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>

                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="font-mono text-sm font-bold"
                                style={{ color: "#c084fc" }}
                              >
                                {card.card_id}
                              </span>
                              {card.is_alt_art && (
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded font-medium"
                                  style={{
                                    background: "rgba(168, 85, 247, 0.2)",
                                    color: "#c084fc",
                                    border: "1px solid rgba(168, 85, 247, 0.3)",
                                  }}
                                >
                                  ALT ART
                                </span>
                              )}
                              {isInCollection && (
                                <Check
                                  className="h-4 w-4"
                                  style={{ color: "#60a5fa" }}
                                />
                              )}
                            </div>
                            <p
                              className="text-sm font-semibold text-white truncate"
                              data-testid={`text-batch-name-${index}`}
                            >
                              {card.name}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                className={`text-xs ${getRarityClass(card.rarity)}`}
                              >
                                {card.rarity}
                              </Badge>
                              <span
                                className="text-xs"
                                style={{ color: "#94a3b8" }}
                              >
                                {card.type}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <Button
                                size="sm"
                                onClick={() => handleAddSingleBatchCard(card, index)}
                                disabled={isAdding}
                                className="flex-1 h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                                data-testid={`button-batch-add-${index}`}
                              >
                                {isAdding ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeBatchCard(index)}
                                className="h-7 text-xs px-2"
                                style={{ color: "#94a3b8" }}
                                data-testid={`button-batch-discard-${index}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div
                    className="flex items-center justify-center pt-2"
                    data-testid="batch-save-all-container"
                  >
                    <Button
                      onClick={handleSaveAllToCollection}
                      disabled={batchSaving || batchResults.length === 0}
                      className="w-full sm:w-auto px-8"
                      style={{
                        background:
                          "linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)",
                        boxShadow:
                          "0 0 20px rgba(124, 58, 237, 0.3), 0 0 40px rgba(59, 130, 246, 0.15)",
                      }}
                      data-testid="button-save-all"
                    >
                      {batchSaving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save All to Collection ({batchResults.length})
                    </Button>
                  </div>
                </div>
              )}
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
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground mr-1">Set:</span>
            <Select
              value={selectedSet || "all"}
              onValueChange={(val) => setSelectedSet(val === "all" ? null : val)}
            >
              <SelectTrigger
                className="w-[260px] h-9"
                data-testid="select-set"
              >
                <SelectValue placeholder="All Sets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sets</SelectItem>
                {availableSets.map((setName) => (
                  <SelectItem key={setName} value={setName}>
                    {setName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="ml-auto"
                data-testid="button-clear-filters"
              >
                <X className="h-3 w-3 mr-1" />
                Clear All
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p
              className="text-sm text-muted-foreground"
              data-testid="text-results-count"
            >
              Showing {filteredCards.length} of {catalogCards.length} cards
              {selectedSet && (
                <span className="ml-1 font-medium text-foreground">
                  in {selectedSet}
                </span>
              )}
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
