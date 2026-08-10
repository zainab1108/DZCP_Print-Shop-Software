"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { createCheckoutSession } from "@/lib/actions/portal";

export function PortalPayButton({
  token,
  invoiceId,
  amountLabel,
}: {
  token: string;
  invoiceId: string;
  amountLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pay() {
    startTransition(async () => {
      setError(null);
      const res = await createCheckoutSession(token, invoiceId);
      if (res.ok) {
        // Full navigation, not router.push — Checkout is another origin.
        window.location.href = res.url;
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button disabled={pending} onClick={pay}>
        {pending ? "Starting…" : `Pay ${amountLabel} by card`}
      </Button>
      <p className="text-muted-foreground text-xs">
        Secure payment handled by Stripe. Card details never touch our servers.
      </p>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
