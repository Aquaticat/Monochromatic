/**
 * Tests for where run artifacts are written.
 *
 * `resolveRunsDir` had no test. Everything durable a run produces lands under
 * the path it returns: artifacts, logs, the attempts map, and the grading
 * sheets a human spends hours on. The sheet-path guard refuses to overwrite a
 * final sheet, but that guard only protects paths under whatever this function
 * resolved, so a wrong answer here relocates the entire protected area rather
 * than defeating one check.
 *
 * The empty-string case is the one worth having. An exported-but-empty
 * environment variable is a normal shell accident, and a bare truthiness check
 * would treat it as an override, resolving every artifact path relative to the
 * process working directory instead of the runs directory.
 *
 * The override is injected as a disposable so the variable is restored however
 * a case ends, following the pattern in
 * `package/pi-plugin/morph-compact/src/api-key.unit.test.ts`.
 *
 * @module
 */

import {
  caught,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  createRunClient,
  HYPER_MESSAGES_URL,
  readHeadSha,
  resolveRunsDir,
  RUN_SEATS,
  RunConfigError,
  StatedRefusalError,
} from '../../dist/final/node/index.mjs';

/**
 * Environment variable that overrides the runs directory.
 */
const RUNS_DIR_VAR = 'TRANSLATION_REPAIR_RUNS_DIR';

/**
 * Sets the override for the life of a scope and restores it on exit.
 *
 * @param value - override to install; the empty string is meaningful here
 *
 * @returns Disposable restoring the previous value, including its absence
 *
 * @example
 * ```ts
 * using _override = withRunsDir({ value: '/tmp/whiskers', },);
 * ```
 */
function withRunsDir({ value, }: { readonly value: string; },): Disposable {
  /**
   * Value before this scope; absent means the variable was unset.
   */
  const original = process.env[RUNS_DIR_VAR];
  process.env[RUNS_DIR_VAR] = value;
  return {
    [Symbol.dispose](): void {
      if (original === undefined)
        Reflect.deleteProperty(process.env, RUNS_DIR_VAR,);
      else
        process.env[RUNS_DIR_VAR] = original;
    },
  };
}

/**
 * Removes the override for the life of a scope and restores it on exit.
 *
 * @returns Disposable restoring the previous value
 *
 * @example
 * ```ts
 * using _unset = withoutRunsDir();
 * ```
 */
function withoutRunsDir(): Disposable {
  /**
   * Value before this scope; absent means the variable was already unset.
   */
  const original = process.env[RUNS_DIR_VAR];
  Reflect.deleteProperty(process.env, RUNS_DIR_VAR,);
  return {
    [Symbol.dispose](): void {
      if (original !== undefined)
        process.env[RUNS_DIR_VAR] = original;
    },
  };
}

await describe({
  name: resolveRunsDir.name,
  children: [
    it({
      name: 'honors an explicit override exactly, so a run can be pointed at a '
        + 'throwaway directory without touching the real one',
      fn: async () => {
        using _override = withRunsDir({ value: '/tmp/whiskers-runs', },);

        expect(await resolveRunsDir(),).toBe('/tmp/whiskers-runs',);
      },
    },),

    it({
      name: 'IGNORES an empty override and falls back to the default. An '
        + 'exported-but-empty variable is an ordinary shell accident, and '
        + 'treating it as an override would resolve every artifact path '
        + 'relative to the process working directory instead of the runs '
        + 'directory, scattering a run and moving the sheet guard\'s protected '
        + 'area with it',
      fn: async () => {
        using _empty = withRunsDir({ value: '', },);

        /**
         * Resolved directory under an empty override.
         */
        const resolved = await resolveRunsDir();

        expect(resolved,).not.toBe('',);
        expect(resolved,).toContain(join(
          'node_modules',
          '.monochromatic',
          'translation-repair-runs',
        ),);
      },
    },),

    it({
      name: 'defaults under the worktree\'s gitignored node_modules when no '
        + 'override is set, so artifacts are durable across runs yet can never '
        + 'be committed: the corpus they derive from is unlicensed',
      fn: async () => {
        using _unset = withoutRunsDir();

        /**
         * Resolved directory with no override present.
         */
        const resolved = await resolveRunsDir();

        expect(resolved,).toContain(join(
          'node_modules',
          '.monochromatic',
          'translation-repair-runs',
        ),);
        expect(resolved.startsWith('/',),).toBe(true,);
      },
    },),

    it({
      name: 'returns an ABSOLUTE path in both branches, since callers join '
        + 'sheet and artifact names onto it from working directories they do '
        + 'not control',
      fn: async () => {
        {
          using _override = withRunsDir({ value: '/tmp/whiskers-runs', },);

          expect((await resolveRunsDir()).startsWith('/',),).toBe(true,);
        }

        using _unset = withoutRunsDir();

        expect((await resolveRunsDir()).startsWith('/',),).toBe(true,);
      },
    },),

    it({
      name: 'restores the environment after each case, so one case cannot '
        + 'silently decide where a later one writes',
      fn: async () => {
        /**
         * Value outside any override scope.
         */
        const outside = process.env[RUNS_DIR_VAR];

        {
          using _override = withRunsDir({ value: '/tmp/whiskers-runs', },);

          expect(process.env[RUNS_DIR_VAR],).toBe('/tmp/whiskers-runs',);
        }

        expect(process.env[RUNS_DIR_VAR],).toBe(outside,);
      },
    },),
  ],
},);

/**
 * Environment variable carrying the Synthetic API key.
 *
 * Only its NAME appears in this file. No case asserts on the value, prints it,
 * or compares against it, so a failure message can never carry a real key from
 * a developer's environment into a log.
 */
const API_KEY_VAR = 'TRANSLATION_REPAIR_SYNTHETIC_API_KEY';

/**
 * Sets the API key for the life of a scope and restores it on exit.
 *
 * @param value - stand-in key; the empty string is meaningful here
 *
 * @returns Disposable restoring the previous value, including its absence
 *
 * @example
 * ```ts
 * using _key = withApiKey({ value: 'whiskers-not-a-real-key', },);
 * ```
 */
function withApiKey({ value, }: { readonly value: string; },): Disposable {
  /**
   * Value before this scope; absent means the variable was unset.
   */
  const original = process.env[API_KEY_VAR];
  process.env[API_KEY_VAR] = value;
  return {
    [Symbol.dispose](): void {
      if (original === undefined)
        Reflect.deleteProperty(process.env, API_KEY_VAR,);
      else
        process.env[API_KEY_VAR] = original;
    },
  };
}

/**
 * Environment variable carrying the second provider's API key.
 *
 * Only its NAME appears in this file, for the same reason as
 * `API_KEY_VAR`.
 */
const HYPER_KEY_VAR = 'TRANSLATION_REPAIR_CHARM_HYPER_API_KEY';

/**
 * Sets the second provider's key for the life of a scope, or removes it.
 *
 * @param value - stand-in key; the empty string removes the variable
 *
 * @returns Disposable restoring the previous value, including its absence
 *
 * @example
 * ```ts
 * using _second = withHyperKey({ value: '', },);
 * ```
 */
function withHyperKey({ value, }: { readonly value: string; },): Disposable {
  /**
   * Value before this scope; absent means the variable was unset.
   */
  const original = process.env[HYPER_KEY_VAR];

  if (value === '')
    Reflect.deleteProperty(process.env, HYPER_KEY_VAR,);
  else
    process.env[HYPER_KEY_VAR] = value;
  return {
    [Symbol.dispose](): void {
      if (original === undefined)
        Reflect.deleteProperty(process.env, HYPER_KEY_VAR,);
      else
        process.env[HYPER_KEY_VAR] = original;
    },
  };
}

/**
 * Removes the API key for the life of a scope and restores it on exit.
 *
 * @returns Disposable restoring the previous value
 *
 * @example
 * ```ts
 * using _unset = withoutApiKey();
 * ```
 */
function withoutApiKey(): Disposable {
  /**
   * Value before this scope; absent means the variable was already unset.
   */
  const original = process.env[API_KEY_VAR];
  Reflect.deleteProperty(process.env, API_KEY_VAR,);
  return {
    [Symbol.dispose](): void {
      if (original !== undefined)
        process.env[API_KEY_VAR] = original;
    },
  };
}

await describe({
  name: createRunClient.name,
  children: [
    it({
      name: 'builds a client when both keys are injected, which is the only '
        + 'path a run should ever take',
      fn: async () => {
        using _key = withApiKey({ value: 'whiskers-not-a-real-key', },);
        using _second = withHyperKey({ value: 'mittens-not-a-real-key', },);

        /**
         * Client built from the stand-in keys.
         */
        const client = createRunClient();

        expect(typeof client.chatJson,).toBe('function',);
        expect(typeof client.chatText,).toBe('function',);
        expect(typeof client.quotas,).toBe('function',);
      },
    },),

    it({
      name: 'keeps the same surface when the second provider is keyed too, so '
        + 'every existing caller and the bench recorder are untouched by routing',
      fn: async () => {
        using _key = withApiKey({ value: 'whiskers-not-a-real-key', },);
        using _second = withHyperKey({ value: 'mittens-not-a-real-key', },);

        /**
         * Client built over both providers.
         */
        const client = createRunClient();

        // `quotas` is the first provider's meter and nothing else; the routing
        // client does not offer one, and this wiring layer supplies it.
        expect(typeof client.chatJson,).toBe('function',);
        expect(typeof client.chatText,).toBe('function',);
        expect(typeof client.quotas,).toBe('function',);
      },
    },),

    it({
      name: 'REFUSES a missing second key rather than running on one provider. '
        + 'Half the roster is served only by the second provider, so a '
        + 'one-provider client offered those seats to a provider that cannot '
        + 'serve them, quorum still met on the other half, and the run settled '
        + 'as a well-formed comparison half the roster never took part in '
        + '(`#235`)',
      fn: async () => {
        using _key = withApiKey({ value: 'whiskers-not-a-real-key', },);
        using _second = withHyperKey({ value: '', },);

        /**
         * What buildWithoutSecondKey raised, read for its class and its wording.
         */
        const refusalOfBuildingWithOneKey = caught(function buildWithoutSecondKey() {
          createRunClient();
        },);

        expect(refusalOfBuildingWithOneKey,).toBeInstanceOf(RunConfigError,);
        expect((refusalOfBuildingWithOneKey as Error).message,).toContain(HYPER_KEY_VAR,);
        expect((refusalOfBuildingWithOneKey as Error).message,).toContain('mise',);
      },
    },),

    it({
      name: 'refuses as a STATED refusal, so the CLI boundary repeats the '
        + 'variable name and exits 6 instead of printing a fault with frames: '
        + 'the message names a variable and a fix, never content',
      fn: async () => {
        using _unset = withoutApiKey();

        /**
         * What buildWithoutKey raised, read for the marker the boundary checks.
         */
        const refusalReadForItsMarker = caught(function buildWithoutKey() {
          createRunClient();
        },);

        expect(refusalReadForItsMarker,).toBeInstanceOf(StatedRefusalError,);
        expect((refusalReadForItsMarker as StatedRefusalError).messageNamesOnly,).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES to build a client when the key is unset, rather than '
        + 'building one that fails on every call. A client with no key would '
        + 'burn the whole roster against 401s before anyone realized sops had '
        + 'not injected anything, and the failure would read as a provider '
        + 'outage rather than as a setup mistake',
      fn: async () => {
        using _unset = withoutApiKey();

        /**
         * What buildWithoutKey raised, read for its class as well as its wording.
         */
        const refusalOfBuildingWithNoKeyAtAll = caught(function buildWithoutKey() {
          createRunClient();
        },);

        expect(refusalOfBuildingWithNoKeyAtAll,).toBeInstanceOf(RunConfigError,);
        expect((refusalOfBuildingWithNoKeyAtAll as Error).message,).toContain(API_KEY_VAR,);
      },
    },),

    it({
      name: 'refuses an EMPTY key for the same reason it refuses an absent '
        + 'one, since an exported-but-empty variable is an ordinary shell '
        + 'accident and is indistinguishable from no key at the API',
      fn: async () => {
        using _empty = withApiKey({ value: '', },);

        /**
         * What buildWithEmptyKey raised, read for its class as well as its wording.
         */
        const refusalOfBuildingWithAnEmptyKey = caught(function buildWithEmptyKey() {
          createRunClient();
        },);

        expect(refusalOfBuildingWithAnEmptyKey,).toBeInstanceOf(RunConfigError,);
        expect((refusalOfBuildingWithAnEmptyKey as Error).message,).toContain(API_KEY_VAR,);
      },
    },),

    it({
      name: 'names mise in the failure, so whoever hits it learns the fix '
        + 'rather than only the symptom',
      fn: async () => {
        using _unset = withoutApiKey();

        /**
         * What buildWithoutKey raised, read for its class as well as its wording.
         */
        const refusalOfBuildWithoutKey = caught(function buildWithoutKey() {
          createRunClient();
        },);

        expect(refusalOfBuildWithoutKey,).toBeInstanceOf(RunConfigError,);
        expect((refusalOfBuildWithoutKey as Error).message,).toContain('mise',);
      },
    },),
  ],
},);

/**
 * Streamed reply the first provider's chat endpoint answers with in the wiring
 * cases: one content delta and the terminator, the way the provider ends a
 * stream. Cat-themed, like every fixture here.
 */
const FIRST_PROVIDER_REPLY = [
  `data: ${JSON.stringify({ choices: [{ delta: { content: '喵。', }, },], },)}`,
  'data: [DONE]',
  '',
].join('\n\n',);

/**
 * Status the wiring transport answers where a call must fail at once: not a
 * budget status, so the router does not re-ask the other provider, and not a
 * transient one, so no retry ladder waits on it.
 */
const REFUSED_OUTRIGHT = 400;

/**
 * Status of the one endpoint that answers.
 */
const ANSWERED = 200;

/**
 * Whether a URL is the first provider's chat endpoint.
 *
 * @param url - URL the transport was asked
 *
 * @returns Whether a chat exchange went to the first provider
 *
 * @example
 * ```ts
 * const askedFirst = urls.some(isFirstProviderChat,);
 * ```
 */
function isFirstProviderChat(url: string,): boolean {
  return url.endsWith('/chat/completions',);
}

/**
 * Builds a transport that records every URL asked and answers by endpoint:
 * the first provider's chat endpoint streams `FIRST_PROVIDER_REPLY`, the
 * second provider's messages endpoint refuses outright, and every meter
 * (quotas, credits) refuses too. AN UNREADABLE METER READS AS SPENDABLE, which
 * is the documented failover in `provider-budget.ts`, so the routing these
 * cases observe is decided on serving capability alone, never on budget.
 *
 * @returns Transport plus the URLs it was asked, in call order
 *
 * @example
 * ```ts
 * const { transport, urls, } = recordingTransport();
 * ```
 */
function recordingTransport(): {
  readonly transport: (exchange: { readonly url: string; },) => Promise<{
    readonly status: number;
    readonly bodyText: string;
  }>;
  readonly urls: string[];
} {
  /**
   * URLs asked so far, pushed as each exchange arrives.
   */
  const urls: string[] = [];
  return {
    async transport(exchange: { readonly url: string; },): Promise<{
      readonly status: number;
      readonly bodyText: string;
    }> {
      urls.push(exchange.url,);
      if (isFirstProviderChat(exchange.url,))
        return { status: ANSWERED, bodyText: FIRST_PROVIDER_REPLY, };
      return { status: REFUSED_OUTRIGHT, bodyText: '{}', };
    },
    urls,
  };
}

/**
 * Empties the run-wide seat tally for the life of a scope and again on exit,
 * so a case reads only what it caused and leaves nothing for the next one.
 *
 * @returns Disposable emptying the tally again
 *
 * @example
 * ```ts
 * using _fresh = withFreshRunSeats();
 * ```
 */
function withFreshRunSeats(): Disposable {
  RUN_SEATS.reset();
  return {
    [Symbol.dispose](): void {
      RUN_SEATS.reset();
    },
  };
}

/**
 * Single user message reused across the wiring exchanges.
 */
const MESSAGES = [
  {
    role: 'user' as const,
    content: '猫猫的翻译对吗？',
  },
];

/**
 * Seat the first provider serves under its own catalog name.
 */
const SHARED_SEAT = 'hf:openai/gpt-oss-120b';

/**
 * Seat only the second provider serves: a Charm Hyper endpoint label.
 */
const SECOND_ONLY_SEAT = 'qwen3.8-max';

/**
 * Asks one seat through the client and hands back whatever came of it, the
 * reply or the failure, because half of the wiring cases expect the call to
 * fail and care only about where it went and how it was counted.
 *
 * @param client - client under test
 *
 * @param modelId - seat to ask
 *
 * @returns Reply when the call answered, otherwise what it threw
 *
 * @example
 * ```ts
 * const came = await askSeat({ client, modelId: SECOND_ONLY_SEAT, },);
 * ```
 */
async function askSeat(
  {
    client,
    modelId,
  }: {
    readonly client: ReturnType<typeof createRunClient>;
    readonly modelId: typeof SHARED_SEAT | typeof SECOND_ONLY_SEAT;
  },
): Promise<unknown> {
  try {
    return await client.chatText({
      modelId,
      messages: MESSAGES,
      signal: new AbortController().signal,
    },);
  }
  catch (error) {
    return error;
  }
}

await describe({
  name: `${createRunClient.name} wiring`,
  children: [
    it({
      name: 'ROUTES a Charm Hyper endpoint label to the second provider and '
        + 'never to the first, with the first provider live: serving '
        + 'capability is a property of the pair, not of a provider\'s health '
        + '(`#235`)',
      fn: async () => {
        using _key = withApiKey({ value: 'whiskers-not-a-real-key', },);
        using _second = withHyperKey({ value: 'mittens-not-a-real-key', },);
        using _fresh = withFreshRunSeats();

        /**
         * Transport recording where the call went.
         */
        const { transport, urls, } = recordingTransport();

        await askSeat({
          client: createRunClient({ transport, },),
          modelId: SECOND_ONLY_SEAT,
        },);

        expect(urls.includes(HYPER_MESSAGES_URL,),).toBe(true,);
        expect(urls.some(isFirstProviderChat,),).toBe(false,);
      },
    },),

    it({
      name: 'SENDS a seat the first provider serves to the first provider, so '
        + 'the routing does not push the whole roster onto the second',
      fn: async () => {
        using _key = withApiKey({ value: 'whiskers-not-a-real-key', },);
        using _second = withHyperKey({ value: 'mittens-not-a-real-key', },);
        using _fresh = withFreshRunSeats();

        /**
         * Transport recording where the call went.
         */
        const { transport, urls, } = recordingTransport();

        /**
         * What the shared seat answered.
         */
        const came = await askSeat({
          client: createRunClient({ transport, },),
          modelId: SHARED_SEAT,
        },);

        expect(came instanceof Error,).toBe(false,);
        expect(urls.some(isFirstProviderChat,),).toBe(true,);
        expect(urls.includes(HYPER_MESSAGES_URL,),).toBe(false,);
      },
    },),

    it({
      name: 'COUNTS every call against its seat on the run-wide tally, so the '
        + 'closing report can say which seat never answered (`#235`)',
      fn: async () => {
        using _key = withApiKey({ value: 'whiskers-not-a-real-key', },);
        using _second = withHyperKey({ value: 'mittens-not-a-real-key', },);
        using _fresh = withFreshRunSeats();

        /**
         * Transport answering the first provider and refusing the second.
         */
        const { transport, } = recordingTransport();

        /**
         * Client under test, built once for both seats.
         */
        const client = createRunClient({ transport, },);

        await askSeat({ client, modelId: SHARED_SEAT, },);
        await askSeat({ client, modelId: SECOND_ONLY_SEAT, },);

        /**
         * Counts for the seat that answered.
         */
        const shared = RUN_SEATS.counts().find(function isShared(count,): boolean {
          return count.modelId === SHARED_SEAT;
        },);

        /**
         * Counts for the seat that was refused.
         */
        const secondOnly = RUN_SEATS.counts().find(function isSecondOnly(count,): boolean {
          return count.modelId === SECOND_ONLY_SEAT;
        },);

        expect(shared?.asked,).toBe(1,);
        expect(shared?.usable,).toBe(1,);
        expect(secondOnly?.asked,).toBe(1,);
        expect(secondOnly?.threw,).toBe(1,);
        expect(RUN_SEATS.dark().map(function toId(count,): string {
          return count.modelId;
        },),).toStrictEqual([SECOND_ONLY_SEAT,],);
      },
    },),
  ],
  concurrency: 1,
},);

/**
 * Moves the process working directory for the life of a scope and restores it
 * on exit.
 *
 * @param path - directory to move to
 *
 * @returns Disposable restoring the previous working directory
 *
 * @example
 * ```ts
 * using _elsewhere = inDirectory({ path: tmpdir(), },);
 * ```
 */
function inDirectory({ path, }: { readonly path: string; },): Disposable {
  /**
   * Working directory before this scope.
   */
  const original = process.cwd();
  process.chdir(path,);
  return {
    [Symbol.dispose](): void {
      process.chdir(original,);
    },
  };
}

await describe({
  name: readHeadSha.name,
  children: [
    it({
      name: 'reads the sha of THIS repository regardless of the working '
        + 'directory the task was invoked from. The pin is what says which '
        + 'pipeline version produced an artifact, so resolving it against the '
        + 'process cwd would stamp another repository\'s sha onto a run, or '
        + 'fail outright when a task ran from a directory git does not track',
      fn: async () => {
        /**
         * Sha read from the ordinary working directory.
         */
        const fromHere = await readHeadSha();

        using _elsewhere = inDirectory({ path: tmpdir(), },);

        expect(await readHeadSha(),).toBe(fromHere,);
      },
    },),

    it({
      name: 'returns a bare 40-character sha with no trailing newline, since '
        + 'it is written into artifacts and a stray newline there would travel '
        + 'into every file that records the pin',
      fn: async () => {
        /**
         * Sha under test.
         */
        const sha = await readHeadSha();

        expect(sha.length,).toBe(40,);
        expect(sha.includes('\n',),).toBe(false,);
        expect(sha,).toBe(sha.trim(),);
      },
    },),
  ],
},);
