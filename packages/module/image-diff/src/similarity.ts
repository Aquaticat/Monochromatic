/**
 * Compute the dot product of two vectors.
 * Voyage AI embeddings are unit-normalized, so the dot product equals cosine similarity.
 *
 * @param a - first embedding vector
 *
 * @param b - second embedding vector
 *
 * @returns dot product (cosine similarity for unit vectors)
 *
 * @throws when vectors have different lengths
 *
 * @example
 * ```ts
 * const sim = dotProduct({ a: [1, 0], b: [0, 1] }); // 0
 * const same = dotProduct({ a: [1, 0], b: [1, 0] }); // 1
 * ```
 */
export function dotProduct({
  a,
  b,
}: {
  a: readonly number[];
  b: readonly number[];
},): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector length mismatch: ${String(a.length,)} vs ${String(b.length,)}`,
    );
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    if (ai === undefined || bi === undefined)
      break;
    sum += ai * bi;
  }
  return sum;
}

/**
 * Compute cosine similarity between two embedding vectors.
 * For Voyage AI embeddings (already unit-normalized), this is equivalent to {@link dotProduct}.
 * This function handles arbitrary vectors by normalizing them first.
 *
 * @param a - first embedding vector
 *
 * @param b - second embedding vector
 *
 * @returns cosine similarity between -1 and 1
 *
 * @throws when vectors have different lengths or either has zero magnitude
 *
 * @example
 * ```ts
 * const sim = cosineSimilarity({ a: [3, 4], b: [4, 3] }); // ~0.96
 * ```
 */
export function cosineSimilarity({
  a,
  b,
}: {
  a: readonly number[];
  b: readonly number[];
},): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector length mismatch: ${String(a.length,)} vs ${String(b.length,)}`,
    );
  }

  const dot = dotProduct({
    a,
    b,
  },);
  const magnitude = Math.sqrt(dotProduct({
    a,
    b: a,
  },),) * Math.sqrt(dotProduct({
    a: b,
    b,
  },),);
  if (magnitude === 0) {
    throw new Error(
      'Cannot compute cosine similarity: one or both vectors have zero magnitude',
    );
  }

  return dot / magnitude;
}
