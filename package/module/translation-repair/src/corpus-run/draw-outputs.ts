import { rm, } from 'node:fs/promises';

//region Draw outputs
// The lifetime of the files one draw writes.
//
// A draw produces three outputs that must exist together to mean anything: the
// detection sheet, the repair sheet, and the manifest joining sheet positions
// back to issue ids. They are written one after another, and a FINAL path is
// refused once it exists, which is what protects graded work from a repeated
// draw.
//
// Those two facts combine badly on failure. A fault between writes leaves a
// partial set, and the refusal then blocks the next draw on files nobody ever
// graded. Removing what the failed invocation created is what returns the
// directory to a state a draw can be retried from, and it can never remove
// graded work, because a graded sheet is one an earlier invocation committed.

/**
 * Files a draw has written, and whether it finished writing all of them.
 *
 * @example
 * ```ts
 * await using outputs: DrawOutputs = trackDrawOutputs();
 * ```
 */
export type DrawOutputs = AsyncDisposable & {
  /**
   * Notes a file this draw created.
   */
  readonly record: ({ path, }: { readonly path: string; },) => void;

  /**
   * Marks the set complete, so nothing is removed on the way out.
   */
  readonly commit: () => void;
};

/**
 * Tracks the files a draw writes and removes them unless it finished.
 *
 * @returns Tracker to be held with `await using`
 *
 * @example
 * ```ts
 * await using outputs = trackDrawOutputs();
 * outputs.record({ path: sheetPath, },);
 * outputs.commit();
 * ```
 */
export function trackDrawOutputs(): DrawOutputs {
  /**
   * Paths written so far, and whether the set completed.
   */
  const state = {
    paths: [] as string[],
    committed: false,
  };
  return {
    record({ path, }: { readonly path: string; },): void {
      state.paths
        .push(path,);
    },
    commit(): void {
      state.committed = true;
    },
    async [Symbol.asyncDispose](): Promise<void> {
      if (state.committed)
        return;
      // `force` so removing a path the failing write never created is not
      // itself a failure, which is the ordinary case: the write that threw is
      // the one whose file may be absent.
      await Promise.all(state.paths
        .map(function removeOne(path,) {
          return rm(
            path,
            { force: true, },
          );
        },),);
    },
  };
}

//endregion Draw outputs
