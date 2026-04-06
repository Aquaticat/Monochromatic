// oxlint-disable prefer-destructuring -- CLI handler with array access patterns
import {
  parseFlags,
  parseImageArg,
} from './cli.parse.ts';
import { compareAll, } from './client.multi.compare.ts';
import { compare, } from './client.ts';
import {
  l,
  tagged,
} from './log.ts';

/**
 * Handle the `compare` subcommand.
 *
 * @param args - CLI arguments after "compare"
 *
 * @param printUsageAndExit - callback to print usage and exit on errors
 *
 * @example
 * ```ts
 * await handleCompare(['imageA.png', 'imageB.png'], printUsageAndExit);
 * ```
 */
export async function handleCompare(
  args: string[],
  printUsageAndExit: () => never,
): Promise<void> {
  const rl = tagged({
    tag: handleCompare.name,
    l,
  },);
  const {
    provider,
    model,
    remaining,
  } = parseFlags(
    args,
    printUsageAndExit,
  );

  if (remaining.length !== 2) {
    console.error('Error: compare requires exactly 2 image arguments',);
    printUsageAndExit();
  }

  const argA = remaining[0];
  const argB = remaining[1];
  if (argA === undefined || argB === undefined) {
    console.error('Error: compare requires exactly 2 image arguments',);
    printUsageAndExit();
  }
  const imageA = parseImageArg(argA,);
  const imageB = parseImageArg(argB,);

  if (provider !== undefined) {
    rl.debug(`comparing via ${provider}`,);
    const config = {
      provider,
      ...(model !== undefined ? { model, } : {}),
    };
    const result = await compare(
      imageA,
      imageB,
      config,
    );

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
    const results = await compareAll(
      imageA,
      imageB,
    );

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
