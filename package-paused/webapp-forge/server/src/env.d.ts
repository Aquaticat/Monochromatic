/**
 * Ambient type declarations for the webapp-forge-server package.
 *
 * Extends `process.env` with the env vars the server reads (so a typo in
 * `process.env.PORT` is caught at type-check time) and declares static
 * asset module shapes used with `import ... with { type: 'text' }`.
 */

declare namespace NodeJS {
  interface ProcessEnv {
    /** HTTP listen port; CLI `--port=` takes precedence. */
    readonly PORT?: string;
    /** libSQL file path; CLI `--db=` takes precedence. */
    readonly DB_PATH?: string;
  }
}

declare module '*.sql' {
  const sql: string;
  export default sql;
}
