import type { StopInput, } from '@monochromatic-dev/claude-code-plugin-hook-type/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  AUTO_CONTINUE_ENV,
  autoContinueActive,
  autoContinueEnabled,
  autoContinueReason,
  DISABLING_VALUES,
  UNSET_SETTING,
} from './auto-continue.ts';
import {
  stopRemindersDecision,
  stopRemindersHandler,
} from './index.ts';

/**
 * Fields a test varies on the built stop event; anything omitted keeps its default.
 */
type StopEventOverrides = {
  readonly stop_hook_active?: boolean;
  readonly last_assistant_message?: string;
};

/**
 * Stop event with every field the handler reads, so each test varies one thing.
 *
 * @param overrides - fields replacing defaults on built event
 *
 * @returns event shaped like Claude Code's `Stop` payload
 *
 * @example
 * ```ts
 * stopEvent({ stop_hook_active: true });
 * ```
 */
function stopEvent(overrides: StopEventOverrides = {},): StopInput {
  return {
    session_id: 'test-session',
    transcript_path: '/dev/null',
    cwd: '/tmp',
    permission_mode: 'default',
    hook_event_name: 'Stop',
    stop_hook_active: false,
    last_assistant_message: 'Done.',
    ...overrides,
  };
}

await describe({
  name: 'stop-reminder forced continuation',
  children: [
    describe({
      name: autoContinueEnabled.name,
      children: [
        it({
          name: 'defaults to enabled when the kill switch is unset',
          fn: async () => {
            expect(autoContinueEnabled(UNSET_SETTING,),).toBe(true,);
          },
        },),
        it({
          name: 'stays enabled for an unrecognized value',
          fn: async () => {
            expect(autoContinueEnabled('yes',),).toBe(true,);
          },
        },),
        it({
          name: 'disables on every documented disabling value',
          fn: async () => {
            for (const value of DISABLING_VALUES) {
              expect(autoContinueEnabled(value,),).toBe(false,);
            }
          },
        },),
        it({
          name: 'normalizes surrounding space and letter case',
          fn: async () => {
            expect(autoContinueEnabled('  OFF  ',),).toBe(false,);
          },
        },),
        it({
          name: 'names the kill switch with the repository environment prefix',
          fn: async () => {
            expect(AUTO_CONTINUE_ENV,).toBe('MONOCHROMATIC_STOP_AUTO_CONTINUE',);
          },
        },),
        it({
          name: 'reads the kill switch from this process without re-deciding it',
          fn: async () => {
            expect(autoContinueActive(),).toBe(
              autoContinueEnabled(process.env[AUTO_CONTINUE_ENV] ?? UNSET_SETTING,),
            );
          },
        },),
      ],
    },),

    describe({
      name: autoContinueReason.name,
      children: [
        it({
          name: 'instructs the agent to keep status prose rather than suppress it',
          fn: async () => {
            expect(autoContinueReason()
              .join(' ',),).toContain('do not delete, shorten, or rephrase it',);
          },
        },),
        it({
          name: 'offers a blocker path so a genuine stop can be explained',
          fn: async () => {
            expect(autoContinueReason()
              .join(' ',),).toContain('name the concrete blocker',);
          },
        },),
        it({
          name: 'routes a decision-blocked agent to AskUserQuestion rather than to a stop',
          fn: async () => {
            // That tool waits for the user, so it is the one exit that gets the agent
            // what stopping was reaching for, and the hook has nothing to refuse.
            expect(autoContinueReason()
              .join(' ',),).toContain('AskUserQuestion',);
          },
        },),
      ],
    },),

    describe({
      name: stopRemindersDecision.name,
      children: [
        it({
          name: "blocks a clean response that would otherwise have been allowed",
          fn: async () => {
            expect(stopRemindersDecision({ event: stopEvent(), forcedContinuationAllowed: true, },).decision,)
              .toBe("block",);
          },
        },),
        it({
          name: "still blocks inside a chain, where the quality detectors no longer apply",
          fn: async () => {
            const output = stopRemindersDecision({
              event: stopEvent({ stop_hook_active: true, last_assistant_message: "This probably works.", },),
              forcedContinuationAllowed: true,
            },);

            expect(output.decision,).toBe("block",);
            expect(output.reason,).not.toContain("uncertain language",);
          },
        },),
        it({
          name: "reports hedging on the first stop of a chain",
          fn: async () => {
            expect(stopRemindersDecision({
              event: stopEvent({ last_assistant_message: "This probably works.", },),
              forcedContinuationAllowed: true,
            },).reason,).toContain("uncertain language",);
          },
        },),
        it({
          name: "allows a clean stop once forced continuation is disallowed",
          fn: async () => {
            expect(stopRemindersDecision({ event: stopEvent(), forcedContinuationAllowed: false, },),)
              .toEqual({},);
          },
        },),
        it({
          name: "still reports hedging while forced continuation is disallowed",
          fn: async () => {
            const output = stopRemindersDecision({
              event: stopEvent({ last_assistant_message: "This probably works.", },),
              forcedContinuationAllowed: false,
            },);

            expect(output.decision,).toBe("block",);
            expect(output.reason,).toContain("uncertain language",);
          },
        },),
        it({
          name: "reports an uncited dismissal on the first stop of a chain",
          fn: async () => {
            expect(stopRemindersDecision({
              event: stopEvent({ last_assistant_message: "This project doesn't use that.", },),
              forcedContinuationAllowed: true,
            },).reason,).toContain("categorical dismissal",);
          },
        },),
        it({
          name: "suppresses the dismissal report inside a chain, leaving only continuation",
          fn: async () => {
            const output = stopRemindersDecision({
              event: stopEvent({ stop_hook_active: true, last_assistant_message: "This project doesn't use that.", },),
              forcedContinuationAllowed: true,
            },);

            expect(output.decision,).toBe("block",);
            expect(output.reason,).not.toContain("categorical dismissal",);
            expect(output.reason,).toContain("Resume the next item now",);
          },
        },),
        it({
          name: "yields precedence to a trailing question instead of contradicting it",
          fn: async () => {
            const output = stopRemindersDecision({
              event: stopEvent({ last_assistant_message: "Which package should I migrate first?", },),
              forcedContinuationAllowed: true,
            },);

            expect(output.reason,).toContain("AskUserQuestion",);
            expect(output.reason,).not.toContain("Resume the next item now",);
          },
        },),
        it({
          name: "wires the handler through to a real block on a live event",
          fn: async () => {
            expect((await stopRemindersHandler(stopEvent(),)).decision,).toBe("block",);
          },
        },),
      ],
    },),
  ],
},);
