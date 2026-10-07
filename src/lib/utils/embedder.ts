// gemini-embedding-001 with outputDimensionality: 768 produces 768-dimensional vectors.
// This MUST match the vector(768) column in document_chunks.
export const EMBEDDING_DIMENSION = 768;

/**
 * Generate an embedding vector for a single text string via Gemini REST API.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in environment variables");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      // Force 768 dimensions to match the vector(768) column in pgvector.
      outputDimensionality: EMBEDDING_DIMENSION,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  if (!data?.embedding?.values) {
    throw new Error("Invalid embedding response format from Gemini API");
  }
  return data.embedding.values as number[];
}

/**
 * Generate embeddings for multiple texts sequentially.
 * Adds a small delay every 5 chunks to avoid free-tier rate limits.
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i++) {
    const embedding = await generateEmbedding(texts[i]);
    embeddings.push(embedding);

    // Throttle: 500ms pause every 5 requests to stay within rate limits
    if (i > 0 && i % 5 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return embeddings;
}
