"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { deleteGrid } from "@/lib/actions/pricing";

export function DeleteGridButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (
          confirm(
            `Delete price grid "${name}"? Existing documents keep their prices.`,
          )
        ) {
          startTransition(async () => {
            const res = await deleteGrid(id);
            if (res.ok) router.refresh();
            else alert(res.error);
          });
        }
      }}
    >
      Delete
    </Button>
  );
}
