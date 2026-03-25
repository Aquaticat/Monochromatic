// oxlint-disable prefer-destructuring -- CLI handler with array access patterns
import {
  parseFlags,
  parseImageArg,
} from './cli.parse.ts';
import { embedAll, } from './client.multi.ts';
import { embed, } from './client.ts';
import {
  l,
  tagged,
} from './log.ts';

/**
 * Handle the `embed` subcommand.
 *
 * @param args - CLI arguments after "embed"
 *
 * @param printUsageAndExit - callback to print usage and exit on errors
 */
export async function handleEmbed(
  args: string[],
  printUsageAndExit: () => never,
): Promise<void>
{
  const rl = tagged({
    tag: handleEmbed.name,
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

  if (remaining.length !== 1) {
    console.error('Error: embed requires exactly 1 image argument',);
    printUsageAndExit();
  }

  const embedArg = remaining[0];
  if (embedArg === undefined) {
    console.error('Error: embed requires exactly 1 image argument',);
    printUsageAndExit();
  }
  const image = parseImageArg(embedArg,);

  if (provider !== undefined) {
    rl.debug(`embedding via ${provider}`,);
    const config = {
      provider,
      ...(model !== undefined ? { model, } : {}),
    };
    const result = await embed(
      image,
      config,
    );

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
    const results = await embedAll(image,);

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
