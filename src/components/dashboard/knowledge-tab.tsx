"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  UploadCloud,
  FileText,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Document {
  id: string;
  filename: string;
  file_url: string;
  status: "uploading" | "processing" | "ready" | "failed";
  error_message: string | null;
  file_size_bytes: number | null;
  chunk_count: number;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const FILE_ICON: Record<string, string> = {
  pdf: "📄",
  txt: "📝",
  docx: "📃",
};

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Document["status"] }) {
  const map = {
    uploading: { label: "Uploading", classes: "bg-blue-500/10 text-blue-400" },
    processing: { label: "Processing", classes: "bg-amber-500/10 text-amber-400" },
    ready: { label: "Ready", classes: "bg-emerald-500/10 text-emerald-400" },
    failed: { label: "Failed", classes: "bg-destructive/10 text-destructive" },
  };
  const { label, classes } = map[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full",
        classes
      )}
    >
      {status === "processing" && (
        <Loader2 className="w-3 h-3 animate-spin" />
      )}
      {status === "ready" && <CheckCircle2 className="w-3 h-3" />}
      {status === "failed" && <AlertTriangle className="w-3 h-3" />}
      {label}
    </span>
  );
}

// ─── Document row ─────────────────────────────────────────────────────────────

function DocumentRow({
  doc,
  onDelete,
}: {
  doc: Document;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const ext = doc.filename.split(".").pop()?.toLowerCase() ?? "";
  const icon = FILE_ICON[ext] ?? "📄";
  const canDelete = doc.status === "ready" || doc.status === "failed";

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        onDelete(doc.id);
        toast.success("Document deleted.");
      } else {
        toast.error("Failed to delete document.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card hover:border-border/80 transition-colors">
      {/* File icon */}
      <span className="text-2xl leading-none mt-0.5">{icon}</span>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-medium text-sm truncate">{doc.filename}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          {doc.file_size_bytes && <span>{formatBytes(doc.file_size_bytes)}</span>}
          {doc.file_size_bytes && <span>•</span>}
          <span>{formatDate(doc.created_at)}</span>
          {doc.status === "ready" && doc.chunk_count > 0 && (
            <>
              <span>•</span>
              <span>{doc.chunk_count} chunks</span>
            </>
          )}
        </div>
        {doc.status === "failed" && doc.error_message && (
          <p className="text-xs text-destructive mt-1">{doc.error_message}</p>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <StatusBadge status={doc.status} />

        {/* Delete button / confirm */}
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            disabled={!canDelete || deleting}
            aria-label={`Delete ${doc.filename}`}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              canDelete
                ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                : "text-muted-foreground/30 cursor-not-allowed"
            )}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs px-2"
              onClick={handleDelete}
              disabled={deleting}
              id={`confirm-delete-doc-${doc.id}`}
            >
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete"}
            </Button>
            <button
              onClick={() => setConfirming(false)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Upload zone ──────────────────────────────────────────────────────────────

function UploadZone({
  chatbotId,
  onUploaded,
  disabled,
}: {
  chatbotId: string;
  onUploaded: (doc: Document) => void;
  disabled: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [zoneError, setZoneError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_EXTS = ["pdf", "txt", "docx"];
  const MAX_MB = 10;

  function validateFile(file: File): string | null {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTS.includes(ext))
      return `"${file.name}" is not supported. Use PDF, TXT, or DOCX.`;
    if (file.size > MAX_MB * 1024 * 1024)
      return `"${file.name}" exceeds the 10 MB size limit.`;
    return null;
  }

  async function uploadFile(file: File) {
    setZoneError(null);
    const err = validateFile(file);
    if (err) {
      setZoneError(err);
      return;
    }

    setUploading(true);
    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`/api/chatbots/${chatbotId}/documents`, {
        method: "POST",
        body: form,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Upload failed.");
        setZoneError(data.error ?? "Upload failed.");
        return;
      }

      onUploaded(data as Document);
      if (data.status === "ready") {
        toast.success(`"${file.name}" processed successfully!`);
      } else if (data.status === "failed") {
        toast.error(`Processing failed: ${data.error_message}`);
      }
    } catch {
      toast.error("Network error. Please try again.");
      setZoneError("Network error. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled || uploading) return;
      const file = e.dataTransfer.files?.[0];
      if (file) uploadFile(file);
    },
    [disabled, uploading]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled && !uploading) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={cn(
        "relative flex flex-col items-center justify-center min-h-[200px] rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer",
        dragOver && !disabled
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40 hover:bg-muted/30",
        (disabled || uploading) && "opacity-60 cursor-not-allowed"
      )}
      onClick={() => {
        if (!disabled && !uploading) inputRef.current?.click();
      }}
      role="button"
      aria-label="Upload zone"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.docx"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file);
        }}
        disabled={disabled || uploading}
        id="document-file-input"
      />

      <div className="flex flex-col items-center gap-3 px-6 py-8 text-center pointer-events-none">
        {uploading ? (
          <>
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="font-medium text-sm">Processing document…</p>
            <p className="text-xs text-muted-foreground">
              Extracting text, generating embeddings…
            </p>
          </>
        ) : (
          <>
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                dragOver ? "bg-primary/20" : "bg-muted"
              )}
            >
              <UploadCloud
                className={cn(
                  "w-6 h-6 transition-colors",
                  dragOver ? "text-primary" : "text-muted-foreground"
                )}
              />
            </div>
            <div>
              <p className="font-medium text-sm">
                Drag &amp; Drop PDF, TXT, or DOCX files here
              </p>
              <p className="text-xs text-muted-foreground mt-1">or</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="pointer-events-auto"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
              id="browse-files-btn"
            >
              Browse Files
            </Button>
            <p className="text-xs text-muted-foreground">Max 10 MB per file</p>
          </>
        )}
      </div>

      {/* Inline zone error */}
      {zoneError && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center px-4">
          <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-1.5">
            {zoneError}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Knowledge Tab ───────────────────────────────────────────────────────

export function KnowledgeTab({ chatbotId }: { chatbotId: string }) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchDocuments() {
    const res = await fetch(`/api/chatbots/${chatbotId}/documents`);
    if (res.ok) {
      const data = await res.json();
      setDocuments(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchDocuments();
  }, [chatbotId]);

  // Poll while any document is still processing
  useEffect(() => {
    const hasActive = documents.some(
      (d) => d.status === "uploading" || d.status === "processing"
    );
    if (!hasActive) return;

    const interval = setInterval(fetchDocuments, 3000);
    return () => clearInterval(interval);
  }, [documents]);

  function handleUploaded(doc: Document) {
    setDocuments((prev) => {
      const exists = prev.find((d) => d.id === doc.id);
      if (exists) return prev.map((d) => (d.id === doc.id ? doc : d));
      return [doc, ...prev];
    });
  }

  function handleDeleted(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  const hasProcessing = documents.some(
    (d) => d.status === "uploading" || d.status === "processing"
  );

  return (
    <div className="max-w-3xl space-y-6">
      {/* Upload zone */}
      <UploadZone
        chatbotId={chatbotId}
        onUploaded={handleUploaded}
        disabled={hasProcessing}
      />

      {/* Document list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Documents ({documents.length})
          </h2>
          <button
            onClick={fetchDocuments}
            aria-label="Refresh document list"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-xl border border-border bg-card animate-pulse"
              />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3 rounded-xl border border-dashed border-border">
            <FileText className="w-8 h-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No documents yet. Upload your first file to train your chatbot.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} onDelete={handleDeleted} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
