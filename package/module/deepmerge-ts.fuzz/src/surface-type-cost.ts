/**
 Type-checker cost of deepmerge-ts result types: generates one scenario file
 per shape family and size, type-checks each alone with
 `tsc --extendedDiagnostics`, and prints instantiations, types, check time,
 memory, and any diagnostic codes.

 Runs inside a capped container with the scratch install from
 `./surface-toolchain.ts`:

 ```sh
 node src/surface-type-cost.ts <scratch> [alias] [family-prefix] [repeat]
 ```

 Instantiation and type counts are deterministic; check time and memory vary
 run to run (measure the band with `repeat` on one case before comparing).
 Findings: `doc/audit/deepmerge-ts-surface-2026-09-24.md`.

 @module
 */

import {
  mkdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  isTypeScriptAlias,
  runChild,
  tscPrefix,
} from './surface-toolchain.ts';

/**
 Per-case limit; the largest case measured takes under 3 seconds.
 */
const CASE_TIMEOUT_MS = 180_000;

/**
 Consecutive integers from zero.

 @param count - How many.

 @returns `[0, 1, ..., count - 1]`.

 @example
 ```ts
 range(3,); // [0, 1, 2]
 ```
 */
function range(count: number,): readonly number[] {
  return Array.from(
    { length: count, },
    function index(
      _unused,
      position,
    ) {
    return position;
  },
  );
}

/**
 Nested record literal `depth` levels deep, with a distinct leaf key per level.

 @param depth - Nesting levels.

 @param leaf - Suffix keeping two inputs' leaf keys apart.

 @returns Object literal source.

 @example
 ```ts
 nested({ depth: 1, leaf: 'a', },); // '{ n: { enda: true }, l0a: 0 }'
 ```
 */
function nested({
  depth,
  leaf,
}: {
  readonly depth: number;
  readonly leaf: string
},): string {
  return range(depth,)
    .reduce(
      function wrap(
        inner,
        level,
      ) {
    return `{ n: ${inner}, l${String(level,)}${leaf}: ${String(level,)} }`;
  },
      `{ end${leaf}: true }`,
    );
}

/**
 Sizes a family sweeps: an arithmetic or a geometric sequence from `first`
 up to and including `last`.
 */
type Series = {
  readonly kind: 'linear';
  readonly first: number;
  readonly step: number;
  readonly last: number;
} | {
  readonly kind: 'geometric';
  readonly first: number;
  readonly ratio: number;
  readonly last: number;
};

/**
 Expand a {@link Series} into its sizes.

 @param series - Sweep description.

 @returns Sizes in increasing order.

 @example
 ```ts
 seriesOf({ first: 1, kind: 'geometric', last: 8, ratio: 2, },); // [1, 2, 4, 8]
 ```
 */
function seriesOf(series: Series,): readonly number[] {
  /**
   Sizes collected so far.
   */
  const sizes: number[] = [];
  for (let size = series.first; size <= series.last; size = (series.kind === 'linear') ? size + series.step : size * series.ratio)
    sizes.push(size,);
  return sizes;
}

/**
 Scenario body per family, given the size; each reads the result so the
 checker resolves it.
 */
const FAMILIES: Readonly<Record<string, {
  readonly series: Series;
  readonly body: (size: number,) => string
}>> = {
  args: {
    body: function args(size,) {
      return `const merged = deepmerge(${range(size,)
        .map(function input(i,) {
        return `{ k${String(i,)}: ${String(i,)}, shared: { x${String(i,)}: "${String(i,)}" }, list: [${String(i,)}] }`;
      },)
        .join(', ',)});\nexport const probe: number = merged.k${String(size - 1,)};`;
    },
    series: {
      first: 25,
      kind: 'linear',
      last: 200,
      step: 25,
    },
  },
  deep: {
    body: function deep(size,) {
      return `const merged = deepmerge(${nested({
        depth: size,
        leaf: 'a',
      },)}, ${nested({
        depth: size,
        leaf: 'b',
      },)});\nexport const probe: boolean = merged${'.n'.repeat(size,)}.endb;`;
    },
    series: {
      first: 10,
      kind: 'linear',
      last: 70,
      step: 20,
    },
  },
  intowide: {
    body: function intoWide(size,) {
      return `const target = { ${range(size,)
        .map(function key(i,) { return `k${String(i,)}: ${String(i,)}`; },)
        .join(', ',)} };\ndeepmergeInto(target, { ${range(size,)
          .map(function key(i,) { return `k${String(i + (size / 2),)}: "s"`; },)
          .join(', ',)} });\nexport const probe = target.k${String(size - 1,)};`;
    },
    series: {
      first: 100,
      kind: 'geometric',
      last: 800,
      ratio: 2,
    },
  },
  recursive: {
    body: function recursive(size,) {
      return `${range(size,)
        .map(function declare(i,) {
        return `type T${String(i,)} = { v${String(i,)}: number; child?: T${String(i,)}; list?: T${String(i,)}[] };\ndeclare const t${String(i,)}: T${String(i,)};`;
      },)
        .join('\n',)}\nconst merged = deepmerge(${range(size,)
          .map(function name(i,) { return `t${String(i,)}`; },)
          .join(', ',)});\nexport const probe = merged.child?.child?.child;`;
    },
    series: {
      first: 5,
      kind: 'linear',
      last: 50,
      step: 5,
    },
  },
  sets: {
    body: function sets(size,) {
      return `export const probe = deepmerge(${range(size,)
        .map(function set(i,) { return `new Set<"v${String(i,)}">()`; },)
        .join(', ',)});`;
    },
    series: {
      first: 10,
      kind: 'linear',
      last: 50,
      step: 20,
    },
  },
  tuple: {
    body: function tuple(size,) {
      return `export const probe = deepmerge([${range(size,)
        .join(', ',)}] as const, [${range(size,)
          .join(', ',)}] as const).length;`;
    },
    series: {
      first: 100,
      kind: 'geometric',
      last: 800,
      ratio: 2,
    },
  },
  union: {
    body: function union(size,) {
      /**
       Union of `size` object types.
       */
      const members = range(size,)
        .map(function member(i,) { return `{ t: ${String(i,)}; v${String(i,)}: string }`; },)
        .join(' | ',);
      return `declare const a: { f: ${members} };\ndeclare const b: { f: ${members} };\nexport const probe = deepmerge(a, b).f;`;
    },
    series: {
      first: 4,
      kind: 'geometric',
      last: 64,
      ratio: 2,
    },
  },
  wide: {
    body: function wide(size,) {
      return `const merged = deepmerge({ ${range(size,)
        .map(function key(i,) { return `k${String(i,)}: ${String(i,)}`; },)
        .join(', ',)} }, { ${range(size,)
          .map(function key(i,) { return `k${String(i + (size / 2),)}: "s"`; },)
          .join(', ',)} });\nexport const probe: string = merged.k${String(size - 1,)};`;
    },
    series: {
      first: 100,
      kind: 'geometric',
      last: 1_600,
      ratio: 2,
    },
  },
};

/**
 Value of one `--extendedDiagnostics` line.

 @param output - Compiler output.

 @param name - Metric label, such as `Instantiations`.

 @returns The value text, or `-` when the line is absent (the checker crashed or stopped early).

 @example
 ```ts
 metric({ name: 'Types', output: 'Types: 12\n', },); // '12'
 ```
 */
function metric({
  output,
  name,
}: {
  readonly output: string;
  readonly name: string
},): string {
  /**
   Line carrying the metric.
   */
  const line = output.split('\n',)
    .find(function labelled(candidate,) {
    return candidate.startsWith(`${name}:`,);
  },);
  return (line === undefined) ? '-' : line.slice(name.length + 1,)
    .trim();
}

/**
 Write every scenario of the families matching `prefix`, then check each.

 @param scratch - Scratch directory holding the install.

 @param alias - TypeScript release.

 @param prefix - Family name prefix; empty runs every family.

 @param repeat - Runs per case.

 @example
 ```ts
 await runCost({ alias: 'ts60', prefix: 'wide', repeat: 1, scratch: '/scratch', },);
 ```
 */
async function runCost(
  {
    scratch,
    alias,
    prefix,
    repeat,
  }: {
    readonly scratch: string;
    readonly alias: Parameters<typeof tscPrefix>[0]['alias'];
    readonly prefix: string;
    readonly repeat: number;
  },
): Promise<void> {
  /**
   Directory for generated scenarios.
   */
  const cases = join(
    scratch,
    'cost',
  );
  await rm(
    cases,
    {
      force: true,
      recursive: true,
    },
  );
  await mkdir(
    cases,
    { recursive: true, },
  );
  for (const [family, {
    series,
    body,
  },] of Object.entries(FAMILIES,)
    .filter(function wanted([name,],) {
    return name.startsWith(prefix,);
  },)) {
    for (const size of seriesOf(series,)) {
      /**
       Scenario file, relative to the scratch directory.
       */
      const file = join(
        'cost',
        `${family}-${String(size,)}.ts`,
      );
      // oxlint-disable-next-line eslint/no-await-in-loop -- one scenario at a time so each check gets the whole container.
      await writeFile(
        join(
          scratch,
          file,
        ),
        `import { deepmerge, deepmergeInto } from "deepmerge-ts";\n${body(size,)}\nexport {};\n`,
      );
      for (const _run of range(repeat,)) {
        /* oxlint-disable eslint/no-await-in-loop -- sequential for comparable timings. */
        /**
         Compiler run for this case.
         */
        const outcome = await runChild({
          args: [
            ...tscPrefix({
              alias,
              scratch,
            },),
            '--strict',
            '--skipLibCheck',
            '--extendedDiagnostics',
            file,
          ],
          command: 'node',
          cwd: scratch,
          timeoutMs: CASE_TIMEOUT_MS,
        },);
        /* oxlint-enable eslint/no-await-in-loop */
        /**
         Diagnostic codes in the output.
         */
        const codes = [...new Set(outcome.output
          .split('\n',)
          .filter(function isError(line,) {
          return line.includes('error TS',);
        },)
          .map(function codeOf(line,) {
          return line.slice(
            line.indexOf(
              'TS',
              line.indexOf('error',),
            ),
            line.indexOf(
              ':',
              line.indexOf('error',),
            ),
          );
        },),),];
        console.log([
          `${family}-${String(size,)}`,
          `inst=${metric({
            name: 'Instantiations',
            output: outcome.output,
          },)}`,
          `types=${metric({
            name: 'Types',
            output: outcome.output,
          },)}`,
          `check=${metric({
            name: 'Check time',
            output: outcome.output,
          },)}`,
          `mem=${metric({
            name: 'Memory used',
            output: outcome.output,
          },)}`,
          `exit=${outcome.exit}`,
          (codes.length > 0) ? `errors=${codes.join(',',)}` : '',
        ].join(' ',),);
      }
    }
  }
}

if (import.meta.main) {
  /**
   Scratch directory, release, family prefix, and repeat count.
   */
  const [scratch, alias = 'ts60', prefix = '', repeatText = '1',] = process.argv
    .slice(2,);
  /**
   Runs per case.
   */
  const repeat = Number(repeatText,);
  if ((scratch === undefined) || (!isTypeScriptAlias(alias,))
    || (!Number.isInteger(repeat,))
    || (repeat < 1))
    throw new Error('usage: surface-type-cost.ts <scratch> [alias] [family-prefix] [repeat]',);
  await runCost({
    alias,
    prefix,
    repeat,
    scratch,
  },);
}
