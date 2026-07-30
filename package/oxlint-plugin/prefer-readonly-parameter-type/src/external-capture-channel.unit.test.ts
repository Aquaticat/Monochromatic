/**
 * Whether a capture handed to an external package's retained callback is charged.
 *
 * Its own test, over a dependency this file writes, because no other route exists. The external channel
 * needs an installed package with a locked version whose shipped implementation the analyzer can load,
 * and this workspace has none it can reach: a `workspace:*` dependency appears in `pnpm-lock.yaml` only
 * as `link:package/...`, never as a `name@version` key, so `packageVersionIsLocked` answers false for
 * every package the repo owns.
 *
 * Authoring one satisfies every gate, because `packageVersionIsLocked` walks ancestors of
 * `consumerProject.configFileName` rather than the repository root. A disposable consumer directory
 * therefore owns its own lockfile, its own configured project, and its own `node_modules`.
 *
 * What the authored lockfile does **not** prove: that pnpm would emit that key for a package installed
 * this way. It would not. A `file:` tarball is keyed `name@file:/absolute/path`, and a workspace link is
 * keyed `link:`, so neither reaches the gate. The key shape here is copied from this repository's own
 * `pnpm-lock.yaml`, and the gate under test reads a lockfile rather than an installer, so a copied shape
 * is the honest input. The boundary is worth stating rather than leaving implied.
 *
 * Driven through the effect summaries rather than through oxlint deliberately. Under oxlint the whole
 * external channel fails with `spawn ENOMEM`, because `openExternalImplementation` starts a second
 * TypeScript child mid-lint after oxlint has reserved a multi-gigabyte virtual buffer per worker, which
 * is the failure `initializeSemanticBridge` exists to avoid for the first child. Task #117 holds that.
 * The end-to-end falsification was run separately under `oxlint --threads=1`, where the channel does
 * work, and it produced both halves at once:
 *
 * ```text
 * consumer.ts:15: ... used by these calls: capture-retainer-probe@1.0.0 . retainCallback
 * consumer.ts:25: Parameter "config" should be readonly: property row is writable.
 * ```
 *
 * @module
 */

import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { isFunctionLikeDeclaration, } from 'typescript/unstable/ast/is';

import {
  buildEffectSummaryIndex,
  closeSemanticBridge,
  NO_EFFECT_SUMMARY,
  openSemanticFile,
} from '../dist/final/node/index.mjs';

/**
 * Authored dependency name, which must not name anything installed.
 */
const PACKAGE_NAME = 'capture-retainer-probe';

/**
 * Authored dependency version, matched exactly by the fixture lockfile key.
 */
const PACKAGE_VERSION = '1.0.0';

/**
 * Shipped implementation, whose effects the analyzer proves by reading this source.
 *
 * `retainCallback` keeps both arguments past its own return, which is what makes its summary non-empty
 * and therefore what makes the external gate open at all. `stampRow` writes its formal, so a consumer
 * handing it caller state is charged a proven mutation rather than opacity, and that difference is the
 * fixture's own proof that the external path ran.
 *
 * `runCallback` invokes rather than keeps, which reaches a different branch of the formal selection:
 * retention arrives as an opaque formal and invocation as an invoked one. Without it, deleting
 * invocation from that selection would leave this suite green while a measured false offer returned.
 */
const IMPLEMENTATION_SOURCE = `const heldCallbacks = [];
const heldRows = [];

export function retainCallback(callback, row) {
  heldCallbacks.push(callback);
  heldRows.push(row);
  return heldCallbacks.length;
}

export function stampRow(row) {
  row.label = 'external';
}

export function retainRow(row) {
  heldRows.push(row);
  return heldRows.length;
}

export function runCallback(callback) {
  return callback();
}
`;

/**
 * Shipped declarations, which are what the consumer's checker resolves each call against.
 *
 * `retainCallback` declares `() => void` while the consumer hands it `() => Row`. That substitution is
 * legal, which is the whole reason a reading closure reaches caller state here.
 */
const DECLARATION_SOURCE = `export declare function retainCallback(callback: () => void, row: { label: string; }): number;
export declare function stampRow(row: { label: string; }): void;
export declare function retainRow(row: { label: string; }): number;
export declare function runCallback(callback: () => void): void;
`;

/**
 * Consumer source, one callable per claim.
 */
const CONSUMER_SOURCE = `import { retainCallback, retainRow, runCallback, stampRow, } from '${PACKAGE_NAME}';

export type Row = { label: string; };

export type Config = { row: Row; };

export function stampThroughExternal(config: Config,): void {
  stampRow(config.row,);
}

export function retainRowThroughExternal(config: Config,): number {
  return retainRow(config.row,);
}

export function proveRetainCallbackResolves(config: Config,): number {
  return retainCallback(
    function fresh(): void {
      const own: Row = { label: 'own', };
      own.label = 'changed';
    },
    config.row,
  );
}

export function handRowProducerToExternalRetainer(config: Config,): number {
  return retainCallback(
    function produce(): Row {
      return config.row;
    },
    { label: 'own', },
  );
}

export function handFreshProducerToExternalRetainer(): number {
  return retainCallback(
    function produceFresh(): Row {
      return { label: 'fresh', };
    },
    { label: 'own', },
  );
}

export function handCaptureWriterToExternalRetainer(config: Config,): number {
  return retainCallback(
    function writeRow(): void {
      config.row.label = 'external';
    },
    { label: 'own', },
  );
}

export function handRowProducerToExternalRunner(config: Config,): void {
  runCallback(function produceForRunner(): Row {
    return config.row;
  },);
}
`;

/**
 * Disposable consumer workspace owning its own lockfile, configured project and dependency.
 */
type ExternalCaptureFixture = {
  readonly consumerPath: string;
  readonly [Symbol.dispose]: () => void;
};

/**
 * Materializes the consumer workspace and the dependency it resolves against.
 *
 * @returns fixture removed when the enclosing scope ends.
 *
 * @example
 * ```ts
 * using fixture = externalCaptureFixture();
 * ```
 */
function externalCaptureFixture(): ExternalCaptureFixture {
  /**
   * Consumer root, outside every repository lockfile's reach.
   */
  const root = mkdtempSync(join(
    tmpdir(),
    'readonly-external-capture-',
  ),);
  /**
   * Installed dependency root, whose `node_modules` segment is what package identity reads.
   */
  const packageRoot = join(
    root,
    'node_modules',
    PACKAGE_NAME,
  );
  mkdirSync(
    packageRoot,
    { recursive: true, },
  );
  writeFileSync(
    join(
      packageRoot,
      'package.json',
    ),
    `${JSON.stringify(
      {
        name: PACKAGE_NAME,
        version: PACKAGE_VERSION,
        type: 'module',
        exports: {
          types: './index.d.ts',
          default: './index.js',
        },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(
      packageRoot,
      'index.js',
    ),
    IMPLEMENTATION_SOURCE,
  );
  writeFileSync(
    join(
      packageRoot,
      'index.d.ts',
    ),
    DECLARATION_SOURCE,
  );
  /* Key shape copied from this repository's `pnpm-lock.yaml`. `lockfileLinePackageKey` scans for keys at
   * two-space indentation without regard to section, so the surrounding structure is present for
   * readers rather than for the parser. */
  writeFileSync(
    join(
      root,
      'pnpm-lock.yaml',
    ),
    `lockfileVersion: '9.0'

packages:

  ${PACKAGE_NAME}@${PACKAGE_VERSION}:
    resolution: {integrity: sha512-${'A'.repeat(86,)}==}

snapshots:

  ${PACKAGE_NAME}@${PACKAGE_VERSION}: {}
`,
  );
  writeFileSync(
    join(
      root,
      'tsconfig.json',
    ),
    `${JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          module: 'nodenext',
          moduleResolution: 'nodenext',
          target: 'esnext',
          noEmit: true,
        },
        include: ['consumer.ts',],
      },
      null,
      2,
    )}\n`,
  );
  /**
   * Consumer source path, whose ancestors supply the configured project and the lockfile.
   */
  const consumerPath = join(
    root,
    'consumer.ts',
  );
  writeFileSync(
    consumerPath,
    CONSUMER_SOURCE,
  );
  return {
    consumerPath,
    [Symbol.dispose](): void {
      rmSync(
        root,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

await describe({
  name: 'external capture channel',
  concurrency: 1,
  children: [
    it({
      name: 'charges a capture handed to an external formal the implementation keeps',
      fn: async () => {
        /* The callable handing a closure to a package that keeps it was offered `readonly` before
         * `recordExternalCaptureOpacity`. That was a false offer rather than an imprecision: the rule
         * wrote `Parameter "config" should be readonly: property row is writable.` under
         * `oxlint --threads=1`, and the retained closure hands back the caller's own row.
         *
         * The proof callables carry the other half, and they are why the subject means anything. If any
         * gate had rejected the authored dependency, `stampThroughExternal` would report ordinary
         * unresolved opacity instead of a proven mutation, and `proveRetainCallbackResolves` would carry
         * no package provenance. Those two shapes separate "the hole is closed" from "my fixture never
         * reached the code", and a fixture that stopped reaching it would otherwise look like a pass. */
        using fixture = externalCaptureFixture();
        /**
         * Consumer session, whose configured project is the fixture's own.
         */
        const session = openSemanticFile({
          fileName: fixture.consumerPath,
          sourceText: CONSUMER_SOURCE,
          hasBOM: false,
        },);
        /**
         * Effects over the consumer, resolving the authored dependency through the external channel.
         */
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
        },);
        /**
         * Reads one index set of one consumer callable.
         *
         * @param functionName - Consumer callable to inspect.
         *
         * @param read - Which index set to take off the summary.
         *
         * @returns those parameter indexes in ascending order.
         *
         * @throws when the name does not resolve to a callable carrying a summary.
         *
         * @example
         * ```ts
         * consumerIndexes({ functionName: 'stampThroughExternal', read: opaqueOf });
         * ```
         */
        function consumerIndexes({
          functionName,
          read,
        }: {
          readonly functionName: string;
          readonly read: (summary: {
            readonly referentMutatedParameterIndexes: Iterable<number>;
            readonly opaqueParameterIndexes: Iterable<number>;
          },) => Iterable<number>;
        },): readonly number[] {
          /**
           * Name node of the requested consumer declaration.
           */
          const nameNode = session.nodeAtOffset(
            CONSUMER_SOURCE.indexOf(`function ${functionName}`,)
              + 'function '.length,
          );
          /**
           * Declaration owning that name.
           */
          const declaration = nameNode.parent;
          if (!isFunctionLikeDeclaration(declaration,))
            throw new Error(`Expected a declaration for ${functionName}.`,);
          /**
           * Effect summary for that declaration.
           */
          const summary = index.get(declaration,);
          if (summary === NO_EFFECT_SUMMARY)
            throw new Error(`Expected an effect summary for ${functionName}.`,);
          return [...read(summary,),]
            .toSorted(function byIndex(left: number, right: number,): number {
              return left - right;
            },);
        }
        /**
         * Reads the opaque parameter indexes of one consumer callable.
         *
         * @param functionName - Consumer callable to inspect.
         *
         * @returns opaque parameter indexes in ascending order.
         *
         * @example
         * ```ts
         * consumerOpaque('handRowProducerToExternalRetainer');
         * ```
         */
        function consumerOpaque(functionName: string,): readonly number[] {
          return consumerIndexes({
            functionName,
            read: function opaqueOf(summary,): Iterable<number> {
              return summary.opaqueParameterIndexes;
            },
          },);
        }
        /**
         * Reads the written parameter indexes of one consumer callable.
         *
         * @param functionName - Consumer callable to inspect.
         *
         * @returns written parameter indexes in ascending order.
         *
         * @example
         * ```ts
         * consumerWritten('stampThroughExternal');
         * ```
         */
        function consumerWritten(functionName: string,): readonly number[] {
          return consumerIndexes({
            functionName,
            read: function writtenOf(summary,): Iterable<number> {
              return summary.referentMutatedParameterIndexes;
            },
          },);
        }
        /** Proven external mutation of a formal the consumer fed caller state. */
        const stamped = consumerWritten('stampThroughExternal',);
        /** Opacity from the same call, which must be absent for the mutation to be the proven kind. */
        const stampedOpaque = consumerOpaque('stampThroughExternal',);
        /** Proven external retention of a row passed directly. */
        const retainedRow = consumerOpaque('retainRowThroughExternal',);
        /** Proven external retention through the same export the capture cases use. */
        const retainerReached = consumerOpaque('proveRetainCallbackResolves',);
        /** Capture handed to the retaining export inside a closure that reads it. */
        const producedCapture = consumerOpaque('handRowProducerToExternalRetainer',);
        /** Closure allocating its own row, which must never be charged. */
        const freshCapture = consumerOpaque('handFreshProducerToExternalRetainer',);
        /** Capture inside a closure that writes it rather than handing it back. */
        const writtenCapture = consumerWritten('handCaptureWriterToExternalRetainer',);
        /** Capture handed to an export that invokes rather than keeps. */
        const invokedCapture = consumerOpaque('handRowProducerToExternalRunner',);
        closeSemanticBridge();
        /* The gates opened. A proven mutation arrives through the external summary, so this parameter is
         * written rather than merely unknown, and no unresolved boundary was recorded beside it. Both
         * halves matter: the write alone would also appear if the fixture's own direct-write scan had
         * produced it, and the empty opacity is what rules that out. */
        expect(stamped,).toEqual([0,],);
        expect(stampedOpaque,).toEqual([],);
        /* Proven external retention, charged from the shipped implementation's own store into a module
         * binding. Under oxlint these two carry `capture-retainer-probe@1.0.0` in the message, which is
         * provenance only `applyExternalEffect` writes. */
        expect(retainedRow,).toEqual([0,],);
        /* The per-export proof. This is the same `retainCallback` the two capture cases call, so it
         * settles that the gate opens for that exact export rather than merely for the package. */
        expect(retainerReached,).toEqual([0,],);
        /* The subject. `applyExternalEffect` maps external formals onto caller origins taken from
         * argument positions, and a closure argument carries no origin of its own, so a capture inside
         * one was charged by nothing: `recordOpaqueBoundary` is what charges captures, and the external
         * branch returns before reaching it. Measured `[]` before the channel existed. */
        expect(producedCapture,).toEqual([0,],);
        /* The control, and the one that decides this is an attribution rather than a rule against
         * handing any closure to an external callee. The same export, the same position, a closure
         * allocating its own row: nothing captured travels, so the offer stands. */
        expect(freshCapture,).toEqual([],);
        /* The shape that is already covered, and the reason the falsification needed a reading closure
         * rather than a writing one. A write inside the closure is attributed by the direct-write scan
         * whatever the callee is, so it never reaches the capture channel and cannot expose its
         * absence. */
        expect(writtenCapture,).toEqual([0,],);
        /* The second branch of the formal selection, and it needs its own case rather than inheriting
         * the subject's. Retention reaches an opaque formal and invocation reaches an invoked one, so
         * deleting invocation from `exposingFormals` leaves every other line here passing while this
         * false offer returns. Measured as a false offer in its own right: this reported
         * `Parameter "config" should be readonly` under `oxlint --threads=1` before the channel
         * existed. */
        expect(invokedCapture,).toEqual([0,],);
      },
    },),
  ],
},);
