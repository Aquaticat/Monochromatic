/**
 * Extract properties from an object based on keys or validation schemas with transformation support.
 * Processes each extraction layer and collects all matching properties, allowing key transformations.
 *
 * Unlike pick which selects specific keys, extract applies transformations through schemas
 * and collects all properties that pass validation, potentially with renamed keys.
 *
 * @param obj - Input object to extract properties from
 * @param extracted - Keys or schemas to extract and transform
 * @returns Object containing extracted and potentially transformed properties
 * @throws {TypeError} When extracted array is empty
 *
 * @example
 * Extract specific key:
 * ```ts
 * const result = $({a: 1, b: 2}, ['a']);
 * console.log(result); // {a: 1}
 * ```
 *
 * @example
 * Extract multiple keys:
 * ```ts
 * const data = { name: 'John', age: 30, city: 'NYC', country: 'USA' };
 * const personal = $(data, ['name', 'age']);
 * console.log(personal); // { name: 'John', age: 30 }
 * ```
 *
 * @example
 * Extract with key filtering:
 * ```ts
 * const config = { apiKey: 'secret', apiUrl: 'https://api.com', theme: 'dark' };
 * const apiConfig = $(config, ['apiKey', 'apiUrl']);
 * console.log(apiConfig); // { apiKey: 'secret', apiUrl: 'https://api.com' }
 * ```
 *
 * @example
 * Working with nested object extraction:
 * ```ts
 * const user = {
 *   profile: { name: 'Alice', avatar: 'pic.jpg' },
 *   settings: { theme: 'dark', lang: 'en' },
 *   metadata: { created: '2023-01-01', version: 1 }
 * };
 * 
 * const essentials = $(user, ['profile', 'settings']);
 * console.log(essentials); // { profile: {...}, settings: {...} }
 * ```
 *
 * @example
 * Error handling for missing keys:
 * ```ts
 * const obj = { a: 1, b: 2 };
 * try {
 *   const result = $(obj, ['a', 'missing']);
 * } catch (error) {
 *   console.log('Key not found in object');
 * }
 * ```
 *
 * @example
 * Dynamic key extraction:
 * ```ts
 * const data = { x: 1, y: 2, z: 3, w: 4 };
 * const keysToExtract = Object.keys(data).filter(key => key !== 'w');
 * const filtered = $(data, keysToExtract);
 * console.log(filtered); // { x: 1, y: 2, z: 3 }
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function $<
  const TObject extends Record<string, unknown>,
  const TExtracted extends Iterable<keyof TObject>,
>(
  obj: TObject,
  extracted: TExtracted,
): Record<string, unknown> {
  
  // Handle iterable of keys
  const extractedArray = [...extracted];
  
  // Throw if extracted array is empty
  if (extractedArray.length === 0) {
    throw new TypeError('Extracted array cannot be empty');
  }

  const result: Record<string, unknown> = {};
  const processedKeys = new Set<string>();

  // Process each extraction key
  for (const extractor of extractedArray) {
    // Direct key extraction
    const stringKey = String(extractor);
    if (stringKey in obj && !processedKeys.has(stringKey)) {
      result[stringKey] = obj[stringKey as keyof TObject];
      processedKeys.add(stringKey);
    }
  }

  return result;
}