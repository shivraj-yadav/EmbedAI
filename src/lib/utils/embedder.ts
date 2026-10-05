// text-embedding-004 produces 768-dimensional vectors.
// This MUST match the vector(768) column in document_chunks.
export const EMBEDDING_DIMENSION = 768;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
// text-embedding-004 is only on v1, NOT v1beta.
// The @google/generative-ai SDK defaults to v1beta, so we call the REST API directly.
const EMBEDDING_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`

/**
 * Generate an embedding vector for a single text string via the Gemini v1 REST API.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch(EMBEDDING_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/text-embedding-004",
      content: { parts: [{ text }] },
      // Force 768 dimensions to match the vector(768) column in pgvector.
      // Without this, gemini-embedding-001 returns 3072 dims by default.
      outputDimensionality: 768,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding API error (${res.status}): ${err}`);
  }

  const data = await res.json();
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
