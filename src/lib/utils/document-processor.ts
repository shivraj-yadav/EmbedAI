import { createServiceClient } from "@/lib/supabase/service";
import { extractText, cleanText } from "@/lib/utils/text-extractor";
import { chunkText } from "@/lib/utils/chunker";
import { generateEmbeddings } from "@/lib/utils/embedder";

export interface ProcessResult {
  success: boolean;
  error?: string;
  chunkCount?: number;
}

/**
 * Process a document buffer:
 * 1. Mark status as 'processing'
 * 2. Clear any existing chunks (idempotent)
 * 3. Extract text (PDF, DOCX, TXT)
 * 4. Clean & chunk text
 * 5. Generate embeddings with Gemini
 * 6. Store chunks in pgvector
 * 7. Mark status as 'ready' (or 'failed' on error)
 */
export async function processDocumentBuffer(
  buffer: Buffer,
  filename: string,
  docId: string,
  chatbotId: string
): Promise<ProcessResult> {
  const serviceClient = createServiceClient();

  // Step 1: Update status to processing and clear previous error
  await serviceClient
    .from("documents")
    .update({ status: "processing", error_message: null })
    .eq("id", docId);

  // Clear any existing chunks for this document (ensures clean retry)
  await serviceClient
    .from("document_chunks")
    .delete()
    .eq("document_id", docId);

  // Step 2: Extract text
  let rawText: string;
  try {
    rawText = await extractText(buffer, filename);
  } catch (err: any) {
    const errorMsg = "Text extraction failed: " + (err.message || String(err));
    await serviceClient
      .from("documents")
      .update({ status: "failed", error_message: errorMsg })
      .eq("id", docId);
    return { success: false, error: errorMsg };
  }

  if (!rawText.trim()) {
    const errorMsg = "No text could be extracted from this file.";
    await serviceClient
      .from("documents")
      .update({ status: "failed", error_message: errorMsg })
      .eq("id", docId);
    return { success: false, error: errorMsg };
  }

  // Step 3: Clean + Chunk
  const cleaned = cleanText(rawText);
  const chunks = chunkText(cleaned);

  if (chunks.length === 0) {
    const errorMsg = "Document produced no text chunks.";
    await serviceClient
      .from("documents")
      .update({ status: "failed", error_message: errorMsg })
      .eq("id", docId);
    return { success: false, error: errorMsg };
  }

  // Step 4: Generate embeddings
  let embeddings: number[][];
  try {
    embeddings = await generateEmbeddings(chunks);
  } catch (err: any) {
    const errorMsg = "Embedding generation failed: " + (err.message || String(err));
    console.error("Embedding error:", err);
    await serviceClient
      .from("documents")
      .update({ status: "failed", error_message: errorMsg })
      .eq("id", docId);
    return { success: false, error: errorMsg };
  }

  // Step 5: Insert chunks
  const chunkRows = chunks.map((content, i) => ({
    document_id: docId,
    chatbot_id: chatbotId,
    content,
    embedding: JSON.stringify(embeddings[i]),
    chunk_index: i,
    metadata: {},
  }));

  const { error: chunkError } = await serviceClient
    .from("document_chunks")
    .insert(chunkRows);

  if (chunkError) {
    const errorMsg = "Failed to store document chunks.";
    console.error("Chunk insert error:", chunkError);
    await serviceClient
      .from("documents")
      .update({ status: "failed", error_message: errorMsg })
      .eq("id", docId);
    return { success: false, error: errorMsg };
  }

  // Step 6: Mark as ready
  await serviceClient
    .from("documents")
    .update({ status: "ready", chunk_count: chunks.length, error_message: null })
    .eq("id", docId);

  return { success: true, chunkCount: chunks.length };
}
