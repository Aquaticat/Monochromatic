// oxlint-disable typescript/no-unsafe-type-assertion, prefer-destructuring, require-await -- API response types require assertions; provider interface requires async
import type {
  BatchEmbeddingResult,
  EmbeddingProvider,
  EmbeddingResult,
  GeminiBatchEmbedRequest,
  GeminiBatchEmbedResponse,
  GeminiEmbedContentRequest,
  GeminiEmbedContentResponse,
  GeminiModel,
  ImageDiffConfig,
  ImageInput,
} from './types.ts';
import { toGeminiInlineData } from './encoding.ts';
import { l, tagged } from './log.ts';

/**
 * Gemini API base URL for embedding endpoints.
 */
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Default Gemini model -- latest multimodal embedding preview.
 */
const DEFAULT_GEMINI_MODEL: GeminiModel = 'gemini-embedding-2-preview';

/**
 * Resolve the Gemini API key from config or environment.
 *
 * @param configKey - explicitly provided API key, if any
 *
 * @returns resolved API key
 *
 * @throws when no API key is available from either source
 *
 * @example
 * ```ts
 * const key = resolveGeminiApiKey(undefined);
 * ```
 */
function resolveGeminiApiKey(configKey: string | undefined): string {
  const rl = tagged({ tag: resolveGeminiApiKey.name, l });
  const key = configKey ?? process.env['IMAGE_DIFF_GEMINI_API_KEY'] ?? process.env['GEMINI_API_KEY'];
  if (key === undefined || key === '') {
    throw new Error(
      'Gemini API key is required. Provide it via config.apiKey or set IMAGE_DIFF_GEMINI_API_KEY (or GEMINI_API_KEY) environment variable.',
    );
  }
  rl.debug('Gemini API key resolved');
  return key;
}

/**
 * Compute a single image embedding via the Gemini embedContent API.
 *
 * @param input - image to embed, in any supported format
 *
 * @param config - client configuration
 *
 * @returns embedding vector and usage metadata
 *
 * @example
 * ```ts
 * const { embedding } = await geminiEmbed({ path: './photo.png' }, {});
 * ```
 */
async function geminiEmbed(input: ImageInput, config: ImageDiffConfig): Promise<EmbeddingResult> {
  const rl = tagged({ tag: geminiEmbed.name, l });
  rl.debug('computing single image embedding via Gemini');

  const apiKey = resolveGeminiApiKey(config.apiKey);
  const model = (config.model as GeminiModel | undefined) ?? DEFAULT_GEMINI_MODEL;
  const inlineData = await toGeminiInlineData(input);

  const requestBody: GeminiEmbedContentRequest = {
    content: {
      parts: [{ inline_data: inlineData }],
    },
  };

  const url = `${GEMINI_API_BASE}/${model}:embedContent`;
  rl.debug(`calling Gemini API: ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    rl.error(`Gemini API returned ${String(response.status)}: ${errorBody}`);
    throw new Error(`Gemini API error (${String(response.status)}): ${errorBody}`);
  }

  const result = await response.json() as GeminiEmbedContentResponse;
  rl.debug(`received embedding with ${String(result.embedding.values.length)} dimensions`);

  return {
    embedding: result.embedding.values,
    usage: {
      textTokens: 0,
      imagePixels: 0,
      totalTokens: 0,
    },
  };
}

/**
 * Compute embeddings for multiple images via the Gemini batchEmbedContents API.
 *
 * @param inputs - array of images to embed
 *
 * @param config - client configuration
 *
 * @returns embedding vectors (in input order) and aggregate usage metadata
 *
 * @example
 * ```ts
 * const { embeddings } = await geminiEmbedBatch([{ path: 'a.png' }, { path: 'b.png' }], {});
 * ```
 */
async function geminiEmbedBatch(
  inputs: readonly ImageInput[],
  config: ImageDiffConfig,
): Promise<BatchEmbeddingResult> {
  const rl = tagged({ tag: geminiEmbedBatch.name, l });
  rl.debug(`computing batch embeddings via Gemini for ${String(inputs.length)} image(s)`);

  const apiKey = resolveGeminiApiKey(config.apiKey);
  const model = (config.model as GeminiModel | undefined) ?? DEFAULT_GEMINI_MODEL;

  const inlineDataItems = await Promise.all(
    inputs.map(async function convertInput(input) {
      return toGeminiInlineData(input);
    }),
  );

  const requestBody: GeminiBatchEmbedRequest = {
    requests: inlineDataItems.map(function wrapInlineData(inlineData) {
      return {
        model: `models/${model}`,
        content: {
          parts: [{ inline_data: inlineData }],
        },
      };
    }),
  };

  const url = `${GEMINI_API_BASE}/${model}:batchEmbedContents`;
  rl.debug(`calling Gemini batch API: ${url}, ${String(inputs.length)} input(s)`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    rl.error(`Gemini batch API returned ${String(response.status)}: ${errorBody}`);
    throw new Error(`Gemini API error (${String(response.status)}): ${errorBody}`);
  }

  const result = await response.json() as GeminiBatchEmbedResponse;
  rl.debug(`received ${String(result.embeddings.length)} embedding(s)`);

  return {
    embeddings: result.embeddings.map(function extractValues(e) {
      return e.values;
    }),
    usage: {
      textTokens: 0,
      imagePixels: 0,
      totalTokens: 0,
    },
  };
}

/**
 * Gemini embedding provider.
 * Implements the {@link EmbeddingProvider} interface for the Gemini multimodal API.
 *
 * @example
 * ```ts
 * const result = await geminiProvider.embed({ path: 'photo.png' }, {});
 * ```
 */
export const geminiProvider: EmbeddingProvider = {
  embed: geminiEmbed,
  embedBatch: geminiEmbedBatch,
};
