/**
 * Tests for the Bedrock ledger, the meter this provider does not have: the
 * durable file every priced call appends to, the credit line it is read
 * against, and the environment that names both.
 *
 * Every case writes under a disposable directory and removes it after.
 *
 * @module
 */

import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  BEDROCK_CREDIT_USD,
  BEDROCK_CREDIT_USD_VAR,
  BEDROCK_LEDGER_PATH_VAR,
  BedrockCreditOverrideError,
  BedrockLedgerShapeError,
  bedrockCreditUsdFrom,
  bedrockIsDry,
  bedrockLedgerPathFrom,
  bedrockMeterLevel,
  createBedrockLedger,
  defaultBedrockLedgerPath,
} from '../dist/final/node/index.mjs';

/**
 * One priced call, cat-themed.
 *
 * @param usd - what it cost
 *
 * @returns Entry to note
 *
 * @example
 * ```ts
 * await ledger.note(callCosting({ usd: 0.5, },),);
 * ```
 */
function callCosting({ usd, }: { readonly usd: number; },) {
  return {
    at: '2026-09-07T20:00:00.000Z',
    model: 'google.gemma-4-e2b',
    usd,
    promptTokens: 90,
    completionTokens: 10,
  };
}

/**
 * Disposable directory a case owns, removed when its scope ends.
 *
 * @returns Directory path and the disposer that removes it
 *
 * @example
 * ```ts
 * await using scratch = await scratchDir();
 * ```
 */
async function scratchDir(): Promise<{ readonly dir: string; } & AsyncDisposable> {
  /**
   * Fresh directory under the system temp root.
   */
  const dir = await mkdtemp(join(
    tmpdir(),
    'bedrock-ledger-',
  ),);
  return {
    dir,
    [Symbol.asyncDispose]: async function remove(): Promise<void> {
      await rm(
        dir,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 * Runs one case inside a disposable directory, removing it after.
 *
 * @param fn - case body, given the directory
 *
 * @example
 * ```ts
 * await inScratch(async function body(dir,) { ... },);
 * ```
 */
async function inScratch(fn: (dir: string,) => Promise<void>,): Promise<void> {
  /**
   * Directory this case owns, removed when this function returns.
   */
  await using scratch = await scratchDir();
  await fn(scratch.dir,);
}

await describe({
  name: createBedrockLedger.name,
  children: [
    it({
      name: 'READS A FILE THAT DOES NOT EXIST YET AS NOTHING SPENT, since the first run has no history',
      fn: async () => {
        await inScratch(async function body(dir,) {
          /**
           * Ledger over a file nobody has written.
           */
          const ledger = createBedrockLedger({
            path: join(
              dir,
              'nested',
              'bedrock-spend.jsonl',
            ),
            creditUsd: 200,
          },);
          expect(await ledger.read(),).toEqual({
            creditUsd: 200,
            spentUsd: 0,
            remainingUsd: 200,
            calls: 0,
          },);
        },);
      },
    },),

    it({
      name: 'APPENDS ONE LINE PER CALL, creating the directory, and SUMS THEM on the next read',
      fn: async () => {
        await inScratch(async function body(dir,) {
          /**
           * Ledger over a file in a directory that does not exist yet.
           */
          const ledger = createBedrockLedger({
            path: join(
              dir,
              'state',
              'bedrock-spend.jsonl',
            ),
            creditUsd: 1,
          },);
          await ledger.note(callCosting({ usd: 0.25, },),);
          await ledger.note(callCosting({ usd: 0.5, },),);
          expect(await ledger.read(),).toEqual({
            creditUsd: 1,
            spentUsd: 0.75,
            remainingUsd: 0.25,
            calls: 2,
          },);

          /**
           * The file as written: one JSON object per line.
           */
          const lines = (await readFile(
            ledger.path,
            'utf8',
          ))
            .trim()
            .split('\n',);
          expect(lines.length,).toBe(2,);
          expect(JSON.parse(lines[0] ?? '',),).toEqual(callCosting({ usd: 0.25, },),);
        },);
      },
    },),

    it({
      name: 'GOES DRY PAST THE CREDIT, with the ledger reading below zero rather than clamped, so the '
        + 'meter says how far past the line the calls in flight went',
      fn: async () => {
        await inScratch(async function body(dir,) {
          /**
           * Ledger with a credit two calls exceed.
           */
          const ledger = createBedrockLedger({
            path: join(
              dir,
              'bedrock-spend.jsonl',
            ),
            creditUsd: 0.3,
          },);
          await ledger.note(callCosting({ usd: 0.25, },),);
          expect(bedrockIsDry({ credits: await ledger.read(), },),).toBe(false,);
          await ledger.note(callCosting({ usd: 0.25, },),);

          /**
           * Reading past the line.
           */
          const credits = await ledger.read();
          expect(bedrockIsDry({ credits, },),).toBe(true,);
          expect(credits.remainingUsd,).toBeCloseTo(
            -0.2,
            9,
          );
          expect(bedrockMeterLevel({ credits, },),).toEqual(['bedrockUsd=-0.20',],);
        },);
      },
    },),

    it({
      name: 'REFUSES A LINE THAT WILL NOT READ, naming its number, rather than summing the file as if '
        + 'the money were unspent',
      fn: async () => {
        await inScratch(async function body(dir,) {
          /**
           * Ledger file with a torn second line.
           */
          const path = join(
            dir,
            'bedrock-spend.jsonl',
          );
          await writeFile(
            path,
            `${JSON.stringify(callCosting({ usd: 0.1, },),)}\n{"at":"2026-09-07T20:00:00.000Z","model":"goo\n`,
            'utf8',
          );

          /**
           * Ledger over the torn file.
           */
          const ledger = createBedrockLedger({
            path,
            creditUsd: 200,
          },);

          /**
           * What the read threw.
           */
          const thrown = await ledger
            .read()
            .then(
              function unexpected(): unknown {
                return undefined;
              },
              function caught(error: unknown,): unknown {
                return error;
              },
            );
          expect(thrown,).toBeInstanceOf(BedrockLedgerShapeError,);
          expect((thrown as Error).message,).toContain('line 2',);
        },);
      },
    },),

    it({
      name: 'REFUSES A LINE WHOSE COST IS NOT A NON-NEGATIVE NUMBER, since a negative or absent cost '
        + 'would refund the credit',
      fn: async () => {
        await inScratch(async function body(dir,) {
          /**
           * Ledger file whose one line carries a negative cost.
           */
          const path = join(
            dir,
            'bedrock-spend.jsonl',
          );
          await writeFile(
            path,
            `${JSON.stringify(callCosting({ usd: -1, },),)}\n`,
            'utf8',
          );

          /**
           * What the read threw.
           */
          const thrown = await createBedrockLedger({
            path,
            creditUsd: 200,
          },)
            .read()
            .then(
              function unexpected(): unknown {
                return undefined;
              },
              function caught(error: unknown,): unknown {
                return error;
              },
            );
          expect(thrown,).toBeInstanceOf(BedrockLedgerShapeError,);
          expect((thrown as Error).message,).toContain('usd is not a non-negative number',);
        },);
      },
    },),
  ],
},);

await describe({
  name: 'ledger settings from the environment',
  children: [
    it({
      name: 'READS THE OWNER\'S CREDIT by default and an override where one is set',
      fn: async () => {
        expect(bedrockCreditUsdFrom({ env: {}, },),).toBe(BEDROCK_CREDIT_USD,);
        expect(bedrockCreditUsdFrom({ env: { [BEDROCK_CREDIT_USD_VAR]: '', }, },),).toBe(BEDROCK_CREDIT_USD,);
        expect(bedrockCreditUsdFrom({ env: { [BEDROCK_CREDIT_USD_VAR]: '150.5', }, },),).toBe(150.5,);
        expect(bedrockCreditUsdFrom({ env: { [BEDROCK_CREDIT_USD_VAR]: '0', }, },),).toBe(0,);
      },
    },),

    it({
      name: 'REFUSES AN OVERRIDE THAT IS NOT AN AMOUNT, naming the variable and quoting the value, '
        + 'since an operator who set it believes the credit is bounded as they asked',
      fn: async () => {
        expect(function plenty(): number {
          return bedrockCreditUsdFrom({ env: { [BEDROCK_CREDIT_USD_VAR]: 'plenty', }, },);
        },).toThrow(BedrockCreditOverrideError,);
        expect(function negative(): number {
          return bedrockCreditUsdFrom({ env: { [BEDROCK_CREDIT_USD_VAR]: '-5', }, },);
        },).toThrow(BedrockCreditOverrideError,);
      },
    },),

    it({
      name: 'PUTS THE FILE UNDER THE HOME IT IS GIVEN by default, never a spelled-out username, and '
        + 'where the variable points otherwise',
      fn: async () => {
        expect(defaultBedrockLedgerPath({ home: '/srv/cats', },),).toBe(
          '/srv/cats/.local/state/translation-repair/bedrock-spend.jsonl',
        );
        expect(bedrockLedgerPathFrom({
          env: {},
          home: '/srv/cats',
        },),).toBe('/srv/cats/.local/state/translation-repair/bedrock-spend.jsonl',);
        expect(bedrockLedgerPathFrom({
          env: { [BEDROCK_LEDGER_PATH_VAR]: '/var/lib/cats/spend.jsonl', },
          home: '/srv/cats',
        },),).toBe('/var/lib/cats/spend.jsonl',);
      },
    },),
  ],
},);
