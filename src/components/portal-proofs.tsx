"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { decideProofByToken } from "@/lib/actions/proofs";
import { formatDate } from "@/lib/format";

export interface PortalProofRow {
  id: string;
  version: number;
  mimeType: string;
  status: "PENDING" | "APPROVED" | "CHANGES_REQUESTED";
  note: string | null;
  feedback: string | null;
  createdAt: string;
}

const isImage = (mime: string) => mime.startsWith("image/");

export function PortalProofs({
  token,
  proofs,
}: {
  token: string;
  proofs: PortalProofRow[];
}) {
  return (
    <ul className="space-y-3">
      {[...proofs]
        .sort((a, b) => b.version - a.version)
        .map((p) => (
          <PortalProofCard key={p.id} token={token} proof={p} />
        ))}
    </ul>
  );
}

function PortalProofCard({
  token,
  proof,
}: {
  token: string;
  proof: PortalProofRow;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [showDecline, setShowDecline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fileUrl = `/api/portal/${token}/proofs/${proof.id}`;

  function approve() {
    setError(null);
    startTransition(async () => {
      const res = await decideProofByToken(token, proof.id, "APPROVED", "");
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  function requestChanges() {
    setError(null);
    startTransition(async () => {
      const res = await decideProofByToken(
        token,
        proof.id,
        "CHANGES_REQUESTED",
        feedback,
      );
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <li className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">Version {proof.version}</span>
          <StatusBadge status={proof.status} />
        </div>
        <span className="text-muted-foreground text-xs">
          {formatDate(proof.createdAt)}
        </span>
      </div>

      {isImage(proof.mimeType) ? (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element -- local, non-optimizable upload */}
          <img
            src={fileUrl}
            alt={`Proof v${proof.version}`}
            className="max-h-64 rounded border object-contain"
          />
        </a>
      ) : (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline-offset-2 hover:underline"
        >
          Open PDF proof
        </a>
      )}

      {proof.note && <p className="text-sm">{proof.note}</p>}
      {proof.feedback && (
        <p className="text-sm">
          <span className="font-medium">Your feedback:</span> {proof.feedback}
        </p>
      )}

      {proof.status === "PENDING" && (
        <div className="space-y-2 border-t pt-2">
          <div className="flex gap-2">
            <Button size="sm" disabled={pending} onClick={approve}>
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setShowDecline((s) => !s)}
            >
              Request changes
            </Button>
          </div>
          {showDecline && (
            <div className="space-y-2">
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="What needs to change?"
                rows={2}
              />
              <Button size="sm" disabled={pending} onClick={requestChanges}>
                Submit
              </Button>
            </div>
          )}
        </div>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </li>
  );
}
