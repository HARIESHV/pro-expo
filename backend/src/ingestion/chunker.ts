export interface Chunk {
  content: string;
  chunkIndex: number;
  totalChunks: number;
}

const DEFAULT_CHUNK_SIZE = 500;    // tokens (approx characters / 4)
const DEFAULT_CHUNK_OVERLAP = 100;

/**
 * Splits document content into overlapping chunks for embedding.
 * Uses sentence-boundary-aware splitting.
 */
export function chunkDocument(
  content: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_CHUNK_OVERLAP
): Chunk[] {
  const cleanContent = content.replace(/\s+/g, ' ').trim();
  if (!cleanContent) return [];

  // Split into sentences
  const sentences = cleanContent.match(/[^.!?\n]+[.!?\n]+/g) || [cleanContent];
  const chunks: string[] = [];
  let currentChunk = '';
  const charSize = chunkSize * 4; // approx chars per token

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > charSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        // Overlap: keep the last `overlap * 4` chars
        currentChunk = currentChunk.slice(-overlap * 4) + sentence;
      } else {
        // Sentence itself too long — force split
        chunks.push(sentence.trim());
        currentChunk = '';
      }
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.map((content, index) => ({
    content,
    chunkIndex: index,
    totalChunks: chunks.length,
  }));
}
