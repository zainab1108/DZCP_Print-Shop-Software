"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Carrier, ShipmentStatus } from "@/generated/prisma/client";
import {
  createShipment,
  deleteShipment,
  updateShipmentStatus,
} from "@/lib/actions/shipments";
import { formatDate, formatMoney } from "@/lib/format";
import {
  CARRIER_LABELS,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_OPTIONS,
  trackingUrl,
} from "@/lib/shipping";

export interface ShipmentRow {
  id: string;
  carrier: Carrier;
  service: string | null;
  trackingNumber: string | null;
  status: ShipmentStatus;
  cost: string;
  shippedAt: string | null;
  deliveredAt: string | null;
}

const CARRIERS: Carrier[] = ["UPS", "USPS", "FEDEX", "DHL", "OTHER"];

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ShipmentsSection({
  jobId,
  shipments,
}: {
  jobId: string;
  shipments: ShipmentRow[];
}) {
  return (
    <div className="space-y-4">
      {shipments.length === 0 ? (
        <p className="text-muted-foreground text-sm">No shipments yet.</p>
      ) : (
        <ul className="space-y-3">
          {shipments.map((s) => (
            <ShipmentCard key={s.id} shipment={s} />
          ))}
        </ul>
      )}
      <AddShipmentForm jobId={jobId} />
    </div>
  );
}

function ShipmentCard({ shipment }: { shipment: ShipmentRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const url = trackingUrl(shipment.carrier, shipment.trackingNumber);

  const setStatus = (status: ShipmentStatus) =>
    startTransition(async () => {
      setError(null);
      const res = await updateShipmentStatus(shipment.id, status);
      if (res.ok) router.refresh();
      else setError(res.error);
    });

  const remove = () => {
    if (!confirm("Delete this shipment?")) return;
    startTransition(async () => {
      const res = await deleteShipment(shipment.id);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };

  return (
    <li className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {CARRIER_LABELS[shipment.carrier]}
          </span>
          {shipment.service && (
            <span className="text-muted-foreground text-sm">
              {shipment.service}
            </span>
          )}
          <StatusBadge
            status={shipment.status}
            label={SHIPMENT_STATUS_LABELS[shipment.status]}
          />
        </div>
        <span className="text-muted-foreground text-sm tabular-nums">
          {formatMoney(shipment.cost)}
        </span>
      </div>

      <div className="text-sm">
        {shipment.trackingNumber ? (
          url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono underline-offset-2 hover:underline"
            >
              {shipment.trackingNumber}
            </a>
          ) : (
            <span className="font-mono">{shipment.trackingNumber}</span>
          )
        ) : (
          <span className="text-muted-foreground">No tracking number</span>
        )}
        {shipment.shippedAt && (
          <span className="text-muted-foreground">
            {" "}
            · shipped {formatDate(shipment.shippedAt)}
          </span>
        )}
        {shipment.deliveredAt && (
          <span className="text-muted-foreground">
            {" "}
            · delivered {formatDate(shipment.deliveredAt)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={shipment.status}
          onValueChange={(v) => v && setStatus(v as ShipmentStatus)}
          items={SHIPMENT_STATUS_OPTIONS.map((s) => ({
            value: s,
            label: SHIPMENT_STATUS_LABELS[s],
          }))}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SHIPMENT_STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {SHIPMENT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" disabled={pending} onClick={remove}>
          Delete
        </Button>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </li>
  );
}

function AddShipmentForm({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [carrier, setCarrier] = useState<Carrier>("UPS");
  const [service, setService] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [cost, setCost] = useState("");
  const [status, setStatus] = useState<ShipmentStatus>("SHIPPED");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createShipment(jobId, {
        carrier,
        service,
        trackingNumber,
        status,
        cost: cost.trim(),
        weightOz: "",
        shippedAt: today(),
        notes: "",
      });
      if (res.ok) {
        setService("");
        setTrackingNumber("");
        setCost("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form
      className="space-y-3 border-t pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <p className="text-sm font-medium">Add shipment</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label>Carrier</Label>
          <Select
            value={carrier}
            onValueChange={(v) => setCarrier((v ?? "UPS") as Carrier)}
            items={CARRIERS.map((c) => ({
              value: c,
              label: CARRIER_LABELS[c],
            }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CARRIERS.map((c) => (
                <SelectItem key={c} value={c}>
                  {CARRIER_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ship-service">Service</Label>
          <Input
            id="ship-service"
            value={service}
            onChange={(e) => setService(e.target.value)}
            placeholder="Ground"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ship-tracking">Tracking #</Label>
          <Input
            id="ship-tracking"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ship-cost">Cost</Label>
          <Input
            id="ship-cost"
            inputMode="decimal"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>
      <div className="flex items-end gap-3">
        <div className="w-40 space-y-2">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus((v ?? "SHIPPED") as ShipmentStatus)}
            items={SHIPMENT_STATUS_OPTIONS.map((s) => ({
              value: s,
              label: SHIPMENT_STATUS_LABELS[s],
            }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHIPMENT_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {SHIPMENT_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add shipment"}
        </Button>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </form>
  );
}
