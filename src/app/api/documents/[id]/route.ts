import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { deleteFromImageKit } from "@/lib/imagekit";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
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
    .select("id, imagekit_file_id, chatbot_id, chatbots!inner(user_id)")
    .eq("id", documentId)
    .single();

  if (fetchError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Delete chunks first (CASCADE also handles it, but explicit is safer)
  await serviceClient
    .from("document_chunks")
    .delete()
    .eq("document_id", documentId);

  // Delete from ImageKit
  if (doc.imagekit_file_id) {
    try {
      await deleteFromImageKit(doc.imagekit_file_id);
    } catch (err) {
      console.error("ImageKit delete error (continuing):", err);
      // Don't block DB deletion if ImageKit fails
    }
  }

  // Delete document record
  const { error: deleteError } = await serviceClient
    .from("documents")
    .delete()
    .eq("id", documentId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
