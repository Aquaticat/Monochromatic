/**
 * Intentionally triggers `TypeError: Cannot read properties of null` by
 * accessing a property on a `null` value. The double-cast bypasses TypeScript's
 * static null check so the error surfaces at runtime rather than compile time.
 */
const value = null as unknown as Record<string, unknown>;

console.log(value["property"]);
