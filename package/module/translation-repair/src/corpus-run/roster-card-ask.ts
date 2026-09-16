import type { CardProvider, } from '../model-card-derive.ts';
import { StatedRefusalError, } from '../stated-refusal.ts';

//region Roster card ask
// THE COMMAND LINE OF `roster-card`, kept apart from the entry so the entry
// module exports nothing: an exported entry is bundled as a shared chunk,
// and `import.meta.main` is then false inside it and the task prints
// nothing (measured 2026-09-16 on the first build of the task).

/**
 Providers as the command line may name them.
 */
const PROVIDERS: readonly CardProvider[] = [
  'synthetic',
  'hyper',
  'openrouter',
  'bedrock',
];

/**
 Reads the provider and served id off the command line.

 @param argv - arguments after the script

 @returns Provider and served id

 @throws {@link StatedRefusalError} When either is missing or the provider
 is not one of the four

 @example
 ```ts
 const asked = readAsk({ argv: process.argv.slice(2,), },);
 ```
 */
export function readAsk(
  { argv, }: { readonly argv: readonly string[]; },
): {
  readonly provider: CardProvider;
  readonly servedId: string;
} {
  /**
   Provider and served id as written.
   */
  const [
    providerWritten,
    servedId,
  ] = argv;
  /**
   Provider as written, if it is one of the four.
   */
  const provider = PROVIDERS.find(function is(candidate,): boolean {
    return candidate === providerWritten;
  },);
  /**
   Whether the ask names both parts.
   */
  const complete = (provider !== undefined)
    && (servedId !== undefined)
    && (servedId !== '');
  if (!complete) {
    throw new StatedRefusalError({
      says: `usage: roster-card <${PROVIDERS.join('|',)}> <served id>`,
    },);
  }
  return {
    provider,
    servedId,
  };
}

//endregion Roster card ask
