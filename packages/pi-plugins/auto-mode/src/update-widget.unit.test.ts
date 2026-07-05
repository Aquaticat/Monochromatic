/**
 * Tests for auto-mode widget rendering.
 *
 * @module
 */

import type { ExtensionContext, } from '@earendil-works/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { updateWidget, } from './ask-user.ts';

/** Widget name used by auto-mode status updates. */
const AUTO_MODE_WIDGET_NAME = 'auto-mode';

/** Widget update captured from mock extension UI. */
type WidgetUpdate = {
  /** Widget identifier passed to `setWidget`. */
  readonly name: string;
  /** Whether widget was cleared instead of rendered. */
  readonly cleared: boolean;
  /** Widget lines passed to `setWidget` when rendered. */
  readonly lines?: readonly string[];
};

/** Flow verdict shape consumed by {@link updateWidget}. */
type FlowVerdictFixture = {
  /** Action text associated with verdict. */
  readonly action: string;
  /** Verdict label rendered or ignored by widget summary. */
  readonly verdict: string;
  /** Verdict explanation associated with action. */
  readonly reason: string;
};

/**
 * Create extension context whose widget API records calls.
 *
 * @param updates - stores widget updates for assertions
 *
 * @returns mock extension context sufficient for {@link updateWidget}
 *
 * @example
 * ```typescript
 * const updates = [];
 * const ctx = createWidgetContext({ updates });
 * ```
 */
function createWidgetContext(
  {
    updates,
  }: {
    readonly updates: WidgetUpdate[];
  },
): ExtensionContext {
  return {
    ui: {
      setWidget(
        name: string,
        lines?: readonly string[],
      ): void {
        if (lines === undefined) {
          updates.push({
            name,
            cleared: true,
          },);
          return;
        }

        updates.push({
          name,
          cleared: false,
          lines,
        },);
      },
    },
  } as unknown as ExtensionContext;
}

await describe({
  name: updateWidget.name,
  children: [
    it({
      name: 'clears widget when flow has only approvals',
      fn: async function clearsWidgetWhenFlowHasOnlyApprovals() {
        /** Widget updates emitted by {@link updateWidget}. */
        const updates: WidgetUpdate[] = [];
        /** Approved verdicts that should not create visible widget text. */
        const verdicts = [
          {
            action: 'read README.md',
            verdict: 'approved',
            reason: 'Safe read.',
          },
        ] as const satisfies readonly FlowVerdictFixture[];

        updateWidget({
          ctx: createWidgetContext({ updates, },),
          verdicts,
        },);

        expect(updates,).toEqual([
          {
            name: AUTO_MODE_WIDGET_NAME,
            cleared: true,
          },
        ],);
      },
    },),

    it({
      name: 'renders denied count without approved count',
      fn: async function rendersDeniedCountWithoutApprovedCount() {
        /** Widget updates emitted by {@link updateWidget}. */
        const updates: WidgetUpdate[] = [];
        /** Mixed verdicts where approvals should not appear in widget text. */
        const verdicts = [
          {
            action: 'read README.md',
            verdict: 'approved',
            reason: 'Safe read.',
          },
          {
            action: 'write .env',
            verdict: 'denied',
            reason: 'Secret file.',
          },
          {
            action: 'read package.json',
            verdict: 'approved',
            reason: 'Safe read.',
          },
          {
            action: 'bash: deploy production',
            verdict: 'denied',
            reason: 'Production change.',
          },
        ] as const satisfies readonly FlowVerdictFixture[];

        updateWidget({
          ctx: createWidgetContext({ updates, },),
          verdicts,
        },);

        expect(updates,).toEqual([
          {
            name: AUTO_MODE_WIDGET_NAME,
            cleared: false,
            lines: ['2 denied',],
          },
        ],);
      },
    },),
  ],
},);
