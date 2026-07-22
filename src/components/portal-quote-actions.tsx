"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { decideQuoteByToken } from "@/lib/actions/portal";

export function PortalQuoteActions({
  token,
  quoteId,
}: {
  token: string;
  quoteId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const decide = (decision: "APPROVED" | "DECLINED") =>
    startTransition(async () => {
      setError(null);
      const res = await decideQuoteByToken(token, quoteId, decision);
      if (res.ok) router.refresh();
      else setError(res.error);
    });

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button disabled={pending} onClick={() => decide("APPROVED")}>
          Approve quote
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (confirm("Decline this quote?")) decide("DECLINED");
          }}
        >
          Decline
        </Button>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
