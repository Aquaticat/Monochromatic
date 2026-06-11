import { $ as pick, } from '../../../pick/p n/index.ts';

/**
 * Extract properties from an object based on an iterable of keys.
 *
 * Accepts any iterable of keys (arrays, Sets, generators) and returns
 * a new object containing only those properties. Delegates to pick
 * internally after converting the iterable to a Set.
 *
 * @param obj - Input object to extract properties from
 *
 * @param extracted - Iterable of keys to extract
 *
 * @returns Object containing only the extracted properties
 *
 * @throws Error when a key in extracted does not exist in obj
 *
 * @throws TypeError when extracted iterable is empty
 *
 * @example
 * Extract with array of keys:
 * ```ts
 * const result = $({ obj: { a: 1, b: 2, c: 3 }, extracted: ['a', 'c'] });
 * console.log(result); // { a: 1, c: 3 }
 * ```
 *
 * @example
 * Extract with Set:
 * ```ts
 * const data = { name: 'John', age: 30, city: 'NYC' };
 * const personal = $({ obj: data, extracted: new Set(['name', 'age']) });
 * console.log(personal); // { name: 'John', age: 30 }
 * ```
 *
 * @example
 * Dynamic key extraction:
 * ```ts
 * const data = { x: 1, y: 2, z: 3, w: 4 };
 * const keysToExtract = Object.keys(data).filter(key => key !== 'w');
 * const filtered = $({ obj: data, extracted: keysToExtract });
 * console.log(filtered); // { x: 1, y: 2, z: 3 }
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function $<
  const TObject extends Record<string, unknown>,
  const TKeys extends keyof TObject,
>({
  obj,
  extracted,
}: {
  obj: TObject;
  extracted: Iterable<TKeys>;
},): Pick<TObject, TKeys> {
  /**
   * Keys to extract collected into a Set for O(1) membership inside pick.
   */
  const extractedSet = extracted instanceof Set
    ? extracted as ReadonlySet<TKeys>
    : new Set(extracted,);

  if (extractedSet.size
    === 0)
    throw new TypeError('Extracted iterable cannot be empty',);

  return pick({
    original: obj,
    toPick: extractedSet,
  },);
}
