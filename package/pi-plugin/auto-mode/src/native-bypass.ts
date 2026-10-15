/**
 Native host bypass uses the original session audit format and fixed virtual-input guard. @module
 */
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolCallEvent,
  ToolCallEventResult
} from '@earendil-works/pi-coding-agent';
import type {
  ForeignBorrowed,
  ForeignHostCapability
} from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import {
  announceBypassToggle,
  appendBypassAllowEntry,
  appendBypassToggleEntry,
  BYPASS_SHORTCUT,
  findLatestBypassEnabled,
  updateBypassStatus
} from './bypass.ts';
import { describeAction } from './tool-helpers.ts';
import { guardVirtualInput } from './virtual-input-guard.ts';

/**
 Native diagnostics identify explicit user control separately from policy approval.
 */
const l = tagged({ tag: 'auto-mode-native-bypass' });

//region Original session entries are the sole source of explicit bypass state.
/**
 Read bypass from the current native session branch without retaining stale extension context.

 @param ctx - current native session context

 @returns explicit user bypass state recorded in this branch

 @mutates ctx - session branch reading may update native caches

 @example readNativeBypassEnabled(ctx);
 */
export function readNativeBypassEnabled(ctx: ForeignHostCapability<ExtensionContext>): boolean {
  return findLatestBypassEnabled({ ctx });
}

/**
 Register the original shortcut, status restoration, audit events, and fixed input guard.

 @param pi - current native resource loader's extension API

 @mutates pi - registers native shortcut and session event handlers

 @example registerNativeBypass(pi);
 */
export function registerNativeBypass(pi: ForeignHostCapability<ExtensionAPI>): void {
  /**
   Registration diagnostics omit borrowed API contents.
   */
  const rl = tagged({
    tag: registerNativeBypass.name,
    l
  });
  rl.debug('registering native explicit bypass control');
  pi.registerShortcut(
    BYPASS_SHORTCUT,
    {
    description: 'Toggle auto-mode bypass',
    handler(ctx: ForeignHostCapability<ExtensionContext>): void {
      /**
       Toggle selection uses the active branch, including after reload or navigation.
       */
      const enabled = !readNativeBypassEnabled(ctx);
      tagged({ tag: 'toggleNativeBypass', l: rl })
        .warn(enabled ? 'explicit bypass enabled' : 'explicit bypass disabled');
      appendBypassToggleEntry({
        pi,
        enabled
      });
      announceBypassToggle({
        ctx,
        enabled
      });
    },
  }
  );
  /**
   Restore the existing visible status from the currently selected branch.

   @param ctx - current native session context

   @mutates ctx - updates displayed bypass status
   */
  function restoreStatus(ctx: ForeignHostCapability<ExtensionContext>): void {
    tagged({
      tag: restoreStatus.name,
      l: rl
    })
      .debug('restoring native bypass status from current branch');
    updateBypassStatus({
      ctx,
      enabled: readNativeBypassEnabled(ctx)
    });
  }
  pi.on(
    'session_start',
    function restoreSession(
      _event: unknown,
      ctx
    ) { restoreStatus(ctx); }
  );
  pi.on(
    'session_tree',
    function restoreBranch(
      _event: unknown,
      ctx
    ) { restoreStatus(ctx); }
  );
  pi.on(
    'tool_call',
    function guardNativeTool(
      event: ForeignBorrowed<ToolCallEvent>,
      ctx: ForeignHostCapability<ExtensionContext>
    ): Readonly<{ decision?: ToolCallEventResult }>['decision'] {
    /**
     Fixed safety policy precedes explicit bypass and remains active in both modes.
     */
    const decision = guardVirtualInput(event);
    if (decision.block) {
      tagged({ tag: guardNativeTool.name, l: rl })
        .warn('fixed virtual-input guard blocked native tool');
      return decision;
    }
    if (readNativeBypassEnabled(ctx)) {
      tagged({ tag: guardNativeTool.name, l: rl })
        .warn('recording explicit native bypass tool admission');
      appendBypassAllowEntry({
        pi,
        action: describeAction(event)
      });
    }
    return undefined;
  }
  );
}
//endregion
