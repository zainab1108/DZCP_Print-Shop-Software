import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney, formatUnitPrice } from "@/lib/format";

interface Line {
  id: string;
  description: string;
  quantity: number;
  unitPrice: { toString(): string };
  taxable: boolean;
  lineTotal: { toString(): string };
}

interface Totals {
  subtotal: { toString(): string };
  taxRate: { toString(): string };
  taxAmount: { toString(): string };
  total: { toString(): string };
  // Optional so older callers (and documents predating discounts) still work.
  discountType?: "PERCENT" | "AMOUNT";
  discountValue?: { toString(): string };
  discountAmount?: { toString(): string };
}

export function DocumentLines({
  lines,
  totals,
}: {
  lines: Line[];
  totals: Totals;
}) {
  const taxPercent = Number(totals.taxRate.toString()) * 100;
  const discount = Number(totals.discountAmount?.toString() ?? 0);
  // Show how the discount was expressed, e.g. "Discount (10%)".
  const discountLabel =
    totals.discountType === "PERCENT"
      ? `Discount (${Number(totals.discountValue?.toString() ?? 0)}%)`
      : "Discount";

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Unit price</TableHead>
            <TableHead className="text-center">Taxable</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((l) => (
            <TableRow key={l.id}>
              <TableCell>{l.description}</TableCell>
              <TableCell className="text-right tabular-nums">
                {l.quantity}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatUnitPrice(l.unitPrice)}
              </TableCell>
              <TableCell className="text-center">
                {l.taxable ? "Yes" : "No"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(l.lineTotal)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="ml-auto w-full max-w-xs space-y-1 border-t pt-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">{formatMoney(totals.subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{discountLabel}</span>
            <span className="tabular-nums">
              −{formatMoney(totals.discountAmount ?? 0)}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            Tax ({taxPercent.toFixed(taxPercent % 1 === 0 ? 0 : 2)}%)
          </span>
          <span className="tabular-nums">{formatMoney(totals.taxAmount)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatMoney(totals.total)}</span>
        </div>
      </div>
    </div>
  );
}
