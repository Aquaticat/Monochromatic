import { SYNTHETIC_CHAT_BASE_URL, } from '../synthetic-catalog.ts';
import {
  CATALOG_MODEL_IDS,
  compareCatalog,
  decodeModelList,
  formatCatalogReport,
} from './model-catalog-compare.ts';

//region Model catalog drift
// Asks the provider what it currently serves and compares that against the
// catalog this pipeline compiles against.
//
// This exists because the drift has already happened and cost silently. Two ids
// were removed on 2026-08-05 after both began answering HTTP 404 "is no longer
// supported", and 404 is not in the transient retry set, so every stage holding
// one of them lost a voice per call and nothing said why. The catalog comment
// records facts "verified live on 2026-07-16", and a hand-verified note is
// exactly the kind of claim that rots without announcing it.
//
// It also answers a roster question that cannot be answered from the catalog
// alone: whether any model exists that holds NO role in a run. Critics, panel
// and judges are all the same six, so no judge is independent of the issue it
// would judge, and a genuinely independent judge needs a model the run does not
// already use.
//
// Read-only. Prints ids and nothing else: the key is never rendered.

/**
 * Where the provider lists what it serves.
 */
const MODELS_URL = `${SYNTHETIC_CHAT_BASE_URL}/models`;

/**
 * Fetches the provider's current model list.
 *
 * @param apiKey - Synthetic key, sent as a bearer token and never printed
 *
 * @returns Parsed response body
 *
 * @throws {@link Error} when the provider answers with a non-ok status
 *
 * @example
 * ```ts
 * const body = await fetchModels({ apiKey, },);
 * ```
 */
async function fetchModels(
  {
    apiKey,
  }: {
    readonly apiKey: string;
  },
): Promise<unknown> {
  /**
   * Provider reply.
   */
  const reply = await fetch(
    MODELS_URL,
    {
      method: 'GET',
      headers: { authorization: `Bearer ${apiKey}`, },
    },
  );
  if (!reply.ok)
    throw new Error(`${MODELS_URL} answered ${String(reply.status,)} ${reply.statusText}`,);
  return await reply.json();
}

/**
 * Reports how the provider's current offering differs from the catalog.
 *
 * @throws {@link Error} when the key is absent, so the failure names the fix
 * rather than surfacing as an authentication error
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  /**
   * Synthetic API key, resolved by name from the mise-injected env.
   */
  const apiKey = process.env
    .TRANSLATION_REPAIR_SYNTHETIC_API_KEY
    ?? '';
  if (apiKey === '')
    throw new Error(
      'TRANSLATION_REPAIR_SYNTHETIC_API_KEY is not set; run under mise so sops injects it',
    );

  /**
   * Every model the provider currently serves, aliases included.
   */
  const served = decodeModelList({ body: await fetchModels({ apiKey, },), },);

  /**
   * Drift in both directions, plus the aliases held out of the catalog.
   */
  const comparison = compareCatalog({
    served,
    catalog: CATALOG_MODEL_IDS,
  },);

  // Raw output, deliberately: this is a report a human reads, not pipeline
  // logging, and the tagged logger would wrap every line in a prefix. That is
  // the stated exception to the tagged-logger rule, and it needs no
  // suppression: the corpus-run scripts are all shaped this way.
  console.log(formatCatalogReport({ comparison, },),);
}

// Guarded so this runs only when INVOKED. Unguarded it ran on IMPORT, so
// anything pulling this module into the bundle performed the whole task as a
// side effect of loading the library: for the probing scripts that means live
// model calls, and for every one of them it means writing files.
if (import.meta.main)
  await main();

//endregion Model catalog drift
