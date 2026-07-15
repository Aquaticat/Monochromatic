/**
 * Type declarations for text-typed module imports used in test fixtures.
 *
 * @module
 */

/** SQL files imported with `{ type: 'text' }` resolve to their raw content as a default export. */
declare module '*.sql' {
  const content: string;
  export default content;
}
