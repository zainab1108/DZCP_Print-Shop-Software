"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  cancelPurchaseOrder,
  deletePurchaseOrder,
  markOrdered,
  receivePurchaseOrder,
} from "@/lib/actions/purchase-orders";

type Result = { ok: true; id: string } | { ok: false; error: string };

export function POActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<Result>, after?: () => void) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error);
      else if (after) after();
      else router.refresh();
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "DRAFT" && (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/purchasing/${id}/edit`} />}
          >
            Edit
          </Button>
        )}
        {status === "DRAFT" && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => markOrdered(id))}
          >
            Mark ordered
          </Button>
        )}
        {status !== "RECEIVED" && status !== "CANCELLED" && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (confirm("Cancel this purchase order?")) {
                run(() => cancelPurchaseOrder(id));
              }
            }}
          >
            Cancel PO
          </Button>
        )}
        {status === "DRAFT" && (
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => {
              if (confirm("Delete this draft PO?")) {
                run(
                  () => deletePurchaseOrder(id),
                  () => router.push("/purchasing"),
                );
              }
            }}
          >
            Delete
          </Button>
        )}
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}

export interface ReceiveLine {
  id: string;
  description: string;
  outstanding: number;
}

export function ReceivePanel({
  poId,
  lines,
}: {
  poId: string;
  lines: ReceiveLine[];
}) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const receivable = lines.filter((l) => l.outstanding > 0);
  if (receivable.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Everything on this PO has been received.
      </p>
    );
  }

  function submit() {
    setError(null);
    const receipts = receivable
      .map((l) => ({ lineId: l.id, quantity: Number(qty[l.id] || 0) }))
      .filter((r) => r.quantity > 0);
    if (receipts.length === 0) {
      setError("Enter a quantity to receive");
      return;
    }
    startTransition(async () => {
      const res = await receivePurchaseOrder(poId, { receipts });
      if (res.ok) {
        setQty({});
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      {receivable.map((l) => (
        <div key={l.id} className="flex items-center gap-3">
          <span className="flex-1 text-sm">{l.description}</span>
          <span className="text-muted-foreground text-xs">
            {l.outstanding} outstanding
          </span>
          <Input
            className="w-24"
            inputMode="numeric"
            placeholder="0"
            value={qty[l.id] ?? ""}
            onChange={(e) => setQty((q) => ({ ...q, [l.id]: e.target.value }))}
          />
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() =>
              setQty((q) => ({ ...q, [l.id]: String(l.outstanding) }))
            }
          >
            All
          </Button>
        </div>
      ))}
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button size="sm" disabled={pending} onClick={submit}>
        {pending ? "Receiving…" : "Receive items"}
      </Button>
    </div>
  );
}
