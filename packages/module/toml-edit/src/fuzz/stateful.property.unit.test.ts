/**
 * Stateful edit-model property: random `tomlSet` / `tomlDelete` sequences over
 * `emptyTomlEdit`, checked against an in-memory model of the effective document.
 *
 * An operation that the API rejects must throw a `TomlEditError` and leave both
 * the state and the model unchanged. An operation that succeeds must update the
 * effective read at its path to the written value (delete to `undefined`), and
 * the model is updated to match. After the whole sequence, `tomlStringify`
 * output reparses to a document semantically equal to the model. Repeating the
 * final successful set is byte-identical (idempotence).
 *
 * Paths are single top-level bare keys over a tiny alphabet, so overwrites and
 * type changes (a scalar then a table over it) arise often and exercise both the
 * success and rejection paths. Nested structure is exercised through object and
 * array-of-object values rather than dotted paths, whose implicit-parent edits
 * have known issues tracked in #252.
 *
 * Run plan and seed policy: see `../fuzz-budget.ts`.
 *
 * @module
 */

import {
  type Arbitrary,
  array,
  assert,
  asyncProperty,
  boolean,
  constant,
  constantFrom,
  dictionary,
  double,
  integer,
  oneof,
  string,
  tuple,
} from 'fast-check';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  emptyTomlEdit,
  parseTomlEdit,
  type TomlEditState,
  TomlEditError,
  tomlDelete,
  tomlGetValue,
  tomlSet,
  tomlStringify,
} from '@monochromatic-dev/module-toml-edit';

import { fuzzRunPlan, } from '../fuzz-budget.ts';
import {
  semanticEquals,
  semanticModel,
} from './equality.ts';

//region Arbitraries

/**
 * Run plan resolved once for every property in this file.
 */
const RUN = fuzzRunPlan();

/**
 * Maximum operations in one generated sequence.
 */
const MAX_OPS = 14;

/**
 * Scalar value arbitrary over the TOML-representable JS scalars (finite floats
 * only; the special float and datetime spellings are covered elsewhere).
 */
const scalarValueArbitrary = oneof(
  string(),
  integer(),
  boolean(),
  double({
    noNaN: true,
    noDefaultInfinity: true,
  },),
);

/**
 * Flat object arbitrary, emitted as a table or inline table.
 */
const flatObjectArbitrary = dictionary(
  constantFrom('x', 'y',),
  scalarValueArbitrary,
);

/**
 * Value arbitrary: scalars, flat objects (tables), arrays of scalars (inline
 * arrays), and non-empty arrays of flat objects (arrays-of-tables).
 */
const valueArbitrary: Arbitrary<unknown> = oneof(
  scalarValueArbitrary,
  flatObjectArbitrary,
  array(scalarValueArbitrary, { maxLength: 3, },),
  array(flatObjectArbitrary, {
    minLength: 1,
    maxLength: 3,
  },),
);

/**
 * Path arbitrary: a single bare top-level segment over a tiny alphabet.
 *
 * Constrained to one segment so the sequence stays on the reliably-supported
 * top-level edit surface. Nested edits over implicit dotted-key parents have
 * known delta-versus-bytes inconsistencies tracked in #252; nested structure is
 * still exercised here through object and array-of-object values.
 */
const pathArbitrary: Arbitrary<readonly string[]> = constantFrom('a', 'b', 'c',)
  .map(function single(owner,) { return [owner,]; },);

/**
 * One edit operation: a set with a value, or a delete.
 */
type EditOp =
  | { readonly kind: 'set'; readonly path: readonly string[]; readonly value: unknown; }
  | { readonly kind: 'delete'; readonly path: readonly string[]; };

/**
 * Operation arbitrary.
 */
const opArbitrary: Arbitrary<EditOp> = oneof(
  tuple(pathArbitrary, valueArbitrary,).map(function set([path, value,],) {
    return {
      kind: 'set',
      path,
      value,
    } as EditOp;
  },),
  pathArbitrary.map(function del(path,) {
    return {
      kind: 'delete',
      path,
    } as EditOp;
  },),
);

/**
 * Sequence arbitrary.
 */
const opsArbitrary: Arbitrary<readonly EditOp[]> = array(opArbitrary, { maxLength: MAX_OPS, },);

//endregion Arbitraries

//region Model helpers

/**
 * Mutable model node: a record of top-level model values.
 */
type ModelTree = Record<string, unknown>;

/**
 * Set `value` at the single-segment `path` within `tree`.
 *
 * @returns Nothing; mutates `tree` in place.
 */
function modelSet(
  {
    tree,
    path,
    value,
  }: {
    readonly tree: ModelTree;
    readonly path: readonly string[];
    readonly value: unknown;
  },
): void {
  tree[path[0] ?? ''] = structuredClone(value,);
}

/**
 * Delete the single-segment `path` from `tree`.
 *
 * @returns Nothing; mutates `tree` in place.
 */
function modelDelete({ tree, path, }: { readonly tree: ModelTree; readonly path: readonly string[]; },): void {
  Reflect.deleteProperty(tree, path[0] ?? '',);
}

//endregion Model helpers

//region Operation application

/**
 * Apply one operation to the live state and the model, asserting invariants.
 *
 * @returns Next state (unchanged when the operation was rejected).
 */
function applyOp(
  {
    edit,
    op,
    tree,
  }: {
    readonly edit: TomlEditState;
    readonly op: EditOp;
    readonly tree: ModelTree;
  },
): TomlEditState {
  try {
    if (op.kind === 'set') {
      /**
       * State after the set, computed before the model is updated to match.
       */
      const next = tomlSet({
        edit,
        path: op.path,
        value: op.value,
      },);
      modelSet({
        tree,
        path: op.path,
        value: op.value,
      },);
      // Whole-path read-back is well-defined for scalars; table and
      // array-of-tables whole-reads project sub-path only by design, so those
      // are validated through the final whole-document model check instead.
      if (((typeof op.value) !== 'object') || (op.value === null)) {
        expect(
          semanticEquals({
            left: tomlGetValue({
              edit: next,
              path: op.path,
            },) as never,
            right: op.value as never,
          },),
        ).toBe(true,);
      }
      return next;
    }
    /**
     * State after the delete.
     */
    const next = tomlDelete({
      edit,
      path: op.path,
    },);
    modelDelete({
      tree,
      path: op.path,
    },);
    expect(tomlGetValue({
      edit: next,
      path: op.path,
    },),).toBe(undefined,);
    return next;
  }
  catch (caught: unknown) {
    expect(caught,).toBeInstanceOf(TomlEditError,);
    return edit;
  }
}

//endregion Operation application

await describe({
  name: 'stateful edit model',
  children: [
    it({
      name: 'set/delete sequences keep effective reads and stringify in sync with the model',
      timeout: RUN.timeout,
      fn: async () => {
        await assert(
          asyncProperty(opsArbitrary, async function sequence(ops,) {
            /**
             * Predicted effective document.
             */
            const tree: ModelTree = {};
            /**
             * Live state. Each step applies one operation, then materializes by
             * reparsing the splice output, so the next operation resolves against
             * a real document. This is the documented "reparse to continue
             * editing" workflow and keeps pending deltas from accumulating across
             * operations.
             */
            const edit = ops.reduce(
              function step(current, op,) {
                /**
                 * State after the operation, before materialization.
                 */
                const afterOp = applyOp({
                  edit: current,
                  op,
                  tree,
                },);
                return parseTomlEdit({ source: tomlStringify({ edit: afterOp, },), },);
              },
              emptyTomlEdit(),
            );
            /**
             * Final serialization, which must reparse to the model.
             */
            const text = tomlStringify({ edit, },);
            expect(
              semanticEquals({
                left: semanticModel({ source: text, },),
                right: tree as never,
              },),
            ).toBe(true,);
          },),
          RUN.params,
        );
      },
    },),

    it({
      name: 'repeating a successful set on the reparsed result is byte-identical',
      timeout: RUN.timeout,
      fn: async () => {
        await assert(
          asyncProperty(
            pathArbitrary,
            valueArbitrary,
            async function idempotent(path, value,) {
              /**
               * Document after the first set of an empty base.
               */
              const once = tomlStringify({
                edit: tomlSet({
                  edit: emptyTomlEdit(),
                  path,
                  value,
                },),
              },);
              /**
               * Document after reparsing and repeating the identical set, the
               * documented way to apply a follow-up edit.
               */
              const twice = tomlStringify({
                edit: tomlSet({
                  edit: parseTomlEdit({ source: once, },),
                  path,
                  value,
                },),
              },);
              expect(twice,).toBe(once,);
            },
          ),
          RUN.params,
        );
      },
    },),
  ],
},);
