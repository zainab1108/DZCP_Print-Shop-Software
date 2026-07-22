"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { enablePortal, revokePortal } from "@/lib/actions/portal";

export function PortalAccessCard({
  customerId,
  portalToken,
}: {
  customerId: string;
  portalToken: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const url = portalToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/portal/${portalToken}`
    : null;

  const run = (fn: () => Promise<{ ok: boolean }>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Customer portal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {url ? (
          <>
            <p className="text-muted-foreground">
              Share this link — the customer can view their quotes and invoices
              and approve quotes. Revoking invalidates the link.
            </p>
            <div className="flex gap-2">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() => {
                if (
                  confirm(
                    "Revoke portal access? The current link stops working.",
                  )
                ) {
                  run(() => revokePortal(customerId));
                }
              }}
            >
              Revoke access
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">
              Portal access is off. Enabling it creates a private link for this
              customer.
            </p>
            <Button
              size="sm"
              disabled={pending}
              onClick={() => run(() => enablePortal(customerId))}
            >
              Enable portal access
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
