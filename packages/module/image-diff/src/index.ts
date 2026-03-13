/**
 * Perceptual image difference comparison using multimodal embeddings
 * from Voyage AI and Google Gemini.
 *
 * By default, all available providers are called concurrently with their
 * latest models. Use the `provider` config field to select a specific backend.
 *
 * @example
 * ```ts
 * import { compareAll } from '@monochromatic-dev/module-image-diff';
 *
 * // Compare using all providers (Voyage + Gemini)
 * const results = await compareAll(
 *   { path: './before.png' },
 *   { path: './after.png' },
 * );
 * for (const { provider, result } of results) {
 *   console.log(`${provider}: similarity=${result.similarity}`);
 * }
 * ```
 *
 * @example
 * ```ts
 * import { compare } from '@monochromatic-dev/module-image-diff';
 *
 * // Compare using a specific provider
 * const result = await compare(
 *   { path: './before.png' },
 *   { path: './after.png' },
 *   { provider: 'gemini' },
 * );
 * ```
 *
 * @packageDocumentation
 */

export {
  compare,
  compareAll,
  embed,
  embedAll,
  embedBatch,
  embedBatchAll,
} from './client.ts';
export type {
  MultiProviderBatchEmbedEntry,
  MultiProviderComparisonEntry,
  MultiProviderEmbedEntry,
} from './client.ts';
export { dotProduct, cosineSimilarity } from './similarity.ts';
export { voyageProvider } from './voyage.ts';
export { geminiProvider } from './gemini.ts';
export type {
  BatchEmbeddingResult,
  ComparisonResult,
  EmbeddingModel,
  EmbeddingProvider,
  EmbeddingResult,
  GeminiModel,
  ImageBase64,
  ImageBuffer,
  ImageDiffConfig,
  ImageFormat,
  ImageInput,
  ImagePath,
  ImageUrl,
  Provider,
  VoyageModel,
} from './types.ts';
