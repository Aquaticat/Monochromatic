/**
 Tests for the editor fidelity probe's run over a scripted reference, client and clock: what it refuses before anything
 is read or spent, what a zero cap says, the ceiling and the guard it prints, the arm it ends before a call that would
 pass `--max-usd`, and what a run writes to disk and prints, with the model ids it asked.

 No model is called and no corpus clone is read: the reference reader and the client builder are handed in. The real
 reviewed manifest supplies the request's specifications, and the invented cat texts of the fixture module stand in
 for what the pinned clone would hold.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import { existsSync, } from 'node:fs';
import {
  readdir,
  readFile,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import type {
  ChatJsonOutcome,
  ChatJsonRequest,
  ModelClient,
} from '@monochromatic-dev/translation-repair-provider';
import { StatedRefusalError, } from '@monochromatic-dev/translation-repair-glossary';
import type { RosterModelId, } from '@monochromatic-dev/translation-repair-shared-contract';
import {
  EDITOR_DAMAGE_KINDS,
  EDITOR_FIDELITY_POOL,
  editorFidelityTrials,
  type FidelityReferenceSpec,
  REVIEWED_FIDELITY_REFERENCES,
  type ReviewedFidelityReference,
  runEditorFidelityProbe,
} from '../../dist/final/node/index.mjs';
import { capturingLoggerPair, } from '@monochromatic-dev/translation-repair-test-fixture/ts/capturing-logger.test-fixture.ts';
import { scratchDir, } from '@monochromatic-dev/translation-repair-test-fixture/ts/scratch-dir.test-fixture.ts';
import { lineOf, } from '@monochromatic-dev/translation-repair-run/ts/corpus-run/command-line.test-fixture.ts';
import { HANG_STOP_MS, } from '@monochromatic-dev/translation-repair-test-fixture/ts/hang-stop.test-fixture.ts';
import { SCRIPTED_STAGE_SETTINGS, } from '@monochromatic-dev/translation-repair-stage/ts/stage-settings.test-fixture.ts';
import {
  HIGH_CARD,
  inventedReference,
  LOW_CARD,
} from '../editor-fidelity.test-fixture.ts';

/**
 Digest every run claims, ending in the eight characters a kept file's name carries.
 */
const DIGEST = `sha256-tree-v1:${'c'.repeat(56,)}cafef00d`;

/**
 Closure every run records.
 */
const CLOSURE = {
  kind: 'read',
  entry: 'editor-fidelity-probe.mjs',
  chunks: ['run-config-abc.mjs',],
} as const;

/**
 Reviewed specification the cases select: the one entry whose manifest holds both families the probe builds, an
 insertion and an alteration.
 */
const SPEC: FidelityReferenceSpec = nonNullishOrThrow(REVIEWED_FIDELITY_REFERENCES.find(function holdsBoth(spec,): boolean {
  return spec.damages.some(function isAlteration(damage,): boolean {
    return damage.kind === 'alteration';
  },);
},),);

/**
 What every scripted reply reports: two thousand prompt tokens and twenty thousand completion tokens, which cost
 (2000 x 2.5 + 20000 x 10) / 1e6 = 0.205 USD at the Sonnet prices, the prompt priced at the higher of the input and
 cache-write rates.
 */
const REPORTED_USAGE = {
  prompt_tokens: 2_000,
  completion_tokens: 20_000,
} as const;

/**
 Instant the first clock reading gives.
 */
const STARTED_AT = '2026-10-23T06:00:00.000Z';

/**
 Instant the second clock reading gives.
 */
const FINISHED_AT = '2026-10-23T06:05:00.000Z';

/**
 The trials the invented reference makes, whose fixes the scripted client knows.
 */
const TRIALS = editorFidelityTrials({
  references: [inventedReference(),],
  damageKinds: EDITOR_DAMAGE_KINDS,
},);

/**
 What a run did, for the case to read.
 */
type ProbeRunSeen = {
  /**
   Every line the run logged, in order.
   */
  readonly lines: readonly string[];

  /**
   Everything written to the output sink.
   */
  readonly written: string;

  /**
   Model ids the scripted client was asked, in order.
   */
  readonly asked: readonly string[];

  /**
   Specifications the reference reader was handed, one entry per call.
   */
  readonly readFor: readonly (readonly FidelityReferenceSpec[])[];

  /**
   What each client build saw: the cards it was built for, and whether the plan was on disk by then.
   */
  readonly clientBuilds: readonly {
    readonly cardIds: readonly RosterModelId[];
    readonly promptPayloadDir: string;
    readonly planWasOnDisk: boolean;
  }[];

  /**
   Runs directory requests, one entry per call.
   */
  readonly runsAsked: readonly string[];

  /**
   What the run threw, empty when it completed.
   */
  readonly failures: readonly unknown[];
};

/**
 Reference reader answering with the invented reference for every specification it is handed.

 @param readFor - array each call's specifications are appended to

 @returns The reader the run takes

 @example
 ```ts
 const readReferences = inventedReader({ readFor: [], },);
 ```
 */
function inventedReader(
  { readFor, }: { readonly readFor: (readonly FidelityReferenceSpec[])[]; },
): Parameters<typeof runEditorFidelityProbe>[0]['readReferences'] {
  return function readInvented({ specs, },): Promise<readonly ReviewedFidelityReference[]> {
    readFor.push(specs,);
    return Promise.resolve(specs.map(function referenceOf(spec,): ReviewedFidelityReference {
      return {
        ...inventedReference(),
        spec,
      };
    },),);
  };
}

/**
 Client that knows each trial's fix and applies it, unless told to say nothing readable.

 @param asked - array each call's model id is appended to

 @param silent - whether every reply is one nobody can read

 @returns The client the run asks through

 @example
 ```ts
 const client = fixingClient({ asked: [], silent: false, },);
 ```
 */
function fixingClient({ asked, silent, }: { readonly asked: string[]; readonly silent: boolean; },): ModelClient {
  return {
    chatText: () => Promise.reject(new Error('chatText unused by the editor',),),
    quotas: () => Promise.reject(new Error('quotas unused by the editor',),),
    chatJson: <ValueT,>(request: ChatJsonRequest<ValueT>,): Promise<ChatJsonOutcome<ValueT>> => {
      asked.push(request.modelId,);
      /**
       The sheet's user message, which holds the region's current text.
       */
      const sheet = request.messages.map(function wordsOf(message,): string {
        if ((typeof message.content) === 'string')
          return message.content;
        return JSON.stringify(message.content,);
      },)
        .join('\n',);
      /**
       The trial whose region the sheet shows.
       */
      const trial = TRIALS.find(function isShown(candidate,): boolean {
        return sheet.includes(`CURRENT TEXT: ${candidate.damagedText.slice(
          candidate.region.startOffset,
          candidate.region.endOffset,
        )}`,);
      },);
      /**
       The report for it: the sentence removed, or the number put back.
       */
      const report = (silent || (trial === undefined))
        ? { unrelated: true, }
        : {
          edits: [
            {
              region: 1,
              newText: (trial.damageKind === 'insertion')
                ? ''
                : trial.damagedText.slice(
                  trial.region.startOffset,
                  trial.region.endOffset,
                )
                  .replace(
                  trial.damagedDefect,
                  trial.cleanDefect,
                  ),
            },
          ],
        };
      if (!request.validate(report,)) {
        return Promise.resolve({
          kind: 'schema-mismatch',
          rawText: JSON.stringify(report,),
          detail: 'unreadable',
          usage: REPORTED_USAGE,
        },);
      }
      return Promise.resolve({
        kind: 'ok',
        value: report,
        rawText: JSON.stringify(report,),
        usage: REPORTED_USAGE,
      },);
    },
  };
}

/**
 Runs the probe once over scripted parts, keeping its files in the directory given.

 @param runsDir - runs directory the run keeps its files in

 @param typed - what the operator wrote after the script path

 @param silent - whether the scripted client says nothing readable

 @returns What the run did, once it settles, including what it threw

 @example
 ```ts
 const seen = await probeIn({ runsDir: scratch.path, typed: ['--cap', '0',], silent: false, },);
 ```
 */
async function probeIn(
  {
    runsDir,
    typed,
    silent = false,
  }: {
    readonly runsDir: string;
    readonly typed: readonly string[];
    readonly silent?: boolean;
  },
): Promise<ProbeRunSeen> {
  /**
   Lines the run logged.
   */
  const logged = capturingLoggerPair();
  /**
   Model ids asked.
   */
  const asked: string[] = [];
  /**
   Specifications the reader was handed.
   */
  const readFor: (readonly FidelityReferenceSpec[])[] = [];
  /**
   Client builds seen.
   */
  const clientBuilds: {
    cardIds: readonly RosterModelId[];
    promptPayloadDir: string;
    planWasOnDisk: boolean;
  }[] = [];
  /**
   Text written to the sink.
   */
  const chunks: string[] = [];
  /**
   Runs directory requests.
   */
  const runsAsked: string[] = [];
  /**
   What the run threw.
   */
  const failures: unknown[] = [];
  /**
   Clock readings still to give.
   */
  const instants = [STARTED_AT, FINISHED_AT,];
  try {
    await runEditorFidelityProbe({
      line: lineOf({
        command: 'editor-fidelity-probe',
        typed,
      },),
      pin: {
        cloneDir: join(
          runsDir,
          'no-clone-is-read',
        ),
        commitSha: SPEC.corpusSha,
      },
      readReferences: inventedReader({ readFor, },),
      resolveRuns: function resolveScratch(): Promise<string> {
        runsAsked.push(runsDir,);
        return Promise.resolve(runsDir,);
      },
      newClient: function buildClient({ promptPayloadDir, cardIds, },): ModelClient {
        clientBuilds.push({
          cardIds,
          promptPayloadDir,
          planWasOnDisk: existsSync(join(
            dirname(promptPayloadDir,),
            'plan.json',
          ),),
        },);
        return fixingClient({
          asked,
          silent,
        },);
      },
      now: function nextInstant(): string {
        return nonNullishOrThrow(instants.shift(),);
      },
      pipelineDigest: DIGEST,
      runnerClosure: CLOSURE,
      perCallTimeoutMs: HANG_STOP_MS,
      log: logged.logger,
      out: {
        write: function keep(text: string,): void {
          chunks.push(text,);
        },
      },
      stageSettings: SCRIPTED_STAGE_SETTINGS,
    },);
  }
  catch (error) {
    failures.push(error,);
  }
  return {
    lines: logged.lines,
    written: chunks.join('',),
    asked,
    readFor,
    clientBuilds,
    runsAsked,
    failures,
  };
}

/**
 The message the run's refusal carries.

 @param seen - what the run did

 @returns The stated message

 @throws {@link Error} when the run did not refuse with a stated refusal

 @example
 ```ts
 const said = refusedWith({ seen, },);
 ```
 */
function refusedWith({ seen, }: { readonly seen: ProbeRunSeen; },): string {
  const [failure,] = seen.failures;
  if (!(failure instanceof StatedRefusalError))
    throw new Error('the run was expected to refuse with a stated refusal',);
  return failure.message;
}

/**
 Flags every run case that asks something starts from: the entry the first reviewed reference holds, the one card alone.
 */
const ONE_CARD = [
  '--only',
  SPEC.entryId,
  '--candidates',
  LOW_CARD,
  '--candidates-alone',
];

await describe({
  name: runEditorFidelityProbe.name,
  children: [
    describe({
      name: 'refusals before anything is read',
      children: [
        it({
          name: 'REFUSES A CARD THE ROSTER DOES NOT KNOW, in the judge probe\'s wording, before reading or building '
            + 'anything',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'editor-fidelity-run-', },);
            const seen = await probeIn({
              runsDir: scratch.path,
              typed: ['--candidates', 'nobody/such-model', '--candidates-alone',],
            },);
            expect(refusedWith({ seen, },),).toContain(
              '--candidates names "nobody/such-model", which is not seatable; the roster knows ',
            );
            expect(seen.readFor,).toStrictEqual([],);
            expect(seen.clientBuilds,).toStrictEqual([],);
          },
        },),

        it({
          name: 'REFUSES --candidates-alone WITH NO CARD in the judge probe\'s wording, and a run that does not say '
            + 'alone, since this probe seats the named cards and nobody else and a roster beside them would spend '
            + 'on more than was asked',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'editor-fidelity-run-', },);
            expect(refusedWith({
              seen: await probeIn({
                runsDir: scratch.path,
                typed: ['--candidates-alone',],
              },),
            },),).toBe(
              '--candidates-alone runs the candidates without the seated roster, and --candidates named none',
            );
            expect(refusedWith({
              seen: await probeIn({
                runsDir: scratch.path,
                typed: ['--candidates', LOW_CARD,],
              },),
            },),).toBe(
              'this probe seats only the cards --candidates names; write --candidates-alone to say so',
            );
            expect(refusedWith({
              seen: await probeIn({
                runsDir: scratch.path,
                typed: [],
              },),
            },),).toBe(
              'this probe seats only the cards --candidates names; write --candidates-alone to say so',
            );
          },
        },),

        it({
          name: 'REFUSES A CARD WITH NO PRICE TABLE before reading anything, since no ceiling could be printed for it',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'editor-fidelity-run-', },);
            const seen = await probeIn({
              runsDir: scratch.path,
              typed: ['--candidates', 'hf:zai-org/GLM-5.3-Flash', '--candidates-alone',],
            },);
            expect(refusedWith({ seen, },),).toContain('has no price table in claude-card-sides.ts',);
            expect(seen.readFor,).toStrictEqual([],);
            expect(seen.clientBuilds,).toStrictEqual([],);
          },
        },),
      ],
    },),

    describe({
      name: 'a zero cap',
      children: [
        it({
          name: 'SAYS THE CARD SEATED AND THE ENTRIES SELECTED and returns before the corpus is read, a directory '
            + 'is made or a client is built',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'editor-fidelity-run-', },);
            const seen = await probeIn({
              runsDir: scratch.path,
              typed: [...ONE_CARD, '--cap', '0',],
            },);
            expect(seen.failures,).toStrictEqual([],);
            expect(seen.lines,).toStrictEqual([
              `editors: ${LOW_CARD}`,
              `preflight only: 1 pinned reference specification selected for ${LOW_CARD}; no corpus or model calls`,
            ],);
            expect(seen.readFor,).toStrictEqual([],);
            expect(seen.runsAsked,).toStrictEqual([],);
            expect(seen.clientBuilds,).toStrictEqual([],);
            expect(seen.written,).toBe('',);
          },
        },),
      ],
    },),

    describe({
      name: 'the frozen pool',
      children: [
        it({
          name: 'SELECTS EVERY SPECIFICATION OF THE POOL when no entry is named, and a cap of zero says how many',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'editor-fidelity-run-', },);
            const seen = await probeIn({
              runsDir: scratch.path,
              typed: ['--candidates', LOW_CARD, '--candidates-alone', '--cap', '0',],
            },);
            expect(seen.failures,).toStrictEqual([],);
            expect(seen.lines,).toContain(
              `preflight only: ${String(EDITOR_FIDELITY_POOL.length,)} pinned reference specifications selected for ${LOW_CARD}; `
                + 'no corpus or model calls',
            );
          },
        },),

        it({
          name: 'READS A DRAWN ENTRY OF THE POOL by its id, the specifications of that entry and no others, in the pool\'s order',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'editor-fidelity-run-', },);
            const drawn = nonNullishOrThrow(EDITOR_FIDELITY_POOL.at(-1,),);
            const seen = await probeIn({
              runsDir: scratch.path,
              typed: ['--only', drawn.entryId, '--candidates', LOW_CARD, '--candidates-alone', '--cap', '1',],
            },);
            expect(seen.failures,).toStrictEqual([],);
            expect(seen.readFor,).toStrictEqual([
              EDITOR_FIDELITY_POOL.filter(function isEntry(spec,): boolean {
                return spec.entryId === drawn.entryId;
              },),
            ],);
          },
        },),

        it({
          name: 'SAYS WHAT IT DREW just before the ceiling, so the log of an arm shows the pool it saw',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'editor-fidelity-run-', },);
            const seen = await probeIn({
              runsDir: scratch.path,
              typed: ONE_CARD,
            },);
            const ceilingAt = seen.lines.findIndex(function isCeiling(line,): boolean {
              return line.startsWith('ceiling ',);
            },);
            expect(ceilingAt,).toBeGreaterThan(0,);
            expect(seen.lines[ceilingAt - 1],).toBe('pool: 2 trials over 1 entry (insertion 1, alteration 1)',);
          },
        },),
      ],
    },),

    describe({
      name: 'the ceiling',
      children: [
        it({
          name: 'PRINTS THE CEILING AND THE GUARD before any client exists, and does not refuse to start on the total: '
            + 'a --max-usd under the first-pass ceiling still builds the client, since the guard holds each call to it',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'editor-fidelity-run-', },);
            const seen = await probeIn({
              runsDir: scratch.path,
              typed: [...ONE_CARD, '--max-usd', '0.5',],
            },);
            const ceilingAt = seen.lines.findIndex(function isCeiling(line,): boolean {
              return line.startsWith(`ceiling ${LOW_CARD}: 2 trials, one ask each, at most `,);
            },);
            expect(ceilingAt,).toBeGreaterThanOrEqual(0,);
            expect(seen.lines[ceilingAt + 1],).toBe(
              'spend guard: each call is refused, and the arm ends, when the spend measured from the replies so far plus '
                + 'that call\'s ceiling would pass --max-usd 0.5000',
            );
            expect(seen.clientBuilds.length,).toBe(1,);
            expect(seen.clientBuilds[0]?.planWasOnDisk,).toBe(true,);
          },
        },),

        it({
          name: 'STOPS THE ARM BEFORE THE CALL THAT WOULD PASS --max-usd: the first reply costs 0.2050 USD measured, the '
            + 'second call\'s ceiling would take the total past 0.5, so the second is never made, the refusal names the '
            + 'three figures, the finished row stays in its file and no kept line or document is written',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'editor-fidelity-run-', },);
            const seen = await probeIn({
              runsDir: scratch.path,
              typed: [...ONE_CARD, '--max-usd', '0.5',],
            },);
            expect(seen.asked,).toStrictEqual([LOW_CARD,],);
            /**
             What the refusal says.
             */
            const said = refusedWith({ seen, },);
            expect(said.startsWith(
              `the editor fidelity probe will not ask ${LOW_CARD}: the replies so far cost 0.2050 USD as measured, this call `
                + 'can cost 0.3',
            ),).toBe(true,);
            expect(said.endsWith(
              ' USD at most, and together they pass --max-usd 0.5000; the arm ends here, and the rows it finished stay in '
                + 'their files',
            ),).toBe(true,);
            const [runName,] = (await readdir(scratch.path,)).filter(function isRun(name,): boolean {
              return name.startsWith('editor-fidelity-',);
            },);
            const runDir = join(
              scratch.path,
              nonNullishOrThrow(runName,),
            );
            expect(
              existsSync(join(
                runDir,
                'row-0.json',
              ),),
            ).toBe(true,);
            expect(
              existsSync(join(
                runDir,
                'row-1.json',
              ),),
            ).toBe(false,);
            expect(seen.lines.some(function isKept(line,): boolean {
              return line.startsWith('kept ',);
            },),).toBe(false,);
            expect(seen.written,).toBe('',);
          },
        },),

        it({
          name: 'STARTS under the default two dollars for one card, which is the arm the lead runs',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'editor-fidelity-run-', },);
            const seen = await probeIn({
              runsDir: scratch.path,
              typed: ONE_CARD,
            },);
            expect(seen.failures,).toStrictEqual([],);
            expect(seen.clientBuilds.length,).toBe(1,);
          },
        },),
      ],
    },),

    describe({
      name: 'a run',
      children: [
        it({
          name: 'BUILDS ITS CLIENT ONCE, FOR THE NAMED CARD ONLY, after the plan is on disk, and asks that card and no '
            + 'other, once for each trial, with no critic, panel, judge or checker in the roster',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'editor-fidelity-run-', },);
            const seen = await probeIn({
              runsDir: scratch.path,
              typed: ONE_CARD,
            },);
            expect(seen.failures,).toStrictEqual([],);
            expect(seen.clientBuilds.length,).toBe(1,);
            expect(seen.clientBuilds[0]?.cardIds,).toStrictEqual([LOW_CARD,],);
            expect(seen.clientBuilds[0]?.planWasOnDisk,).toBe(true,);
            expect(seen.asked,).toStrictEqual([LOW_CARD, LOW_CARD,],);
            expect(seen.readFor.length,).toBe(1,);
          },
        },),

        it({
          name: 'BENCHES TWO CARDS EACH IN ITS OWN GATHER, one card at a time and the first card\'s trials before the '
            + 'second\'s, so two efforts of one wire model are never seated together',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'editor-fidelity-run-', },);
            const seen = await probeIn({
              runsDir: scratch.path,
              typed: [
                '--only',
                SPEC.entryId,
                '--candidates',
                `${LOW_CARD},${HIGH_CARD}`,
                '--candidates-alone',
              ],
            },);
            expect(seen.failures,).toStrictEqual([],);
            expect(seen.clientBuilds.length,).toBe(1,);
            expect(seen.clientBuilds[0]?.cardIds,).toStrictEqual([LOW_CARD, HIGH_CARD,],);
            expect(seen.asked,).toStrictEqual([LOW_CARD, LOW_CARD, HIGH_CARD, HIGH_CARD,],);
          },
        },),

        it({
          name: 'KEEPS A PLAN, A ROW FOR EVERY CARD AND TRIAL AND THE RUN, and prints the tally of each card, the kept '
            + 'line and a document of the rows and tallies, none of it quoting the corpus',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'editor-fidelity-run-', },);
            const seen = await probeIn({
              runsDir: scratch.path,
              typed: ONE_CARD,
            },);
            expect(seen.failures,).toStrictEqual([],);
            const [runName,] = (await readdir(scratch.path,)).filter(function isRun(name,): boolean {
              return name.startsWith('editor-fidelity-',);
            },);
            const runDir = join(
              scratch.path,
              nonNullishOrThrow(runName,),
            );
            const plan = JSON.parse(await readFile(
              join(
                runDir,
                'plan.json',
              ),
              'utf8',
            ),) as { readonly status: string; readonly requestedCards: readonly string[]; readonly plannedRows: number; };
            expect(plan.status,).toBe('planned',);
            expect(plan.requestedCards,).toStrictEqual([LOW_CARD,],);
            expect(plan.plannedRows,).toBe(2,);
            expect(
              existsSync(join(
                runDir,
                'row-0.json',
              ),),
            ).toBe(true,);
            expect(
              existsSync(join(
                runDir,
                'row-1.json',
              ),),
            ).toBe(true,);
            expect(seen.lines,).toContain(
              `EDITOR ${LOW_CARD}: fixed 2 of 2 (exact 1, equivalent 1, defect only 0), collateral 0, missed 0, refused 0, `
                + 'unusable 0',
            );
            expect(seen.lines.some(function isKept(line,): boolean {
              return line.startsWith('kept 2 editor rows at ',);
            },),).toBe(true,);
            const printed = JSON.parse(seen.written,) as {
              readonly rows: readonly { readonly cardId: string; }[];
              readonly tallies: readonly { readonly cardId: string; readonly fixed: number; }[];
            };
            expect(printed.rows.length,).toBe(2,);
            expect(printed.tallies.map(function pairOf(tally,): readonly [string, number] {
              return [tally.cardId, tally.fixed,];
            },),).toEqual([[LOW_CARD, 2,],],);
            for (const trial of TRIALS)
              expect(seen.written.includes(trial.damagedText,),).toBe(false,);
          },
        },),

        it({
          name: 'COUNTS A CARD THAT ANSWERS NOTHING READABLE as unusable on every trial, and still ends the run',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'editor-fidelity-run-', },);
            const seen = await probeIn({
              runsDir: scratch.path,
              typed: ONE_CARD,
              silent: true,
            },);
            expect(seen.failures,).toStrictEqual([],);
            expect(seen.lines,).toContain(
              `EDITOR ${LOW_CARD}: fixed 0 of 2 (exact 0, equivalent 0, defect only 0), collateral 0, missed 0, refused 0, `
                + 'unusable 2',
            );
          },
        },),

        it({
          name: 'WARNS WHEN THE CAP LEAVES TRIALS OUT, in the judge probe\'s wording, and runs only the first',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'editor-fidelity-run-', },);
            const seen = await probeIn({
              runsDir: scratch.path,
              typed: [...ONE_CARD, '--cap', '1',],
            },);
            expect(seen.failures,).toStrictEqual([],);
            expect(seen.lines,).toContain('partial reviewed matrix: 1 of 2 rows; not complete admission evidence',);
            expect(seen.asked,).toStrictEqual([LOW_CARD,],);
          },
        },),
      ],
    },),
  ],
},);
