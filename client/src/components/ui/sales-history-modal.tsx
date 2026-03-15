import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { SaleRecord } from "@/lib/types";
import { TrendingUp, ShoppingCart, Calendar } from "lucide-react";

interface SalesHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardName: string;
  cardId: string;
  tcgProductId: string | null | undefined;
  marketPrice?: number | null;
}

export function SalesHistoryModal({
  open,
  onOpenChange,
  cardName,
  cardId,
  tcgProductId,
  marketPrice,
}: SalesHistoryModalProps) {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostRecentSale, setMostRecentSale] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;

    async function fetchSales() {
      setLoading(true);
      setError(null);
      setSales([]);

      try {
        let url: string;
        if (tcgProductId) {
          url = `/api/market-data/${tcgProductId}?limit=10`;
        } else {
          url = `/api/market-data/resolve/${encodeURIComponent(cardId)}?name=${encodeURIComponent(cardName)}&limit=10`;
        }

        const resp = await fetch(url);
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${resp.status}`);
        }

        const data = await resp.json();
        setSales(data.recentSales || []);
        setMostRecentSale(data.mostRecentSale ?? null);
      } catch (err: any) {
        setError(err.message || "Failed to load sales data");
      } finally {
        setLoading(false);
      }
    }

    fetchSales();
  }, [open, tcgProductId, cardId, cardName]);

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Sales History
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <span className="block font-medium text-foreground">{cardName}</span>
            <span className="block text-xs text-muted-foreground font-mono">{cardId}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Market Price
            </div>
            <div className="text-lg font-bold text-foreground">
              {marketPrice != null ? `$${marketPrice.toFixed(2)}` : "--"}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Most Recent Sale
            </div>
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              {loading ? (
                <Skeleton className="h-6 w-20" />
              ) : mostRecentSale != null ? (
                `$${mostRecentSale.toFixed(2)}`
              ) : (
                "--"
              )}
            </div>
          </div>
        </div>

        {/* Sales table */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <p className="text-destructive font-medium">{error}</p>
            <p className="mt-1">
              Sales data may not be available for this card.
            </p>
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No recent sales found.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Date</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Shipping</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(sale.orderDate)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="text-xs font-normal"
                    >
                      {sale.condition}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {sale.quantity}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-sm">
                    ${sale.purchasePrice.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {sale.shippingPrice > 0
                      ? `+$${sale.shippingPrice.toFixed(2)}`
                      : "Free"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
