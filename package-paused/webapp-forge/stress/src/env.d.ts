/**
 * Ambient type declarations for the webapp-forge-stress package.
 *
 * Declares the static-asset module shape used by the imported server
 * package's `import schema from './migrations/...sql' with { type: 'text' }`.
 */

declare module '*.sql' {
  const sql: string;
  export default sql;
}
