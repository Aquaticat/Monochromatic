import { parseImageArg, } from './cli.image.ts';
import { embedAll, } from './client.multi.ts';
import { embed, } from './client.ts';
import {
  l,
  tagged,
} from './log.ts';
import type {
  EmbeddingModel,
  Provider,
} from './types.ts';

/**
 * Handle the `embed` subcommand.
 *
 * @param image - image argument (path or URL)
 *
 * @param provider - provider name, or undefined to use all providers
 *
 * @param model - model override, or undefined for the provider's default
 *
 * @example
 * ```ts
 * await handleEmbed({
 *   image: 'photo.png',
 *   provider: 'voyage',
 *   model: undefined,
 * });
 * ```
 */
export async function handleEmbed({
  image,
  provider,
  model,
}: {
  image: string;
  provider: Provider | undefined;
  model: EmbeddingModel | undefined;
},): Promise<void> {
  /** Logger pre-tagged with this function's name so call-site context is preserved across debug lines. */
  const rl = tagged({
    tag: handleEmbed.name,
    l,
  },);
  /**
   * Parsed image input; converts the CLI path-or-URL string into the structured {@link ImageInput}.
   */
  const input = parseImageArg(image,);

  if (provider !== undefined) {
    rl.debug(`embedding via ${provider}`,);
    /** Single-provider config; only includes `model` when the caller passed an override. */
    const config = {
      provider,
      ...(model !== undefined ? { model, } : {}),
    };
    /** Single-provider embedding result; printed as JSON below. */
    const result = await embed({
      input,
      config,
    },);

    console.log(JSON.stringify(
      {
        provider,
        dimensions: result.embedding.length,
        usage: result.usage,
        embedding: result.embedding,
      },
      null,
      2,
    ),);
  }
  else {
    rl.debug('embedding via all providers',);
    /** Per-provider embedding entries from the multi-provider dispatch; printed as JSON below. */
    const results = await embedAll(input,);

    console.log(JSON.stringify(
      results.map(function formatEntry(entry,) {
        return {
          provider: entry.provider,
          dimensions: entry.result.embedding.length,
          usage: entry.result.usage,
          embedding: entry.result.embedding,
        };
      },),
      null,
      2,
    ),);
  }
}
