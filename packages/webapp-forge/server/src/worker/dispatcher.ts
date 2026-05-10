/**
 * Dispatcher: turns events into fragment rebuilds.
 *
 * Phase 1 dispatcher is **synchronous in-request**: callers (route
 * handlers, seed scripts, stress harnesses) invoke `processEvent`
 * directly after writing the event row. The work runs to completion
 * inline, so the next read sees the rebuilt fragment.
 *
 * Phase 2+ replaces this with an async worker pool (advisory locks,
 * heartbeat, debounce) that polls the events table. The interface in
 * this module stays stable for that migration: `processEvent` is the
 * single entry point both modes call.
 */

import { logger, } from '@monochromatic-dev/module-logger/logger';
import { tagged, } from '@monochromatic-dev/module-logger/tagged';

import {
  type EventKind,
  getIssue,
  listIssueLabels,
  listRepoLabels,
  upsertFragmentIndexIfNewer,
} from '../data/queries.ts';
import type { Storage, } from '../storage/adapter.ts';
import type { WriteBuffer, } from '../storage/write-buffer.ts';
import {
  dependenciesFor,
  type EventInput,
  type ResolvedEventContext,
} from './dependency-graph.ts';
import type { IssueStateFacet, } from './fragment-keys.ts';
import {
  existingContentHash,
  renderFragment,
} from './render.ts';

/** Tagged logger scoped to the dispatcher. */
const l = tagged({
  tag: 'dispatcher',
  l: logger,
},);

/**
 * Output of {@link processEvent}: counters useful to the stress harness.
 */
export type ProcessEventResult = {
  /** Total fragment keys that the dependency graph mapped to. */
  readonly fanout: number;
  /** Number of fragments whose content hash matched and were skipped. */
  readonly skipped: number;
  /** Number of fragments that were re-rendered and written. */
  readonly written: number;
  /** Number of fragments that lost the sequence-guard race (no-op). */
  readonly discarded: number;
};

/**
 * Turns one event into rebuilds.
 *
 * @param event - event header
 *
 * @param _sequenceNumber - per-resource sequence number that produced
 *                          the event. Unused after the sequence guard
 *                          moved to `events.id`; kept on the signature
 *                          so callers do not have to change as the
 *                          dispatcher learns to publish per-resource
 *                          metrics in Phase 2+
 *
 * @param eventId - generated `events.id`; doubles as the global
 *                  monotonic sequence guard for `fragment_index`
 *
 * @param sink - storage destination (write buffer in production, adapter in tests)
 *
 * @returns counters describing what happened
 *
 * @example
 * ```ts
 * await processEvent(
 *   { kind: 'comment.created', resourceId: 'i1' },
 *   3,
 *   42,
 *   storageOrBuffer,
 * );
 * ```
 */
export async function processEvent(
  event: EventInput,
  _sequenceNumber: number,
  eventId: number,
  sink: Storage | WriteBuffer,
): Promise<ProcessEventResult> {
  const context = await resolveContext(event,);
  if (context === null) {
    l.debug(
      `skipping event ${String(eventId,)} for unknown issue ${event.resourceId}`,
    );
    return {
      fanout: 0,
      skipped: 0,
      written: 0,
      discarded: 0,
    };
  }
  const keys = dependenciesFor(
    event,
    context,
  );
  let skipped = 0;
  let written = 0;
  let discarded = 0;

  // Render in declared order. Phase 2+ adds parallel rendering via
  // p-limit; for Phase 1 the synchronous in-request dispatcher only
  // sees one event at a time.
  for (const fragmentKey of keys) {
    // oxlint-disable-next-line no-await-in-loop -- per-fragment serialisation by design
    const previousHash = await existingContentHash(fragmentKey,);
    // oxlint-disable-next-line no-await-in-loop -- pure-DB-read render runs sequentially in Phase 1
    const result = await renderFragment(fragmentKey,);
    if (previousHash === result.contentHash) {
      skipped += 1;
      continue;
    }
    // Use the globally monotonic `events.id` as the sequence guard.
    // Per-resource sequences are not safe across cross-resource fragments
    // (e.g. a filter list whose membership depends on many issues): a
    // later event for resource B can carry a smaller per-resource
    // sequence than an earlier event for resource A but still represents
    // the latest state at write time. `sequenceNumber` stays in the
    // event log for telemetry; `eventId` is what the fragment_index
    // races on.
    // oxlint-disable-next-line no-await-in-loop -- sequence-guarded upsert must observe prior writes
    const accepted = await upsertFragmentIndexIfNewer({
      fragmentKey,
      contentHash: result.contentHash,
      lastBuiltAt: Date.now(),
      sourceEventId: eventId,
      sourceEventSequence: eventId,
    },);
    if (!accepted) {
      l.debug(
        `sequence guard rejected fragment write: ${fragmentKey} eventId=${
          String(eventId,)
        }`,
      );
      discarded += 1;
      continue;
    }
    if ('enqueue' in sink) {
      sink.enqueue({
        key: fragmentKey,
        body: result.body,
      },);
    }
    else {
      // oxlint-disable-next-line no-await-in-loop -- raw adapter sink awaits per write
      await sink.put(
        fragmentKey,
        result.body,
      );
    }
    written += 1;
  }

  return {
    fanout: keys.size,
    skipped,
    written,
    discarded,
  };
}

/**
 * Loads the metadata that the dependency graph needs for an issue event.
 *
 * @param event - event header
 *
 * @returns resolved context, or `null` when the issue does not exist
 */
async function resolveContext(event: EventInput,): Promise<ResolvedEventContext | null> {
  const issueId = event.resourceId;
  const issue = await getIssue(issueId,);
  if (issue === undefined)
    return null;
  const issueLabels = await listIssueLabels(issueId,);
  const repoLabels = await listRepoLabels(issue.repo_id,);
  const state: IssueStateFacet = issue.state === 'closed' ? 'closed' : 'open';
  return {
    repoId: issue.repo_id,
    issueLabelIds: issueLabels.map(function pickId(label,) {
      return label.id;
    },),
    repoLabelIds: repoLabels.map(function pickId(label,) {
      return label.id;
    },),
    issueState: state,
  };
}

/**
 * Re-export for tests that want to drive the dispatcher with a typed event kind.
 */
export type { EventKind, };
