/**
 * Intentionally triggers `TypeError: notAFunction is not a function` by
 * casting a string value to a callable type and then invoking it. The
 * double-cast bypasses TypeScript's static type check so the error surfaces
 * at runtime rather than compile time.
 */
export {};

/**
 * String value cast to a callable type to trigger a runtime TypeError.
 */
// oxlint-disable-next-line no-unsafe-type-assertion -- intentional unsafe cast to provoke a runtime TypeError
const notAFunction = 'I am a string' as unknown as () => void;

notAFunction();
