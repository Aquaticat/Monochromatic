/**
 * Bypass mode state, audit entries, and UI feedback.
 *
 * Keeps the shortcut implementation in the entry point small while preserving
 * visible and session-auditable bypass transitions.
 *
 * @module
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import type { ForeignHostCapability, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

//region Constants

/**
 * Discriminator for bypass toggle and bypass-allow session audit entries.
 */
const BYPASS_ENTRY_TYPE = 'auto-mode:bypass';

/**
 * Keyboard shortcut used by auto-mode to toggle bypass mode.
 */
const BYPASS_SHORTCUT = 'shift+tab';

/**
 * Footer status key used for the bypass indicator.
 */
const BYPASS_STATUS_KEY = 'auto-mode:bypass';

/**
 * Footer status text displayed while bypass mode is active.
 */
const BYPASS_STATUS_TEXT = 'auto-mode: bypass';

/**
 * Session-entry kind for toggling bypass mode.
 */
const BYPASS_TOGGLE_KIND = 'toggle';

/**
 * Session-entry kind for tool calls allowed while bypass mode is active.
 */
const BYPASS_ALLOW_KIND = 'allow';

/**
 * Source label for shortcut-driven bypass toggles.
 */
const BYPASS_SOURCE_SHORTCUT = 'shortcut';

/**
 * Audit reason stored on tool calls allowed by bypass mode.
 */
const BYPASS_ALLOW_REASON = 'auto-mode bypass enabled';

//endregion Constants

//region Types

/**
 * Minimal custom session entry shape needed for bypass state restoration.
 */
type SessionCustomEntry = {
  /**
   * Session entry discriminator.
   */
  readonly type: string;
  /**
   * Custom entry type emitted through `pi.appendEntry`.
   */
  readonly customType?: unknown;
  /**
   * Custom entry payload.
   */
  readonly data?: unknown;
};

/**
 * Session payload recorded when bypass mode is toggled.
 */
type BypassToggleData = {
  /**
   * Entry kind so future bypass audit payloads can share the same custom type.
   */
  readonly kind: typeof BYPASS_TOGGLE_KIND;
  /**
   * New bypass state after the toggle.
   */
  readonly enabled: boolean;
  /**
   * UI action that produced this toggle.
   */
  readonly source: typeof BYPASS_SOURCE_SHORTCUT;
};

/**
 * Session payload recorded when a tool call is allowed under bypass mode.
 */
type BypassAllowData = {
  /**
   * Entry kind for per-tool bypass audit rows.
   */
  readonly kind: typeof BYPASS_ALLOW_KIND;
  /**
   * Human-readable tool action that bypass mode allowed.
   */
  readonly action: string;
  /**
   * Reason explaining why the guardrail did not evaluate the action.
   */
  readonly reason: typeof BYPASS_ALLOW_REASON;
};

/**
 * Union of payloads recorded under {@link BYPASS_ENTRY_TYPE}.
 */
type BypassEntryData = BypassToggleData | BypassAllowData;

//endregion Types

//region Guards

/**
 * Check whether a value is a non-null object with string keys.
 *
 * @param value - candidate value read from session history
 *
 * @returns whether `value` can be inspected as a record
 *
 * @example
 * ```typescript
 * isRecord({ kind: 'toggle' });
 * ```
 */
function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  if ((typeof value)
    !== 'object') {
    return false;
  }
  return value !== null;
}

/**
 * Check whether unknown session payload is a bypass-toggle entry.
 *
 * @param data - custom entry data read from session history
 *
 * @returns whether `data` can restore bypass state
 *
 * @example
 * ```typescript
 * isBypassToggleData({ kind: 'toggle', enabled: true, source: 'shortcut' });
 * ```
 */
function isBypassToggleData(
  data: unknown,
): data is BypassToggleData {
  if (!isRecord(data,))
    return false;
  if (data.kind !== BYPASS_TOGGLE_KIND)
    return false;
  if ((typeof data.enabled)
    !== 'boolean') {
    return false;
  }
  return data.source === BYPASS_SOURCE_SHORTCUT;
}

/**
 * Check whether a session entry carries bypass-toggle data.
 *
 * @param entry - session branch entry
 *
 * @returns whether `entry` is a bypass-toggle custom entry
 *
 * @example
 * ```typescript
 * isBypassToggleEntry({ type: 'custom', customType: 'auto-mode:bypass', data: { kind: 'toggle', enabled: true, source: 'shortcut' } });
 * ```
 */
function isBypassToggleEntry(
  entry: SessionCustomEntry,
): entry is SessionCustomEntry & { readonly data: BypassToggleData; } {
  if (entry.type !== 'custom')
    return false;
  if (entry.customType !== BYPASS_ENTRY_TYPE)
    return false;
  return isBypassToggleData(entry.data,);
}

//endregion Guards

//region Public helpers

/**
 * Read latest bypass toggle from the active session branch.
 *
 * @param ctx - extension context exposing session history
 *
 * @returns latest bypass state, or disabled when no toggle exists
 *
 * @mutates ctx - `getBranch` may update host-owned session caches while producing branch snapshot
 *
 * @example
 * ```typescript
 * const enabled = findLatestBypassEnabled({ ctx });
 * ```
 */
function findLatestBypassEnabled(
  {
    ctx,
  }: {
    readonly ctx: ForeignHostCapability<ExtensionContext>;
  },
): boolean {
  /**
   * Session branch entries normalized to the custom-entry subset used by bypass restoration.
   */
  const branchEntries: SessionCustomEntry[] = ctx.sessionManager
    .getBranch()
    .map(
      function normalizeSessionEntry(entry: Readonly<SessionCustomEntry>,) {
        return {
          type: entry.type,
          ...('customType' in entry ? { customType: entry.customType, } : {}),
          ...('data' in entry ? { data: entry.data, } : {}),
        };
      },
    );
  /**
   * Latest bypass-toggle entry on the active branch, if any.
   */
  const latestEntry = branchEntries
    .toReversed()
    .find(
      function isLatestBypassToggleEntry(entry,) {
        return isBypassToggleEntry(entry,);
      },
    );
  if (latestEntry === undefined)
    return false;
  /**
   * Payload from the latest bypass-toggle entry.
   */
  const latestData = latestEntry.data;
  return latestData.enabled;
}

/**
 * Update footer status to reflect current bypass state.
 *
 * @param ctx - extension context whose UI receives the status update
 *
 * @param enabled - current bypass state
 *
 * @mutates ctx - `ctx.ui.setStatus` changes displayed Pi status state
 *
 * @example
 * ```typescript
 * updateBypassStatus({ ctx, enabled: true });
 * ```
 */
function updateBypassStatus(
  {
    ctx,
    enabled,
  }: {
    readonly ctx: ForeignHostCapability<ExtensionContext>;
    readonly enabled: boolean;
  },
): void {
  ctx.ui
    .setStatus(
    BYPASS_STATUS_KEY,
    enabled ? BYPASS_STATUS_TEXT : undefined,
  );
}

/**
 * Append an audit entry for a bypass toggle.
 *
 * @param pi - extension API used to persist custom entries
 *
 * @param enabled - new bypass state
 *
 * @mutates pi - `pi.appendEntry` appends bypass-toggle Pi session state
 *
 * @example
 * ```typescript
 * appendBypassToggleEntry({ pi, enabled: true });
 * ```
 */
function appendBypassToggleEntry(
  {
    pi,
    enabled,
  }: {
    readonly pi: ForeignHostCapability<ExtensionAPI>;
    readonly enabled: boolean;
  },
): void {
  pi.appendEntry(
    BYPASS_ENTRY_TYPE,
    {
      kind: BYPASS_TOGGLE_KIND,
      enabled,
      source: BYPASS_SOURCE_SHORTCUT,
    } satisfies BypassEntryData,
  );
}

/**
 * Append an audit entry for a tool call allowed by bypass mode.
 *
 * @param pi - extension API used to persist custom entries
 *
 * @param action - human-readable action bypass mode allowed
 *
 * @mutates pi - `pi.appendEntry` appends bypass-allow Pi session state
 *
 * @example
 * ```typescript
 * appendBypassAllowEntry({ pi, action: 'read /repo/.env' });
 * ```
 */
function appendBypassAllowEntry(
  {
    pi,
    action,
  }: {
    readonly pi: ForeignHostCapability<ExtensionAPI>;
    readonly action: string;
  },
): void {
  pi.appendEntry(
    BYPASS_ENTRY_TYPE,
    {
      kind: BYPASS_ALLOW_KIND,
      action,
      reason: BYPASS_ALLOW_REASON,
    } satisfies BypassEntryData,
  );
}

/**
 * Notify user that bypass state changed and keep footer status in sync.
 *
 * @param ctx - extension context whose UI receives feedback
 *
 * @param enabled - new bypass state
 *
 * @mutates ctx - `updateBypassStatus` and `ctx.ui.notify` change displayed Pi state
 *
 * @example
 * ```typescript
 * announceBypassToggle({ ctx, enabled: false });
 * ```
 */
function announceBypassToggle(
  {
    ctx,
    enabled,
  }: {
    readonly ctx: ForeignHostCapability<ExtensionContext>;
    readonly enabled: boolean;
  },
): void {
  updateBypassStatus({
    ctx,
    enabled,
  },);
  ctx.ui
    .notify(
    enabled
      ? 'Auto-mode bypass enabled: tool calls will run without judge checks.'
      : 'Auto-mode bypass disabled: guardrail checks restored.',
    enabled ? 'warning' : 'info',
  );
}

//endregion Public helpers

export {
  announceBypassToggle,
  appendBypassAllowEntry,
  appendBypassToggleEntry,
  BYPASS_ALLOW_KIND,
  BYPASS_ALLOW_REASON,
  BYPASS_ENTRY_TYPE,
  BYPASS_SHORTCUT,
  BYPASS_SOURCE_SHORTCUT,
  BYPASS_STATUS_KEY,
  BYPASS_STATUS_TEXT,
  BYPASS_TOGGLE_KIND,
  findLatestBypassEnabled,
  updateBypassStatus,
};
export type {
  BypassAllowData,
  BypassEntryData,
  BypassToggleData,
};
