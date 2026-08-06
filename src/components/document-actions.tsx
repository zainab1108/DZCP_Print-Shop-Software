"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { deleteInvoice, setInvoiceStatus } from "@/lib/actions/invoices";
import {
  convertQuoteToSalesOrder,
  deleteQuote,
  setQuoteStatus,
} from "@/lib/actions/quotes";
import {
  convertSalesOrderToInvoice,
  convertSalesOrderToQuote,
  deleteSalesOrder,
  setSalesOrderStatus,
} from "@/lib/actions/sales-orders";

type Result = { ok: true; id: string } | { ok: false; error: string };

export function QuoteActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<Result>, after?: (id: string) => void) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error);
      else if (after) after(res.id);
      else router.refresh();
    });

  const editable = status === "DRAFT" || status === "SENT";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {editable && (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/quotes/${id}/edit`} />}
          >
            Edit
          </Button>
        )}
        {status === "DRAFT" && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => setQuoteStatus(id, "SENT"))}
          >
            Mark sent
          </Button>
        )}
        {status === "SENT" && (
          <>
            <Button
              size="sm"
              disabled={pending}
              onClick={() => run(() => setQuoteStatus(id, "APPROVED"))}
            >
              Mark approved
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => setQuoteStatus(id, "DECLINED"))}
            >
              Mark declined
            </Button>
          </>
        )}
        {(status === "APPROVED" || status === "SENT" || status === "DRAFT") && (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              run(
                () => convertQuoteToSalesOrder(id),
                (salesOrderId) => router.push(`/sales-orders/${salesOrderId}`),
              )
            }
          >
            Convert to sales order
          </Button>
        )}
        {status === "DRAFT" && (
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => {
              if (confirm("Delete this draft quote?")) {
                run(
                  () => deleteQuote(id),
                  () => router.push("/quotes"),
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

export function SalesOrderActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<Result>, after?: (id: string) => void) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error);
      else if (after) after(res.id);
      else router.refresh();
    });

  const editable = status === "DRAFT" || status === "CONFIRMED";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {editable && (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/sales-orders/${id}/edit`} />}
          >
            Edit
          </Button>
        )}
        {status === "DRAFT" && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => setSalesOrderStatus(id, "CONFIRMED"))}
          >
            Confirm
          </Button>
        )}
        {status === "CONFIRMED" && (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              run(
                () => convertSalesOrderToInvoice(id),
                (invoiceId) => router.push(`/invoices/${invoiceId}`),
              )
            }
          >
            Convert to invoice
          </Button>
        )}
        {editable && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(
                () => convertSalesOrderToQuote(id),
                (quoteId) => router.push(`/quotes/${quoteId}`),
              )
            }
          >
            Convert back to quote
          </Button>
        )}
        {editable && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (confirm("Cancel this sales order?")) {
                run(() => setSalesOrderStatus(id, "CANCELLED"));
              }
            }}
          >
            Cancel
          </Button>
        )}
        {status === "DRAFT" && (
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => {
              if (confirm("Delete this draft sales order?")) {
                run(
                  () => deleteSalesOrder(id),
                  () => router.push("/sales-orders"),
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

export function InvoiceActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<Result>, after?: (id: string) => void) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error);
      else if (after) after(res.id);
      else router.refresh();
    });

  const editable = status === "DRAFT" || status === "SENT";
  const open = status !== "PAID" && status !== "VOID";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {editable && (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/invoices/${id}/edit`} />}
          >
            Edit
          </Button>
        )}
        {status === "DRAFT" && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => setInvoiceStatus(id, "SENT"))}
          >
            Mark sent
          </Button>
        )}
        {open && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (confirm("Void this invoice? This can't be undone.")) {
                run(() => setInvoiceStatus(id, "VOID"));
              }
            }}
          >
            Void
          </Button>
        )}
        {status === "DRAFT" && (
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => {
              if (confirm("Delete this draft invoice?")) {
                run(
                  () => deleteInvoice(id),
                  () => router.push("/invoices"),
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

export function ArchiveCustomerButton({
  id,
  archived,
  action,
}: {
  id: string;
  archived: boolean;
  action: (id: string, archived: boolean) => Promise<Result>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await action(id, !archived);
          if (res.ok) router.refresh();
        })
      }
    >
      {archived ? "Unarchive" : "Archive"}
    </Button>
  );
}
