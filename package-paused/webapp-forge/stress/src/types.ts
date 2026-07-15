/**
 * Common types shared across stress scenarios.
 */

/**
 * Per-scenario report emitted to stdout (and optionally `--out=path`).
 */
export type ScenarioResult = {
  /**
   * Scenario identifier (e.g. `hot-repo`).
   */
  readonly scenario: string;
  /**
   * Total scenario duration in milliseconds.
   */
  readonly durationMs: number;
  /**
   * Total events processed by the dispatcher.
   */
  readonly eventCount: number;
  /**
   * Median per-event rebuild latency in milliseconds.
   */
  readonly p50: number;
  /**
   * 99th-percentile per-event rebuild latency in milliseconds.
   */
  readonly p99: number;
  /**
   * Total fragments written.
   */
  readonly fragmentsWritten: number;
  /**
   * Total bytes written across every fragment.
   */
  readonly bytesWritten: number;
  /**
   * Number of stale-read invariant violations.
   */
  readonly staleReadCount: number;
  /**
   * Free-form list of invariant violations recorded during the run.
   */
  readonly invariantViolations: readonly string[];
};

/**
 * Functions a scenario module exports.
 */
export type Scenario = {
  /**
   * Scenario name (matches `--scenario=` value).
   */
  readonly name: string;
  /**
   * Runs the scenario and returns its result.
   */
  run: () => Promise<ScenarioResult>;
};
