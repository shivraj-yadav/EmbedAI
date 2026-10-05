// ~1800 chars ≈ ~450 tokens (safe for 512 token limit in many models)
// text-embedding-004 supports up to 2048 tokens, so this is very safe.
const CHUNK_SIZE = 1800;
const OVERLAP = 200;
// Minimum chunk length to bother embedding — lowered to handle tiny files
const MIN_CHUNK_LENGTH = 3;

/**
 * Split cleaned text into overlapping chunks.
 * Tries to break at sentence boundaries for better semantic coherence.
 * Handles tiny documents (< CHUNK_SIZE chars) by returning them as a single chunk.
 */
export function chunkText(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // If the whole document is smaller than one chunk, return it as-is
  if (trimmed.length <= CHUNK_SIZE) {
    return trimmed.length >= MIN_CHUNK_LENGTH ? [trimmed] : [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < trimmed.length) {
    let end = Math.min(start + CHUNK_SIZE, trimmed.length);

    // If not at end, try to break at a sentence boundary
    if (end < trimmed.length) {
      const sentenceBreaks = [". ", ".\n", "? ", "! ", "\n\n", "\n"];
      let breakAt = -1;

      for (const bp of sentenceBreaks) {
        const idx = trimmed.lastIndexOf(bp, end);
        if (idx > start + CHUNK_SIZE * 0.5) {
          breakAt = idx + bp.length;
          break;
        }
      }

      if (breakAt > start) {
        end = breakAt;
      }
    }

    const chunk = trimmed.slice(start, end).trim();
    if (chunk.length >= MIN_CHUNK_LENGTH) {
      chunks.push(chunk);
    }

    // Move forward, keeping the overlap from the previous chunk
    const nextStart = end - OVERLAP;
    if (nextStart <= start || nextStart >= trimmed.length) break;
    start = nextStart;
  }

  return chunks;
}
