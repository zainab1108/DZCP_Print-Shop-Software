"use client";

import { useRef, useState, useTransition } from "react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  decideProofAsAdmin,
  deleteProof,
  uploadProof,
} from "@/lib/actions/proofs";
import { formatDate } from "@/lib/format";

export interface ProofRow {
  id: string;
  version: number;
  fileName: string;
  mimeType: string;
  status: "PENDING" | "APPROVED" | "CHANGES_REQUESTED";
  note: string | null;
  feedback: string | null;
  decidedAt: string | null; // ISO
  createdAt: string; // ISO
}

const isImage = (mime: string) => mime.startsWith("image/");

export function ProofsSection({
  quoteId,
  proofs,
}: {
  quoteId: string;
  proofs: ProofRow[];
}) {
  return (
    <div className="space-y-4">
      {proofs.length === 0 ? (
        <p className="text-muted-foreground text-sm">No proofs uploaded yet.</p>
      ) : (
        <ul className="space-y-3">
          {[...proofs]
            .sort((a, b) => b.version - a.version)
            .map((p) => (
              <ProofCard key={p.id} proof={p} />
            ))}
        </ul>
      )}
      <UploadForm quoteId={quoteId} />
    </div>
  );
}

function ProofCard({ proof }: { proof: ProofRow }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState("");
  const [showDecline, setShowDecline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function approve() {
    setError(null);
    startTransition(async () => {
      const res = await decideProofAsAdmin(proof.id, "APPROVED");
      if (!res.ok) setError(res.error);
    });
  }

  function requestChanges() {
    setError(null);
    startTransition(async () => {
      const res = await decideProofAsAdmin(
        proof.id,
        "CHANGES_REQUESTED",
        feedback,
      );
      if (res.ok) setShowDecline(false);
      else setError(res.error);
    });
  }

  function remove() {
    if (!confirm(`Delete v${proof.version}? This can't be undone.`)) return;
    startTransition(async () => {
      const res = await deleteProof(proof.id);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <li className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">v{proof.version}</span>
          <StatusBadge status={proof.status} />
          <span className="text-muted-foreground text-xs">
            {formatDate(proof.createdAt)}
          </span>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/proofs/${proof.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline-offset-2 hover:underline"
          >
            {isImage(proof.mimeType) ? "View" : "Open PDF"}
          </a>
          <Button variant="ghost" size="sm" disabled={pending} onClick={remove}>
            Delete
          </Button>
        </div>
      </div>

      {isImage(proof.mimeType) && (
        <a
          href={`/api/proofs/${proof.id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local, non-optimizable upload */}
          <img
            src={`/api/proofs/${proof.id}`}
            alt={`Proof v${proof.version}`}
            className="max-h-48 rounded border object-contain"
          />
        </a>
      )}

      <p className="text-muted-foreground text-sm">{proof.fileName}</p>
      {proof.note && <p className="text-sm">Note: {proof.note}</p>}
      {proof.feedback && (
        <p className="text-sm">
          <span className="font-medium">Customer feedback:</span>{" "}
          {proof.feedback}
        </p>
      )}

      {proof.status === "PENDING" && (
        <div className="space-y-2 border-t pt-2">
          <p className="text-muted-foreground text-xs">
            Record a decision made by phone or email.
          </p>
          <div className="flex gap-2">
            <Button size="sm" disabled={pending} onClick={approve}>
              Mark approved
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

function UploadForm({ quoteId }: { quoteId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await uploadProof(quoteId, formData);
      if (res.ok) formRef.current?.reset();
      else setError(res.error);
    });
  }

  return (
    <form ref={formRef} action={submit} className="space-y-2 border-t pt-4">
      <Label htmlFor="proof-file">Upload new proof version</Label>
      <Input
        id="proof-file"
        name="file"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
        required
      />
      <Input name="note" placeholder="Note shown to the customer (optional)" />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Uploading…" : "Upload"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </form>
  );
}
