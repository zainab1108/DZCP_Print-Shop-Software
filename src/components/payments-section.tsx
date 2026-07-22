"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deletePayment, recordPayment } from "@/lib/actions/payments";
import { formatDate, formatMoney } from "@/lib/format";

export interface PaymentRow {
  id: string;
  amount: string;
  method: string;
  reference: string | null;
  receivedAt: string; // ISO
  notes: string | null;
}

const METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "CHECK", label: "Check" },
  { value: "CARD", label: "Card" },
  { value: "ACH", label: "ACH / bank transfer" },
  { value: "OTHER", label: "Other" },
];

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PaymentsSection({
  invoiceId,
  payments,
  balance,
  canRecord,
}: {
  invoiceId: string;
  payments: PaymentRow[];
  balance: string; // remaining balance, prefills the form
  canRecord: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [amount, setAmount] = useState(balance);
  const [method, setMethod] = useState("CHECK");
  const [reference, setReference] = useState("");
  const [receivedAt, setReceivedAt] = useState(today());
  const [notes, setNotes] = useState("");

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await recordPayment(invoiceId, {
        amount: amount.trim(),
        method,
        reference,
        receivedAt,
        notes,
      });
      if (res.ok) {
        setOpen(false);
        setReference("");
        setNotes("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function remove(paymentId: string) {
    if (
      !confirm("Delete this payment? The invoice balance will be recalculated.")
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deletePayment(paymentId);
      if (res.ok) router.refresh();
      else alert(res.error);
    });
  }

  return (
    <div className="space-y-4">
      {payments.length === 0 ? (
        <p className="text-muted-foreground text-sm">No payments recorded.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Received</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{formatDate(p.receivedAt)}</TableCell>
                <TableCell>
                  {METHODS.find((m) => m.value === p.method)?.label ?? p.method}
                </TableCell>
                <TableCell>{p.reference ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {p.notes ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(p.amount)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => remove(p.id)}
                  >
                    ✕
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {canRecord && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm">Record payment</Button>} />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Record payment</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pay-amount">Amount *</Label>
                  <Input
                    id="pay-amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select
                    value={method}
                    onValueChange={(v) => setMethod(v ?? "OTHER")}
                    items={METHODS}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pay-ref">Reference</Label>
                  <Input
                    id="pay-ref"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Check #1042"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pay-date">Date received *</Label>
                  <Input
                    id="pay-date"
                    type="date"
                    value={receivedAt}
                    onChange={(e) => setReceivedAt(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="pay-notes">Notes</Label>
                  <Input
                    id="pay-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Record payment"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
