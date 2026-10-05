import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { uploadToImageKit } from "@/lib/imagekit";
import { extractText, cleanText } from "@/lib/utils/text-extractor";
import { chunkText } from "@/lib/utils/chunker";
import { generateEmbeddings } from "@/lib/utils/embedder";

type Params = { params: Promise<{ id: string }> };

const ALLOWED_TYPES = [
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ALLOWED_EXTENSIONS = ["pdf", "txt", "docx"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ─── GET /api/chatbots/:id/documents ─────────────────────────────────────────

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify chatbot ownership
  const { data: bot } = await supabase
    .from("chatbots")
    .select("id")
    .eq("id", id)
    .single();

  if (!bot) {
    return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
  }

  const { data: documents, error } = await supabase
    .from("documents")
    .select("id, filename, file_url, status, error_message, file_size_bytes, chunk_count, created_at")
    .eq("chatbot_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(documents ?? []);
}

// ─── POST /api/chatbots/:id/documents ────────────────────────────────────────

export async function POST(request: Request, { params }: Params) {
  const { id: chatbotId } = await params;
  const supabase = await createClient();
  const serviceClient = createServiceClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify chatbot ownership
  const { data: bot } = await supabase
    .from("chatbots")
    .select("id")
    .eq("id", chatbotId)
    .single();

  if (!bot) {
    return NextResponse.json({ error: "Chatbot not found or forbidden" }, { status: 404 });
  }

  // Parse multipart form
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate type
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: `File type .${ext} is not supported. Use PDF, TXT, or DOCX.` },
      { status: 400 }
    );
  }

  // Validate size
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File size exceeds 10MB limit." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // ── Step 1: Upload to ImageKit ──
  let fileUrl: string;
  let imagekitFileId: string;
  try {
    const uploaded = await uploadToImageKit(
      buffer,
      file.name,
      `/embedai/${chatbotId}`
    );
    fileUrl = uploaded.url;
    imagekitFileId = uploaded.fileId;
  } catch (err: any) {
    console.error("ImageKit upload error:", err);
    return NextResponse.json(
      { error: "File upload failed: " + err.message },
      { status: 500 }
    );
  }

  // ── Step 2: Insert document record (processing) ──
  const { data: doc, error: insertError } = await serviceClient
    .from("documents")
    .insert({
      chatbot_id: chatbotId,
      filename: file.name,
      file_url: fileUrl,
      imagekit_file_id: imagekitFileId,
      status: "processing",
      file_size_bytes: file.size,
    })
    .select()
    .single();

  if (insertError || !doc) {
    console.error("Document insert error:", insertError);
    return NextResponse.json(
      { error: "Failed to create document record." },
      { status: 500 }
    );
  }

  // ── Step 3: Extract text ──
  let rawText: string;
  try {
    rawText = await extractText(buffer, file.name);
  } catch (err: any) {
    await serviceClient
      .from("documents")
      .update({ status: "failed", error_message: "Text extraction failed: " + err.message })
      .eq("id", doc.id);
    return NextResponse.json(doc);
  }

  if (!rawText.trim()) {
    await serviceClient
      .from("documents")
      .update({ status: "failed", error_message: "No text could be extracted from this file." })
      .eq("id", doc.id);
    return NextResponse.json(doc);
  }

  // ── Step 4: Clean + Chunk ──
  const cleaned = cleanText(rawText);
  const chunks = chunkText(cleaned);

  if (chunks.length === 0) {
    await serviceClient
      .from("documents")
      .update({ status: "failed", error_message: "Document produced no text chunks." })
      .eq("id", doc.id);
    return NextResponse.json(doc);
  }

  // ── Step 5: Generate embeddings ──
  let embeddings: number[][];
  try {
    embeddings = await generateEmbeddings(chunks);
  } catch (err: any) {
    console.error("Embedding error:", err);
    await serviceClient
      .from("documents")
      .update({ status: "failed", error_message: "Embedding generation failed: " + err.message })
      .eq("id", doc.id);
    return NextResponse.json(doc);
  }

  // ── Step 6: Insert chunks ──
  const chunkRows = chunks.map((content, i) => ({
    document_id: doc.id,
    chatbot_id: chatbotId,
    content,
    embedding: JSON.stringify(embeddings[i]), // pgvector accepts JSON array
    chunk_index: i,
    metadata: {},
  }));

  const { error: chunkError } = await serviceClient
    .from("document_chunks")
    .insert(chunkRows);

  if (chunkError) {
    console.error("Chunk insert error:", chunkError);
    await serviceClient
      .from("documents")
      .update({ status: "failed", error_message: "Failed to store document chunks." })
      .eq("id", doc.id);
    return NextResponse.json(doc);
  }

  // ── Step 7: Mark as ready ──
  const { data: finalDoc } = await serviceClient
    .from("documents")
    .update({ status: "ready", chunk_count: chunks.length })
    .eq("id", doc.id)
    .select()
    .single();

  return NextResponse.json(finalDoc ?? doc, { status: 200 });
}
