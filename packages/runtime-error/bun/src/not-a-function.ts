/**
 * Intentionally triggers `TypeError: notAFunction is not a function` by
 * casting a string value to a callable type and then invoking it. The
 * double-cast bypasses TypeScript's static type check so the error surfaces
 * at runtime rather than compile time.
 */
export {}

const notAFunction = "I am a string" as unknown as () => void;

notAFunction();
