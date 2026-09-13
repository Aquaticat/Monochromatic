import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import type {
  FrozenPreparationObligation,
  FrozenPreparationParent,
  FrozenPreparationReference,
} from './preparation-selection-model.ts';
import {
  selectionArray,
  selectionDigest,
  selectionRecord,
  selectionString,
} from './preparation-selection-value.ts';

//region Frozen identity and supporting-evidence inventories

/**
 * Frozen parent count is distinct from the later forty writing rounds.
 */
export const FROZEN_PREPARATION_PARENT_COUNT = 40;
/**
 * Parent IDs encode entry, source label/index and target label/index.
 */
const PARENT_ID_SEGMENTS = 5;
/**
 * Target label position in the frozen ID grammar.
 */
const TARGET_LABEL_INDEX = 3;
/**
 * Target section coordinate position in the frozen ID grammar.
 */
const TARGET_COORDINATE_INDEX = 4;

/**
 * First printable ASCII code unit.
 */
const PRINTABLE_ASCII_START = 32;
/**
 * Beginning of DEL and the C1 control block.
 */
const CONTROL_BLOCK_START = 127;
/**
 * End of the C1 control block.
 */
const CONTROL_BLOCK_END = 159;

/**
 * Checks an entry path component without changing its frozen spelling.
 *
 * @param entryId - one bounded component of the independently matched artifact
 *
 * @returns Whether whitespace edges, traversal and control characters are absent
 *
 * @example
 * ```ts
 * const valid = validParentEntry('fixture');
 * ```
 */
export function validParentEntry(entryId: string,): boolean {
  if ((entryId.length === 0) || (entryId !== entryId.trim())
    || (entryId === '.')
    || (entryId === '..')
    || entryId.includes('\\',))
    return false;
  for (let index = 0; index < entryId.length; index += 1) {
    /**
     * Control code units are invalid even when embedded inside an otherwise printable entry name.
     */
    const code = nonNullishOrThrow(entryId.codePointAt(index,),);
    if ((code < PRINTABLE_ASCII_START) || ((code >= CONTROL_BLOCK_START) && (code <= CONTROL_BLOCK_END)))
      return false;
  }
  return true;
}

/**
 * Reads one canonical section coordinate rather than accepting alternate numeric spellings.
 *
 * @param value - frozen ID component
 *
 * @returns Safe nonnegative index
 *
 * @throws PreparationRootError when coordinate grammar differs
 *
 * @example
 * ```ts
 * const index = parentCoordinate('2');
 * ```
 */
function parentCoordinate(value: unknown,): number {
  if ((typeof value) !== 'string')
    throw new PreparationRootError({ kind: 'selection-parents', },);
  /**
   * Numeric conversion is accepted only when exact canonical text round-trips.
   */
  const index = Number(value,);
  if ((!Number.isSafeInteger(index,)) || (index < 0)
    || (String(index,) !== value))
    throw new PreparationRootError({ kind: 'selection-parents', },);
  return index;
}

/**
 * Reads ordered frozen parent identities without drawing or substituting a parent.
 *
 * @param value - complete ordered parent ID array
 *
 * @returns Owned identity records in frozen order
 *
 * @throws PreparationRootError when cardinality, uniqueness or ID grammar differs
 *
 * @example
 * ```ts
 * const parents = selectionParents(value);
 * ```
 */
export function selectionParents(value: unknown,): readonly FrozenPreparationParent[] {
  /**
   * The parsed collection must retain the fixed parent count.
   */
  const ids = selectionArray(value,);
  if ((ids.length !== FROZEN_PREPARATION_PARENT_COUNT) || (new Set(ids,).size !== ids.length))
    throw new PreparationRootError({ kind: 'selection-parents', },);
  return ids.map(function parent(item,): FrozenPreparationParent {
    /**
     * Exact frozen identifier, retained separately from its parsed coordinates.
     */
    const parentId = selectionString(item,);
    /**
     * Finite path grammar, not executable source or a filesystem request.
     */
    const parts = parentId.split('/',);
    /**
     * Entry component cannot escape a later corpus-relative path.
     */
    const [entryId,] = parts;
    if ((parts.length !== PARENT_ID_SEGMENTS) || (entryId === undefined)
      || (!validParentEntry(entryId,))
      || (parts[1] !== 'source-section')
      || (parts[TARGET_LABEL_INDEX] !== 'target-section'))
      throw new PreparationRootError({ kind: 'selection-parents', },);
    return {
      parentId,
      entryId,
      sourceIndex: parentCoordinate(parts[2],),
      targetIndex: parentCoordinate(parts[TARGET_COORDINATE_INDEX],),
    };
  },);
}

/**
 * Retains every original supporting-artifact reference without reading or executing its path.
 *
 * @param value - frozen reference inventory
 *
 * @returns Owned locators and exact expected hashes for the later verifier
 *
 * @throws PreparationRootError when inventory is missing, duplicated or malformed
 *
 * @example
 * ```ts
 * const references = selectionReferences(value);
 * ```
 */
export function selectionReferences(value: unknown,): readonly FrozenPreparationReference[] {
  /**
   * Explicit references remain distinct from later verified artifact bytes.
   */
  const references = selectionArray(value,)
    .map(function reference(item,): FrozenPreparationReference {
    /**
     * Parsed record has no executable meaning.
     */
    const record = selectionRecord(item,);
    return {
      path: selectionString(record.path,),
      hash: selectionDigest({
        value: record.hash,
        kind: 'selection-references',
      },),
    };
  },);
  /**
   * Path identity, not hash equality, determines duplicate supporting references.
   */
  const paths = references.map(function path(reference,): string {
    return reference.path;
  },);
  if ((references.length === 0) || (new Set(paths,).size !== references.length))
    throw new PreparationRootError({ kind: 'selection-references', },);
  return references;
}

/**
 * Preserves one reading-derived obligation record per frozen parent without turning notes into call permission.
 *
 * @param value - frozen source-context obligations
 *
 * @param parents - independently checked ordered identities
 *
 * @returns Owned notes and unresolved flags in original order
 *
 * @throws PreparationRootError when an obligation is absent or belongs to a different parent
 *
 * @example
 * ```ts
 * const obligations = selectionObligations({ value, parents });
 * ```
 */
export function selectionObligations({
  value,
  parents,
}: {
  readonly value: unknown;
  readonly parents: readonly FrozenPreparationParent[]
},): readonly FrozenPreparationObligation[] {
  /**
   * No parent disappears merely because its context qualification remains open.
   */
  const records = selectionArray(value,);
  if (records.length !== parents.length)
    throw new PreparationRootError({ kind: 'selection-obligations', },);
  return records.map(function obligation(
    item,
    index,
  ): FrozenPreparationObligation {
    /**
     * Notes are data authored during reading, not execution directives.
     */
    const record = selectionRecord(item,);
    if ((record.parentId
      !== parents[index]
      ?.parentId) || (record.disposition !== 'unqualified; failure aborts without substitution')
      || ((typeof record.pictureEvidenceNeeded) !== 'boolean')
      || ((typeof record.scopeQualificationOpen) !== 'boolean'))
      throw new PreparationRootError({ kind: 'selection-obligations', },);
    /**
     * Each required context string is preserved rather than interpreted or rewritten.
     */
    const requiredContext = selectionArray(record.requiredContext,)
      .map(function context(contextText,): string {
        return selectionString(contextText,);
      },);
    if (requiredContext.length === 0)
      throw new PreparationRootError({ kind: 'selection-obligations', },);
    return {
      parentId: selectionString(record.parentId,),
      requiredContext,
      pictureEvidenceNeeded: record.pictureEvidenceNeeded,
      scopeQualificationOpen: record.scopeQualificationOpen,
    };
  },);
}

//endregion Frozen identity and supporting-evidence inventories
