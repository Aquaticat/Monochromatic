import { BEDROCK_MANTLE_BASE_URL, } from '../bedrock-catalog.ts';
import type { CardProvider, } from '../model-card-derive.ts';
import { StatedRefusalError, } from '../stated-refusal.ts';
import { SYNTHETIC_CHAT_BASE_URL, } from '../synthetic-catalog.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import { readAsk, } from './roster-card-ask.ts';
import {
  cardFieldsFrom,
  listingRowFor,
  NOT_LISTED,
  renderProviderCard,
} from './roster-card-render.ts';

//region Roster card
// PRINTS THE CARD FRAGMENT FOR ONE MODEL OFF A PROVIDER'S LIVE LISTING, so
// seating a model is: run this for each provider that serves it, paste the
// fragments into one card in `model-cards.ts`, add the spellings to the
// lists in `roster-id.ts`, run the package checks. The owner asked for the
// workflow on 2026-09-16 ("a reusable workflow or mise task or something
// should be built"); the cards are the workflow and this is its one tool.
//
// READ-ONLY AND KEY-SILENT: the key goes in a bearer header and is never
// printed; the listing is fetched once and only the named row is read.
//
// usage: mise run roster-card -- <synthetic|hyper|openrouter|bedrock> <served id>

/**
 Where each provider lists what it serves.
 */
const LISTING_URL: Readonly<Record<CardProvider, string>> = {
  synthetic: `${SYNTHETIC_CHAT_BASE_URL}/models`,
  hyper: 'https://hyper.charm.land/v1/models',
  openrouter: 'https://openrouter.ai/api/v1/models',
  bedrock: `${BEDROCK_MANTLE_BASE_URL}/v1/models`,
};

/**
 Environment variable carrying each provider's key, injected by mise.
 */
const KEY_VAR: Readonly<Record<CardProvider, string>> = {
  synthetic: 'TRANSLATION_REPAIR_SYNTHETIC_API_KEY',
  hyper: 'TRANSLATION_REPAIR_CHARM_HYPER_API_KEY',
  openrouter: 'TRANSLATION_REPAIR_OPENROUTER_API_KEY',
  bedrock: 'TRANSLATION_REPAIR_AMAZON_BEDROCK_API_KEY',
};

/**
 List constant in `roster-id.ts` each provider's spellings go on.
 */
const SERVED_LIST: Readonly<Record<CardProvider, string>> = {
  synthetic: 'SYNTHETIC_SERVED_IDS',
  hyper: 'HYPER_SERVED_IDS',
  openrouter: 'OPENROUTER_SERVED_IDS',
  bedrock: 'BEDROCK_SERVED_IDS',
};

/**
 Leading entries of process.argv that name the runtime and the script.
 */
const SCRIPT_ARGS = 2;

/**
 Characters of an ISO timestamp that spell the date.
 */
const DATE_CHARS = 10;

/**
 Fetches one provider's listing.

 @param provider - whose listing

 @returns Decoded body

 @throws {@link StatedRefusalError} When the key is unset or the provider
 answers with a non-ok status
 */
async function fetchListing(
  { provider, }: { readonly provider: CardProvider; },
): Promise<unknown> {
  /**
   Key by the provider's variable name, never printed.
   */
  const apiKey = process.env[KEY_VAR[provider]] ?? '';
  if (apiKey === '') {
    throw new StatedRefusalError({
      says: `${KEY_VAR[provider]} is not set; run under mise so sops injects it`,
    },);
  }
  /**
   Provider reply.
   */
  const reply = await fetch(
    LISTING_URL[provider],
    {
      method: 'GET',
      headers: { authorization: `Bearer ${apiKey}`, },
    },
  );
  if (!reply.ok) {
    throw new StatedRefusalError({
      says: `${LISTING_URL[provider]} answered ${String(reply.status,)}; the reason phrase is the provider's wording and is dropped`,
    },);
  }
  return await reply.json();
}

/**
 Prints the card fragment for the asked model.

 @throws {@link StatedRefusalError} When the listing does not name the
 served id, which is the answer a typo or a retired model gets

 @example
 ```ts
 await main();
 ```
 */
async function main(): Promise<void> {
  /**
   The whole command line.
   */
  const { argv: everyArg, } = process;
  /**
   Arguments after the script name, the runtime and the script itself dropped.
   */
  const argv = everyArg.slice(SCRIPT_ARGS,);
  /**
   Provider and served id asked for.
   */
  const {
    provider,
    servedId,
  } = readAsk({ argv, },);
  /**
   Row the listing carries for this id.
   */
  const row = listingRowFor({
    body: await fetchListing({ provider, },),
    servedId,
  },);
  if ((typeof row) === 'symbol') {
    throw new StatedRefusalError({
      says: `${LISTING_URL[provider]} lists no model under ${servedId}`,
    },);
  }
  /**
   Fragment to paste, with the listing's fields filled in.
   */
  const fragment = renderProviderCard({
    provider,
    servedId,
    fields: cardFieldsFrom({
      provider,
      row,
    },),
  },);
  // Raw output, deliberately: this is text a person pastes, not pipeline
  // logging, and the tagged logger would prefix every line. That is the
  // stated exception to the tagged-logger rule, as `model-catalog` uses it.
  /**
   Today, for the fragment's provenance line.
   */
  const today = new Date().toISOString();
  console.log([
    `// ${provider} side for ${servedId}, read from ${LISTING_URL[provider]} on ${today.slice(
      0,
      DATE_CHARS,
    )}`,
    fragment,
    '',
    `// 1. Add '${servedId}' to ${SERVED_LIST[provider]} in roster-id.ts.`,
    '// 2. If this is a new model, add its roster id (the first serving provider\'s',
    '//    spelling: Synthetic, else Hyper, else Bedrock, else OpenRouter) to',
    '//    ROSTER_MODEL_IDS and write its card in model-cards.ts with',
    "//    completionCap: 'pooled-p99' and holds ['judge-unmeasured',",
    "//    'writer-unmeasured', 'reader-unmeasured'] until each is measured.",
    '// 3. Run the package checks; model-cards.unit.test.ts holds the lists to the cards.',
    `// A ${String(NOT_LISTED.description,)} is printed as a question to answer by hand.`,
  ].join('\n',),);
}

if (import.meta.main)
  await reportingRefusals({
    what: 'roster-card',
    run: main,
  },);

//endregion Roster card
