/**
 Registry of background jobs owned by one extension instance.

 @module
 */

import type { RunningJob, } from './job-runner.ts';

//region Types

/**
 Live view of every job started from `!` and not yet reported.
 */
type JobRegistry = {
  /**
   Tracks a started job so progress and cancellation can reach it.
   */
  readonly add: (job: RunningJob) => void;

  /**
   Stops tracking a job whose outcome was already reported.
   */
  readonly remove: (id: string) => void;

  /**
   Lists tracked jobs in start order.
   */
  readonly list: () => readonly RunningJob[];

  /**
   Counts tracked jobs, used to decide whether a keystroke belongs to us.
   */
  readonly size: () => number;

  /**
   Cancels every tracked job and reports how many were cancelled.
   */
  readonly cancelAll: () => number;
};

//endregion Types

//region Registry

/**
 Creates an empty registry.
 
 Concurrency is unrestricted on purpose: refusing a second command while one
 runs is exactly the native behavior this extension exists to replace.
 
 @returns registry tracking jobs for one extension instance
 
 @example
 ```ts
 const jobs = createJobRegistry();
 jobs.size();
 ```
 */
function createJobRegistry(): JobRegistry {
  /**
   Tracked jobs keyed by identifier, which preserves insertion order.
   */
  const jobs = new Map<string, RunningJob>();

  return {
    add(job: RunningJob, ): void {
      jobs.set(
        job.id,
        job,
      );
    },

    remove(id: string, ): void {
      jobs.delete(id, );
    },

    list(): readonly RunningJob[] {
      return [...jobs.values(), ];
    },

    size(): number {
      return jobs.size;
    },

    cancelAll(): number {
      /**
       Tracked jobs snapshot, so a cancellation that reports immediately cannot
       mutate the collection being walked.
       */
      const tracked = [...jobs.values(), ];
      for (const job of tracked)
        job.cancel();
      return tracked.length;
    },
  };
}

//endregion Registry

export { createJobRegistry, };

export type { JobRegistry, };
