/**
 * Session context builder for the judge prompt.
 *
 * Walks session branch and preserves complete user-visible messages from
 * larger of newest message floor and span beginning at latest user message.
 *
 * @module
 */

import type { ExtensionContext, } from '@earendil-works/pi-coding-agent';
import type { ForeignHostCapability, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import {
  isTrustEntry,
  isVerdictEntry,
  type VerdictData,
} from './types.ts';
import { serializeUntrustedDataForJudge, } from './tool-helpers.ts';
import { buildVisibleContext, } from './visible-context.ts';

/**
 * Loaded Pi context file supplied to coding agent system prompt.
 *
 * @example
 * ```typescript
 * const contextFile: ProjectContextFile = {
 *   path: '/project/AGENTS.md',
 *   content: 'Run builds through mise.',
 * };
 * ```
 */
type ProjectContextFile = {
  /** Absolute context-file path reported by Pi. */
  readonly path: string;
  /** Complete loaded context-file content. */
  readonly content: string;
};

/**
 * Build isolated canonical project-context data for judge request.
 *
 * Copies only path and content from Pi-owned records before serialization so
 * later host mutation cannot change active judge context.
 *
 * @param contextFiles - context files loaded into coding agent prompt
 *
 * @returns canonical request-only JSON, or empty string when none loaded
 *
 * @example
 * ```typescript
 * const context = buildProjectContext([
 *   { path: '/project/AGENTS.md', content: 'Use mise.' },
 * ]);
 * ```
 */
function buildProjectContext(
  contextFiles: readonly ProjectContextFile[] | undefined,
): string {
  /** Owned path/content records preserving Pi load order. */
  const isolatedContextFiles = (contextFiles ?? [])
    .map(function isolateContextFile(
      contextFile,
    ): ProjectContextFile {
      return {
        path: contextFile.path,
        content: contextFile.content,
      };
    },);
  return isolatedContextFiles.length === 0
    ? ''
    : serializeUntrustedDataForJudge(isolatedContextFiles,);
}

/**
 * Reusable approval lookup result.
 *
 * Uses a positive discriminant so callers must handle missing or superseded
 * approvals explicitly.
 *
 * @example
 * ```typescript
 * const approval: ReusableApproval = { reusable: false };
 * ```
 */
type ReusableApproval =
  | {
    /**
     * Whether session history contains reusable approval.
     */
    readonly reusable: true;
    /**
     * Prior approval reason to surface in audit logs and widgets.
     */
    readonly reason: string;
    /**
     * Approval source used to distinguish judge and user approvals.
     */
    readonly source: 'approve' | 'user-approve';
  }
  | {
    /**
     * Whether session history contains reusable approval.
     */
    readonly reusable: false;
  };

/**
 * Get active trust directives from the session.
 *
 * Walks the branch looking for entries matched by {@link isTrustEntry}.
 * A `null` data value acts as a reset sentinel (clears all prior directives).
 *
 * @param ctx - extension context with session access
 *
 * @returns array of active trust directive strings
 *
 * @mutates ctx - `getBranch` may update host-owned session caches while producing branch snapshot
 *
 * @example
 * ```typescript
 * const directives = getTrustDirectives(ctx);
 * ```
 */
function getTrustDirectives(
  ctx: ForeignHostCapability<ExtensionContext>,
): string[] {
  /**
   * Accumulator for currently-active trust directives.
   */
  const directives: string[] = [];
  for (const entry of ctx.sessionManager
    .getBranch()) {
    if (isTrustEntry(entry,)) {
      if (entry.data
        === null)
        directives.length = 0;
      else
        directives.push(entry.data,);
    }
  }
  return directives;
}

/**
 * Find reusable approval for an action in current session history.
 *
 * Scans the active branch backward for entries matched by
 * {@link isVerdictEntry} and only reuses approval when latest verdict
 * for the exact action and approval fingerprint is an approval. A later denial
 * for same action and fingerprint disables reuse, so stale approvals cannot
 * override newer user or judge decisions.
 *
 * @param ctx - extension context with session access
 *
 * @param action - exact action description produced by {@link describeAction}
 *
 * @param approvalFingerprint - exact guarded tool-call fingerprint
 *
 * @returns reusable approval metadata, or a negative result
 *
 * @mutates ctx - `getBranch` may update host-owned session caches while producing branch snapshot
 *
 * @example
 * ```typescript
 * const approval = getReusableApproval({
 *   ctx,
 *   action: 'read .env',
 *   approvalFingerprint: 'abc123',
 * });
 * if (approval.reusable) console.log(approval.reason);
 * ```
 */
function getReusableApproval(
  {
    ctx,
    action,
    approvalFingerprint,
  }: {
    readonly ctx: ForeignHostCapability<ExtensionContext>;
    readonly action: string;
    readonly approvalFingerprint: string;
  },
): ReusableApproval {
  /**
   * Current branch snapshot; entries before forks outside this branch are intentionally ignored.
   */
  const branch = ctx.sessionManager
    .getBranch();

  for (let loopIndex = branch.length
    - 1; loopIndex >= 0; loopIndex--) {
    /**
     * Branch entry inspected while walking newest to oldest.
     */
    const entry = branch[loopIndex];
    if (entry === undefined)
      continue;
    if (!isVerdictEntry(entry,))
      continue;
    /**
     * Verdict payload from matching custom entry.
     */
    const {
      action: verdictAction,
      approvalFingerprint: verdictApprovalFingerprint,
      reason,
      reusedFromVerdict,
      verdict,
    } = entry.data;
    if (verdictAction
      !== action)
      continue;
    if (verdictApprovalFingerprint === undefined)
      return { reusable: false, };
    if (verdictApprovalFingerprint
      !== approvalFingerprint)
      continue;

    if ((verdict
      === 'approve') || (verdict
      === 'user-approve')) {
      return {
        reusable: true,
        reason,
        source: reusedFromVerdict
          ?? verdict,
      };
    }

    return { reusable: false, };
  }

  return { reusable: false, };
}

/**
 * Build complete user-visible session-message context for LLM judge.
 *
 * Includes larger of newest message floor and complete span from latest user
 * message. Message data uses same Pi session-entry projection as interactive
 * transcript and preserves complete visible text,
 * thinking,
 * tool inputs,
 * tool outputs,
 * images,
 * custom messages,
 * direct Bash execution,
 * and summaries.
 *
 * @param ctx - extension context with session access
 *
 * @returns formatted context summary string
 *
 * @mutates ctx - `buildContextEntries` may update host-owned session caches while producing visible transcript entries
 *
 * @example
 * ```typescript
 * const context = buildContext(ctx);
 * ```
 */
function buildContext(
  ctx: ForeignHostCapability<ExtensionContext>,
): string {
  return buildVisibleContext(
    ctx.sessionManager
      .buildContextEntries(),
  );
}

export {
  buildContext,
  buildProjectContext,
  getReusableApproval,
  getTrustDirectives,
};
export type { ProjectContextFile, };
