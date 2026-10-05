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

interface BatchProgress {
  total: number;
  current: number;
  currentFile: string;
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
      {status === "uploading" && (
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
  onUpdate,
}: {
  doc: Document;
  onDelete: (id: string) => void;
  onUpdate: (doc: Document) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);

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

  async function handleRetry() {
    setRetrying(true);
    onUpdate({ ...doc, status: "processing", error_message: null });
    try {
      const res = await fetch(`/api/documents/${doc.id}/retry`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Retry failed.");
        if (data.id) onUpdate(data);
      } else {
        onUpdate(data);
        if (data.status === "ready") {
          toast.success(`"${doc.filename}" processed successfully!`);
        } else if (data.status === "failed") {
          toast.error(`Retry failed: ${data.error_message}`);
        }
      }
    } catch {
      toast.error("Network error during retry.");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="p-4 rounded-xl border border-border bg-card hover:border-border/80 transition-colors space-y-3">
      <div className="flex items-start gap-4">
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

        {/* Actions & Status */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={doc.status} />

          {/* Retry Button for Failed Docs */}
          {doc.status === "failed" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2.5 gap-1.5 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
              onClick={handleRetry}
              disabled={retrying}
              title="Retry extraction and embedding"
            >
              <RefreshCw className={cn("w-3 h-3", retrying && "animate-spin")} />
              <span>{retrying ? "Retrying..." : "Retry"}</span>
            </Button>
          )}

          {/* Delete button / confirm */}
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              disabled={!canDelete || deleting || retrying}
              aria-label={`Delete ${doc.filename}`}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                canDelete && !retrying
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

      {/* Progress Bars for Active States */}
      {doc.status === "uploading" && (
        <div className="space-y-1.5 pt-1 border-t border-border/40">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
              Uploading to cloud storage...
            </span>
            <span className="font-mono text-blue-400">30%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-blue-500 animate-pulse transition-all duration-300 w-[30%]" />
          </div>
        </div>
      )}

      {doc.status === "processing" && (
        <div className="space-y-1.5 pt-1 border-t border-border/40">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
              Extracting text &amp; generating vector embeddings...
            </span>
            <span className="font-mono text-amber-400">70%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-amber-500 animate-pulse transition-all duration-300 w-[70%]" />
          </div>
        </div>
      )}
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
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
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

  async function uploadFiles(fileList: File[]) {
    if (fileList.length === 0) return;
    setZoneError(null);

    // Validate files
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const f of fileList) {
      const err = validateFile(f);
      if (err) errors.push(err);
      else validFiles.push(f);
    }

    if (errors.length > 0) {
      setZoneError(errors.slice(0, 2).join(" • ") + (errors.length > 2 ? ` (+${errors.length - 2} more)` : ""));
      if (validFiles.length === 0) return;
    }

    setUploading(true);
    let successCount = 0;

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      setBatchProgress({
        total: validFiles.length,
        current: i + 1,
        currentFile: file.name,
      });

      const form = new FormData();
      form.append("file", file);

      try {
        const res = await fetch(`/api/chatbots/${chatbotId}/documents`, {
          method: "POST",
          body: form,
        });

        const data = await res.json();

        if (!res.ok) {
          toast.error(`"${file.name}": ${data.error ?? "Upload failed."}`);
        } else {
          onUploaded(data as Document);
          if (data.status === "ready") {
            successCount++;
          } else if (data.status === "failed") {
            toast.error(`"${file.name}": ${data.error_message ?? "Processing failed"}`);
          }
        }
      } catch {
        toast.error(`"${file.name}": Network error.`);
      }
    }

    if (successCount > 0) {
      toast.success(
        successCount === 1
          ? "Document processed successfully!"
          : `${successCount} documents processed successfully!`
      );
    }

    setUploading(false);
    setBatchProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled || uploading) return;
      const files = Array.from(e.dataTransfer.files ?? []);
      if (files.length > 0) uploadFiles(files);
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
        "relative flex flex-col items-center justify-center min-h-[210px] rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer",
        dragOver && !disabled
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40 hover:bg-muted/30",
        (disabled || uploading) && "opacity-80 cursor-not-allowed"
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
        multiple
        accept=".pdf,.txt,.docx"
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) uploadFiles(files);
        }}
        disabled={disabled || uploading}
        id="document-file-input"
      />

      <div className="flex flex-col items-center gap-3 px-6 py-8 text-center pointer-events-none w-full max-w-md">
        {uploading && batchProgress ? (
          <div className="flex flex-col items-center gap-3 w-full animate-in fade-in duration-200">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <div>
              <p className="font-medium text-sm">
                Processing {batchProgress.current} of {batchProgress.total}
              </p>
              <p className="text-xs text-muted-foreground truncate max-w-xs mt-0.5">
                {batchProgress.currentFile}
              </p>
            </div>

            {/* Overall batch progress bar */}
            <div className="w-full space-y-1.5 mt-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{
                    width: `${Math.round((batchProgress.current / batchProgress.total) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Batch upload</span>
                <span className="font-mono">
                  {Math.round((batchProgress.current / batchProgress.total) * 100)}%
                </span>
              </div>
            </div>
          </div>
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
                Drag &amp; Drop multiple PDF, TXT, or DOCX files here
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
            <p className="text-xs text-muted-foreground">Max 10 MB per file • Multi-file supported</p>
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

  function handleUpdated(doc: Document) {
    setDocuments((prev) => prev.map((d) => (d.id === doc.id ? doc : d)));
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
              <DocumentRow
                key={doc.id}
                doc={doc}
                onDelete={handleDeleted}
                onUpdate={handleUpdated}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
