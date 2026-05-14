import { parseImageArg, } from './cli.image.ts';
import { compareAll, } from './client.multi.compare.ts';
import { compare, } from './client.ts';
import {
  l,
  tagged,
} from './log.ts';
import type {
  EmbeddingModel,
  Provider,
} from './types.ts';

/**
 * Handle the `compare` subcommand.
 *
 * @param imageA - first image argument (path or URL)
 *
 * @param imageB - second image argument (path or URL)
 *
 * @param provider - provider name, or undefined to use all providers
 *
 * @param model - model override, or undefined for the provider's default
 *
 * @example
 * ```ts
 * await handleCompare({
 *   imageA: 'a.png',
 *   imageB: 'b.png',
 *   provider: 'voyage',
 *   model: undefined,
 * });
 * ```
 */
export async function handleCompare({
  imageA,
  imageB,
  provider,
  model,
}: {
  imageA: string;
  imageB: string;
  provider: Provider | undefined;
  model: EmbeddingModel | undefined;
},): Promise<void> {
  const rl = tagged({
    tag: handleCompare.name,
    l,
  },);
  const inputA = parseImageArg(imageA,);
  const inputB = parseImageArg(imageB,);

  if (provider !== undefined) {
    rl.debug(`comparing via ${provider}`,);
    const config = {
      provider,
      ...(model !== undefined ? { model, } : {}),
    };
    const result = await compare({
      imageA: inputA,
      imageB: inputB,
      config,
    },);

    console.log(JSON.stringify(
      {
        provider,
        similarity: result.similarity,
        distance: result.distance,
        embeddingDimensions: result.embeddingA.length,
        description: result.description,
      },
      null,
      2,
    ),);
  }
  else {
    rl.debug('comparing via all providers',);
    const results = await compareAll({
      imageA: inputA,
      imageB: inputB,
    },);

    console.log(JSON.stringify(
      results.map(function formatEntry(entry,) {
        return {
          provider: entry.provider,
          similarity: entry.result.similarity,
          distance: entry.result.distance,
          embeddingDimensions: entry.result.embeddingA.length,
          description: entry.result.description,
        };
      },),
      null,
      2,
    ),);
  }
}
