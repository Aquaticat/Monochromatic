/**
 * Ambient type declarations local to the messages-demo package.
 *
 * Re-exports nothing; this file exists to extend the global `process.env`
 * shape with the env vars the server reads, so a typo in `process.env.PORT`
 * (etc.) is caught at type-check time.
 */

declare namespace NodeJS {
  interface ProcessEnv {
    /** HTTP listen port; CLI `--port=` takes precedence. */
    readonly PORT?: string;
    /** SQLite file path; CLI `--db=` takes precedence. */
    readonly DB_PATH?: string;
  }
}
