import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { processDocumentBuffer } from "@/lib/utils/document-processor";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id: documentId } = await params;
  const supabase = await createClient();
  const serviceClient = createServiceClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch document with ownership check via chatbot
  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("id, filename, file_url, chatbot_id, chatbots!inner(user_id)")
    .eq("id", documentId)
    .single();

  if (fetchError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Fetch file content from ImageKit URL
  let buffer: Buffer;
  try {
    const res = await fetch(doc.file_url);
    if (!res.ok) {
      throw new Error(`Failed to fetch file from storage: HTTP ${res.status}`);
    }
    buffer = Buffer.from(await res.arrayBuffer());
  } catch (err: any) {
    console.error("Error fetching file for retry:", err);
    await serviceClient
      .from("documents")
      .update({
        status: "failed",
        error_message: "Failed to download stored file: " + (err.message || String(err)),
      })
      .eq("id", documentId);

    const { data: updatedDoc } = await serviceClient
      .from("documents")
      .select("id, filename, file_url, status, error_message, file_size_bytes, chunk_count, created_at")
      .eq("id", documentId)
      .single();

    return NextResponse.json(updatedDoc, { status: 500 });
  }

  // Run processing pipeline
  await processDocumentBuffer(buffer, doc.filename, doc.id, doc.chatbot_id);

  // Return refreshed document
  const { data: updatedDoc } = await serviceClient
    .from("documents")
    .select("id, filename, file_url, status, error_message, file_size_bytes, chunk_count, created_at")
    .eq("id", documentId)
    .single();

  return NextResponse.json(updatedDoc ?? doc, { status: 200 });
}
